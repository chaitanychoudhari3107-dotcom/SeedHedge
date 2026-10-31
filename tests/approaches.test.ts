import test from 'node:test';
import assert from 'node:assert/strict';
import {rainfallThresholdPlan, comparePlans} from '../src/approaches.ts';
import {defaultRates, analyze} from '../src/engine.ts';
import type {HistoricalReplay} from '../src/weather.ts';
const fake = {years:[2022,2023], diagnostics:{
 '2024-06-20':{2022:{precedingRainMm:120},2023:{precedingRainMm:70}},
 '2024-06-24':{2022:{precedingRainMm:115},2023:{precedingRainMm:110}},
},} as unknown as HistoricalReplay;
test('Plan A takes earliest candidate meeting threshold in every observed analog year',()=>{
 const p=rainfallThresholdPlan(fake,['2024-06-20','2024-06-24'],2,defaultRates,100);
 assert.equal(p.date,'2024-06-24');assert.equal(p.qualifiedCount,2);
});
test('Plan A rejects missing evidence and never silently recommends',()=>{
 assert.equal(rainfallThresholdPlan(null,['2024-06-20'],2,defaultRates).date,null);
 assert.equal(rainfallThresholdPlan(fake,['2024-06-20'],2,defaultRates,100).date,null);
});
test('Plan A uses current editable costs and does not change Plan B',()=>{
 const p=rainfallThresholdPlan(fake,['2024-06-24'],2,defaultRates,100);
 const b=analyze({dates:['2024-06-24'],farmAcres:2,rates:defaultRates,scenarios:[{id:'s',label:'s',byDate:{'2024-06-24':0.1}}],threshold:0.6,approvedDates:new Set(['2024-06-24'])}).winner;
 assert.equal(comparePlans(p,b).difference,0);
});
test('No Plan A result is separate from missing data and does not create a cost winner',()=>{
 const a=rainfallThresholdPlan(fake,['2024-06-20'],2,defaultRates,180);
 assert.equal(a.date,null);
 assert.ok(a.yearsCount>0);
 assert.match(a.explanation,/No enabled date meets/);
 const b=analyze({dates:['2024-06-20'],farmAcres:2,rates:defaultRates,scenarios:[{id:'s',label:'s',byDate:{'2024-06-20':.1}}],threshold:.60,approvedDates:new Set(['2024-06-20'])}).winner;
 assert.equal(comparePlans(a,b).difference,null);
});
test('Rainfall threshold can be adjusted without altering input weather evidence',()=>{
 const low=rainfallThresholdPlan(fake,['2024-06-20','2024-06-24'],2,defaultRates,60);
 const high=rainfallThresholdPlan(fake,['2024-06-20','2024-06-24'],2,defaultRates,180);
 assert.equal(low.date,'2024-06-20');
 assert.equal(high.date,null);
 assert.equal(fake.diagnostics['2024-06-20'][2022].precedingRainMm,120);
});
