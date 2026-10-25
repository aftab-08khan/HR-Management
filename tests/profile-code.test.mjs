import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';
import {createEmployeePassPayload, parseEmployeePassPayload, resolveEmployeePass, resolveManualEmployeeCode} from '../lib/profile-code.js';

const employee = {id: 'internal-1', employeeCode: 'ACME-012', name: 'A person', email: 'private@example.com', salary: 10000, workspaceId: 'acme'};
const payload = createEmployeePassPayload(employee, 'acme');

test('employee passes include only scoped identifiers and survive a real QR round trip', async () => {
  assert.deepEqual(JSON.parse(payload), {app: 'peopleos', workspaceId: 'acme', employeeId: 'internal-1', employeeCode: 'ACME-012'});
  const png = await QRCode.toBuffer(payload, {width: 420, margin: 2});
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  assert.equal(result.data, payload);
  assert.equal(resolveEmployeePass(result.data, 'acme', [employee]), employee);
});

test('cross-workspace passes and mismatched authorized records are rejected', () => {
  assert.throws(() => parseEmployeePassPayload(payload, 'another-workspace'), /different workspace/);
  assert.throws(() => resolveEmployeePass(payload, 'acme', []), /not available/);
  assert.throws(() => resolveEmployeePass(payload, 'acme', [{...employee, workspaceId: 'other'}]), /not available/);
  assert.throws(() => resolveEmployeePass(payload, 'acme', [{...employee, id: 'different'}]), /not available/);
  assert.throws(() => resolveEmployeePass(payload, 'acme', [{...employee, employeeCode: 'CHANGED'}]), /not available/);
  assert.throws(() => createEmployeePassPayload(employee, 'another-workspace'), /different workspace/);
});

test('arbitrary URLs, application payloads, incomplete and oversized codes never resolve', () => {
  for (const value of ['https://example.com/profile', '/api/employees/internal-1', 'javascript:alert(1)', 'null', '[]', '{}', 'x'.repeat(1201), JSON.stringify({...JSON.parse(payload), app: 'another-app'}), JSON.stringify({...JSON.parse(payload), employeeCode: null}), JSON.stringify({...JSON.parse(payload), redirect: 'https://example.com'}), JSON.stringify({...JSON.parse(payload), employeeId: ''})]) assert.throws(() => resolveEmployeePass(value, 'acme', [employee]), /not a valid/);
  assert.throws(() => createEmployeePassPayload({...employee, employeeCode: ''}, 'acme'), /Add an employee ID/);
});

test('manual lookup is case-insensitive and never expands the authorized collection', () => {
  assert.equal(resolveManualEmployeeCode(' acme-012 ', 'acme', [employee]), employee);
  assert.throws(() => resolveManualEmployeeCode('ACME-012', 'acme', []), /No accessible employee/);
  assert.throws(() => resolveManualEmployeeCode('ACME-012', 'other', [employee]), /No accessible employee/);
  assert.throws(() => resolveManualEmployeeCode('ACME-012', 'acme', [employee, {...employee, id: 'duplicate'}]), /No accessible employee/);
  assert.throws(() => resolveManualEmployeeCode(' ', 'acme', [employee]), /Enter an employee ID/);
});
