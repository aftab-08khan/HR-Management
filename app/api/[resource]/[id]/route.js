import {getServerSession} from 'next-auth';
import {authOptions, resolveMembership} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {RESOURCES, validIdentity} from '@/lib/access';
import {readRecordDetail, RecordDetailError} from '@/lib/record-details';

const respond = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});
export async function GET(_req, {params}) {
  try {
    const {resource, id} = await params;
    if (!RESOURCES.includes(resource)) return respond({error: 'Record type not found'}, 404);
    const session = await getServerSession(authOptions);
    if (!validIdentity(session?.user)) return respond({error: 'Sign in to an active workspace first'}, 401);
    const membership = await resolveMembership(session.user.email, session.user.workspaceId);
    if (!membership) return respond({error: 'Workspace access revoked'}, 403);
    const user = {...session.user, role: membership.role, workspaceId: membership.workspaceId};
    return respond({record: await readRecordDetail(await database(), user, resource, id)});
  } catch (error) {
    if (error instanceof RecordDetailError) return respond({error: error.message}, error.status);
    return respond({error: 'Record details are unavailable'}, 503);
  }
}
