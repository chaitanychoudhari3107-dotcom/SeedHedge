import test from 'node:test';
import assert from 'node:assert/strict';
import {explainQuestion, type HelpContext} from '../src/help.ts';
import {defaultRates, analyze} from '../src/engine.ts';
import {rainfallThresholdPlan} from '../src/approaches.ts';
import {syntheticScenariosForDates} from '../src/fixtures.ts';
const dates=['2024-06-20','2024-06-24'];
const b=analyze({dates,farmAcres:2,rates:defaultRates,scenarios:syntheticScenariosForDates(dates,'calm'),threshold:.60,approvedDates:new Set(dates),increment:.1}).winner;
const ctx:HelpContext={location:'Akola',acres:2,dates,source:'synthetic',loading:false,weatherError:null,planA:rainfallThresholdPlan(null,dates,2,defaultRates),planB:b,rates:defaultRates};
test('Q&A never describes fictional scenarios as verified observations',()=>{
 assert.match(explainQuestion('Where is the weather from?',ctx),/SYNTHETIC DEMO/);
 assert.match(explainQuestion('plan a',ctx),/needs complete historical rainfall/);
});
test('Q&A cost answer uses current rates without a budget field',()=>{
 const a=explainQuestion('cost',ctx);assert.match(a,/2 acres/);assert.match(a,/450/);assert.match(a,/editable examples/);
});
test('Q&A declines ungrounded forecasts and explains known limitations',()=>{
 const a=explainQuestion('predict disease tomorrow',ctx);assert.match(a,/cannot answer/);
 assert.match(explainQuestion('what next?',ctx),/Neither plan predicts yield/);
});
test('Q&A acknowledges missing historical API without inventing weather',()=>{
 const a=explainQuestion('rain forecast',{...ctx,source:'historical',weatherError:'2025 HTTP 503'});
 assert.match(a,/could not be fully verified/);assert.match(a,/2025 HTTP 503/);
});

test('Q&A explains soybean-only scope and what cost cannot predict',()=>{
 assert.match(explainQuestion('Can I grow cotton?',ctx),/soybean.*only/i);
 assert.match(explainQuestion('Will this date give more yield?',ctx),/no validated yield/);
});
test('Q&A explains one date versus split visits without inventing benefit',()=>{
 const answer=explainQuestion('Why one day or two dates?',{...ctx, strategies:b?[b]:[]});
 assert.match(answer,/planting visit/);assert.match(answer,/no measured yield/i);
});
