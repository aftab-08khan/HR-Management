import {privateJson, readJsonBody} from '@/lib/http-response';
import {getServerSession} from 'next-auth';
import {authOptions, resolveMembership} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {emitWorkflowNotifications} from '@/lib/notifications';
import {validatePhotoPath} from '@/lib/media';
import {backfillRecordCodes, generatedRecordCode, normalizeEmployeeCode} from '@/lib/codes';
import {canRead, canWrite, canEditExisting, employeeFields, normalizeEmail, RESOURCES, RESOURCE_FIELDS, scopeQuery, validIdentity, validateRecord} from '@/lib/access';
import {validRequestOrigin} from '@/lib/request-origin';

const error = (message, status) => privateJson({error: message}, {status});
const publicRecord = record => {const {_id, ...rest} = record; return rest;};

async function context(params, method = 'GET') {
  const {resource} = await params;
  if (!RESOURCES.includes(resource)) return {error: error('Not found', 404)};
  const session = await getServerSession(authOptions);
  if (!validIdentity(session?.user)) return {error: error('Sign in to an active workspace first', 401)};
  try {
    const membership = await resolveMembership(session.user.email, session.user.workspaceId);
    if (!membership) return {error: error('Workspace access revoked', 403)};
    const user = {...session.user, email: normalizeEmail(session.user.email), role: membership.role, workspaceId: membership.workspaceId};
    if (method === 'GET' ? !canRead(user, resource) : !canWrite(user, resource, method)) return {error: error('Your role does not permit this action', 403)};
    return {resource, user, db: await database()};
  } catch {return {error: error('Database unavailable', 503)};}
}

export async function GET(_req, {params}) {
  const c = await context(params);
  if (c.error) return c.error;
  try {
    const rows = await c.db.collection(c.resource).find(scopeQuery(c.user, c.resource), {projection: {_id: 0}}).sort(c.resource === 'audit' ? {createdAt: -1} : {createdAt: 1}).limit(1000).toArray();
    await backfillRecordCodes(c.db, c.resource, c.user.workspaceId, rows);
    return privateJson(rows);
  } catch {return error('Database unavailable', 503);}
}


async function notify(c, method, record, previous) {
  try {await emitWorkflowNotifications(c.db, c.user, c.resource, method, record, previous);}
  catch (cause) {console.error('Workspace notification write failed', cause.name);}
}

async function audit(c, method, id) {
  try {
    await c.db.collection('audit').insertOne({id: crypto.randomUUID(), workspaceId: c.user.workspaceId, actor: c.user.email, actorName: c.user.name, action: method === 'POST' ? 'Created' : method === 'DELETE' ? 'Deleted' : 'Updated', resource: c.resource, recordId: id, createdAt: new Date().toISOString()});
  } catch (cause) {console.error('Workspace audit write failed', cause.name);}
}

// Serialize membership changes so concurrent demotions cannot remove the last administrator.
async function acquireMembershipLock(c) {
  const lockId = crypto.randomUUID();
  const now = new Date();
  const workspace = await c.db.collection('workspaces').findOneAndUpdate({id: c.user.workspaceId, $or: [{membershipLock: {$exists: false}}, {'membershipLock.expiresAt': {$lt: now}}]}, {$set: {membershipLock: {id: lockId, expiresAt: new Date(now.getTime() + 30000)}}}, {returnDocument: 'after'});
  return workspace ? lockId : null;
}

