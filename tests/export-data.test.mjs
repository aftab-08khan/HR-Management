import test from 'node:test';
import assert from 'node:assert/strict';
import {reportData, safeCsvCell, createCsvReport, createPdfReport, reportFileName} from '../lib/export-data.js';

test('exports use an explicit business schema and omit internal metadata and photo URLs', () => {
  const report = reportData('employees', [{employeeCode: 'EMP-001', name: 'Team Member', salary: 50000, workspaceId: 'secret-tenant', id: 'internal-id', owner: 'private-owner', photoUrl: '/api/uploads/private'}]);
  assert.equal(report.headers[0], 'Employee ID');
  assert.equal(report.rows[0][0], 'EMP-001');
  for (const internal of ['workspaceId', 'id', 'owner', 'photoUrl']) assert.equal(report.fields.includes(internal), false);
  assert.equal(report.rows.length, 1);
  assert.throws(() => reportData('uploads', []), /cannot be exported/);
});

test('CSV preserves multiline Unicode values and escapes spreadsheet formulas and quoted cells', () => {
  assert.equal(safeCsvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(safeCsvCell('  +SUM(A1:A2)'), '"\'  +SUM(A1:A2)"');
  assert.equal(safeCsvCell('Line one\nLine "two"'), '"Line one\nLine ""two"""');
  const csv = createCsvReport('employees', [{employeeCode: 'EMP-001', name: 'عبد الله', email: 'person@example.test'}], 'ar');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('معرف الموظف'));
  assert.ok(csv.includes('عبد الله'));
  assert.ok(csv.endsWith('\r\n'));
});

test('PDF reports produce a complete paginated PDF without exporting internal metadata', async () => {
  const rows = Array.from({length: 100}, (_, index) => ({employeeCode: `EMP-${index + 1}`, name: `Team Member ${index + 1}`, email: `person${index + 1}@example.test`, role: 'Designer', department: 'Product', status: 'Full-time', location: 'Dubai', joined: '2026-01-05', salary: 80000 + index}));
  const bytes = await createPdfReport('employees', rows, {workspaceName: 'Acme Company', generatedAt: new Date('2026-10-24T12:00:00Z')});
  const raw = new TextDecoder('latin1').decode(bytes);
  assert.ok(raw.startsWith('%PDF-'));
  assert.ok(raw.trimEnd().endsWith('%%EOF'));
  assert.ok((raw.match(/\/Type \/Page\b/g) || []).length > 1);
  assert.equal(reportFileName('employees', 'pdf', new Date('2026-10-24T12:00:00Z')), 'peopleos-employees-2026-10-24.pdf');
  await assert.rejects(createPdfReport('employees', [], {locale: 'ar'}), /Arabic report font/);
});


test('download filenames use the Dubai calendar at UTC day and year boundaries', () => {
  assert.equal(reportFileName('employees', 'pdf', new Date('2026-10-23T21:00:00Z')), 'peopleos-employees-2026-10-24.pdf');
  assert.equal(reportFileName('employees', 'csv', new Date('2026-12-31T21:00:00Z')), 'peopleos-employees-2027-01-01.csv');
});
