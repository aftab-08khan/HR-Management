import {MongoClient} from 'mongodb';
let promise;
export async function database() {
  if (!process.env.MONGODB_URI) throw new Error('MongoDB is not configured');
  if (!promise) promise = new MongoClient(process.env.MONGODB_URI, {serverSelectionTimeoutMS: 5000}).connect().catch(error => {promise = undefined; throw error;});
  return (await promise).db(process.env.MONGODB_DB || 'peopleos');
}
let indexPromise;
export async function ensureWorkspaceIndexes(db) {
  if (!indexPromise) indexPromise = Promise.all([
    db.collection('memberships').createIndex({workspaceId: 1, email: 1}, {unique: true}),
    db.collection('memberships').createIndex({email: 1, status: 1}),
    db.collection('credentials').createIndex({workspaceId: 1, email: 1}, {unique: true}),
    db.collection('credentials').createIndex({email: 1, workspaceId: 1}),
    db.collection('memberships').createIndex({workspaceId: 1, memberCode: 1}, {unique: true, partialFilterExpression: {memberCode: {$type: 'string'}}}),
    db.collection('employees').createIndex({workspaceId: 1, employeeCode: 1}, {unique: true, partialFilterExpression: {employeeCode: {$type: 'string'}}}),
    db.collection('workspaces').createIndex({id: 1}, {unique: true}),
    db.collection('notifications').createIndex({workspaceId: 1, recipientEmail: 1, createdAt: -1}),
    db.collection('notifications').createIndex({workspaceId: 1, recipientEmail: 1, read: 1}),
    db.collection('uploads').createIndex({workspaceId: 1, id: 1}, {unique: true}),
    db.collection('employees').createIndex({workspaceId: 1, email: 1}, {unique: true, partialFilterExpression: {workspaceId: {$type: 'string'}, email: {$type: 'string'}}}),
  ]).catch(error => {indexPromise = undefined; throw error;});
  return indexPromise;
}
