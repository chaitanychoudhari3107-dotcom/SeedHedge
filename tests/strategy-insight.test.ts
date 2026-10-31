import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, defaultRates } from '../src/engine.ts';
import { strategyBreakdown, strategyScenarioRows, modelComparison } from '../src/strategy-insight.ts';
import { calmScenarios, demoScenarios } from '../src/fixtures.ts';
import { SOWING_DATES } from '../src/weather.ts';

test('10 percent increments produce 95 candidates for five dates', () => {
  const dates = ['2024-06-20','2024-06-24','2024-06-28','2024-07-02','2024-07-05'];
  const r = analyze({ dates, farmAcres: 2, rates: defaultRates, scenarios: calmScenarios,
    threshold:.60,approvedDates:new Set(dates),increment:.10 });
  assert.equal(r.strategies.length,95);
  assert.equal(r.strategies.filter(s=>s.allocations.length===2).length,90);
});

test('strategy cost breakdown matches engine cost and counts visits', () => {
  const dates=['2024-06-20','2024-06-24'];
  const scenarios = [{ id: 'mild', label: 'test conditions', byDate: Object.fromEntries(dates.map(d => [d, .2])) }];
  const r=analyze({dates,farmAcres:2,rates:defaultRates,scenarios,threshold:.60,approvedDates:new Set(dates),increment:.10});
  for(const s of r.strategies){
    const b=strategyBreakdown(s,2,defaultRates);
    assert.equal(b.total,s.cost);
    assert.equal(b.perVisit,s.visits*defaultRates.mobilizationPerVisit);
  }
});

test('comparison uses selected strategy without replacing the winner', () => {
  const dates=['2024-06-20','2024-06-24'];
  const scenarios = [{ id: 'mild', label: 'test conditions', byDate: Object.fromEntries(dates.map(d => [d, .2])) }];
  const r=analyze({dates,farmAcres:2,rates:defaultRates,scenarios,threshold:.60,approvedDates:new Set(dates),increment:.10});
  assert.ok(r.winner);
  const other=r.strategies.find(s=>s.allocations.length===2)!;
  const cmp=modelComparison(r.winner!,other);
  assert.ok(cmp.extraCost>0);
  assert.equal(cmp.same,false);
  assert.equal(r.winner!.visits,1);
  const rows=strategyScenarioRows(other,scenarios);
  assert.equal(rows.length,1);
  assert.ok(rows.every(x=>x.exposure!==null));
});

test('synthetic demonstration covers every current selectable sowing date', () => {
  for (const scenario of [...calmScenarios,...demoScenarios]) {
    for (const date of SOWING_DATES) assert.equal(typeof scenario.byDate[date], 'number', `${scenario.id}: ${date}`);
  }
});
