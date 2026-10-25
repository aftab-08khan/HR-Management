import sharp from 'sharp';
import {normalizeEmail, validIdentity} from './access.js';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
const PHOTO_PATH = /^\/api\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only server-hosted media IDs may be saved in an employee profile. */
export function validatePhotoPath(value) {
  return typeof value === 'string' && (value === '' || PHOTO_PATH.test(value));
}

export function canReadUpload(user, upload) {
  if (!validIdentity(user) || !upload || upload.workspaceId !== user.workspaceId) return false;
  return user.role !== 'employee' || (!!normalizeEmail(upload.ownerEmail) && normalizeEmail(upload.ownerEmail) === normalizeEmail(user.email));
}

export function canUploadForEmployee(user, employee) {
  if (!validIdentity(user) || !employee || employee.workspaceId !== user.workspaceId || !employee.id || !normalizeEmail(employee.email)) return false;
  return user.role !== 'employee' || normalizeEmail(employee.email) === normalizeEmail(user.email);
}

function mediaError(message, status) {
  return Object.assign(new Error(message), {status});
}

function imageMime(data) {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Decode and re-encode untrusted images, stripping metadata and appended payloads. */
export async function inspectUploadedImage(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size <= 0) throw mediaError('Choose a profile image', 400);
  if (file.size > MAX_UPLOAD_BYTES) throw mediaError('Profile images must be 2 MB or smaller', 413);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw mediaError('Use a JPEG, PNG, or WebP image', 415);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_UPLOAD_BYTES) throw mediaError('Profile images must be 2 MB or smaller', 413);
  if (imageMime(bytes) !== file.type) throw mediaError('The image contents do not match its file type', 415);
  try {
    const image = sharp(bytes, {animated: true, failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS});
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192 || metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw mediaError('Choose an image smaller than 16 megapixels', 400);
    if ((metadata.pages || 1) !== 1) throw mediaError('Choose a still profile image', 400);
    const {data, info} = await image.rotate().resize({width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true}).webp({quality: 88}).toBuffer({resolveWithObject: true});
    return {data, mimeType: 'image/webp', width: info.width, height: info.height};
  } catch (cause) {
    if (cause.status) throw cause;
    throw mediaError('This image could not be read. Choose a valid JPEG, PNG, or WebP image.', 400);
  }
}
