import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, defaultRates, evaluateStrategy, generateStrategies, rankStrategies, strategyCost, type HazardScenario } from '../src/engine.ts';
import { dates, demoScenarios, calmScenarios } from '../src/fixtures.ts';
const approvedDates = new Set(dates);
const params = { dates, farmAcres: 2, rates: defaultRates, scenarios: demoScenarios, threshold: .6, approvedDates };
test('strategy count depends on chosen dates', () => {
  assert.equal(generateStrategies(['a']).length, 1);
  assert.equal(generateStrategies(['a','b']).length, 5);
  assert.equal(generateStrategies(['a','b','c']).length, 12);
});
test('shares total 100% and dates do not repeat within strategy', () => {
  for (const a of generateStrategies(dates)) {
    assert.equal(a.reduce((s, x) => s + x.share, 0), 1);
    assert.equal(new Set(a.map(x => x.date)).size, a.length);
  }
});
test('rejects lower-cost unsafe options, and ranks only acceptable alternatives', () => {
  const r = analyze(params);
  assert.ok(r.winner);
  assert.equal(r.winner.verdict, 'acceptable');
  assert.ok(r.strategies.some(x => x.verdict === 'unacceptable' && x.cost < r.winner!.cost));
  assert.equal(r.winner.cost, Math.min(...r.strategies.filter(x => x.verdict === 'acceptable').map(x => x.cost)));
});
test('stable weather prefers one operation over two when both pass', () => {
  const r = analyze({ ...params, scenarios: calmScenarios });
  assert.equal(r.winner?.visits, 1);
});
test('additional mobilization charges count once per operation', () => {
  const a = [{date:dates[0],share:1}];
  const b = [{date:dates[0],share:.5},{date:dates[1],share:.5}];
  const surcharge = strategyCost(b, 2, defaultRates) - strategyCost(a, 2, defaultRates);
  assert.equal(surcharge, defaultRates.mobilizationPerVisit + defaultRates.otherPerVisit);
});
test('editing local rates changes computed costs', () => {
  const original = analyze(params).winner!.cost;
  const changed = analyze({ ...params, rates: {...defaultRates, mobilizationPerVisit: 1000} }).winner!.cost;
  assert.ok(changed > original);
});
test('no passing strategies results in no winner', () => {
  const r = analyze({ ...params, threshold: 0 });
  assert.equal(r.winner, null);
});
test('missing scenario evidence is unknown, never approved', () => {
  const unknownScenarios: HazardScenario[] = [{id:'unknown',label:'missing',byDate:{}}];
  const r = analyze({ ...params, scenarios: unknownScenarios });
  assert.equal(r.winner, null);
  assert.ok(r.strategies.every(x => x.verdict === 'unknown'));
});
test('out of window dates are rejected before cost ranking', () => {
  const r = evaluateStrategy({allocations:[{date:'2024-08-01',share:1}],farmAcres:2,rates:defaultRates,scenarios:demoScenarios,threshold:.6,approvedDates});
  assert.equal(r.verdict, 'unacceptable');
});
test('invalid rates, area or shares cannot produce a recommendation', () => {
  assert.throws(() => strategyCost([{date:'a',share:1}],2,{...defaultRates,laborPerAcre:-3}));
  assert.throws(() => strategyCost([{date:'a',share:1}],0,defaultRates));
  assert.throws(() => strategyCost([{date:'a',share:.9}],2,defaultRates));
});
test('ranking ignores unacceptable strategies even if cheaper', () => {
  const r = analyze(params);
  assert.ok(rankStrategies(r.strategies).every(s => s.verdict === 'acceptable'));
});
