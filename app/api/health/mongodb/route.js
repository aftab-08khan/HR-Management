import {database} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await database();
    await db.command({ping: 1});
    return Response.json({connected: true, database: db.databaseName}, {headers: {'Cache-Control': 'no-store'}});
  } catch (cause) {
    const code = cause?.code || cause?.cause?.code || cause?.name || 'UNKNOWN';
    console.error('MongoDB health check failed:', code);
    const messages = {
      ENOTFOUND: 'MongoDB hostname could not be resolved. Check the MONGODB_URI host and DNS/network connection.',
      ECONNREFUSED: 'MongoDB refused the connection. Check the host and port.',
      ETIMEDOUT: 'MongoDB connection timed out. Check the network and Atlas IP access list.',
      EAI_AGAIN: 'DNS lookup failed temporarily. Check the network and try again.',
      MongoServerSelectionError: 'MongoDB could not be reached. Check the URI and Atlas IP access list.',
    };
    const message = cause?.code === 18 || cause?.code === 8000 || cause?.codeName === 'AuthenticationFailed' || /bad auth|authentication failed/i.test(cause?.message || '')
      ? 'MongoDB rejected the database username or password.'
      : messages[code] || 'MongoDB is unavailable. Check the connection URI, network access, and database credentials.';
    return Response.json({connected: false, code, error: message}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
}
