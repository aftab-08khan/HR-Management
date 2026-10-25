import {getServerSession} from 'next-auth';
import {authOptions, resolveMembership} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {validIdentity} from '@/lib/access';
import {validRequestOrigin} from '@/lib/request-origin';
import {CredentialSetupError, setWorkspacePassword} from '@/lib/credentials';

const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});
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
    if (!reader) return respond({error: 'Invalid credential request'}, 400);
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
    try {body = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return respond({error: 'Invalid credential request'}, 400);}
    if (!body || Array.isArray(body) || Object.keys(body).some(key => !['email', 'password'].includes(key))) return respond({error: 'Provide only a member email and password'}, 400);
    const actor = {...session.user, role: member.role, workspaceId: member.workspaceId};
    return respond(await setWorkspacePassword(await database(), actor, body));
  } catch (error) {
    if (error instanceof CredentialSetupError) return respond({error: error.message}, error.status);
    return respond({error: 'Unable to update credentials'}, 503);
  }
}
