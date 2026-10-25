import {createHash} from 'node:crypto';

export function normalizeEmployeeCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code) ? code : null;
}

export function generatedRecordCode(resource, id, attempt = 0) {
  if (resource === 'employees' && attempt === 0) {
    const legacy = String(id).match(/(?:^|[-_])(EMP[-_]\d{3,})$/i);
    if (legacy) return legacy[1].replace('_', '-').toUpperCase();
  }
  const suffix = createHash('sha256').update(`${id}${attempt ? `:${attempt}` : ''}`).digest('hex').slice(0, 12).toUpperCase();
  return `${resource === 'employees' ? 'EMP' : 'MEM'}-${suffix}`;
}

/** Fill only absent legacy codes, within the already-authorized tenant and record IDs. */
export async function backfillRecordCodes(db, resource, workspaceId, rows) {
  if (!['employees', 'memberships'].includes(resource)) return rows;
  const field = resource === 'employees' ? 'employeeCode' : 'memberCode';
  const collection = db.collection(resource);
  async function fill(row) {
    if (row[field] || typeof row.id !== 'string') return;
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generatedRecordCode(resource, row.id, attempt);
      try {
        const result = await collection.updateOne({workspaceId, id: row.id, $or: [{[field]: {$exists: false}}, {[field]: ''}, {[field]: null}]}, {$set: {[field]: code}});
        if (result.matchedCount) {row[field] = code; return;}
        const current = await collection.findOne({workspaceId, id: row.id}, {projection: {[field]: 1}});
        if (current?.[field]) {row[field] = current[field]; return;}
      } catch (error) {if (error.code !== 11000) throw error;}
    }
    throw new Error('Unable to allocate a unique record code');
  }
  for (let offset = 0; offset < rows.length; offset += 25) await Promise.all(rows.slice(offset, offset + 25).map(fill));
  return rows;
}
