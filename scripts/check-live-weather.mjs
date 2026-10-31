/** Real external diagnostic. Run with network access; not part of deterministic CI. */
const regions = {akola:[20.7,77],jalna:[19.84,75.89],nagpur:[21.15,79.09],pune:[18.52,73.86]};
const region = process.argv[2] ?? 'akola';
if (!(region in regions)) {console.error(`Unknown region. Use ${Object.keys(regions).join(', ')}`);process.exit(2)}
const [lat,lon] = regions[region];
let failures=0;
for(const year of [2022,2023,2024,2025]) {
 const url=new URL('https://archive-api.open-meteo.com/v1/archive');
 Object.entries({latitude:String(lat),longitude:String(lon),start_date:`${year}-06-01`,end_date:`${year}-07-10`,daily:'precipitation_sum,temperature_2m_max',timezone:'Asia/Kolkata',precipitation_unit:'mm',temperature_unit:'celsius',models:'era5'}).forEach(([k,v])=>url.searchParams.set(k,v));
 try {
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  const payload=await response.json();
  const d=payload.daily;
  const valid=response.ok && payload.timezone==='Asia/Kolkata' && payload.daily_units?.precipitation_sum==='mm' && payload.daily_units?.temperature_2m_max==='°C' && d?.time?.length===40 && d?.time?.every((_,i)=>Number.isFinite(d.precipitation_sum[i])&&Number.isFinite(d.temperature_2m_max[i]));
  console.log(`${year}: HTTP ${response.status}, ${valid?'VALID':'INVALID'}; days=${d?.time?.length??0}; reason=${payload.reason??'none'}`);
  if(!valid)failures++;
 }catch(e){console.error(`${year}: NETWORK ERROR ${e.message}`);failures++}
}
console.log(failures?`FAILED: ${failures}/4 years unavailable; do not represent live evidence as ready.`:'PASS: all four real historical responses validated (this test does not prove scientific validity).');
process.exitCode=failures?1:0;
