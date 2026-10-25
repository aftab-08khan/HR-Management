import {MongoClient} from 'mongodb';
import nextEnv from '@next/env';
import {ensureWorkspaceIndexes} from '../lib/mongodb.js';
import {normalizeEmail, ROLES} from '../lib/access.js';
import {generatedRecordCode} from '../lib/codes.js';
import {setWorkspacePassword, validCredentialEmail, validPassword} from '../lib/credentials.js';

const {loadEnvConfig} = nextEnv;
loadEnvConfig(process.cwd());
function option(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}
function readPassword(prompt) {
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal or PEOPLEOS_INITIAL_PASSWORD for password input');
  return new Promise((resolve, reject) => {
    const characters = [];
    process.stdout.write(prompt);
    process.stdin.setRawMode(true); process.stdin.resume();
    function finish(error) {
      process.stdin.off('data', input); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
      if (error) reject(error); else resolve(characters.join(''));
    }
    function input(chunk) {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {finish(new Error('Cancelled')); return;}
        if (character === '\r' || character === '\n') {finish(); return;}
        if (character === '\u007f' || character === '\b') {if (characters.length) {characters.pop(); process.stdout.write('\b \b');} continue;}
        if (character >= ' ' && characters.length < 129) {characters.push(character); process.stdout.write('*');}
      }
    }
    process.stdin.on('data', input);
  });
}
async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run user:create -- --workspace-id acme --workspace-name "Acme" --email admin@example.com --name "Admin" --role admin');
    console.log('Password is read securely from the terminal, or from PEOPLEOS_INITIAL_PASSWORD. Never pass it as a command-line argument.');
    return;
  }
  const allowedOptions = ['--workspace-id', '--workspace-name', '--email', '--name', '--role'];
  for (let index = 2; index < process.argv.length; index += 2) if (!allowedOptions.includes(process.argv[index]) || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error('Unknown or incomplete option. Use --help.');
  const workspaceId = option('--workspace-id', process.env.WORKSPACE_ID)?.trim();
  const workspaceName = option('--workspace-name', process.env.WORKSPACE_NAME || workspaceId)?.trim();
  const email = normalizeEmail(option('--email', (process.env.ADMIN_EMAILS || '').split(',')[0]));
  const name = option('--name', email)?.trim();
  const role = option('--role', 'employee');
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI in .env.local first');
  if (!workspaceId || workspaceId.length > 160 || /[\u0000-\u001f\u007f]/.test(workspaceId)) throw new Error('Supply an explicit workspace ID or configure WORKSPACE_ID');
  if (!workspaceName || workspaceName.length > 80 || !name || name.length > 120 || !validCredentialEmail(email) || !ROLES.includes(role)) throw new Error('Check the workspace name, member name, email, and role');
  let password = process.env.PEOPLEOS_INITIAL_PASSWORD;
  delete process.env.PEOPLEOS_INITIAL_PASSWORD;
  if (!password) {
    password = await readPassword('New password (12-128 characters): ');
    if (await readPassword('Confirm password: ') !== password) throw new Error('Passwords do not match');
  }
  if (!validPassword(password)) throw new Error('Password must contain 12 to 128 characters');
  const client = await new MongoClient(process.env.MONGODB_URI, {serverSelectionTimeoutMS: 5000}).connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'peopleos');
    await ensureWorkspaceIndexes(db);
    const members = db.collection('memberships');
    const memberCount = await members.countDocuments({workspaceId});
    let administrator = await members.findOne({workspaceId, role: 'admin', status: 'Active'}, {sort: {email: 1}});
    const existing = await members.findOne({workspaceId, email});
    if (existing?.status !== undefined && existing.status !== 'Active') throw new Error('This membership is suspended; the CLI will not reactivate it');
    if (existing && existing.role !== role) throw new Error('The existing role differs. Change roles through Workspace & access before resetting this password');
    if (!administrator && (memberCount > 0 || role !== 'admin')) throw new Error('The first member must be an administrator. Existing memberships without an active administrator require explicit repair');
    const now = new Date().toISOString();
    await db.collection('workspaces').updateOne({id: workspaceId}, {$setOnInsert: {id: workspaceId, name: workspaceName, plan: 'Business', createdAt: now}}, {upsert: true});
    const id = crypto.randomUUID();
    await members.updateOne({workspaceId, email}, {$setOnInsert: {id, workspaceId, email, name, role, status: 'Active', memberCode: generatedRecordCode('memberships', id), createdAt: now}}, {upsert: true});
    administrator ||= await members.findOne({workspaceId, email, role: 'admin', status: 'Active'});
    await setWorkspacePassword(db, {email: administrator.email, role: 'admin', workspaceId}, {email, password});
    console.log(`Password login is ready for ${email} in workspace ${workspaceId}. Existing roles and other tenants were preserved.`);
  } finally {await client.close();}
}
try {await main();} catch (error) {console.error(error.message); process.exitCode = 1;}
