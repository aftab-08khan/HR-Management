import {getServerSession} from 'next-auth';
import {authOptions, resolveMembership} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {validIdentity, normalizeEmail} from '@/lib/access';
import {validRequestOrigin} from '@/lib/request-origin';
import {createHash, randomBytes} from 'node:crypto';
import {validCredentialEmail} from '@/lib/credentials';
import {sendPasswordResetEmail, isEmailConfigured} from '@/lib/email';

const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

/**
 * POST /api/credentials/send-welcome
 * Admin-only: emails a short-lived sign-in setup link without changing the member's password.
 * Body: { email: string }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!validIdentity(session?.user)) return respond({error: 'Sign in to an active workspace first'}, 401);
    const member = await resolveMembership(session.user.email, session.user.workspaceId);
    if (!member || member.role !== 'admin') return respond({error: 'Administrator access required'}, 403);
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
    if (!body || !validCredentialEmail(body.email)) return respond({error: 'Enter a valid member email'}, 400);
    if (!isEmailConfigured()) return respond({error: 'Email service is not configured. Add RESEND_API_KEY to your environment.'}, 503);

    const db = await database();
    const email = normalizeEmail(body.email);

    // Verify the target is an active member of this workspace
    const targetMember = await db.collection('memberships').findOne({workspaceId: member.workspaceId, email, status: 'Active'});
    if (!targetMember) return respond({error: 'An active member in this workspace is required'}, 404);

    // Create a one-time link. Resending never changes an existing password.
    const workspace = await db.collection('workspaces').findOne({id: member.workspaceId});
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    await db.collection('passwordResetTokens').deleteMany({email, workspaceId: member.workspaceId});
    await db.collection('passwordResetTokens').insertOne({tokenHash, email, workspaceId: member.workspaceId, createdAt: now, expiresAt});
    const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const setupUrl = new URL('/reset-password', baseUrl);
    setupUrl.hash = `token=${rawToken}`;
    await sendPasswordResetEmail({recipientEmail: email, recipientName: targetMember.name || email, workspaceName: workspace?.name || member.workspaceName || 'Your workspace', resetUrl: setupUrl.href});
    return respond({ok: true, email, emailSent: true});
  } catch (error) {
    console.error('Send welcome email failed:', error.message);
    return respond({error: error.message || 'Unable to send welcome email'}, 503);
  }
}
