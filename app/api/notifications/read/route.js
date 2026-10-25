import {privateJson, readJsonBody} from '@/lib/http-response';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {loadNotificationFeed, notificationQuery, resolveNotificationUser} from '@/lib/notifications';
import {validRequestOrigin} from '@/lib/request-origin';

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) return privateJson({error: 'Sign in to an active workspace first'}, {status: 401});
  if (!validRequestOrigin(req)) return privateJson({error: 'Invalid request origin'}, {status: 403});
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return privateJson({error: 'Send an application/json record'}, {status: 415});
  let body;
  try {body = await readJsonBody(req,2048);} catch(cause) {return privateJson({error:cause.message||'Invalid JSON record'},{status:cause.status||400});}
  if (typeof body?.id !== 'string' || !/^(all|[0-9a-f-]{36})$/.test(body.id)) return privateJson({error: 'A notification ID or all is required'}, {status: 400});
  try {
    const db = await database();
    const user = await resolveNotificationUser(db, session.user);
    if (!user) return privateJson({error: 'Workspace access revoked'}, {status: 403});
    const query = notificationQuery(user);
    if (body.id !== 'all') query.id = body.id;
    await db.collection('notifications').updateMany(query, {$set: {read: true, readAt: new Date().toISOString()}});
    return privateJson(await loadNotificationFeed(db, user), {headers: {'Cache-Control': 'private, no-store'}});
  } catch {return privateJson({error: 'Unable to mark notifications as read'}, {status: 503});}
}
