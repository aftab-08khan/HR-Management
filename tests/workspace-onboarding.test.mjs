import test from 'node:test';
import assert from 'node:assert/strict';
import {provisionWorkspace, authOptions} from '../lib/auth.js';

const googleUser = {email: 'Owner@Acme.test', name: 'Workspace Owner', verifiedGoogle: true};
function memoryDatabase(initialMembers = [], {failMembershipOnce = false} = {}) {
  const store = new Map([['memberships', initialMembers.map(row => ({...row}))]]);
  const matches = (row, query) => Object.entries(query).every(([key, value]) => row[key] === value);
  function rows(name) {if (!store.has(name)) store.set(name, []); return store.get(name);}
  return {
    store,
    collection(name) {
      return {
        async findOne(query) {return rows(name).find(row => matches(row, query)) || null;},
        async findOneAndUpdate(query, update) {
          let row = rows(name).find(row => matches(row, query));
          if (!row) {row = {...query, ...update.$setOnInsert}; rows(name).push(row);}
          if (update.$set) Object.assign(row, update.$set);
          return row;
        },
        async updateOne(query, update, options = {}) {
          if (name === 'memberships' && failMembershipOnce) {failMembershipOnce = false; throw new Error('Simulated connection interruption');}
          let row = rows(name).find(row => matches(row, query));
          if (!row && options.upsert) {row = {...query, ...update.$setOnInsert}; rows(name).push(row);}
          if (row && update.$set) Object.assign(row, update.$set);
          return {matchedCount: row ? 1 : 0};
        },
      };
    },
  };
}

test('only verified Google identities without membership can create a workspace', async () => {
  for (const user of [{email: googleUser.email}, {...googleUser, verifiedGoogle: false}, {...googleUser, role: 'employee'}]) await assert.rejects(provisionWorkspace(user, 'Acme', memoryDatabase()), error => [401, 409].includes(error.status));
  for (const name of ['', 'A', 'x'.repeat(81), {name: 'Acme'}, 'Company\nName']) await assert.rejects(provisionWorkspace(googleUser, name, memoryDatabase()), error => error.status === 400);
});

test('onboarding assigns a server generated tenant and administrator role to the verified email', async () => {
  const db = memoryDatabase();
  const result = await provisionWorkspace({...googleUser, workspaceId: 'forged-tenant'}, '  Acme  ', db);
  assert.match(result.id, /^ws-[0-9a-f-]{36}$/);
  assert.notEqual(result.id, 'forged-tenant');
  assert.equal(result.name, 'Acme');
  assert.equal(result.plan, 'Trial');
  const member = db.store.get('memberships')[0];
  assert.equal(member.workspaceId, result.id);
  assert.equal(member.email, 'owner@acme.test');
  assert.equal(member.role, 'admin');
  assert.equal(member.status, 'Active');
});

test('active and suspended memberships both block creating a fresh tenant', async () => {
  for (const status of ['Active', 'Suspended']) {
    const db = memoryDatabase([{workspaceId: 'existing', email: 'owner@acme.test', status}]);
    await assert.rejects(provisionWorkspace(googleUser, 'Another workspace', db), error => error.status === 409);
    assert.equal(db.store.has('workspaceProvisioning'), false);
    assert.equal(db.store.has('workspaces'), false);
  }
});

test('concurrent provisioning uses one email guard, one tenant, and one membership', async () => {
  const db = memoryDatabase();
  const result = await Promise.allSettled([provisionWorkspace(googleUser, 'First name', db), provisionWorkspace(googleUser, 'Second name', db)]);
  const successes = result.filter(row => row.status === 'fulfilled');
  assert.ok(successes.length >= 1);
  for (const row of successes) assert.equal(row.value.id, successes[0].value.id);
  assert.equal(db.store.get('workspaceProvisioning').length, 1);
  assert.equal(db.store.get('workspaces').length, 1);
  assert.equal(db.store.get('memberships').length, 1);
});

test('retry recovers an interrupted setup using the same reserved tenant', async () => {
  const db = memoryDatabase([], {failMembershipOnce: true});
  await assert.rejects(provisionWorkspace(googleUser, 'Acme', db), /interruption/);
  const reservedId = db.store.get('workspaceProvisioning')[0].workspaceId;
  const recovered = await provisionWorkspace(googleUser, 'Different retry name', db);
  assert.equal(recovered.id, reservedId);
  assert.equal(recovered.name, 'Acme');
  assert.equal(db.store.get('workspaces').length, 1);
  assert.equal(db.store.get('memberships').length, 1);
});

test('sessions expose Google verification only from the signed token', async () => {
  const unverified = await authOptions.callbacks.session({session: {user: {...googleUser}}, token: {email: googleUser.email}});
  assert.equal(unverified.user.verifiedGoogle, false);
  assert.equal(unverified.user.role, undefined);
  const verified = await authOptions.callbacks.session({session: {user: {email: googleUser.email}}, token: {verifiedGoogle: true, role: 'admin', workspaceId: 'real-tenant'}});
  assert.equal(verified.user.verifiedGoogle, true);
  assert.equal(verified.user.workspaceId, 'real-tenant');
});
