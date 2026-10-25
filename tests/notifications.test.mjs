import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {encode, getToken} from 'next-auth/jwt';
import {notificationQuery, notificationRecipients, workflowEvents, connectNotificationSocket, resolveNotificationUser, socketOriginAllowed} from '../lib/notifications.js';
import {parseCookies, upgradeRequestPath} from '../server.mjs';

const admin = {email: 'admin@acme.test', role: 'admin', workspaceId: 'acme', name: 'Administrator'};
const employee = {email: 'person@acme.test', role: 'employee', workspaceId: 'acme', name: 'Team Member'};
const hr = {email: 'hr@acme.test', role: 'hr', workspaceId: 'acme', name: 'People Partner'};

test('notification visibility always binds tenant, recipient, actor exclusion, and current role', () => {
  assert.deepEqual(notificationQuery(employee), {workspaceId: 'acme', recipientEmail: 'person@acme.test', actorEmail: {$ne: 'person@acme.test'}, audience: {$in: ['all', 'recipient']}});
  assert.equal(notificationQuery(hr).audience.$in.includes('managers'), true);
  assert.deepEqual(notificationQuery({...admin, workspaceId: 'other'}).workspaceId, 'other');
  assert.throws(() => notificationQuery({...employee, role: undefined}), /membership required/);
});

test('materialized recipients include active intended members and exclude the actor', () => {
  const members = [admin, hr, employee, {...employee, email: 'suspended@acme.test', status: 'Suspended'}, {...employee, email: 'invalid@acme.test', role: 'superadmin'}].map(member => ({status: 'Active', ...member}));
  assert.deepEqual(notificationRecipients(members, {audience: 'managers'}, admin.email), [hr.email]);
  assert.deepEqual(notificationRecipients(members, {audience: 'recipient', recipientEmail: employee.email}, hr.email), [employee.email]);
  assert.deepEqual(notificationRecipients(members, {audience: 'all'}, employee.email), [admin.email, hr.email]);
});

test('workflow notifications route submissions to managers and decisions only to the request owner', () => {
  const request = {name: employee.name, type: 'Reimbursement', status: 'Pending', owner: employee.email};
  assert.equal(workflowEvents(employee, 'compensation', 'POST', request)[0].audience, 'managers');
  const decisions = workflowEvents(hr, 'compensation', 'PUT', {...request, status: 'Approved'}, request);
  assert.equal(decisions[0].audience, 'recipient');
  assert.equal(decisions[0].recipientEmail, employee.email);
  assert.equal(workflowEvents(employee, 'compensation', 'PUT', {...request, status: 'Approved'}, request).length, 0);
  assert.equal(workflowEvents(admin, 'announcements', 'POST', {title: 'Team meeting'})[0].audience, 'all');
  assert.equal(workflowEvents(admin, 'compliance', 'POST', {title: 'Policy review', status: 'Action needed'})[0].page, 'Compliance');
});

function fakeDatabase() {
  let membership = {...hr, status: 'Active'};
  let credentialVersion = 'before-reset';
  const notifications = [
    {id: 'manager', workspaceId: 'acme', recipientEmail: hr.email, audience: 'managers', actorEmail: employee.email, read: false},
    {id: 'personal', workspaceId: 'acme', recipientEmail: hr.email, audience: 'recipient', actorEmail: admin.email, read: false},
    {id: 'other-recipient', workspaceId: 'acme', recipientEmail: employee.email, audience: 'all', actorEmail: admin.email, read: false},
    {id: 'other-tenant', workspaceId: 'other', recipientEmail: hr.email, audience: 'all', actorEmail: admin.email, read: false},
  ];
  const matches = (row, query) => Object.entries(query).every(([key, value]) => typeof value === 'object' ? value.$in ? value.$in.includes(row[key]) : row[key] !== value.$ne : row[key] === value);
  return {
    setMember(value) {membership = value;},
    setCredentialVersion(value) {credentialVersion = value;},
    collection(name) {
      if (name === 'credentials') return {async findOne(query) {return query.workspaceId === 'acme' && query.email === hr.email ? {sessionVersion: credentialVersion} : null;}};
      if (name === 'memberships') return {async findOne(query) {return membership && matches(membership, query) ? membership : null;}};
      if (name === 'workspaces') return {async findOne(query) {return query.id === 'acme' ? {id: 'acme'} : null;}};
      if (name === 'notifications') return {
        find(query) {const cursor = {sort() {return cursor;}, limit() {return cursor;}, async toArray() {return notifications.filter(row => matches(row, query));}}; return cursor;},
        async countDocuments(query) {return notifications.filter(row => matches(row, query)).length;},
      };
      throw new Error(`Unexpected collection ${name}`);
    },
  };
}
class FakeSocket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  messages = [];
  send(message) {this.messages.push(JSON.parse(message));}
  close(code, reason) {this.closed = {code, reason}; this.readyState = 3; this.emit('close');}
  ping() {}
  terminate() {this.readyState = 3; this.emit('close');}
}

