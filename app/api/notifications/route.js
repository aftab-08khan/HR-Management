import {privateJson, readJsonBody} from '@/lib/http-response';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {database} from '@/lib/mongodb';
import {loadNotificationFeed, resolveNotificationUser} from '@/lib/notifications';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) return privateJson({error: 'Sign in to an active workspace first'}, {status: 401});
  try {
    const db = await database();
    const user = await resolveNotificationUser(db, session.user);
    if (!user) return privateJson({error: 'Workspace access revoked'}, {status: 403});
    return privateJson(await loadNotificationFeed(db, user), {headers: {'Cache-Control': 'private, no-store'}});
  } catch {return privateJson({error: 'Notifications are unavailable'}, {status: 503});}
}
