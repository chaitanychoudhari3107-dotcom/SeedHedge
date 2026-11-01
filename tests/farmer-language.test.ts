import test from 'node:test';
import assert from 'node:assert/strict';
import {farmerText,choices} from '../src/farmer-language.ts';
test('main four steps have short, distinct Marathi and Hindi labels',()=>{
  for(const label of ['Check Weather','Enter Farm Details','Check My Plan','See My Action Plan']){
    assert.notEqual(farmerText('mr',label),label);
    assert.notEqual(farmerText('hi',label),label);
  }
});
test('source uncertainty and next-step guidance are translated',()=>{
  for(const label of ['These are past records, not a forecast for this season.','Full weather data is still loading.','No planting advice until full weather data is available.','Compare costs, check current field conditions, and ask local agricultural experts before sowing.']){
    assert.notEqual(farmerText('mr',label),label);
    assert.notEqual(farmerText('hi',label),label);
  }
});
test('language options are stable and original English is not rewritten',()=>{
  assert.deepEqual(choices.map(c=>c.value),['en','mr','hi']);
  assert.equal(farmerText('en','Check Weather'),'Check Weather');
});
