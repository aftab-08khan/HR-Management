import {createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {normalizeEmail, ROLES, validIdentity} from './access.js';

const scrypt = promisify(scryptCallback);
const SCRYPT_OPTIONS = {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024};
export function validCredentialEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}
export function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128 && Buffer.byteLength(value, 'utf8') <= 512;
}
export async function hashPassword(password) {
  if (!validPassword(password)) throw new Error('Password must contain 12 to 128 characters');
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}
export async function verifyPassword(password, stored) {
  if (!validPassword(password) || typeof stored !== 'string' || stored.length > 200) return false;
  const [algorithm, version, saltValue, hashValue, extra] = stored.split('$');
  if (algorithm !== 'scrypt' || version !== '1' || extra !== undefined || !/^[A-Za-z0-9_-]{22}$/.test(saltValue || '') || !/^[A-Za-z0-9_-]{86}$/.test(hashValue || '')) return false;
  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const derived = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
    return timingSafeEqual(expected, derived);
  } catch {return false;}
}

export function createCredentialRateLimiter({maxAttempts = 8, windowMs = 15 * 60 * 1000, maxEntries = 10000, now = Date.now} = {}) {
  const attempts = new Map();
  return {
    consume(key) {
      const time = now();
      let entry = attempts.get(key);
      if (!entry || entry.expires <= time) {entry = {count: 0, expires: time + windowMs}; attempts.delete(key); attempts.set(key, entry);}
      if (attempts.size > maxEntries) attempts.delete(attempts.keys().next().value);
      if (entry.count >= maxAttempts) return false;
      entry.count++; return true;
    },
    clear(key) {attempts.delete(key);},
  };
}
const limiterKey = Symbol.for('peopleos.credentials.rate-limit');
globalThis[limiterKey] ||= createCredentialRateLimiter();
let dummyHash;
async function dummyPasswordHash() {dummyHash ||= hashPassword('PeopleOS-dummy-password-not-an-account'); return dummyHash;}

export const LEGACY_CREDENTIAL_VERSION = 'legacy-v1';
export function credentialSessionVersion(credential) {
  const value = credential?.sessionVersion;
  if (value === undefined || value === null) return LEGACY_CREDENTIAL_VERSION;
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}
export async function credentialVersionMatches(db, identity) {
  if (!validCredentialEmail(identity?.email) || typeof identity?.workspaceId !== 'string' || !identity.workspaceId || identity.workspaceId.length > 160) return false;
  const version = identity.credentialVersion === undefined ? LEGACY_CREDENTIAL_VERSION : identity.credentialVersion;
  if (typeof version !== 'string' || !version || version.length > 128) return false;
  const credential = await db.collection('credentials').findOne({workspaceId: identity.workspaceId, email: normalizeEmail(identity.email)}, {projection: {sessionVersion: 1}});
  return !!credential && credentialSessionVersion(credential) === version;
}

/** No role comes from credentials. An optional tenant ID narrows the authorized account search. */
export async function authenticateCredentials(db, credentials, {limiter = globalThis[limiterKey]} = {}) {
  if (!credentials || !validCredentialEmail(credentials.email) || !validPassword(credentials.password)) return null;
  const email = normalizeEmail(credentials.email);
  const workspaceId = typeof credentials.workspaceId === 'string' ? credentials.workspaceId.trim() : '';
  if (credentials.workspaceId !== undefined && credentials.workspaceId !== null && typeof credentials.workspaceId !== 'string') return null;
  if (workspaceId.length > 160 || /[\u0000-\u001f\u007f]/.test(workspaceId)) return null;
  // Limit by email across tenant choices, so changing workspace input cannot bypass the limit.
  const rateKey = createHash('sha256').update(email).digest('hex');
  if (!limiter.consume(rateKey)) return null;
  const query = {email, ...(workspaceId ? {workspaceId} : {})};
  const candidates = await db.collection('credentials').find(query).sort({workspaceId: 1}).limit(workspaceId ? 1 : 20).toArray();
  if (!candidates.length) {await verifyPassword(credentials.password, await dummyPasswordHash()); return null;}
  for (const credential of candidates) {
    if (typeof credential.workspaceId !== 'string' || !credential.workspaceId) continue;
    const [member, workspace, passwordMatches] = await Promise.all([
      db.collection('memberships').findOne({workspaceId: credential.workspaceId, email, status: 'Active'}),
      db.collection('workspaces').findOne({id: credential.workspaceId}),
      verifyPassword(credentials.password, credential.passwordHash),
    ]);
    const credentialVersion = credentialSessionVersion(credential);
    if (!passwordMatches || !member || !ROLES.includes(member.role) || !workspace || !credentialVersion) continue;
    limiter.clear(rateKey);
    return {id: `${credential.workspaceId}:${email}`, email, name: member.name || email, workspaceId: credential.workspaceId, workspaceName: workspace.name, role: member.role, credentialsVerified: true, credentialVersion};
  }
  return null;
}

export class CredentialSetupError extends Error {
  constructor(message, status) {super(message); this.name = 'CredentialSetupError'; this.status = status;}
}
export async function setWorkspacePassword(db, actor, {email: inputEmail, password}) {
  if (!validIdentity(actor) || actor.role !== 'admin') throw new CredentialSetupError('Administrator access required', 403);
  if (!validCredentialEmail(inputEmail)) throw new CredentialSetupError('Enter a valid member email', 400);
  if (!validPassword(password)) throw new CredentialSetupError('Password must contain 12 to 128 characters', 400);
  const email = normalizeEmail(inputEmail);
  const [administrator, member, workspace] = await Promise.all([
    db.collection('memberships').findOne({workspaceId: actor.workspaceId, email: normalizeEmail(actor.email), role: 'admin', status: 'Active'}),
    db.collection('memberships').findOne({workspaceId: actor.workspaceId, email, status: 'Active'}),
    db.collection('workspaces').findOne({id: actor.workspaceId}),
  ]);
  if (!administrator || !workspace) throw new CredentialSetupError('Administrator access revoked', 403);
  if (!member || !ROLES.includes(member.role)) throw new CredentialSetupError('An active member in this workspace is required', 404);
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  await db.collection('credentials').updateOne({workspaceId: actor.workspaceId, email}, {$set: {passwordHash, sessionVersion: randomUUID(), updatedAt: now, updatedBy: normalizeEmail(actor.email)}, $setOnInsert: {createdAt: now}}, {upsert: true});
  return {ok: true, email, workspaceId: actor.workspaceId};
}
