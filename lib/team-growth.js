export const TEAM_GROWTH_PERIODS = ['This year', 'Last 6 months'];

function dateKey(date) { return date.toISOString().slice(0, 10); }

export function dubaiCalendarDate(asOf = new Date()) {
  const instant = asOf instanceof Date ? asOf : new Date(asOf);
  if (!Number.isFinite(instant.getTime())) throw new TypeError('A valid asOf date is required');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Dubai', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(instant).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function validStartDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && dateKey(new Date(timestamp)) === value ? timestamp : null;
}

export function headcountAxis(maxCount) {
  const maximum = Math.max(0, Number.isFinite(maxCount) ? maxCount : 0);
  const rawStep = Math.max(1, maximum / 4);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map(n => n * magnitude).find(n => n >= rawStep) || magnitude * 10;
  return {max:step * 4, step, ticks:[0, 1, 2, 3, 4].map(n => n * step)};
}

export function buildTeamGrowth(employees = [], {period = 'This year', asOf = new Date()} = {}) {
  const today = dubaiCalendarDate(asOf);
  const [year, month] = today.split('-').map(Number);
  const todayTimestamp = Date.parse(`${today}T00:00:00Z`);
  const sixMonths = period === 'Last 6 months';
  const count = sixMonths ? 6 : month;
  const firstMonth = new Date(Date.UTC(year, sixMonths ? month - 6 : 0, 1));
  const records = Array.isArray(employees) ? employees : [];
  const dated = records.map(employee => ({employee, timestamp:validStartDate(employee.joined)}));
  const valid = dated.filter(item => item.timestamp !== null);
  const eligible = valid.filter(item => item.timestamp <= todayTimestamp);
  const series = Array.from({length:count}, (_, index) => {
    const start = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const cutoff = Math.min(todayTimestamp, end.getTime());
    return {
      key:dateKey(start).slice(0, 7),
      label:start.toLocaleDateString('en-US', {month:'short', timeZone:'UTC'}),
      fullLabel:start.toLocaleDateString('en-US', {month:'long', year:'numeric', timeZone:'UTC'}),
      year:start.getUTCFullYear(),
      start:dateKey(start),
      end:dateKey(end),
      cutoff:dateKey(new Date(cutoff)),
      monthToDate:cutoff < end.getTime(),
      headcount:valid.filter(item => item.timestamp <= cutoff).length,
      newHires:valid.filter(item => item.timestamp >= start.getTime() && item.timestamp <= cutoff).length,
    };
  });
  const departments = Object.entries(eligible.reduce((groups, {employee}) => {
    const department = String(employee.department || 'Unassigned');
    groups[department] = (groups[department] || 0) + 1;
    return groups;
  }, {})).map(([name, count]) => ({name, count})).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    today,
    series,
    departments,
    currentHeadcount:eligible.length,
    newHires:series.reduce((sum, point) => sum + point.newHires, 0),
    excludedInvalid:dated.filter(item => item.timestamp === null).length,
    futureStarts:valid.filter(item => item.timestamp > todayTimestamp).length,
    axis:headcountAxis(Math.max(0, ...series.map(point => point.headcount))),
    periodStart:dateKey(firstMonth),
  };
}
