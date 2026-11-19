import {getServerSession} from 'next-auth';
import {authOptions, resolveMembership} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {validIdentity, normalizeEmail} from '@/lib/access';
import {validRequestOrigin} from '@/lib/request-origin';
import {validPassword, hashPassword, verifyPassword, validCredentialEmail} from '@/lib/credentials';
import {sendPasswordChangedEmail} from '@/lib/email';
import {randomUUID} from 'node:crypto';

const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

/**
 * POST /api/credentials/change-password
 * Authenticated users can change their own password.
 * Body: { currentPassword: string, newPassword: string }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!validIdentity(session?.user)) return respond({error: 'Sign in to an active workspace first'}, 401);
    const membership = await resolveMembership(session.user.email, session.user.workspaceId);
    if (!membership) return respond({error: 'Workspace access revoked'}, 403);
    if (!validRequestOrigin(req)) return respond({error: 'Invalid request origin'}, 403);
    if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return respond({error: 'Send an application/json record'}, 415);
    if (Number(req.headers.get('content-length')) > 4096) return respond({error: 'Request is too large'}, 413);
    const reader = req.body?.getReader();
    if (!reader) return respond({error: 'Invalid request'}, 400);
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {await reader.cancel(); return respond({error: 'Request is too large'}, 413);}
        chunks.push(Buffer.from(value));
      }
    } finally {reader.releaseLock();}
    let body;
    try {body = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return respond({error: 'Invalid request'}, 400);}
    if (!body || typeof body !== 'object') return respond({error: 'Invalid request'}, 400);
    const {currentPassword, newPassword} = body;
    if (!validPassword(currentPassword)) return respond({error: 'Enter your current password'}, 400);
    if (!validPassword(newPassword)) return respond({error: 'New password must contain 12 to 128 characters'}, 400);
    if (currentPassword === newPassword) return respond({error: 'New password must be different from the current one'}, 400);

    const db = await database();
    const email = normalizeEmail(session.user.email);
    const workspaceId = membership.workspaceId;

    // Find existing credential
    const credential = await db.collection('credentials').findOne({workspaceId, email});
    if (!credential || !credential.passwordHash) return respond({error: 'No password is set for this account. Contact your administrator.'}, 404);

    // Verify current password
    const matches = await verifyPassword(currentPassword, credential.passwordHash);
    if (!matches) return respond({error: 'Current password is incorrect'}, 403);

    // Hash and save the new password
    const passwordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    await db.collection('credentials').updateOne(
      {workspaceId, email},
      {$set: {passwordHash, sessionVersion: randomUUID(), updatedAt: now, updatedBy: email}},
    );

    // Find workspace name for the email
    const workspace = await db.collection('workspaces').findOne({id: workspaceId});

    // Send confirmation email (non-blocking, failure is not fatal)
    sendPasswordChangedEmail({
      recipientEmail: email,
      recipientName: membership.name || email,
      workspaceName: workspace?.name || 'Your workspace',
    }).catch(err => console.error('Password changed email failed:', err.message));

    return respond({ok: true, message: 'Password changed successfully. Please sign in again with your new password.'});
  } catch (error) {
    console.error('Change password failed:', error.message);
    return respond({error: 'Unable to change password'}, 503);
  }
}
