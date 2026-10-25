import {normalizeEmail, ROLES, validIdentity} from './access.js';
import {credentialVersionMatches} from './credentials.js';

export function notificationQuery(user) {
  if (!validIdentity(user)) throw new Error('Active workspace membership required');
  return {
    workspaceId: user.workspaceId,
    recipientEmail: normalizeEmail(user.email),
    actorEmail: {$ne: normalizeEmail(user.email)},
    audience: {$in: user.role === 'employee' ? ['all', 'recipient'] : ['all', 'recipient', 'managers']},
  };
}

/** Re-resolve persisted membership for each delivery; roles from a JWT or client are not authoritative. */
export async function resolveNotificationUser(db, identity) {
  const email = normalizeEmail(identity?.email);
  if (!email || typeof identity?.workspaceId !== 'string' || !identity.workspaceId) return null;
  const passwordSession = identity.authMethod === 'credentials' || (!identity.authMethod && identity.verifiedGoogle === false && Number.isInteger(identity.exp));
  if (passwordSession && !await credentialVersionMatches(db, identity)) return null;
  const membership = await db.collection('memberships').findOne({email, workspaceId: identity.workspaceId, status: 'Active'});
  if (!membership || !ROLES.includes(membership.role)) return null;
  if (!await db.collection('workspaces').findOne({id: membership.workspaceId}, {projection: {id: 1}})) return null;
  return {email, workspaceId: membership.workspaceId, role: membership.role, name: identity.name || membership.name || email};
}

export function notificationRecipients(members, event, actorEmail) {
  const actor = normalizeEmail(actorEmail);
  const recipients = new Set();
  for (const member of members) {
    const email = normalizeEmail(member.email);
    if (!email || email === actor || member.status !== 'Active' || !ROLES.includes(member.role)) continue;
    if (event.audience === 'managers' && member.role === 'employee') continue;
    if (event.audience === 'recipient' && email !== normalizeEmail(event.recipientEmail)) continue;
    recipients.add(email);
  }
  return [...recipients];
}

export function workflowEvents(user, resource, method, record, previous) {
  if (method === 'DELETE') return [];
  const events = [];
  if (['requests', 'compensation'].includes(resource)) {
    const kind = resource === 'requests' ? 'Time off' : 'Compensation';
    const page = resource === 'requests' ? 'Time off' : 'Compensation';
    if (record.status === 'Pending' && (method === 'POST' || user.role === 'employee')) events.push({audience: 'managers', title: `${kind} request ${method === 'POST' ? 'received' : 'updated'}`, body: `${record.name || user.name || user.email} ${method === 'POST' ? 'submitted' : 'updated'} a ${record.type || kind.toLowerCase()} request.`, page});
    if (user.role !== 'employee' && record.owner && record.status !== 'Pending' && record.status !== previous?.status) events.push({audience: 'recipient', recipientEmail: record.owner, title: `${kind} request ${record.status.toLowerCase()}`, body: `Your ${record.type || kind.toLowerCase()} request is now ${record.status.toLowerCase()}.`, page});
  }
  if (resource === 'announcements') events.push({audience: 'all', title: method === 'POST' ? 'New announcement' : 'Announcement updated', body: record.title || 'Your workspace has a new announcement.', page: 'Announcements'});
  if (resource === 'compliance' && record.status === 'Action needed' && (method === 'POST' || previous?.status !== record.status || previous?.priority !== record.priority || previous?.dueDate !== record.dueDate)) events.push({audience: 'managers', title: 'Compliance action needed', body: record.title || 'A compliance task needs your review.', page: 'Compliance'});
  if (resource === 'memberships') events.push({audience: 'recipient', recipientEmail: record.email, title: method === 'POST' ? 'Welcome to your workspace' : 'Your workspace access was updated', body: `Your role is ${record.role === 'hr' ? 'HR manager' : record.role}, with ${record.status.toLowerCase()} access.`, page: 'Overview'});
  return events;
}

