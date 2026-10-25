import test from 'node:test';
import assert from 'node:assert/strict';
import {authOptions} from '../lib/auth.js';
import {hashPassword, verifyPassword, authenticateCredentials, createCredentialRateLimiter, setWorkspacePassword, validPassword, validCredentialEmail, credentialVersionMatches, LEGACY_CREDENTIAL_VERSION} from '../lib/credentials.js';

const passwordA = 'Acme-private-password-2026';
const passwordB = 'Other-private-password-2026';
const [hashA, hashB] = await Promise.all([hashPassword(passwordA), hashPassword(passwordB)]);
function database() {
  const records = {
    credentials: [{workspaceId: 'acme', email: 'person@example.test', passwordHash: hashA}, {workspaceId: 'other', email: 'person@example.test', passwordHash: hashB}],
    memberships: [{workspaceId: 'acme', email: 'person@example.test', name: 'Team Member', role: 'employee', status: 'Active'}, {workspaceId: 'other', email: 'person@example.test', name: 'Other Admin', role: 'admin', status: 'Active'}, {workspaceId: 'acme', email: 'admin@acme.test', name: 'Acme Admin', role: 'admin', status: 'Active'}],
    workspaces: [{id: 'acme', name: 'Acme'}, {id: 'other', name: 'Other'}],
  };
  const matches = (row, query) => Object.entries(query).every(([key, value]) => row[key] === value);
  return {records, collection(name) {
    const rows = records[name] || [];
    return {
      async findOne(query) {return rows.find(row => matches(row, query)) || null;},
      find(query) {let limit = Infinity; const cursor = {sort() {return cursor;}, limit(value) {limit = value; return cursor;}, async toArray() {return rows.filter(row => matches(row, query)).sort((a, b) => a.workspaceId.localeCompare(b.workspaceId)).slice(0, limit);}}; return cursor;},
      async updateOne(query, update, options) {let row = rows.find(row => matches(row, query)); if (!row && options?.upsert) {row = {...query, ...update.$setOnInsert}; rows.push(row);} Object.assign(row, update.$set); return {matchedCount: 1};},
    };
  }};
}
const noLimit = () => createCredentialRateLimiter({maxAttempts: 100});

test('passwords use distinct salted scrypt hashes, verify correctly, and reject malformed hashes', async () => {
  const second = await hashPassword(passwordA);
  assert.notEqual(hashA, second);
  assert.match(hashA, /^scrypt\$1\$/);
  assert.equal(hashA.includes(passwordA), false);
  assert.equal(await verifyPassword(passwordA, hashA), true);
  assert.equal(await verifyPassword(passwordB, hashA), false);
  for (const value of ['', 'sha256$plain', 'scrypt$999999999$bad$bad', `${hashA}$extra`]) assert.equal(await verifyPassword(passwordA, value), false);
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('x'.repeat(129)), false);
  assert.equal(validCredentialEmail('bad email'), false);
});

test('explicit tenant credentials cannot authenticate against another workspace or client-selected role', async () => {
  const db = database();
  const result = await authenticateCredentials(db, {workspaceId: 'acme', email: 'PERSON@example.test', password: passwordA, role: 'admin'}, {limiter: noLimit()});
  assert.equal(result.workspaceId, 'acme');
  assert.equal(result.role, 'employee');
  assert.equal(result.credentialsVerified, true);
  assert.equal(result.passwordHash, undefined);
  assert.equal(await authenticateCredentials(db, {workspaceId: 'other', email: 'person@example.test', password: passwordA}, {limiter: noLimit()}), null);
});

test('email-only login selects the matching authorized tenant deterministically', async () => {
  const db = database();
  assert.equal((await authenticateCredentials(db, {email: 'person@example.test', password: passwordA}, {limiter: noLimit()})).workspaceId, 'acme');
  const other = await authenticateCredentials(db, {email: 'person@example.test', password: passwordB}, {limiter: noLimit()});
  assert.equal(other.workspaceId, 'other');
  assert.equal(other.role, 'admin');
  assert.equal(await authenticateCredentials(db, {email: 'missing@example.test', password: passwordA}, {limiter: noLimit()}), null);
});

test('suspended membership or a deleted workspace prevents password login even with a correct hash', async () => {
  const db = database();
  db.records.memberships[0].status = 'Suspended';
  assert.equal(await authenticateCredentials(db, {workspaceId: 'acme', email: 'person@example.test', password: passwordA}, {limiter: noLimit()}), null);
  db.records.memberships[0].status = 'Active';
  db.records.workspaces.splice(0, 1);
  assert.equal(await authenticateCredentials(db, {workspaceId: 'acme', email: 'person@example.test', password: passwordA}, {limiter: noLimit()}), null);
});

