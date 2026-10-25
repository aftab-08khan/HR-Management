import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {ROLES} from '@/lib/access';
import {createDemoSession, DEMO_COOKIE_NAME, demoAccessEnabled, demoCookieOptions, verifyDemoSession} from '@/lib/demo-session';
import {demoCredentialRole} from '@/lib/demo-credentials';
import {validRequestOrigin} from '@/lib/request-origin';

const respond = (body, status = 200) => NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});
async function readSmallJson(req) {
  if (Number(req.headers.get('content-length')) > 2048 || !req.body) throw new Error('Invalid request');
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {await reader.cancel(); throw new Error('Invalid request');}
      chunks.push(Buffer.from(value));
    }
  } finally {reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function GET() {
  const enabled = demoAccessEnabled();
  const session = enabled ? verifyDemoSession((await cookies()).get(DEMO_COOKIE_NAME)?.value) : null;
  return respond({enabled, role: session?.role || null});
}
export async function POST(req) {
  if (!demoAccessEnabled()) return respond({enabled: false, error: 'Demo access is disabled'}, 403);
  if (!validRequestOrigin(req)) return respond({error: 'Invalid request origin'}, 403);
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return respond({error: 'Send an application/json record'}, 415);
  let body;
  try {body = await readSmallJson(req);} catch {return respond({error: 'Invalid demo request'}, 400);}
  if (!body || typeof body!=='object' || Array.isArray(body)) return respond({error:'Invalid demo request'},400);
  const keys=Object.keys(body);
  let role;
  if(keys.length===1&&keys[0]==='role'&&ROLES.includes(body.role))role=body.role;
  else if(keys.length===2&&keys.includes('email')&&keys.includes('password')){
    role=demoCredentialRole(body.email,body.password);
    if(!role)return respond({error:'Email or password is incorrect'},401);
  } else return respond({error:'Invalid demo request'},400);
  const response = respond({enabled: true, role});
  response.cookies.set(DEMO_COOKIE_NAME, createDemoSession(role), demoCookieOptions());
  return response;
}
export async function DELETE(req) {
  if (!validRequestOrigin(req)) return respond({error: 'Invalid request origin'}, 403);
  const response = respond({enabled: demoAccessEnabled(), role: null});
  response.cookies.set(DEMO_COOKIE_NAME, '', {...demoCookieOptions(), maxAge: 0, expires: new Date(0)});
  return response;
}
