import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {canReadUpload, canUploadForEmployee, inspectUploadedImage, MAX_UPLOAD_BYTES, validatePhotoPath} from '../lib/media.js';

const admin = {email: 'admin@acme.test', role: 'admin', workspaceId: 'acme'};
const hr = {...admin, email: 'hr@acme.test', role: 'hr'};
const employee = {...admin, email: 'Person@Acme.test', role: 'employee'};
const upload = {workspaceId: 'acme', ownerEmail: 'person@acme.test'};
const file = (bytes, type) => ({size: bytes.length, type, arrayBuffer: async () => bytes});

test('profile photo references accept only a local media ID or an explicit clear', () => {
  assert.equal(validatePhotoPath('/api/uploads/050aa98a-05ef-4a52-a06b-e401452ca709'), true);
  assert.equal(validatePhotoPath(''), true);
  for (const value of [null, undefined, {}, 'https://evil.test/photo.png', '//evil.test/photo.png', 'data:image/svg+xml,x', '/api/uploads/../memberships', '/api/uploads/050aa98a-05ef-4a52-a06b-e401452ca709?x=1', '/api/uploads/not-an-id']) assert.equal(validatePhotoPath(value), false);
});

test('photo reads require active role identity and isolate both tenants and employee ownership', () => {
  for (const user of [admin, hr, employee]) assert.equal(canReadUpload(user, upload), true);
  assert.equal(canReadUpload({...employee, email: 'coworker@acme.test'}, upload), false);
  assert.equal(canReadUpload(admin, {...upload, workspaceId: 'other'}), false);
  assert.equal(canReadUpload(employee, {...upload, ownerEmail: ''}), false);
  for (const user of [null, {...admin, role: 'unknown'}, {...admin, workspaceId: ''}]) assert.equal(canReadUpload(user, upload), false);
  assert.equal(canReadUpload(admin, null), false);
});

test('uploads require an existing same-tenant employee and permit employee self-service only', () => {
  const profile = {id: 'employee-1', workspaceId: 'acme', email: 'person@acme.test'};
  for (const user of [admin, hr, employee]) assert.equal(canUploadForEmployee(user, profile), true);
  assert.equal(canUploadForEmployee(employee, {...profile, email: 'coworker@acme.test'}), false);
  for (const user of [admin, hr, employee]) {
    assert.equal(canUploadForEmployee(user, {...profile, workspaceId: 'other'}), false);
    assert.equal(canUploadForEmployee(user, {...profile, id: ''}), false);
    assert.equal(canUploadForEmployee(user, {...profile, email: ''}), false);
    assert.equal(canUploadForEmployee(user, null), false);
  }
  assert.equal(canUploadForEmployee({...admin, role: 'unknown'}, profile), false);
});

test('valid JPEG, PNG and WebP uploads are decoded into clean bounded WebP images', async () => {
  for (const [format, type] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
    const original = await sharp({create: {width: 1200, height: 600, channels: 3, background: '#225566'}})[format]().withMetadata({exif: {IFD0: {Artist: 'Private metadata'}}}).toBuffer();
    const result = await inspectUploadedImage(file(original, type));
    assert.equal(result.mimeType, 'image/webp');
    assert.equal(result.width, 1024);
    assert.equal(result.height, 512);
    const metadata = await sharp(result.data).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.exif, undefined);
  }
});

test('image inspection rejects MIME spoofing, active formats, corruption and oversized files', async () => {
  const png = await sharp({create: {width: 2, height: 2, channels: 3, background: '#225566'}}).png().toBuffer();
  await assert.rejects(inspectUploadedImage(file(png, 'image/jpeg')), {status: 415});
  await assert.rejects(inspectUploadedImage(file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')), {status: 415});
  await assert.rejects(inspectUploadedImage(file(Buffer.from([255, 216, 255, 0]), 'image/jpeg')), {status: 400});
  await assert.rejects(inspectUploadedImage({size: MAX_UPLOAD_BYTES + 1, type: 'image/png', arrayBuffer: async () => {throw new Error('Must reject before reading');}}), {status: 413});
  await assert.rejects(inspectUploadedImage(null), {status: 400});
});

test('image inspection rejects excessive dimensions and animated WebP', async () => {
  const wide = await sharp({create: {width: 8200, height: 1, channels: 3, background: '#225566'}}).png().toBuffer();
  await assert.rejects(inspectUploadedImage(file(wide, 'image/png')), {status: 400});
  const animated = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), {raw: {width: 1, height: 2, channels: 3, pageHeight: 1}}).webp({loop: 0, delay: [100, 100]}).toBuffer();
  await assert.rejects(inspectUploadedImage(file(animated, 'image/webp')), {status: 400});
});