test('WebSocket delivery isolates recipients and removes manager events immediately after demotion', async () => {
  const db = fakeDatabase();
  const socket = new FakeSocket();
  const connection = connectNotificationSocket(socket, {...hr, exp: Math.floor(Date.now() / 1000) + 300}, {db});
  await connection.ready;
  assert.deepEqual(socket.messages[0].items.map(row => row.id), ['manager', 'personal']);
  assert.equal(socket.messages[0].type, 'notifications');
  assert.equal(socket.messages[0].unreadCount, 2);
  db.setMember({...hr, role: 'employee', status: 'Active'});
  await connection.refresh();
  assert.deepEqual(socket.messages.at(-1).items.map(row => row.id), ['personal']);
  db.setMember({...hr, status: 'Suspended'});
  await connection.refresh();
  assert.equal(socket.closed.code, 4403);
});

test('WebSocket sessions fail closed on expiration, missing membership, and unsupported messages', async () => {
  const db = fakeDatabase();
  assert.equal(await resolveNotificationUser(db, {...hr, workspaceId: 'other'}), null);
  const expired = new FakeSocket();
  const first = connectNotificationSocket(expired, {...hr, exp: 1}, {db});
  await first.ready;
  assert.equal(expired.messages.length, 0);
  assert.equal(expired.closed.code, 4401);
  const invalid = new FakeSocket();
  const second = connectNotificationSocket(invalid, {...hr, exp: Math.floor(Date.now() / 1000) + 300}, {db});
  await second.ready;
  invalid.emit('message', Buffer.from('{"type":"setRole","role":"admin"}'), false);
  assert.equal(invalid.closed.code, 1008);
});

test('WebSocket upgrades require an explicit same-host or configured origin and parse signed-cookie chunks', () => {
  assert.equal(socketOriginAllowed('http://localhost:3000', 'localhost:3000'), true);
  assert.equal(socketOriginAllowed('https://people.example', 'internal:3000', 'https://people.example'), true);
  for (const origin of [undefined, 'null', 'https://evil.example', 'http://localhost:3001', 'javascript:alert(1)']) assert.equal(socketOriginAllowed(origin, 'localhost:3000'), false);
  assert.deepEqual(parseCookies('other=ignored; next-auth.session-token.0=first%2Epart; next-auth.session-token.1=second'), {other: 'ignored', 'next-auth.session-token.0': 'first.part', 'next-auth.session-token.1': 'second'});
});


test('WebSocket cookie authentication decodes signed NextAuth tokens and rejects tampering', async () => {
  const secret = 'test-only-nextauth-secret-for-websocket-verification';
  const encrypted = await encode({token: {...hr}, secret, maxAge: 60});
  const req = {headers: {}, cookies: parseCookies(`next-auth.session-token=${encodeURIComponent(encrypted)}`)};
  const verified = await getToken({req, secret});
  assert.equal(verified.email, hr.email);
  assert.equal(verified.workspaceId, 'acme');
  assert.ok(verified.exp > Math.floor(Date.now() / 1000));
  assert.equal(await getToken({req, secret: 'a-different-secret'}), null);
  const broken = encrypted.slice(0, -4) + 'xxxx';
  assert.equal(await getToken({req: {headers: {}, cookies: parseCookies(`next-auth.session-token=${broken}`)}, secret}), null);
});


test('malformed upgrade targets fail safely before reaching WebSocket routing', () => {
  for (const target of ['//[', 'http://[', undefined, {}, 'x'.repeat(8193)]) assert.equal(upgradeRequestPath(target), null);
  assert.equal(upgradeRequestPath('/api/live?source=dashboard'), '/api/live');
  assert.equal(upgradeRequestPath('/_next/hmr'), '/_next/hmr');
});


test('password-reset revocation stops an existing WebSocket on its next refresh while Google is unaffected', async () => {
  const db = fakeDatabase();
  const identity = {...hr, authMethod: 'credentials', credentialVersion: 'before-reset', exp: Math.floor(Date.now() / 1000) + 300};
  const socket = new FakeSocket();
  const connection = connectNotificationSocket(socket, identity, {db});
  await connection.ready;
  assert.equal(socket.messages.length, 1);
  db.setCredentialVersion('after-reset');
  assert.equal(await resolveNotificationUser(db, identity), null);
  await connection.refresh();
  assert.equal(socket.closed.code, 4403);
  assert.equal(socket.messages.length, 1);
  const google = await resolveNotificationUser(db, {...identity, authMethod: 'google', verifiedGoogle: true});
  assert.equal(google.email, hr.email);
  // HTTP callers already pass a role validated by NextAuth's version-aware JWT callback;
  // the public session user deliberately omits internal credential-version claims.
  const httpUser = await resolveNotificationUser(db, {...hr, verifiedGoogle: false});
  assert.equal(httpUser.email, hr.email);
});
