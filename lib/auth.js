import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import {database, ensureWorkspaceIndexes} from './mongodb.js';
import {normalizeEmail, ROLES, validIdentity} from './access.js';
import {backfillRecordCodes, generatedRecordCode} from './codes.js';
import {authenticateCredentials, credentialVersionMatches, LEGACY_CREDENTIAL_VERSION} from './credentials.js';

export async function resolveMembership(email, workspaceId, {bootstrap = false} = {}) {
  email = normalizeEmail(email);
  if (!email) return null;
  const db = await database();
  await ensureWorkspaceIndexes(db);
  const configuredWorkspace = process.env.WORKSPACE_ID?.trim();
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(normalizeEmail).filter(Boolean);
  // Environment bootstrap is confined to this one workspace. Existing suspended members stay suspended.
  if (bootstrap && configuredWorkspace && admins.includes(email)) {
    await db.collection('workspaces').updateOne({id: configuredWorkspace}, {$setOnInsert: {id: configuredWorkspace, name: process.env.WORKSPACE_NAME || 'My workspace', plan: 'Business', createdAt: new Date().toISOString()}}, {upsert: true});
    await db.collection('memberships').updateOne({workspaceId: configuredWorkspace, email}, {$setOnInsert: {id: crypto.randomUUID(), workspaceId: configuredWorkspace, email, memberCode: generatedRecordCode('memberships', `${configuredWorkspace}:${email}`), role: 'admin', status: 'Active', createdAt: new Date().toISOString()}}, {upsert: true});
  }
  const query = {email, status: 'Active'};
  if (workspaceId) query.workspaceId = workspaceId;
  const member = await db.collection('memberships').findOne(query, {sort: {createdAt: 1}});
  if (!member || !ROLES.includes(member.role) || !member.workspaceId) return null;
  const workspace = await db.collection('workspaces').findOne({id: member.workspaceId});
  if (!workspace) return null;
  await backfillRecordCodes(db, 'memberships', member.workspaceId, [member]);
  return {...member, workspaceName: workspace.name, plan: workspace.plan || 'Business'};
}

export const authOptions = {
  providers: [
    (typeof CredentialsProvider === 'function' ? CredentialsProvider : CredentialsProvider.default)({
      name: 'Email and password',
      credentials: {email: {label: 'Email', type: 'email'}, password: {label: 'Password', type: 'password'}, workspaceId: {label: 'Workspace ID (optional)', type: 'text'}},
      async authorize(credentials) {
        try {const db = await database(); await ensureWorkspaceIndexes(db); return await authenticateCredentials(db, credentials);} catch {return null;}
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [(typeof GoogleProvider === 'function' ? GoogleProvider : GoogleProvider.default)({clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET})] : []),
  ],
  session: {strategy: 'jwt', maxAge: 60 * 60 * 8},
  callbacks: {
    async signIn({user, account, profile}) {
      if (account?.provider === 'credentials') {
        if (!user?.credentialsVerified || !validIdentity(user)) return false;
        try {
          if (!await credentialVersionMatches(await database(), user)) return false;
          return !!await resolveMembership(user.email, user.workspaceId);
        } catch {return false;}
      }
      if (account?.provider !== 'google' || profile?.email_verified !== true) return false;
      try {
        if (await resolveMembership(user.email, undefined, {bootstrap: true})) return true;
        // A new verified identity may onboard. Revoked/suspended accounts cannot create another tenant.
        return !await (await database()).collection('memberships').findOne({email: normalizeEmail(user.email)});
      } catch {return false;}
    },
    async jwt({token, user, account, profile}) {
      if (user) {
        token.verifiedGoogle = account?.provider === 'google' && profile?.email_verified === true;
        token.authMethod = account?.provider;
        if (account?.provider !== 'credentials') delete token.credentialVersion;
      } else if (!token.authMethod && token.verifiedGoogle === false && token.workspaceId) {
        token.authMethod = 'credentials';
        token.credentialVersion ??= LEGACY_CREDENTIAL_VERSION;
      }
      try {
        const selectedWorkspace = user && account?.provider === 'credentials' ? user.workspaceId : user ? undefined : token.workspaceId;
        if (user && account?.provider === 'credentials') {
          if (!user.credentialsVerified || !validIdentity(user)) throw new Error('Invalid credential identity');
          token.workspaceId = selectedWorkspace;
          token.email = normalizeEmail(user.email);
          token.credentialVersion = user.credentialVersion || LEGACY_CREDENTIAL_VERSION;
        }
        if (token.authMethod === 'credentials' && !await credentialVersionMatches(await database(), token)) throw new Error('Password session revoked');
        const member = await resolveMembership(user?.email || token.email, selectedWorkspace);
        if (!member) throw new Error('Membership unavailable');
        token.role = member.role;
        token.workspaceId = member.workspaceId;
        token.workspaceName = member.workspaceName;
        token.memberCode = member.memberCode;
      } catch {
        delete token.role;
        // Retain the tenant selection on failure; revocation or an outage must not switch workspaces.
      }
      return token;
    },
    async session({session, token}) {
      session.user = {...session.user, role: token.role, workspaceId: token.workspaceId, workspaceName: token.workspaceName, memberCode: token.memberCode, verifiedGoogle: token.verifiedGoogle === true};
      for (const field of ['credentialVersion', 'authMethod', 'credentialsVerified', 'password', 'passwordHash']) delete session.user[field];
      return session;
    },
  },
};


function onboardingError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** The per-email MongoDB _id guard makes retries and concurrent requests use one server-issued tenant. */
export async function provisionWorkspace(user, name, db) {
  const email = normalizeEmail(user?.email);
  if (user?.verifiedGoogle !== true || !email) throw onboardingError('A verified Google sign-in is required', 401);
  if (user.role) throw onboardingError('You already belong to a workspace', 409);
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw onboardingError('Workspace name must contain 2 to 80 characters', 400);
  const members = db.collection('memberships');
  // Check every status, not only Active, so onboarding cannot bypass a revoked invitation.
  if (await members.findOne({email})) throw onboardingError('Your account already has a workspace membership. Contact your administrator or refresh your session.', 409);
  const guards = db.collection('workspaceProvisioning');
  let guard;
  try {
    guard = await guards.findOneAndUpdate({_id: email}, {$setOnInsert: {workspaceId: `ws-${crypto.randomUUID()}`, name: name.trim(), createdAt: new Date().toISOString()}}, {upsert: true, returnDocument: 'after'});
  } catch (error) {
    if (error.code !== 11000) throw error;
    guard = await guards.findOne({_id: email});
  }
  if (!guard?.workspaceId) throw onboardingError('Workspace setup is unavailable. Please retry.', 503);
  if (await members.findOne({email})) throw onboardingError('Your account already has a workspace membership. Refresh your session.', 409);
  const workspace = {id: guard.workspaceId, name: guard.name, plan: 'Trial', createdAt: guard.createdAt};
  await db.collection('workspaces').updateOne({id: workspace.id}, {$setOnInsert: workspace}, {upsert: true});
  await members.updateOne({workspaceId: workspace.id, email}, {$setOnInsert: {id: crypto.randomUUID(), workspaceId: workspace.id, email, name: user.name || email, memberCode: generatedRecordCode('memberships', `${workspace.id}:${email}`), role: 'admin', status: 'Active', createdAt: guard.createdAt}}, {upsert: true});
  await guards.updateOne({_id: email}, {$set: {status: 'Ready', completedAt: new Date().toISOString()}});
  return {...workspace, role: 'admin'};
}
