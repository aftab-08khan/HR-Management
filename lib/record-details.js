import {canRead, normalizeEmail, RESOURCES, scopeQuery, validIdentity} from './access.js';
import {backfillRecordCodes} from './codes.js';

export class RecordDetailError extends Error {
  constructor(message, status) {super(message); this.name = 'RecordDetailError'; this.status = status;}
}

export async function readRecordDetail(db, user, resource, id) {
  if (!RESOURCES.includes(resource)) throw new RecordDetailError('Record type not found', 404);
  if (!validIdentity(user)) throw new RecordDetailError('Sign in to an active workspace first', 401);
  if (!canRead(user, resource)) throw new RecordDetailError('Your role does not permit this record', 403);
  if (typeof id !== 'string' || !id || id.length > 160) throw new RecordDetailError('Invalid record ID', 400);
  const record = await db.collection(resource).findOne(scopeQuery(user, resource, id), {projection: {_id: 0}});
  if (!record) throw new RecordDetailError('Record not found', 404);
  await backfillRecordCodes(db, resource, user.workspaceId, [record]);
  return record;
}

export async function readEmployeeProfile(db, user, id) {
  const employee = await readRecordDetail(db, user, 'employees', id);
  const email = normalizeEmail(employee.email);
  const resources = ['requests', 'reviews', 'compensation'];
  const bundles = await Promise.all(resources.map(async resource => {
    // Keep both the role's own-record filter and the selected employee's identity.
    // Names are not unique identifiers and are never used to join private records.
    const query = {$and: [scopeQuery(user, resource), {owner: email}]};
    const [rows, count] = await Promise.all([
      db.collection(resource).find(query, {projection: {_id: 0}}).sort({createdAt: -1, id: 1}).limit(100).toArray(),
      db.collection(resource).countDocuments(query),
    ]);
    return {resource, rows, count};
  }));
  return {employee, ...Object.fromEntries(bundles.map(({resource, rows}) => [resource, rows])), counts: Object.fromEntries(bundles.map(({resource, count}) => [resource, count]))};
}

/** Look up the current account directly; directory pagination never limits a user's own profile. */
export async function readOwnProfile(db, user) {
  if (!validIdentity(user)) throw new RecordDetailError('Sign in to an active workspace first', 401);
  const employee = await db.collection('employees').findOne({workspaceId: user.workspaceId, email: normalizeEmail(user.email)}, {projection: {_id: 0, id: 1}});
  if (!employee) return {employee: null};
  try {
    // Even managers use ownership-only scope here. A concurrent email change
    // must never turn an account profile request into a coworker's profile.
    return await readEmployeeProfile(db, {...user, role: 'employee'}, employee.id);
  } catch (error) {
    if (error instanceof RecordDetailError && error.status === 404) return {employee: null};
    throw error;
  }
}
