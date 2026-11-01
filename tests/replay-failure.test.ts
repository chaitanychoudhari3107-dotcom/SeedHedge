import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHistoricalReplay, IncompleteReplayError } from '../src/weather.ts';
import { REGIONS } from '../src/regions.ts';

const makeYear = (year:number) => ({
  timezone:'Asia/Kolkata',daily_units:{precipitation_sum:'mm',temperature_2m_max:'°C'},
  daily:{time:Array.from({length:40},(_,i)=>new Date(Date.UTC(year,5,1+i)).toISOString().slice(0,10)),
         precipitation_sum:Array(40).fill(8),temperature_2m_max:Array(40).fill(30)}
});

test('partial four-year weather data reports years and never returns a historical recommendation', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (resource:RequestInfo|URL) => {
    const link = new URL(String(resource),'https://example.com');
    const year = Number(link.searchParams.get('start_date')?.slice(0,4));
    if (year === 2025) return new Response('unavailable',{status:403});
    return Response.json(makeYear(year));
  }) as typeof fetch;
  try {
    await assert.rejects(() => fetchHistoricalReplay(REGIONS[0]), (e:unknown) => {
      assert.ok(e instanceof IncompleteReplayError);
      assert.deepEqual(e.loadedYears,[2022,2023,2024]);
      assert.deepEqual(e.failedYears,[2025]);
      assert.match(e.message,/No historical recommendation was made/);
      return true;
    });
  } finally { globalThis.fetch=original; }
});
