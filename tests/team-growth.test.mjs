import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTeamGrowth, dubaiCalendarDate, headcountAxis, validStartDate} from '../lib/team-growth.js';

test('six-month range crosses the year boundary and includes only the current month to date', () => {
  const result=buildTeamGrowth([], {period:'Last 6 months',asOf:'2027-02-15T08:00:00Z'});
  assert.deepEqual(result.series.map(point=>point.key), ['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02']);
  assert.equal(result.series.at(-1).cutoff,'2027-02-15');
  assert.equal(result.series.at(-1).monthToDate,true);
});

test('the Dubai calendar determines year and month at the UTC boundary', () => {
  assert.equal(dubaiCalendarDate('2026-12-31T21:00:00Z'),'2027-01-01');
  const result=buildTeamGrowth([], {asOf:'2026-12-31T21:00:00Z'});
  assert.deepEqual(result.series.map(point=>point.key), ['2027-01']);
});

test('joins on the real month end count in that month, including leap day', () => {
  const result=buildTeamGrowth([{joined:'2024-01-31'},{joined:'2024-02-29'},{joined:'2024-03-01'}], {asOf:'2024-03-12T08:00:00Z'});
  assert.equal(result.series[1].end,'2024-02-29');
  assert.deepEqual(result.series.map(point=>point.headcount),[1,2,3]);
  assert.deepEqual(result.series.map(point=>point.newHires),[1,1,1]);
});

test('current-month future starts are excluded until their recorded start day', () => {
  const result=buildTeamGrowth([{joined:'2026-10-24'},{joined:'2026-10-25'},{joined:'2026-11-01'}], {asOf:'2026-10-24T12:00:00Z'});
  assert.equal(result.currentHeadcount,1);
  assert.equal(result.newHires,1);
  assert.equal(result.futureStarts,2);
  assert.equal(result.series.at(-1).headcount,1);
});

test('axis scales past twelve employees without clipping and keeps integer ticks', () => {
  for(const maximum of [0,1,12,13,28,101,1520]){
    const axis=headcountAxis(maximum);
    assert.ok(axis.max>=maximum);
    assert.ok(axis.ticks.every(Number.isInteger));
    assert.equal(axis.ticks[0],0);
    assert.equal(axis.ticks.at(-1),axis.max);
  }
  const result=buildTeamGrowth(Array.from({length:28},()=>({joined:'2026-01-01'})), {asOf:'2026-10-24T12:00:00Z'});
  assert.equal(result.currentHeadcount,28);
  assert.ok(result.axis.max>=28);
});

test('invalid or missing start dates do not fabricate headcount', () => {
  const result=buildTeamGrowth([{joined:'2026-02-30'},{joined:'not-a-date'},{},{joined:'2026-01-01',department:'Design'}], {asOf:'2026-10-24T12:00:00Z'});
  assert.equal(result.excludedInvalid,3);
  assert.equal(result.currentHeadcount,1);
  assert.deepEqual(result.departments,[{name:'Design',count:1}]);
  assert.equal(validStartDate('2025-02-29'),null);
  assert.notEqual(validStartDate('2024-02-29'),null);
});

test('new hires exclude the baseline roster and empty rosters remain finite', () => {
  const result=buildTeamGrowth([{joined:'2025-01-01'},{joined:'2026-06-01'}], {period:'Last 6 months',asOf:'2026-10-24T12:00:00Z'});
  assert.equal(result.newHires,1);
  assert.equal(result.currentHeadcount,2);
  const empty=buildTeamGrowth([], {asOf:'2026-01-01T08:00:00Z'});
  assert.equal(empty.series.length,1);
  assert.equal(empty.series[0].headcount,0);
  assert.equal(empty.axis.max,4);
});
