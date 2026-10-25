import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEmployeeCode, generatedRecordCode, backfillRecordCodes} from '../lib/codes.js';

test('custom employee codes are canonicalized and constrained to a safe readable format', () => {
  assert.equal(normalizeEmployeeCode('  staff_004-a '), 'STAFF_004-A');
  for (const value of ['AB', 'A'.repeat(33), '-ABC', 'ABC DEF', '<script>', 'الموظف', undefined, 123]) assert.equal(normalizeEmployeeCode(value), null);
});

test('default employee and member codes are deterministic while legacy employee IDs remain readable', () => {
  assert.equal(generatedRecordCode('employees', 'EMP-001'), 'EMP-001');
  assert.equal(generatedRecordCode('employees', 'tenant-EMP-001'), 'EMP-001');
  const id = 'b5a7d310-97c1-4dc5-86fe-ec9aaa7880b8';
  assert.match(generatedRecordCode('employees', id), /^EMP-[A-F0-9]{12}$/);
  assert.equal(generatedRecordCode('employees', id), generatedRecordCode('employees', id));
  assert.match(generatedRecordCode('memberships', id), /^MEM-[A-F0-9]{12}$/);
  assert.notEqual(generatedRecordCode('employees', id, 1), generatedRecordCode('employees', id));
});

test('legacy code backfill writes only the authorized tenant and preserves custom values', async () => {
  const records = [{id: 'shared', workspaceId: 'acme'}, {id: 'shared', workspaceId: 'other'}, {id: 'custom', workspaceId: 'acme', employeeCode: 'STAFF-001'}];
  const writes = [];
  const db = {collection() {return {
    async updateOne(query, update) {writes.push(query); const row = records.find(row => row.id === query.id && row.workspaceId === query.workspaceId); if (!row || row.employeeCode) return {matchedCount: 0}; Object.assign(row, update.$set); return {matchedCount: 1};},
    async findOne(query) {return records.find(row => row.id === query.id && row.workspaceId === query.workspaceId);},
  };}};
  const rows = records.filter(row => row.workspaceId === 'acme').map(row => ({...row}));
  await backfillRecordCodes(db, 'employees', 'acme', rows);
  assert.equal(records[0].employeeCode, generatedRecordCode('employees', 'shared'));
  assert.equal(records[1].employeeCode, undefined);
  assert.equal(records[2].employeeCode, 'STAFF-001');
  assert.ok(writes.every(query => query.workspaceId === 'acme'));
});

test('legacy backfill safely retries a code collision instead of overwriting another record', async () => {
  let calls = 0;
  const row = {id: 'legacy', workspaceId: 'acme'};
  const db = {collection() {return {async updateOne(query, update) {calls++; if (calls === 1) throw Object.assign(new Error('Duplicate code'), {code: 11000}); Object.assign(row, update.$set); return {matchedCount: 1};}};}};
  await backfillRecordCodes(db, 'employees', 'acme', [row]);
  assert.equal(calls, 2);
  assert.equal(row.employeeCode, generatedRecordCode('employees', 'legacy', 1));
});