test('only an active current-workspace administrator can reset an active member password', async () => {
  const db = database();
  const actor = {email: 'admin@acme.test', role: 'admin', workspaceId: 'acme'};
  const beforeOther = db.records.credentials[1].passwordHash;
  const result = await setWorkspacePassword(db, actor, {email: 'PERSON@example.test', password: 'New-Acme-password-2026'});
  assert.deepEqual(result, {ok: true, email: 'person@example.test', workspaceId: 'acme'});
  assert.equal(await verifyPassword('New-Acme-password-2026', db.records.credentials[0].passwordHash), true);
  assert.equal(db.records.credentials[1].passwordHash, beforeOther);
  await assert.rejects(setWorkspacePassword(db, {...actor, role: 'hr'}, {email: 'person@example.test', password: passwordA}), error => error.status === 403);
  await assert.rejects(setWorkspacePassword(db, actor, {email: 'foreign@example.test', password: passwordA}), error => error.status === 404);
  db.records.memberships.find(row => row.email === actor.email).status = 'Suspended';
  await assert.rejects(setWorkspacePassword(db, actor, {email: 'person@example.test', password: passwordA}), error => error.status === 403);
});

test('credential rate limits are bounded and reset only after success or the time window', () => {
  let clock = 0;
  const limiter = createCredentialRateLimiter({maxAttempts: 2, windowMs: 1000, now: () => clock});
  assert.equal(limiter.consume('account'), true);
  assert.equal(limiter.consume('account'), true);
  assert.equal(limiter.consume('account'), false);
  clock = 1001;
  assert.equal(limiter.consume('account'), true);
  limiter.clear('account');
  assert.equal(limiter.consume('account'), true);
});


test('credential JWT initialization retains the authorized tenant and fails closed during database outages', async () => {
  const previous = process.env.MONGODB_URI;
  process.env.MONGODB_URI = '';
  try {
    const token = await authOptions.callbacks.jwt({token: {email: 'person@example.test', workspaceId: 'other', role: 'admin'}, user: {id: 'acme:person@example.test', email: 'person@example.test', workspaceId: 'acme', role: 'employee', credentialsVerified: true}, account: {provider: 'credentials'}});
    assert.equal(token.workspaceId, 'acme');
    assert.equal(token.role, undefined);
    assert.equal(token.verifiedGoogle, false);
    assert.equal(await authOptions.callbacks.signIn({user: {email: 'person@example.test', workspaceId: 'acme', role: 'admin'}, account: {provider: 'credentials'}}), false);
  } finally {if (previous === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = previous;}
});


test('password reset rotates the tenant credential version and revokes earlier password sessions', async () => {
  const db = database();
  const actor = {email: 'admin@acme.test', role: 'admin', workspaceId: 'acme'};
  const previous = await authenticateCredentials(db, {workspaceId: 'acme', email: 'person@example.test', password: passwordA}, {limiter: noLimit()});
  assert.equal(previous.credentialVersion, LEGACY_CREDENTIAL_VERSION);
  assert.equal(await credentialVersionMatches(db, previous), true);
  await setWorkspacePassword(db, actor, {email: previous.email, password: 'Replaced-password-for-Acme'});
  const changed = db.records.credentials.find(row => row.workspaceId === 'acme');
  assert.match(changed.sessionVersion, /^[0-9a-f-]{36}$/);
  assert.equal(await credentialVersionMatches(db, previous), false);
  const current = await authenticateCredentials(db, {workspaceId: 'acme', email: previous.email, password: 'Replaced-password-for-Acme'}, {limiter: noLimit()});
  assert.equal(current.credentialVersion, changed.sessionVersion);
  assert.equal(await credentialVersionMatches(db, current), true);
  assert.equal(await credentialVersionMatches(db, {email: previous.email, workspaceId: 'other', credentialVersion: LEGACY_CREDENTIAL_VERSION}), true);
  assert.equal(await credentialVersionMatches(db, {email: previous.email, workspaceId: 'missing', credentialVersion: LEGACY_CREDENTIAL_VERSION}), false);
});

test('credential version and private password data are never exposed through the session user', async () => {
  const result = await authOptions.callbacks.session({session: {user: {email: 'person@example.test', credentialVersion: 'old', passwordHash: 'private', password: 'private'}}, token: {email: 'person@example.test', workspaceId: 'acme', role: 'employee', authMethod: 'credentials', credentialVersion: 'current-version'}});
  for (const field of ['credentialVersion', 'authMethod', 'credentialsVerified', 'password', 'passwordHash']) assert.equal(result.user[field], undefined);
  assert.equal(result.user.role, 'employee');
  assert.equal(result.user.verifiedGoogle, false);
});
