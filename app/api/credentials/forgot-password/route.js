import {createHash, randomBytes} from 'node:crypto';
import {database, ensureWorkspaceIndexes} from '@/lib/mongodb';
import {createCredentialRateLimiter, validCredentialEmail} from '@/lib/credentials';
import {normalizeEmail} from '@/lib/access';
import {isEmailConfigured, sendPasswordResetEmail} from '@/lib/email';
import {validRequestOrigin} from '@/lib/request-origin';

const limiter = createCredentialRateLimiter({maxAttempts: 5, windowMs: 15 * 60 * 1000});
const genericResponse = {ok: true, message: 'If an active account matches that email, we will send a password reset link.'};
const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

export async function POST(req) {
  if (!validRequestOrigin(req)) return respond({error: 'Invalid request origin'}, 403);
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return respond({error: 'Send an application/json request'}, 415);
  if (Number(req.headers.get('content-length')) > 2048) return respond({error: 'Request is too large'}, 413);
  let body;
  try {body = await req.json();} catch {return respond({error: 'Invalid request'}, 400);}
  if (!body || Array.isArray(body) || Object.keys(body).some(key => key !== 'email')) return respond({error: 'Provide only an email address'}, 400);
  const email = normalizeEmail(body.email);
  if (!validCredentialEmail(email)) return respond(genericResponse);
  const key = createHash('sha256').update(email).digest('hex');
  if (!limiter.consume(key)) return respond(genericResponse);
  if (!isEmailConfigured() && process.env.NODE_ENV === 'production') return respond({error: 'Password reset email is not configured.'}, 503);

  try {
    const db = await database();
    await ensureWorkspaceIndexes(db);
    const membership = await db.collection('memberships').findOne({email, status: 'Active'}, {sort: {createdAt: 1}});
    const workspace = membership && await db.collection('workspaces').findOne({id: membership.workspaceId});
    if (!membership || !workspace) return respond(genericResponse);

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    await db.collection('passwordResetTokens').deleteMany({email, workspaceId: membership.workspaceId});
    await db.collection('passwordResetTokens').insertOne({tokenHash, email, workspaceId: membership.workspaceId, createdAt: now, expiresAt});

    const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const resetUrl = new URL('/reset-password', baseUrl);
    resetUrl.hash = `token=${rawToken}`;
    if (isEmailConfigured()) {
      try {await sendPasswordResetEmail({recipientEmail: email, recipientName: membership.name, workspaceName: workspace.name, resetUrl: resetUrl.href});}
      catch (error) {
        console.error('Password reset email failed:', error.message);
        await db.collection('passwordResetTokens').deleteOne({tokenHash});
        return respond({error: 'The reset email could not be delivered. Check the email service configuration and try again.'}, 503);
      }
      return respond(genericResponse);
    }
    if (process.env.NODE_ENV !== 'production') return respond({...genericResponse, developmentResetUrl: resetUrl.href});
    return respond(genericResponse);
  } catch (error) {
    console.error('Password reset request failed:', error.message);
    return respond({error: 'Password reset is unavailable right now. Please try again later.'}, 503);
  }
}
