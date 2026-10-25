import {privateJson, readJsonBody} from '@/lib/http-response';
import {getServerSession} from 'next-auth';
import {authOptions, resolveMembership, provisionWorkspace} from '@/lib/auth';
import {database, ensureWorkspaceIndexes} from '@/lib/mongodb';
import {validIdentity} from '@/lib/access';
import {validRequestOrigin} from '@/lib/request-origin';
import {backfillRecordCodes} from '@/lib/codes';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!validIdentity(session?.user)) {
    if (session?.user?.verifiedGoogle) return privateJson({error: 'Create a workspace or contact your administrator', onboardingRequired: true}, {status: 409});
    return privateJson({error: 'Sign in to an active workspace first'}, {status: 401});
  }
  try {
    const member = await resolveMembership(session.user.email, session.user.workspaceId);
    if (!member) return privateJson({error: 'Workspace access revoked'}, {status: 403});
    const db = await database();
    const workspace = await db.collection('workspaces').findOne({id: member.workspaceId}, {projection: {_id: 0, membershipLock: 0}});
    const response = {...workspace, role: member.role, memberCode: member.memberCode};
    if (member.role === 'admin') {
      response.members = await db.collection('memberships').find({workspaceId: member.workspaceId}, {projection: {_id: 0}}).limit(1000).toArray();
      await backfillRecordCodes(db, 'memberships', member.workspaceId, response.members);
    }
    return privateJson(response);
  } catch {return privateJson({error: 'Workspace unavailable'}, {status: 503});}
}


export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.verifiedGoogle) return privateJson({error: 'A verified Google sign-in is required'}, {status: 401});
  if (!validRequestOrigin(req)) return privateJson({error: 'Invalid request origin'}, {status: 403});
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return privateJson({error: 'Send an application/json record'}, {status: 415});
  if (Number(req.headers.get('content-length')) > 2048) return privateJson({error: 'Request is too large'}, {status: 413});
  let data;
  try {data = await readJsonBody(req,2048);} catch(cause) {return privateJson({error:cause.message||'Invalid JSON record'},{status:cause.status||400});}
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => key !== 'name')) return privateJson({error: 'Only a workspace name may be supplied'}, {status: 400});
  try {
    const db = await database();
    await ensureWorkspaceIndexes(db);
    const workspace = await provisionWorkspace(session.user, data.name, db);
    return privateJson(workspace, {status: 201});
  } catch (error) {return privateJson({error: error.status ? error.message : 'Workspace setup failed. Please retry.'}, {status: error.status || 503});}
}