export async function emitWorkflowNotifications(db, user, resource, method, record, previous) {
  const events = workflowEvents(user, resource, method, record, previous);
  if (!events.length) return;
  const members = await db.collection('memberships').find({workspaceId: user.workspaceId, status: 'Active'}, {projection: {email: 1, role: 1, status: 1}}).toArray();
  const notifications = events.flatMap(event => notificationRecipients(members, event, user.email).map(recipientEmail => ({id: crypto.randomUUID(), workspaceId: user.workspaceId, recipientEmail, actorEmail: normalizeEmail(user.email), audience: event.audience, title: event.title.slice(0, 140), body: event.body.slice(0, 320), page: event.page, createdAt: new Date().toISOString(), read: false})));
  if (notifications.length) await db.collection('notifications').insertMany(notifications, {ordered: false});
}

export async function loadNotificationFeed(db, user) {
  const query = notificationQuery(user);
  const [items, unreadCount] = await Promise.all([
    db.collection('notifications').find(query, {projection: {_id: 0, workspaceId: 0, actorEmail: 0}}).sort({createdAt: -1}).limit(50).toArray(),
    db.collection('notifications').countDocuments({...query, read: false}),
  ]);
  return {items, unreadCount};
}

export function socketOriginAllowed(origin, host, canonicalUrl) {
  if (typeof origin !== 'string' || !host) return false;
  try {
    const source = new URL(origin);
    if (!['http:', 'https:'].includes(source.protocol) || source.pathname !== '/' || source.search || source.hash) return false;
    if (source.host === host) return true;
    return canonicalUrl ? source.origin === new URL(canonicalUrl).origin : false;
  } catch {return false;}
}

/** Real WebSocket delivery, backed by a short Mongo refresh for standalone MongoDB installations. */
export function connectNotificationSocket(socket, identity, {db, refreshEveryMs = 2000, heartbeatEveryMs = 30000}) {
  let closed = false;
  let refreshing = false;
  let alive = true;
  let previousPayload = '';
  let lastRequested = 0;
  function cleanup() {closed = true; clearInterval(refreshTimer); clearInterval(heartbeatTimer);}
  function end(code, reason) {if (closed) return; cleanup(); socket.close(code, reason);}
  async function refresh(force = false) {
    if (closed || refreshing || socket.readyState !== 1) return;
    refreshing = true;
    try {
      if (!identity.exp || identity.exp * 1000 <= Date.now()) return end(4401, 'Session expired');
      const user = await resolveNotificationUser(db, identity);
      if (!user) return end(4403, 'Workspace access revoked');
      const feed = await loadNotificationFeed(db, user);
      const payload = JSON.stringify({type: 'notifications', ...feed});
      if (socket.bufferedAmount > 1024 * 1024) return end(1013, 'Client is too slow');
      if (!closed && socket.readyState === 1 && (force || payload !== previousPayload)) {socket.send(payload); previousPayload = payload;}
    } catch {end(1011, 'Notifications are unavailable');}
    finally {refreshing = false;}
  }
  const refreshTimer = setInterval(() => void refresh(), refreshEveryMs);
  const heartbeatTimer = setInterval(() => {
    if (closed) return;
    if (!alive) {cleanup(); socket.terminate(); return;}
    alive = false;
    socket.ping();
  }, heartbeatEveryMs);
  refreshTimer.unref?.(); heartbeatTimer.unref?.();
  socket.on('pong', () => {alive = true;});
  socket.on('close', cleanup);
  socket.on('error', cleanup);
  socket.on('message', (data, binary) => {
    if (binary) return end(1003, 'Text messages only');
    try {
      const message = JSON.parse(data.toString());
      if (message.type !== 'refresh') return end(1008, 'Unsupported message');
      if (Date.now() - lastRequested < 500) return;
      lastRequested = Date.now();
      void refresh(true);
    } catch {end(1008, 'Invalid message');}
  });
  return {refresh, ready: refresh(true), close: () => end(1001, 'Server shutdown')};
}