async function mutate(req, params, method) {
  const c = await context(params, method);
  if (c.error) return c.error;
  if (!validRequestOrigin(req)) return error('Invalid request origin', 403);
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return error('Send an application/json record', 415);
  if (Number(req.headers.get('content-length')) > 64000) return error('Record is too large', 413);
  let data;
  try {data = await readJsonBody(req,64000);} catch(cause) {return error(cause.message||'Invalid JSON record',cause.status||400);}
  if (!data || typeof data !== 'object' || Array.isArray(data)) return error('Invalid record', 400);
  if (JSON.stringify(data).length > 64000) return error('Record is too large', 413);
  if (method !== 'POST' && (typeof data.id !== 'string' || !data.id || data.id.length > 160)) return error('Record ID required', 400);
  const allowed = c.user.role === 'employee' ? employeeFields(c.resource, method) : RESOURCE_FIELDS[c.resource];
  const record = Object.fromEntries(allowed.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
  if (record.email !== undefined) record.email = normalizeEmail(record.email);
  if (record.employeeCode !== undefined) {
    const code = normalizeEmployeeCode(record.employeeCode);
    if (!code) return error('Custom employee IDs must contain 3 to 32 letters, numbers, underscores or hyphens', 400);
    record.employeeCode = code;
  }
  let lockId;
  try {
    const col = c.db.collection(c.resource);
    if (c.resource === 'memberships') {
      lockId = await acquireMembershipLock(c);
      if (!lockId) return error('Another membership change is in progress. Please retry.', 409);
      // Recheck the actor after acquiring the workspace lock, including concurrent revocation.
      const actor = await c.db.collection('memberships').findOne({workspaceId: c.user.workspaceId, email: c.user.email, role: 'admin', status: 'Active'});
      if (!actor) return error('Administrator access revoked', 403);
    }
    const query = scopeQuery(c.user, c.resource, method === 'POST' ? undefined : data.id);
    const existing = method === 'POST' ? null : await col.findOne(query);
    if (method !== 'POST' && !existing) return error('Record not found', 404);
    if (existing && !canEditExisting(c.user, c.resource, existing, method)) return error('This record can no longer be changed', 403);
    // Include state in the write filter so a concurrent approval cannot be overwritten.
    if (existing && c.user.role === 'employee') {
      query.status = 'Pending';
    }
    if (method !== 'DELETE' && c.resource === 'employees' && record.photoUrl !== undefined) {
      if (!validatePhotoPath(record.photoUrl)) return error('Choose an uploaded profile image', 400);
      if (record.photoUrl) {
        if (!existing) return error('Save the employee profile before attaching a photo', 400);
        const uploadId = record.photoUrl.split('/').at(-1);
        const upload = await c.db.collection('uploads').findOne({id: uploadId, workspaceId: c.user.workspaceId, employeeId: existing.id, ownerEmail: normalizeEmail(record.email || existing.email)});
        if (!upload) return error('This image does not belong to the employee profile', 403);
      }
    }
    if (method !== 'DELETE') {
      const validation = validateRecord(c.resource, {...existing, ...record}, method === 'POST');
      if (validation) return error(validation, 400);
    }
    if (c.resource === 'memberships' && existing) {
      const bootstrapEmails = (process.env.ADMIN_EMAILS || '').split(',').map(normalizeEmail);
      if (method === 'DELETE' && c.user.workspaceId === process.env.WORKSPACE_ID?.trim() && bootstrapEmails.includes(existing.email)) return error('Suspend this bootstrap administrator instead of deleting the membership', 409);
      // Email is the stable identity. Invite a separate membership to change it.
      if (record.email && record.email !== existing.email) return error('Invite the new email as a separate member', 400);
      if (existing.role === 'admin' && existing.status === 'Active' && (method === 'DELETE' || (record.role && record.role !== 'admin') || record.status === 'Suspended')) {
        const count = await col.countDocuments({workspaceId: c.user.workspaceId, role: 'admin', status: 'Active'});
        if (count <= 1) return error('The workspace must retain an active administrator', 409);
      }
    }
    const now = new Date().toISOString();
    if (method === 'POST') {
      record.id = crypto.randomUUID();
      if (c.resource === 'employees') record.employeeCode ||= generatedRecordCode(c.resource, record.id);
      if (c.resource === 'memberships') record.memberCode = generatedRecordCode(c.resource, record.id);
      record.workspaceId = c.user.workspaceId;
      record.createdAt = now;
      if (c.resource === 'memberships') record.status ||= 'Active';
      else if (c.resource !== 'compliance') {
        record.owner = c.user.email;
        if (c.user.role !== 'employee' && ['requests', 'reviews', 'compensation'].includes(c.resource)) {
          const employee = typeof data.owner === 'string' ? await c.db.collection('employees').findOne({workspaceId: c.user.workspaceId, email: normalizeEmail(data.owner)}) : record.name ? await c.db.collection('employees').findOne({workspaceId: c.user.workspaceId, name: record.name}) : null;
          const member = typeof data.owner === 'string' ? await c.db.collection('memberships').findOne({workspaceId: c.user.workspaceId, email: normalizeEmail(data.owner)}) : null;
          if (data.owner && !employee && !member) return error('Employee does not belong to this workspace', 400);
          record.owner = employee?.email || member?.email || c.user.email;
        }
        if (c.user.role === 'employee') record.name = c.user.name || c.user.email;
      }
      if (['requests', 'compensation'].includes(c.resource)) record.status ||= 'Pending';
      if (c.resource === 'compensation') {record.currency ||= 'USD'; record.submittedAt = now;}
      if (c.resource === 'compliance') {record.status ||= 'Action needed'; record.priority ||= 'Medium';}
      if (c.resource === 'employees') {
        const duplicate = await col.findOne({workspaceId: c.user.workspaceId, email: record.email});
        if (duplicate) return error('This employee email already exists', 409);
      }
      await col.insertOne(record);
      await audit(c, method, record.id);
      await notify(c, method, record);
      return privateJson(publicRecord(record), {status: 201});
    }
    if (method === 'PUT') {
      record.updatedAt = now;
      if (c.resource === 'compensation' && c.user.role !== 'employee' && record.status && record.status !== 'Pending') {record.reviewedBy = c.user.email; record.reviewedAt = now;}
      const result = await col.updateOne(query, {$set: record});
      if (!result.matchedCount) return error('Record not found', 404);
    } else {
      const result = await col.deleteOne(query);
      if (!result.deletedCount) return error('Record not found', 404);
    }
    await audit(c, method, data.id);
    await notify(c, method, {...existing, ...record}, existing);
    return privateJson({ok: true});
  } catch (cause) {
    if (cause.code === 11000) return error('This record already exists in the workspace', 409);
    return error('Unable to save record', 503);
  } finally {
    if (lockId) await c.db.collection('workspaces').updateOne({id: c.user.workspaceId, 'membershipLock.id': lockId}, {$unset: {membershipLock: ''}}).catch(() => {});
  }
}
export async function POST(req, {params}) {return mutate(req, params, 'POST');}
export async function PUT(req, {params}) {return mutate(req, params, 'PUT');}
export async function DELETE(req, {params}) {return mutate(req, params, 'DELETE');}
