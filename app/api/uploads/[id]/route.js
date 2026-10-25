import {getServerSession} from 'next-auth';
import {authOptions, resolveMembership} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {normalizeEmail, validIdentity} from '@/lib/access';
import {canReadUpload, validatePhotoPath} from '@/lib/media';

export const runtime = 'nodejs';
const error = (message, status) => Response.json({error: message}, {status, headers: {'Cache-Control': 'private, no-store'}});

export async function GET(_req, {params}) {
  try {
    const {id} = await params;
    if (!validatePhotoPath(`/api/uploads/${id}`)) return error('Image not found', 404);
    const session = await getServerSession(authOptions);
    if (!validIdentity(session?.user)) return error('Sign in to an active workspace first', 401);
    const membership = await resolveMembership(session.user.email, session.user.workspaceId);
    if (!membership) return error('Workspace access revoked', 403);
    const user = {...session.user, role: membership.role, workspaceId: membership.workspaceId, email: normalizeEmail(session.user.email)};
    const upload = await (await database()).collection('uploads').findOne({id, workspaceId: user.workspaceId});
    if (!canReadUpload(user, upload)) return error('Image not found', 404);
    const data = Buffer.isBuffer(upload.data) ? upload.data : upload.data?.buffer;
    if (!(data instanceof Uint8Array) || upload.mimeType !== 'image/webp') return error('Image not found', 404);
    return new Response(new Uint8Array(data), {headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(data.byteLength),
      'Content-Disposition': 'inline; filename="profile.webp"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    }});
  } catch {return error('Image unavailable', 503);}
}
