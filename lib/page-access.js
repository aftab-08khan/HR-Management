import {getServerSession} from 'next-auth';
import {cookies} from 'next/headers.js';
import {redirect} from 'next/navigation.js';
import {authOptions, resolveMembership} from './auth.js';
import {canRead, normalizeEmail, ROLES, validIdentity} from './access.js';
import {database} from './mongodb.js';
import {readRecordDetail} from './record-details.js';
import {DEMO_COOKIE_NAME, demoAccessEnabled, verifyDemoSession} from './demo-session.js';
import {availablePages, demoData, demoUsers, demoWorkspace} from './demo.js';

export function safeLocalPagePath(value) {
  if (typeof value !== 'string' || value.length > 2048) return '/dashboard';
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return '/dashboard';
    const url = new URL(value, 'https://peopleos.local');
    return url.origin === 'https://peopleos.local' ? `${url.pathname}${url.search}${url.hash}` : '/dashboard';
  } catch {return '/dashboard';}
}

/** A real Google session always takes precedence, including unprovisioned/revoked sessions. */
export function pageIdentity(session, demoRole) {
  if (session) return validIdentity(session.user) ? {...session.user, mode: 'google'} : null;
  return ROLES.includes(demoRole) ? {...demoUsers[demoRole], workspaceId: demoWorkspace.id, workspaceName: demoWorkspace.name, mode: 'demo'} : null;
}
export function canAccessWorkspacePage(user, {page = 'Overview', profileId, resource} = {}) {
  if (!validIdentity(user)) return false;
  const personalProfile = profileId && page === 'Employees';
  if (!personalProfile && page !== 'Profile' && !availablePages(user.role).includes(page)) return false;
  if (resource && !canRead(user, resource)) return false;
  return true;
}
export function demoRecordAllowed(user, {profileId, resource, recordId}, records = demoData) {
  if (user.role !== 'employee') return true;
  if (profileId) return records.employees.some(row => row.id === profileId && row.email === user.email);
  if (resource && recordId) {
    const known = records[resource]?.find(row => row.id === recordId);
    // Browser-local demo CRUD can create new fictional records. Real APIs still require NextAuth.
    if (!known) return ['requests', 'compensation', 'reviews'].includes(resource);
    if (['requests', 'reviews', 'compensation'].includes(resource)) {
      if (known.owner) return normalizeEmail(known.owner) === normalizeEmail(user.email);
      if (known.email) return normalizeEmail(known.email) === normalizeEmail(user.email);
      return known.name === user.name;
    }
  }
  return true;
}

export async function requireWorkspacePage(options = {}) {
  const path = safeLocalPagePath(options.path || '/dashboard');
  const login = () => redirect(`/?callbackUrl=${encodeURIComponent(path)}`);
  const denied = () => redirect('/dashboard?access=denied');
  let session;
  try {session = await getServerSession(authOptions);} catch {return login();}
  let user;
  if (session) {
    if (!validIdentity(session.user)) return login();
    let membership;
    try {membership = await resolveMembership(session.user.email, session.user.workspaceId);} catch {return login();}
    if (!membership) return login();
    user = pageIdentity({user: {...session.user, role: membership.role, workspaceId: membership.workspaceId}}, null);
  } else {
    const demo = demoAccessEnabled() ? verifyDemoSession((await cookies()).get(DEMO_COOKIE_NAME)?.value) : null;
    user = pageIdentity(null, demo?.role);
  }
  if (!user) return login();
  if (!canAccessWorkspacePage(user, options)) return denied();
  if (user.mode === 'demo') {
    if (!demoRecordAllowed(user, options)) return denied();
    return user;
  }
  try {
    if (options.profileId) await readRecordDetail(await database(), user, 'employees', options.profileId);
    else if (options.resource && options.recordId) await readRecordDetail(await database(), user, options.resource, options.recordId);
  } catch {return denied();}
  return user;
}
