import {createHash, randomUUID} from 'node:crypto';
import {database, ensureWorkspaceIndexes} from '@/lib/mongodb';
import {hashPassword, validPassword} from '@/lib/credentials';
import {normalizeEmail} from '@/lib/access';
import {validRequestOrigin} from '@/lib/request-origin';

const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

export async function POST(req) {
  if (!validRequestOrigin(req)) return respond({error: 'Invalid request origin'}, 403);
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return respond({error: 'Send an application/json request'}, 415);
  if (Number(req.headers.get('content-length')) > 4096) return respond({error: 'Request is too large'}, 413);
  let body;
  try {body = await req.json();} catch {return respond({error: 'Invalid request'}, 400);}
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !['token', 'password'].includes(key))) return respond({error: 'Invalid reset request'}, 400);
  const token = body.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return respond({error: 'This password reset link is invalid or has expired.'}, 400);
  if (!validPassword(body.password)) return respond({error: 'Password must contain 12 to 128 characters.'}, 400);

  try {
    const db = await database();
    await ensureWorkspaceIndexes(db);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const reset = await db.collection('passwordResetTokens').findOne({tokenHash, expiresAt: {$gt: now}});
    if (!reset) return respond({error: 'This password reset link is invalid or has expired.'}, 400);
    const email = normalizeEmail(reset.email);
    const membership = await db.collection('memberships').findOne({email, workspaceId: reset.workspaceId, status: 'Active'});
    const workspace = membership && await db.collection('workspaces').findOne({id: reset.workspaceId});
    if (!membership || !workspace) return respond({error: 'This password reset link is invalid or has expired.'}, 400);

    const consumed = await db.collection('passwordResetTokens').deleteOne({_id: reset._id, tokenHash, expiresAt: {$gt: now}});
    if (!consumed.deletedCount) return respond({error: 'This password reset link is invalid or has expired.'}, 400);
    const passwordHash = await hashPassword(body.password);
    await db.collection('credentials').updateOne({workspaceId: reset.workspaceId, email}, {
      $set: {passwordHash, sessionVersion: randomUUID(), updatedAt: now.toISOString(), updatedBy: 'password-reset'},
      $setOnInsert: {createdAt: now.toISOString()},
    }, {upsert: true});
    await db.collection('passwordResetTokens').deleteMany({email, workspaceId: reset.workspaceId});
    return respond({ok: true, message: 'Password updated. You can now sign in with your new password.'});
  } catch (error) {
    console.error('Password reset failed:', error.message);
    return respond({error: 'Password reset is unavailable right now. Please try again later.'}, 503);
  }
}
