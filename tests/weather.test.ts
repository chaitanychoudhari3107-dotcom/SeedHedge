import test from 'node:test';
import assert from 'node:assert/strict';
import { heuristicExposure, historicalUrl, SOWING_DATES, fetchHistoricalYear, type HistoricalDay } from '../src/weather.ts';
import { REGIONS } from '../src/regions.ts';

test('real region coordinates feed the historical API URL', () => {
  const akola = historicalUrl(REGIONS[0], 2024);
  const jalna = historicalUrl(REGIONS[1], 2024);
  assert.notEqual(akola, jalna);
  assert.match(akola, /2024-06-01/);
  assert.match(jalna, /latitude=19.84/);
});

test('historical weather scoring comes from actual daily series, not fixed fixture', () => {
  const days: HistoricalDay[] = Array.from({length: 40}, (_, i) => {
    const d = new Date(Date.UTC(2024, 5, 1 + i));
    return {date: d.toISOString().slice(0, 10), precipitationMm: 0, maxTempC: 30};
  });
  const dry = heuristicExposure(days, '06-20');
  assert.equal(dry?.precedingRainMm, 0);
  assert.ok((dry?.modeledExposure ?? 0) > 0);
  for (let i = 5; i < 19; i++) days[i].precipitationMm = 10;
  const wet = heuristicExposure(days, '06-20');
  assert.equal(wet?.precedingRainMm, 140);
  assert.ok((wet?.modeledExposure ?? 1) < (dry?.modeledExposure ?? 0));
});

test('candidate dates cover central-zone historical replay window only', () => {
  assert.equal(SOWING_DATES[0], '2024-06-20');
  assert.equal(SOWING_DATES.at(-1), '2024-07-05');
});

test('weather API invalid/partial data are rejected, never treated as usable', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ timezone: 'Asia/Kolkata', daily_units: { precipitation_sum: 'mm', temperature_2m_max: '°C' }, daily: {time: ['2024-06-01'], precipitation_sum: [null], temperature_2m_max: [29]} }) })) as typeof fetch;
  try { await assert.rejects(() => fetchHistoricalYear(REGIONS[0], 2024), /Incomplete historical window/); }
  finally { globalThis.fetch = original; }
});
