import {privateJson, readJsonBody} from '@/lib/http-response';
import {getServerSession} from 'next-auth';
import {authOptions, resolveMembership} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {normalizeEmail, validIdentity} from '@/lib/access';
import {canUploadForEmployee, inspectUploadedImage, MAX_UPLOAD_BYTES} from '@/lib/media';
import {validRequestOrigin} from '@/lib/request-origin';

export const runtime = 'nodejs';
const error = (message, status) => privateJson({error: message}, {status});
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 16384;

// Bound multipart parsing even when a client omits or falsifies Content-Length.
async function readUploadForm(req) {
  if (Number(req.headers.get('content-length')) > MAX_REQUEST_BYTES) throw Object.assign(new Error('Upload is too large'), {status: 413});
  if (!req.body) throw Object.assign(new Error('Choose a profile image'), {status: 400});
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error('Upload is too large'), {status: 413});
      }
      chunks.push(Buffer.from(value));
    }
  } finally {reader.releaseLock();}
  try {
    return await new Response(Buffer.concat(chunks), {headers: {'Content-Type': req.headers.get('content-type')}}).formData();
  } catch {throw Object.assign(new Error('Invalid image upload'), {status: 400});}
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!validIdentity(session?.user)) return error('Sign in to an active workspace first', 401);
    const membership = await resolveMembership(session.user.email, session.user.workspaceId);
    if (!membership) return error('Workspace access revoked', 403);
    const user = {...session.user, role: membership.role, workspaceId: membership.workspaceId, email: normalizeEmail(session.user.email)};
    if (!validRequestOrigin(req)) return error('Invalid request origin', 403);
    if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'multipart/form-data') return error('Send a multipart image upload', 415);
    const form = await readUploadForm(req);
    if ([...form.keys()].some(key => !['file', 'employeeId'].includes(key)) || form.getAll('file').length !== 1 || form.getAll('employeeId').length !== 1) return error('Send one image and an employee ID', 400);
    const employeeId = form.get('employeeId');
    if (typeof employeeId !== 'string' || !employeeId.trim() || employeeId.length > 160) return error('An existing employee ID is required', 400);
    const db = await database();
    const employee = await db.collection('employees').findOne({workspaceId: user.workspaceId, id: employeeId});
    if (!canUploadForEmployee(user, employee)) return error('Employee not found', 404);
    const image = await inspectUploadedImage(form.get('file'));
    const id = crypto.randomUUID();
    const url = `/api/uploads/${id}`;
    const ownerEmail = normalizeEmail(employee.email);
    const now = new Date().toISOString();
    await db.collection('uploads').insertOne({id, workspaceId: user.workspaceId, ownerEmail, employeeId, ...image, createdAt: now});
    // Email is an ownership snapshot: a concurrent reassignment cannot attach this image to another person.
    const result = await db.collection('employees').updateOne({id: employeeId, workspaceId: user.workspaceId, email: employee.email}, {$set: {photoUrl: url, updatedAt: now}});
    if (!result.matchedCount) {
      await db.collection('uploads').deleteOne({id, workspaceId: user.workspaceId}).catch(() => {});
      return error('The employee profile changed. Refresh and try again.', 409);
    }
    return privateJson({id, url, photoUrl: url, employeeId, ownerEmail}, {status: 201, headers: {'Cache-Control': 'private, no-store'}});
  } catch (cause) {return error(cause.status ? cause.message : 'Unable to save profile image', cause.status || 503);}
}
