/** Server-side access rules. Client-selected roles and workspace IDs are never trusted. */
export const ROLES = ['admin', 'hr', 'employee'];
export const RESOURCES = ['employees', 'requests', 'jobs', 'announcements', 'reviews', 'compliance', 'compensation', 'memberships', 'audit'];
export const PERSONAL_RESOURCES = ['requests', 'reviews', 'compensation'];
export const SELF_SERVICE_RESOURCES = ['requests', 'compensation'];
export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
export function validIdentity(user) {
  return !!(user && ROLES.includes(user.role) && typeof user.workspaceId === 'string' && user.workspaceId.length && normalizeEmail(user.email));
}
export function canRead(user, resource) {
  if (!validIdentity(user) || !RESOURCES.includes(resource)) return false;
  if (resource === 'memberships') return user.role === 'admin';
  if (resource === 'audit' || resource === 'compliance') return user.role !== 'employee';
  return true;
}
export function canWrite(user, resource, method) {
  if (!validIdentity(user) || !RESOURCES.includes(resource) || !['POST', 'PUT', 'DELETE'].includes(method)) return false;
  if (resource === 'audit') return false;
  if (resource === 'memberships') return user.role === 'admin';
  if (user.role === 'admin' || user.role === 'hr') return true;
  return SELF_SERVICE_RESOURCES.includes(resource);
}
export function scopeQuery(user, resource, id) {
  if (!canRead(user, resource)) throw new Error('Access denied');
  const query = {workspaceId: user.workspaceId};
  if (id !== undefined) {
    if (typeof id !== 'string' || !id || id.length > 160) throw new Error('Invalid record ID');
    query.id = id;
  }
  if (user.role === 'employee') {
    if (resource === 'employees') query.email = normalizeEmail(user.email);
    else if (PERSONAL_RESOURCES.includes(resource)) query.owner = normalizeEmail(user.email);
  }
  return query;
}
export function canEditExisting(user, resource, existing, method) {
  if (!canWrite(user, resource, method) || !existing || existing.workspaceId !== user.workspaceId) return false;
  if (user.role !== 'employee') return true;
  if (normalizeEmail(existing.owner) !== normalizeEmail(user.email)) return false;
  return existing.status === 'Pending';
}
export function employeeFields(resource, method) {
  if (resource === 'requests') return ['type', 'from', 'to', 'reason'];
  if (resource === 'compensation') return ['type', 'amount', 'currency', 'reason'];
  return [];
}

export const RESOURCE_FIELDS = {
  employees: ['name', 'email', 'role', 'department', 'status', 'location', 'joined', 'salary', 'color', 'photoUrl', 'employeeCode'],
  requests: ['name', 'type', 'from', 'to', 'reason', 'status'],
  jobs: ['title', 'department', 'location', 'type', 'applicants', 'status'],
  announcements: ['title', 'body', 'category', 'date'],
  reviews: ['name', 'cycle', 'score', 'status'],
  compliance: ['title', 'category', 'owner', 'description', 'dueDate', 'status', 'priority', 'assignedEmail'],
  compensation: ['name', 'type', 'amount', 'currency', 'reason', 'status', 'reviewNote'],
  memberships: ['email', 'name', 'role', 'status'],
};

export function validateRecord(resource, input, create) {
  const record = Object.fromEntries((RESOURCE_FIELDS[resource] || []).filter(key => input[key] !== undefined).map(key => [key, input[key]]));
  if (Object.entries(record).some(([key, value]) => !(['salary', 'amount', 'applicants'].includes(key) || key === 'score') && typeof value !== 'string')) return 'Invalid field type';
  if (Object.values(record).some(value => !['string', 'number'].includes(typeof value) || (typeof value === 'string' && value.length > 10000) || (typeof value === 'number' && !Number.isFinite(value)))) return 'Invalid field value';
  const required = {employees: ['name', 'email'], requests: ['type', 'from', 'to'], jobs: ['title'], announcements: ['title', 'body'], reviews: ['name', 'cycle'], compliance: ['title'], compensation: ['type', 'amount', 'reason'], memberships: ['email', 'role']};
  if (create && required[resource]?.some(key => record[key] === undefined || (typeof record[key] === 'string' && !record[key].trim()))) return 'Required fields are missing';
  if (record.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) return 'Enter a valid email address';
  for (const field of ['salary', 'amount', 'applicants']) if (record[field] !== undefined && (typeof record[field] !== 'number' || record[field] < 0)) return `${field} must be a nonnegative number`;
  if (resource === 'compensation' && record.amount === 0) return 'Amount must be greater than zero';
  if (resource === 'compensation' && record.currency !== undefined && !/^[A-Z]{3}$/.test(record.currency)) return 'Currency must be a three-letter code';
  const statuses = {requests: ['Pending', 'Approved', 'Declined', 'Rejected'], compensation: ['Pending', 'Approved', 'Declined'], memberships: ['Active', 'Suspended'], compliance: ['Complete', 'In progress', 'Action needed']};
  if (record.status !== undefined && statuses[resource] && !statuses[resource].includes(record.status)) return 'Invalid status';
  if (resource === 'memberships' && record.role !== undefined && !ROLES.includes(record.role)) return 'Invalid workspace role';
  if (resource === 'compensation' && record.type !== undefined && !['Reimbursement', 'Salary adjustment', 'Benefit claim', 'Final settlement'].includes(record.type)) return 'Invalid compensation request type';
  if (resource === 'compliance' && record.priority !== undefined && !['Low', 'Medium', 'High'].includes(record.priority)) return 'Invalid priority';
  for (const field of ['from', 'to', 'joined', 'dueDate']) if (record[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(record[field]) || Number.isNaN(Date.parse(record[field])))) return 'Enter a valid date';
  if (record.from && record.to && record.from > record.to) return 'End date must follow start date';
  return null;
}

