import test from 'node:test';
import assert from 'node:assert/strict';
import {getToken} from 'next-auth/jwt';
import {createDemoSession, verifyDemoSession, demoAccessEnabled, demoCookieOptions, DEMO_COOKIE_NAME, DEMO_MAX_AGE} from '../lib/demo-session.js';
import {pageIdentity, canAccessWorkspacePage, safeLocalPagePath, demoRecordAllowed} from '../lib/page-access.js';

const secret = 'test-only-secret-for-demo-page-access';
const now = Date.parse('2026-10-24T12:00:00Z');
const realEmployee = {user: {email: 'person@acme.test', role: 'employee', workspaceId: 'acme'}};

test('demo cookies are signed, role restricted, scoped to sample use and expire after eight hours', () => {
  for (const role of ['admin', 'hr', 'employee']) {
    const token = createDemoSession(role, {secret, now});
    assert.equal(verifyDemoSession(token, {secret, now}).role, role);
    assert.equal(verifyDemoSession(token, {secret: 'wrong-secret', now}), null);
    assert.equal(verifyDemoSession(token, {secret, now: now + DEMO_MAX_AGE * 1000}), null);
    const [body, signature] = token.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    assert.equal(payload.purpose, 'peopleos-demo-only');
    assert.equal(payload.workspaceId, undefined);
    const tampered = Buffer.from(JSON.stringify({...payload, role: 'superadmin'})).toString('base64url');
    assert.equal(verifyDemoSession(`${tampered}.${signature}`, {secret, now}), null);
  }
  assert.throws(() => createDemoSession('superadmin'), /Invalid demo role/);
  for (const malformed of [null, '', 'not-signed', 'x'.repeat(1025), 'a.b.c']) assert.equal(verifyDemoSession(malformed, {secret, now}), null);
});

test('demo cookies are HttpOnly with safe browser attributes and production access is explicit', () => {
  assert.equal(demoAccessEnabled({NODE_ENV: 'development'}), true);
  assert.equal(demoAccessEnabled({NODE_ENV: 'production'}), false);
  assert.equal(demoAccessEnabled({NODE_ENV: 'production', ALLOW_DEMO_ACCESS: 'true'}), true);
  assert.equal(demoAccessEnabled({NODE_ENV: 'development', ALLOW_DEMO_ACCESS: 'false'}), false);
  assert.deepEqual(demoCookieOptions({NODE_ENV: 'production'}), {httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 28800});
});

test('a real Google employee cannot elevate page access through an administrator demo cookie', () => {
  const user = pageIdentity(realEmployee, 'admin');
  assert.equal(user.role, 'employee');
  assert.equal(user.mode, 'google');
  assert.equal(canAccessWorkspacePage(user, {page: 'Payroll'}), false);
  assert.equal(canAccessWorkspacePage(user, {page: 'Workspace'}), false);
  assert.equal(canAccessWorkspacePage(user, {page: 'Compensation'}), true);
  assert.equal(pageIdentity({user: {email: 'revoked@acme.test'}}, 'admin'), null);
});

test('page roles match workspace navigation while personal profile reads remain individually scoped', () => {
  const admin = pageIdentity(null, 'admin');
  const hr = pageIdentity(null, 'hr');
  const employee = pageIdentity(null, 'employee');
  assert.equal(canAccessWorkspacePage(admin, {page: 'Workspace'}), true);
  assert.equal(canAccessWorkspacePage(hr, {page: 'Workspace'}), false);
  assert.equal(canAccessWorkspacePage(hr, {page: 'Compliance'}), true);
  assert.equal(canAccessWorkspacePage(employee, {page: 'Employees'}), false);
  assert.equal(canAccessWorkspacePage(employee, {page: 'Employees', profileId: 'own-record'}), true);
  assert.equal(canAccessWorkspacePage(employee, {page: 'Time off', resource: 'memberships'}), false);
  assert.equal(canAccessWorkspacePage(employee, {page: 'Profile'}), true);
  assert.equal(canAccessWorkspacePage(null, {page: 'Overview'}), false);
});

test('login callback paths cannot become external redirects or carry control characters', () => {
  assert.equal(safeLocalPagePath('/employees/EMP-001?tab=reviews'), '/employees/EMP-001?tab=reviews');
  for (const path of ['https://evil.example', '//evil.example', '/%2fexample.test', '/%5cevil.test', '/bad%0d%0aLocation:evil', 'javascript:alert(1)', null]) assert.equal(safeLocalPagePath(path), '/dashboard');
});

test('a valid sample cookie never authenticates a protected NextAuth API session', async () => {
  const token = createDemoSession('admin', {secret, now});
  assert.equal(await getToken({req: {headers: {}, cookies: {[DEMO_COOKIE_NAME]: token}}, secret}), null);
  assert.equal(await getToken({req: {headers: {}, cookies: {'next-auth.session-token': token}}, secret}), null);
});


test('legacy sample records can match an exact profile name only when no owner identity exists', () => {
  const user = pageIdentity(null, 'employee');
  assert.equal(demoRecordAllowed(user, {resource: 'reviews', recordId: 'REV-001'}), true);
  assert.equal(demoRecordAllowed(user, {resource: 'reviews', recordId: 'REV-002'}), false);
  const records = {reviews: [{id: 'conflicting-owner', owner: 'coworker@peopleos.co', name: user.name}, {id: 'own-email', email: user.email, name: 'Different name'}]};
  assert.equal(demoRecordAllowed(user, {resource: 'reviews', recordId: 'conflicting-owner'}, records), false);
  assert.equal(demoRecordAllowed(user, {resource: 'reviews', recordId: 'own-email'}, records), true);
});
