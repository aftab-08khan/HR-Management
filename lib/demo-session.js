import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {ROLES} from './access.js';

export const DEMO_COOKIE_NAME = 'peopleos-demo-preview';
export const DEMO_MAX_AGE = 8 * 60 * 60;
const secretKey = Symbol.for('peopleos.demo-preview.secret');
function signingSecret() {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  globalThis[secretKey] ||= randomBytes(32).toString('hex');
  return globalThis[secretKey];
}
export function demoAccessEnabled(env = process.env) {
  if (env.ALLOW_DEMO_ACCESS === 'false') return false;
  return env.NODE_ENV !== 'production' || env.ALLOW_DEMO_ACCESS === 'true';
}
export function demoCookieOptions(env = process.env) {
  return {httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/', maxAge: DEMO_MAX_AGE};
}
export function createDemoSession(role, {secret = signingSecret(), now = Date.now()} = {}) {
  if (!ROLES.includes(role)) throw new Error('Invalid demo role');
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({v: 1, purpose: 'peopleos-demo-only', role, iat, exp: iat + DEMO_MAX_AGE})).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function verifyDemoSession(value, {secret = signingSecret(), now = Date.now()} = {}) {
  if (typeof value !== 'string' || value.length > 1024) return null;
  const pieces = value.split('.');
  if (pieces.length !== 2 || pieces.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  const [encoded, signature] = pieces;
  try {
    const expected = createHmac('sha256', secret).update(encoded).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    const seconds = Math.floor(now / 1000);
    if (payload.v !== 1 || payload.purpose !== 'peopleos-demo-only' || !ROLES.includes(payload.role) || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.iat > seconds + 60 || payload.exp <= seconds || payload.exp - payload.iat !== DEMO_MAX_AGE) return null;
    return {role: payload.role, expiresAt: payload.exp};
  } catch {return null;}
}
