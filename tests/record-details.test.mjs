import test from 'node:test';
import assert from 'node:assert/strict';
import {readRecordDetail, readEmployeeProfile, readOwnProfile} from '../lib/record-details.js';

const admin = {email: 'admin@acme.test', role: 'admin', workspaceId: 'acme'};
const employee = {email: 'person@acme.test', role: 'employee', workspaceId: 'acme'};
function fakeDatabase() {
  const data = {
    employees: [
      {id: 'person', workspaceId: 'acme', employeeCode: 'EMP-001', email: employee.email, name: 'Same Name'},
      {id: 'coworker', workspaceId: 'acme', employeeCode: 'EMP-002', email: 'coworker@acme.test', name: 'Same Name'},
      {id: 'person', workspaceId: 'other', employeeCode: 'EMP-003', email: employee.email, name: 'Same Name'},
    ],
    requests: [
      {id: 'own-request', workspaceId: 'acme', owner: employee.email},
      {id: 'coworker-request', workspaceId: 'acme', owner: 'coworker@acme.test'},
      {id: 'other-tenant-request', workspaceId: 'other', owner: employee.email},
    ],
    compensation: [
      {id: 'own-compensation', workspaceId: 'acme', owner: employee.email},
      {id: 'coworker-compensation', workspaceId: 'acme', owner: 'coworker@acme.test'},
    ],
    reviews: [{id: 'own-review', workspaceId: 'acme', owner: employee.email}],
    memberships: [{id: 'member', workspaceId: 'acme', email: employee.email, memberCode: 'MEM-001'}],
    announcements: [{id: 'announcement', workspaceId: 'acme', title: 'Team event'}],
  };
  const queries = [];
  const matches = (row, query) => Object.entries(query).every(([key, value]) => key === '$and' ? value.every(part => matches(row, part)) : row[key] === value);
  return {
    queries,
    collection(resource) {
      const rows = data[resource] || [];
      return {
        async findOne(query) {queries.push({resource, query}); const row = rows.find(row => matches(row, query)); return row ? {...row} : null;},
        find(query) {queries.push({resource, query}); const cursor = {sort() {return cursor;}, limit() {return cursor;}, async toArray() {return rows.filter(row => matches(row, query)).map(row => ({...row}));}}; return cursor;},
        async countDocuments(query) {queries.push({resource, query}); return rows.filter(row => matches(row, query)).length;},
      };
    },
  };
}

test('employee detail access rejects coworkers and foreign tenants even when record IDs match', async () => {
  const db = fakeDatabase();
  await assert.rejects(readEmployeeProfile(db, employee, 'coworker'), error => error.status === 404);
  const result = await readEmployeeProfile(db, employee, 'person');
  assert.equal(result.employee.workspaceId, 'acme');
  assert.deepEqual(result.requests.map(row => row.id), ['own-request']);
  assert.deepEqual(result.compensation.map(row => row.id), ['own-compensation']);
  assert.deepEqual(result.counts, {requests: 1, reviews: 1, compensation: 1});
});

test('manager profile bundles join related private records by email and tenant, never by a shared name', async () => {
  for (const role of ['admin', 'hr']) {
    const result = await readEmployeeProfile(fakeDatabase(), {...admin, role}, 'person');
    assert.deepEqual(result.requests.map(row => row.id), ['own-request']);
    assert.deepEqual(result.compensation.map(row => row.id), ['own-compensation']);
  }
});

test('generic details preserve resource permissions and personal owner restrictions', async () => {
  const db = fakeDatabase();
  await assert.rejects(readRecordDetail(db, employee, 'compensation', 'coworker-compensation'), error => error.status === 404);
  await assert.rejects(readRecordDetail(db, {...admin, role: 'hr'}, 'memberships', 'member'), error => error.status === 403);
  await assert.rejects(readRecordDetail(db, employee, 'compliance', 'check'), error => error.status === 403);
  assert.equal((await readRecordDetail(db, employee, 'announcements', 'announcement')).title, 'Team event');
  assert.equal((await readRecordDetail(db, admin, 'memberships', 'member')).memberCode, 'MEM-001');
});

test('detail lookups reject absent identity, unsupported resources, malformed IDs and missing rows', async () => {
  const db = fakeDatabase();
  await assert.rejects(readRecordDetail(db, {}, 'employees', 'person'), error => error.status === 401);
  await assert.rejects(readRecordDetail(db, admin, 'uploads', 'person'), error => error.status === 404);
  await assert.rejects(readRecordDetail(db, admin, 'employees', {$ne: null}), error => error.status === 400);
  await assert.rejects(readRecordDetail(db, admin, 'employees', 'missing'), error => error.status === 404);
});


test('self-profile looks up the normalized account email directly within its tenant', async () => {
  const db = fakeDatabase();
  const result = await readOwnProfile(db, {...employee, email: 'PERSON@ACME.TEST'});
  assert.equal(result.employee.id, 'person');
  assert.deepEqual(db.queries[0], {resource: 'employees', query: {workspaceId: 'acme', email: employee.email}});
  assert.deepEqual(result.requests.map(row => row.id), ['own-request']);
  assert.deepEqual(result.compensation.map(row => row.id), ['own-compensation']);
});

test('self-profile never substitutes a coworker or another tenant for an unlinked account', async () => {
  assert.deepEqual(await readOwnProfile(fakeDatabase(), admin), {employee: null});
  assert.deepEqual(await readOwnProfile(fakeDatabase(), {...employee, workspaceId: 'missing'}), {employee: null});
  await assert.rejects(readOwnProfile(fakeDatabase(), {email: employee.email}), error => error.status === 401);
});

test('manager self-profile remains ownership-scoped if the employee email changes during lookup', async () => {
  let reads = 0;
  const db = {collection() {return {async findOne(query) {reads++; if (reads === 1) return {id: 'reassigned-profile'}; assert.equal(query.workspaceId, 'acme'); assert.equal(query.email, admin.email); return null;}};}};
  assert.deepEqual(await readOwnProfile(db, admin), {employee: null});
  assert.equal(reads, 2);
});
