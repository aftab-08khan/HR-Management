import test from 'node:test';
import assert from 'node:assert/strict';
import {canRead, canWrite, canEditExisting, scopeQuery, employeeFields, validIdentity, normalizeEmail, validateRecord} from '../lib/access.js';

const admin = {email: 'admin@acme.test', role: 'admin', workspaceId: 'acme'};
const hr = {email: 'hr@acme.test', role: 'hr', workspaceId: 'acme'};
const employee = {email: 'Person@Acme.test', role: 'employee', workspaceId: 'acme'};

test('every resource is scoped to a verified tenant including administrator CRUD', () => {
  for (const resource of ['employees', 'requests', 'jobs', 'announcements', 'reviews', 'compliance', 'compensation', 'memberships', 'audit']) {
    assert.deepEqual(scopeQuery(admin, resource, 'record-1'), {workspaceId: 'acme', id: 'record-1'});
  }
  assert.deepEqual(scopeQuery({...admin, workspaceId: 'other'}, 'employees'), {workspaceId: 'other'});
  assert.throws(() => scopeQuery({...admin, workspaceId: ''}, 'employees'), /Access denied/);
  assert.throws(() => scopeQuery(admin, 'employees', {$ne: null}), /Invalid record ID/);
});

test('employees see only their profile and personally owned requests and payroll records', () => {
  assert.deepEqual(scopeQuery(employee, 'employees'), {workspaceId: 'acme', email: 'person@acme.test'});
  for (const resource of ['requests', 'reviews', 'compensation']) assert.deepEqual(scopeQuery(employee, resource), {workspaceId: 'acme', owner: 'person@acme.test'});
  for (const resource of ['jobs', 'announcements']) assert.deepEqual(scopeQuery(employee, resource), {workspaceId: 'acme'});
  assert.throws(() => scopeQuery(employee, 'memberships'), /Access denied/);
  assert.throws(() => scopeQuery(employee, 'compliance'), /Access denied/);
});

test('only administrators manage memberships; nobody edits audit history', () => {
  assert.equal(canWrite(admin, 'memberships', 'POST'), true);
  for (const user of [hr, employee]) {
    assert.equal(canRead(user, 'memberships'), false);
    for (const method of ['POST', 'PUT', 'DELETE']) assert.equal(canWrite(user, 'memberships', method), false);
  }
  for (const user of [admin, hr, employee]) for (const method of ['POST', 'PUT', 'DELETE']) assert.equal(canWrite(user, 'audit', method), false);
  assert.equal(canRead(hr, 'audit'), true);
  assert.equal(canRead(employee, 'audit'), false);
});

test('HR manages operational records while employee writes are limited to self service', () => {
  for (const resource of ['employees', 'requests', 'reviews', 'jobs', 'announcements', 'compliance', 'compensation']) assert.equal(canWrite(hr, resource, 'PUT'), true);
  for (const resource of ['employees', 'reviews', 'jobs', 'announcements', 'compliance']) assert.equal(canWrite(employee, resource, 'POST'), false);
  for (const resource of ['requests', 'compensation']) for (const method of ['POST', 'PUT', 'DELETE']) assert.equal(canWrite(employee, resource, method), true);
  assert.equal(canWrite(employee, 'DELETE'), false);
  assert.equal(canWrite(admin, 'employees', 'PATCH'), false);
});

test('employee edits reject another tenant, another employee, or reviewed requests', () => {
  const pending = {workspaceId: 'acme', owner: 'person@acme.test', status: 'Pending'};
  assert.equal(canEditExisting(employee, 'compensation', pending, 'PUT'), true);
  assert.equal(canEditExisting(employee, 'requests', {...pending, workspaceId: 'other'}, 'DELETE'), false);
  assert.equal(canEditExisting(employee, 'compensation', {...pending, owner: 'coworker@acme.test'}, 'PUT'), false);
  assert.equal(canEditExisting(employee, 'compensation', {...pending, status: 'Approved'}, 'DELETE'), false);
  assert.equal(canEditExisting(admin, 'employees', {...pending, workspaceId: 'other'}, 'PUT'), false);
});

test('employee request fields cannot set roles, tenant, identity, or approval decisions', () => {
  for (const resource of ['requests', 'compensation']) for (const field of ['role', 'workspaceId', 'status', 'name', 'owner', 'reviewNote']) assert.equal(employeeFields(resource, 'POST').includes(field), false);
  assert.deepEqual(employeeFields('compensation', 'PUT'), ['type', 'amount', 'currency', 'reason']);
  assert.deepEqual(employeeFields('requests', 'PUT'), ['type', 'from', 'to', 'reason']);
});

test('unknown roles, absent identity, and arbitrary resources fail closed', () => {
  for (const user of [null, {}, {...admin, role: 'owner'}, {...admin, email: ''}, {...admin, workspaceId: undefined}]) {
    assert.equal(validIdentity(user), false);
    assert.equal(canRead(user, 'employees'), false);
    assert.equal(canWrite(user, 'employees', 'POST'), false);
  }
  assert.equal(canRead(admin, 'workspaces'), false);
  assert.equal(normalizeEmail('  PERSON@Acme.test '), 'person@acme.test');
});


test('updating persisted records validates business fields without rejecting MongoDB metadata', () => {
  const persisted = {_id: {objectId: 'opaque-mongo-id'}, id: 'request-1', workspaceId: 'acme', owner: 'person@acme.test', createdAt: '2026-10-24T00:00:00Z', type: 'Reimbursement', amount: 120, currency: 'USD', reason: 'Travel receipt', status: 'Pending'};
  assert.equal(validateRecord('compensation', {...persisted, amount: 135}, false), null);
  assert.equal(validateRecord('compensation', {...persisted, amount: -1}, false), 'amount must be a nonnegative number');
  assert.equal(validateRecord('compensation', {...persisted, amount: {$gt: 0}}, false), 'Invalid field value');
  assert.equal(validateRecord('compensation', {...persisted, status: 'Paid'}, false), 'Invalid status');
});

test('record validation rejects missing fields, forged workspace roles, and invalid field types', () => {
  assert.equal(validateRecord('employees', {name: 'Example'}, true), 'Required fields are missing');
  assert.equal(validateRecord('employees', {name: 5, email: 'example@acme.test'}, true), 'Invalid field type');
  assert.equal(validateRecord('memberships', {email: 'person@acme.test', role: 'superadmin'}, true), 'Invalid workspace role');
  assert.equal(validateRecord('memberships', {email: 'person@acme.test', role: 'employee', status: 'Active'}, true), null);
  assert.equal(validateRecord('requests', {type: 'Annual leave', from: '2026-11-04', to: '2026-11-02'}, true), 'End date must follow start date');
});
