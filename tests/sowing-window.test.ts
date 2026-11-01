import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatesForWindow, DEMO_WINDOW_START, DEMO_WINDOW_END, DEFAULT_INTERVAL_DAYS, DATE_INTERVAL_OPTIONS } from '../src/sowing-window.ts';
import { replayForDates, type HistoricalReplay, type HistoricalDay } from '../src/weather.ts';
import { REGIONS } from '../src/regions.ts';
import { syntheticScenariosForDates } from '../src/fixtures.ts';
import { analyze, defaultRates } from '../src/engine.ts';

test('default demo selects a 3-day interval, not a hardcoded five-date list', () => {
  assert.equal(DEFAULT_INTERVAL_DAYS, 3);
  assert.deepEqual(candidatesForWindow(DEMO_WINDOW_START, DEMO_WINDOW_END).dates,
    ['2024-06-20', '2024-06-23', '2024-06-26', '2024-06-29', '2024-07-02', '2024-07-05']);
});
test('farmer can generate daily options or choose a wider spacing, always including end', () => {
  const daily = candidatesForWindow('2024-06-20', '2024-07-05', 1);
  assert.equal(daily.dates.length, 16);
  assert.equal(new Set(daily.dates).size, 16);
  const everyFive = candidatesForWindow('2024-06-20', '2024-07-05', 5);
  assert.deepEqual(everyFive.dates, ['2024-06-20','2024-06-25','2024-06-30','2024-07-05']);
  const uneven = candidatesForWindow('2024-06-20', '2024-07-05', 7);
  assert.deepEqual(uneven.dates, ['2024-06-20', '2024-06-27', '2024-07-04', '2024-07-05']);
  assert.deepEqual(DATE_INTERVAL_OPTIONS, [1, 2, 3, 5, 7]);
});
test('full historical replay range can be examined daily without a five-date cap', () => {
  const selection = candidatesForWindow('2024-06-15','2024-07-08',1);
  assert.equal(selection.error,null);
  assert.equal(selection.dates.length,24);
  assert.equal(selection.dates[0],'2024-06-15');
  assert.equal(selection.dates.at(-1),'2024-07-08');
});
test('invalid planting interval does not silently substitute a default', () => {
  for (const interval of [0,4,8,-1,2.5]) {
    const selection = candidatesForWindow('2024-06-20','2024-07-05',interval);
    assert.ok(selection.error);
    assert.deepEqual(selection.dates,[]);
  }
});
test('farmer-selected window generates different bounded dates, including endpoints', () => {
  const d = candidatesForWindow('2024-06-23', '2024-07-03');
  assert.equal(d.error, null);
  assert.equal(d.dates[0], '2024-06-23');
  assert.equal(d.dates.at(-1), '2024-07-03');
  assert.ok(d.dates.length >= 2 && d.dates.length <= 7);
  assert.ok(!d.dates.includes('2024-06-20'));
});
test('invalid/out-of-supported-range windows produce no dates, not a recommendation', () => {
  for (const [start,end] of [['2024-07-07','2024-07-01'],['2024-06-10','2024-07-05'],['2024-06-20','2024-07-15'],['bad','2024-07-05']]) {
    const w = candidatesForWindow(start,end); assert.deepEqual(w.dates,[]); assert.ok(w.error);
  }
});
test('one-day window is valid for one-visit comparison', () => {
  assert.deepEqual(candidatesForWindow('2024-06-22','2024-06-22').dates, ['2024-06-22']);
});
test('same generated dates drive both historical weather scenario scores and plan engine', () => {
  const years=[2022,2023,2024,2025];
  const dailyByYear: Record<number,HistoricalDay[]>={};
  for(const y of years) dailyByYear[y]=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(y,5,1+i)).toISOString().slice(0,10),precipitationMm:8,maxTempC:30}));
  const replay: HistoricalReplay={region:REGIONS[0],years,dailyByYear,sourceUrls:[],fetchTransports:[],retrievedAt:'2024-07-10T00:00:00Z',scenarios:[],diagnostics:{}};
  const dates=candidatesForWindow('2024-06-23','2024-07-03').dates;
  const computed=replayForDates(replay,dates);
  assert.deepEqual(computed.scenarios[0].byDate && Object.keys(computed.scenarios[0].byDate).sort(),dates);
  const result=analyze({dates,farmAcres:2,rates:defaultRates,scenarios:computed.scenarios,threshold:0.6,approvedDates:new Set(dates),increment:0.1});
  assert.equal(result.strategies.length,dates.length+(dates.length*(dates.length-1)/2)*9);
  assert.ok(result.strategies.every(s=>s.allocations.every(a=>dates.includes(a.date))));
});
test('fictional stress and calm scenarios cover new dates without claiming observations', () => {
  const dates=candidatesForWindow('2024-06-18','2024-06-30').dates;
  const stress=syntheticScenariosForDates(dates,'stress');
  const calm=syntheticScenariosForDates(dates,'calm');
  assert.equal(stress.length,3); assert.equal(calm.length,2);
  for(const s of [...stress,...calm]) {assert.match(s.label,/Fictional/);assert.deepEqual(Object.keys(s.byDate).sort(),dates);}
  assert.ok(stress[0].byDate[dates[0]]! > calm[0].byDate[dates[0]]!);
});

test('24 generated candidates produce the complete set of one/two-date options', () => {
  const dates = candidatesForWindow('2024-06-15', '2024-07-08', 1).dates;
  const result = analyze({dates, farmAcres:2, rates:defaultRates,
    scenarios:syntheticScenariosForDates(dates, 'calm'), threshold:0.60,
    approvedDates:new Set(dates), increment:0.1});
  assert.equal(result.strategies.length, 24 + 9 * 24 * 23 / 2);
  assert.ok(result.strategies.every(s => s.allocations.every(a => dates.includes(a.date))));
});
