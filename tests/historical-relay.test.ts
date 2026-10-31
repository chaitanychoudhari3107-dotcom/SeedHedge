import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../api/historical.ts';
import { fetchHistoricalYear } from '../src/weather.ts';
import { REGIONS } from '../src/regions.ts';
const payload = {timezone:'Asia/Kolkata',daily_units:{precipitation_sum:'mm',temperature_2m_max:'°C'},daily:{
 time:Array.from({length:40},(_,i)=>new Date(Date.UTC(2024,5,1+i)).toISOString().slice(0,10)),
 precipitation_sum:Array(40).fill(5), temperature_2m_max:Array(40).fill(31)
}};
test('relay refuses arbitrary locations/years',async()=>{
 const r=await GET(new Request('http://localhost/api/historical?region=invalid&year=1999'));
 assert.equal(r.status,400);
});
test('relay uses fixed provider and preserves real payload',async()=>{
 const original=globalThis.fetch;let url='';
 globalThis.fetch=(async(request)=>{url=String(request);return Response.json(payload);}) as typeof fetch;
 try {const r=await GET(new Request('http://localhost/api/historical?region=akola&year=2024'));assert.equal(r.status,200);assert.match(url,/archive-api\.open-meteo\.com/);assert.equal((await r.json()).daily.time.length,40);}
 finally {globalThis.fetch=original;}
});
test('year fetch falls back only after direct network failure',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async(request)=>{calls++;if(String(request).startsWith('http')) throw new Error('browser network blocked');return Response.json(payload);}) as typeof fetch;
 try {const r=await fetchHistoricalYear(REGIONS[0],2024);assert.equal(r.transport,'vercel-relay');assert.equal(r.days.length,40);assert.ok(calls>=4);}
 finally {globalThis.fetch=original;}
});
