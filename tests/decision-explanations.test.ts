import test from 'node:test';
import assert from 'node:assert/strict';
import {explainPlantingVisits, explainSameDateCost, summarizeCandidateDates} from '../src/decision-explanations.ts';
import {defaultRates, evaluateStrategy} from '../src/engine.ts';
import type {HistoricalReplay} from '../src/weather.ts';
const a='2024-06-20',b='2024-06-24';
const scenarios=[{id:'2022',label:'a',byDate:{[a]:.2,[b]:.2}}];
function strat(date:string, date2?:string){return evaluateStrategy({allocations:date2?[{date,share:.5},{date:date2,share:.5}]:[{date,share:1}],farmAcres:2,rates:defaultRates,scenarios,threshold:.6,approvedDates:new Set([a,b])})}
test('one visit is cheaper when both qualify; explanation matches actual extra visit',()=>{
  const single=strat(a),split=strat(a,b);const v=explainPlantingVisits([split,single],single,defaultRates);
  assert.equal(v.chosenVisits,1);assert.equal(v.visitIncrement,450);assert.match(v.reason,/₹450/);assert.equal(v.bestSplit?.visits,2);
});
test('split is chosen when singles fail but the weighted split passes',()=>{
  const single=evaluateStrategy({allocations:[{date:a,share:1}],farmAcres:2,rates:defaultRates,scenarios:[{id:'2022',label:'stress',byDate:{[a]:.8,[b]:.2}}],threshold:.6,approvedDates:new Set([a,b])});
  const split=evaluateStrategy({allocations:[{date:a,share:.5},{date:b,share:.5}],farmAcres:2,rates:defaultRates,scenarios:[{id:'2022',label:'stress',byDate:{[a]:.8,[b]:.2}}],threshold:.6,approvedDates:new Set([a,b])});
  assert.equal(single.verdict,'unacceptable');assert.equal(split.verdict,'acceptable');
  assert.match(explainPlantingVisits([single,split],split,defaultRates).reason,/No one-date option/);
});
test('no qualified option gives no visit recommendation',()=>{
  const x=explainPlantingVisits([],null,defaultRates);assert.equal(x.chosenVisits,null);assert.match(x.title,/No planting plan/);
});
test('explains identical date costs and does not invent yield',()=>{
  const s=explainSameDateCost(2,defaultRates);assert.match(s,/₹8,750/);assert.match(s,/no measured crop yield/);
});
test('date evidence keeps observed annual values distinct from a yield prediction',()=>{
  const replay={years:[2022,2023],diagnostics:{[a]:{2022:{precedingRainMm:110,followingRainMm:15,maxTempC:32,modeledExposure:.25},2023:{precedingRainMm:95,followingRainMm:20,maxTempC:38,modeledExposure:.42}}}} as unknown as HistoricalReplay;
  const rows=summarizeCandidateDates(replay,[a,b],100);assert.equal(rows[0].minRain14,95);assert.equal(rows[0].maxTemp3,38);assert.equal(rows[0].qualifiesRain,false);assert.equal(rows[1].maxExposure,null);
  assert.equal(summarizeCandidateDates(replay,[a],90)[0].qualifiesRain,true);
});
