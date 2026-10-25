const MAX_QR_LENGTH = 1200;
const identity = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\u0000-\u001f]/.test(value);
const normalizedCode = value => typeof value === 'string' ? value.trim().toUpperCase() : '';

/** A pass is a workspace-scoped record locator, never an authentication token. */
export function createEmployeePassPayload(employee, workspaceId) {
  if (!identity(workspaceId) || !identity(employee?.id) || !identity(employee?.employeeCode)) throw new Error('Add an employee ID before creating this pass.');
  if (employee.workspaceId && employee.workspaceId !== workspaceId) throw new Error('This employee belongs to a different workspace.');
  return JSON.stringify({app: 'peopleos', workspaceId, employeeId: employee.id, employeeCode: employee.employeeCode});
}

/** Accept only our small JSON locator. QR links and other application data are rejected. */
export function parseEmployeePassPayload(value, workspaceId) {
  if (typeof value !== 'string' || value.length > MAX_QR_LENGTH || !identity(workspaceId)) throw new Error('This is not a valid PeopleOS employee QR code.');
  let payload;
  try {payload = JSON.parse(value);} catch {throw new Error('This is not a valid PeopleOS employee QR code.');}
  if (!payload || Array.isArray(payload) || typeof payload !== 'object' || Object.keys(payload).length !== 4 || payload.app !== 'peopleos' || !identity(payload.workspaceId) || !identity(payload.employeeId) || !identity(payload.employeeCode)) throw new Error('This is not a valid PeopleOS employee QR code.');
  if (payload.workspaceId !== workspaceId) throw new Error('This pass belongs to a different workspace. Switch to the correct workspace to scan it.');
  return payload;
}

/** Resolve exclusively against the records already authorized for the signed-in user. */
export function resolveEmployeePass(value, workspaceId, employees = []) {
  const payload = parseEmployeePassPayload(value, workspaceId);
  const matches = employees.filter(employee => employee.id === payload.employeeId && normalizedCode(employee.employeeCode) === normalizedCode(payload.employeeCode) && (!employee.workspaceId || employee.workspaceId === workspaceId));
  if (matches.length !== 1) throw new Error('This employee is not available with your current workspace access.');
  return matches[0];
}

export function resolveManualEmployeeCode(value, workspaceId, employees = []) {
  if (!identity(workspaceId) || !identity(value)) throw new Error('Enter an employee ID to continue.');
  const matches = employees.filter(employee => normalizedCode(employee.employeeCode) === normalizedCode(value) && (!employee.workspaceId || employee.workspaceId === workspaceId));
  if (matches.length !== 1) throw new Error('No accessible employee matches this ID. Check the ID and your workspace.');
  return matches[0];
}
