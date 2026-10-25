import {MongoClient} from 'mongodb';
import {initialData} from '../lib/seed.js';
import {RESOURCES} from '../lib/access.js';
import {backfillRecordCodes, generatedRecordCode} from '../lib/codes.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI first; use node --env-file=.env.local scripts/seed.mjs');
const workspaceId = process.env.WORKSPACE_ID?.trim();
if (!workspaceId) throw new Error('Set WORKSPACE_ID to identify the tenant to seed');
const workspaceName = process.env.WORKSPACE_NAME || 'My workspace';
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
const client = await new MongoClient(process.env.MONGODB_URI).connect();
try {
  const db = client.db(process.env.MONGODB_DB || 'peopleos');
  await db.collection('workspaces').createIndex({id: 1}, {unique: true});
  await db.collection('memberships').createIndex({workspaceId: 1, email: 1}, {unique: true});
  await db.collection('memberships').createIndex({email: 1, status: 1});
  await db.collection('workspaces').updateOne({id: workspaceId}, {$setOnInsert: {id: workspaceId, name: workspaceName, plan: 'Business', createdAt: new Date().toISOString()}}, {upsert: true});
  for (const email of adminEmails) await db.collection('memberships').updateOne({workspaceId, email}, {$setOnInsert: {id: crypto.randomUUID(), workspaceId, email, memberCode: generatedRecordCode('memberships', `${workspaceId}:${email}`), role: 'admin', status: 'Active', createdAt: new Date().toISOString()}}, {upsert: true});
  for (const [name, rows] of Object.entries(initialData)) {
    if (!RESOURCES.includes(name) || ['memberships', 'audit'].includes(name)) continue;
    await db.collection(name).createIndex({workspaceId: 1, id: 1}, {unique: true});
    for (const row of rows) {
      const employee = initialData.employees?.find(employee => employee.name === row.name);
      // Namespaced IDs coexist safely with older, unscoped demo documents. Those are never exposed by the APIs.
      const id = `${workspaceId}-${row.id}`;
      const scoped = {...row, id, workspaceId};
      if (name === 'employees') scoped.employeeCode ||= generatedRecordCode(name, row.id);
      if (['requests', 'reviews', 'compensation'].includes(name)) scoped.owner = employee?.email?.toLowerCase() || adminEmails[0] || 'unassigned@example.invalid';
      await db.collection(name).updateOne({workspaceId, id}, {$setOnInsert: scoped}, {upsert: true});
    }
    if (name === 'employees') await backfillRecordCodes(db, name, workspaceId, await db.collection(name).find({workspaceId}).toArray());
    console.log(`Seeded ${name}: ${rows.length} records for ${workspaceId}`);
  }
  console.log('Done. Existing tenant records and membership roles were preserved.');
} finally {await client.close();}
