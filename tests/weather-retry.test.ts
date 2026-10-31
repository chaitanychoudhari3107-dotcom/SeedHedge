import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry, historicalUrl } from '../src/weather.ts';
import {REGIONS} from '../src/regions.ts';
test('ERA5 is explicitly fixed across the replay years', () => {
 const u = new URL(historicalUrl(REGIONS[0], 2024));
 assert.equal(u.searchParams.get('models'), 'era5');
 assert.equal(u.searchParams.get('timezone'), 'Asia/Kolkata');
});
test('transient 503 retries, with real response preserved', async () => {
 const original = globalThis.fetch; let calls=0;
 globalThis.fetch = (async () => { calls++; return new Response('',{status: calls===1?503:200}); }) as typeof fetch;
 try { const r = await fetchWithRetry('https://example.org'); assert.equal(r.status,200); assert.equal(calls,2); }
 finally { globalThis.fetch=original; }
});
test('non-retryable 400 is returned without loops', async () => {
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async()=>{calls++; return new Response('',{status:400});}) as typeof fetch;
 try {const r=await fetchWithRetry('https://example.org');assert.equal(r.status,400);assert.equal(calls,1);} finally {globalThis.fetch=original;}
});
