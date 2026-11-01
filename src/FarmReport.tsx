import { useMemo } from 'react';
import type { CostRates, Strategy } from './engine.ts';
import type { HistoricalDay, HistoricalReplay } from './weather.ts';
import { rainfallThresholdPlan } from './approaches.ts';
import { explainPlantingVisits, summarizeCandidateDates } from './decision-explanations.ts';

export type FarmReportProps = {
  region: string;
  area: number;
  dates: string[];
  windowStart: string;
  windowEnd: string;
  demoExample: boolean;
  mode: 'historical' | 'synthetic';
  simulation: 'stress' | 'calm';
  weather: HistoricalReplay | null;
  loading: boolean;
  weatherError: string | null;
  forecast: HistoricalDay[] | null;
  forecastSource: string | null;
  forecastError: string | null;
  rates: CostRates;
  thresholdMm: number;
  strategies: Strategy[];
  winner: Strategy | null;
};
const money=(v:number)=>`₹${v.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const label=(v:string)=>new Date(`${v}T12:00:00Z`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const plan=(s:Strategy)=>s.allocations.map(a=>`${Math.round(a.share*100)}% on ${label(a.date)}`).join(' + ');
export default function FarmReport(p:FarmReportProps) {
  const ready=p.mode==='historical' && !p.loading && !p.weatherError && !!p.weather;
  const yearRows=useMemo(()=>summarizeCandidateDates(ready?p.weather:null,p.dates,p.thresholdMm),[ready,p.weather,p.dates,p.thresholdMm]);
  const a=useMemo(()=>rainfallThresholdPlan(ready?p.weather:null,p.dates,p.area,p.rates,p.thresholdMm),[ready,p.weather,p.dates,p.area,p.rates,p.thresholdMm]);
  const visit=useMemo(()=>explainPlantingVisits(p.strategies,p.winner,p.rates),[p.strategies,p.winner,p.rates]);
  const singles=useMemo(()=>p.strategies.filter(s=>s.visits===1).sort((x,y)=>(x.verdict==='acceptable'?0:1)-(y.verdict==='acceptable'?0:1)|| (x.maximumExposure??99)-(y.maximumExposure??99)||x.cost-y.cost).slice(0,5),[p.strategies]);
  const splits=useMemo(()=>p.strategies.filter(s=>s.visits===2 && s.verdict==='acceptable').sort((x,y)=>x.cost-y.cost || (x.maximumExposure??99)-(y.maximumExposure??99)).slice(0,5),[p.strategies]);
  const costs=p.area*(p.rates.seedKgPerAcre*p.rates.seedPricePerKg+p.rates.laborPerAcre+p.rates.machineryPerAcre);
  const perVisit=p.rates.mobilizationPerVisit+p.rates.otherPerVisit;
  const demo=p.mode==='synthetic';
  return <section id="farm-report" className="farm-report" aria-label="Farm-specific SeedHedge report">
    <div className="report-heading"><div><span className="section-label">STEP 4 · FARM-SPECIFIC REPORT</span><h2>Your farm's weather and planting comparison</h2><p>One place to understand your dates, rain, temperature, planting options, and estimated expenses.</p></div><button type="button" className="report-print" onClick={()=>window.print()}>Print / Save as PDF</button></div>
    <div className={`report-source ${demo?'report-demo':'report-historical'}`} role="status"><strong>{demo?'FICTIONAL DEMONSTRATION':ready?'HISTORICAL WEATHER REPLAY':p.loading?'LOADING HISTORICAL WEATHER':'HISTORICAL DATA UNAVAILABLE'}</strong><span>{demo?'The modeled outputs below use invented conditions. They are not real forecasts.':ready?'Open-Meteo ERA5 reanalysis for 2022–2025. Not a weather forecast issued before sowing.':p.weatherError??'A complete historical report is not available yet. No weather observations are invented.'}</span></div>
    <div className="report-farm-grid"><div><small>Area and region</small><strong>{p.area} acres · {p.region}, Maharashtra</strong></div><div><small>Crop</small><strong>Soybean (Kharif) only</strong></div><div><small>Chosen sowing window</small><strong>{label(p.windowStart)} – {label(p.windowEnd)}</strong><small>{p.demoExample?'Preset historical example':'Farmer-selected historical example'}</small></div><div><small>Dates assessed</small><strong>{p.dates.length} app-generated dates</strong></div></div>
    <div className="report-lead-grid"><article><h3>Plan A · Wait for past rain</h3><p>{demo?'Not evaluated: simulated weather is not measured rainfall.':ready?(a.date?`First date meeting the ${p.thresholdMm} mm / previous 14 days rule in every replay year: ${label(a.date)}.`:`None of the candidate dates meets ${p.thresholdMm} mm / previous 14 days in all historical replay years.`):'No complete rainfall evidence; no Plan A result.'}</p><small>It checks rainfall before each date, not predicted yield or crop safety.</small></article><article><h3>Plan B · One or two planting dates</h3><p>{!demo && !ready ? p.loading ? 'Historical records are still loading. No planting model result is final.' : 'Historical records are incomplete; no planting model result can be issued.' : `${visit.title}. ${p.winner?`${plan(p.winner)}; estimated cost ${money(p.winner.cost)}.`:'No modeled option qualified.'}`}</p><small>{demo || ready ? visit.reason : 'Retry weather from Step 1 without changing your farm details.'}</small></article></div>
    {ready ? <>
      <h3>Historical conditions for your candidate dates</h3>
      <p className="report-intro">Rainfall = minimum of the four years' 14-day totals <b>before</b> the listed date. Temperature = highest 3-day maximum across the replay years, including days after sowing. The latter is retrospective evidence, not information a farmer would have known beforehand. “Model index” is an unvalidated screening score, <b>not a crop-loss probability</b>.</p>
      <div className="report-table-wrap"><table className="report-data-table"><thead><tr><th>Candidate date</th><th>Lowest prior 14-day rain</th><th>Highest 3-day temperature</th><th>Highest modeled index</th><th>Plan A rain rule</th></tr></thead><tbody>{yearRows.map(row=><tr key={row.date}><td>{label(row.date)}</td><td>{row.minRain14===null?'Missing':`${row.minRain14.toFixed(1)} mm`}</td><td>{row.maxTemp3===null?'Missing':`${row.maxTemp3.toFixed(1)} °C`}</td><td>{row.maxExposure===null?'Unknown':row.maxExposure.toFixed(2)}</td><td>{row.qualifiesRain?'Met in all years':'Not met in all years'}</td></tr>)}</tbody></table></div>
      <details className="report-more-years"><summary>See each year's rainfall behind the comparison</summary><div className="report-table-wrap"><table className="report-data-table"><thead><tr><th>Date</th>{p.weather!.years.map(y=><th key={y}>{y} prior 14-day rain</th>)}</tr></thead><tbody>{yearRows.map(row=><tr key={row.date}><td>{label(row.date)}</td>{row.rainfall14ByYear.map(v=><td key={v.year}>{v.mm===null?'Missing':`${v.mm.toFixed(1)} mm`}</td>)}</tr>)}</tbody></table></div></details>
    </> : <p className="report-unavailable">{demo?'Historical temperature and rainfall tables are intentionally hidden while fictional weather mode is active.':p.loading?'Retrieving historical evidence. The report updates when all required years have been checked.':'The requested records are incomplete or unavailable. Retry the service from Step 1; your farm inputs remain unchanged.'}</p>}
    <h3>One-day vs two-day planting options</h3>
    <div className="report-option-grid"><article><h4>Best one-day options</h4>{singles.length?singles.map(s=><div key={s.id} className="report-option"><span>{plan(s)}</span><strong>{s.verdict==='acceptable'?'Model pass':'Not passed'} · {money(s.cost)} · index {s.maximumExposure?.toFixed(2)??'unknown'}</strong></div>):<p>No evaluated one-day options.</p>}</article><article><h4>Lower-cost two-day options that passed the model</h4>{splits.length?splits.map(s=><div key={s.id} className="report-option"><span>{plan(s)}</span><strong>{money(s.cost)} · index {s.maximumExposure?.toFixed(2)??'unknown'}</strong></div>):<p>None passed, or no complete evidence.</p>}</article></div>
    <h3>Estimated sowing cost for this farm</h3><div className="report-cost-grid"><div><small>Seed, labour and machinery for {p.area} acres</small><strong>{money(costs)}</strong></div><div><small>Charge for each planting visit</small><strong>{money(perVisit)}</strong></div><div><small>One visit total</small><strong>{money(costs+perVisit)}</strong></div><div><small>Two visits total</small><strong>{money(costs+2*perVisit)}</strong></div></div>
    <p className="report-intro">Rates are editable examples, not verified market prices. They do not change by planting date in the current model. Consequently, the model cannot tell you that planting on a particular date will produce more soybean or revenue.</p>
    {p.mode==='historical' && <section className="report-forecast"><h3>Separate current 7-day forecast (not used in these results)</h3>{p.forecast?.length?<><p>This forecast is for the next seven days, not for the 2024 replay dates.</p><div className="report-forecast-days">{p.forecast.map(d=><span key={d.date}>{label(d.date)} · {d.precipitationMm.toFixed(1)} mm rain · {d.maxTempC.toFixed(0)} °C</span>)}</div>{p.forecastSource&&<a href={p.forecastSource} target="_blank" rel="noreferrer">View forecast request</a>}</>:<p>{p.forecastError?'Current forecast unavailable; it was not substituted into the replay.':'Current forecast loading or unavailable.'}</p>}</section>}
    <details className="report-science"><summary>For judges: exact inputs, data provenance and model limits</summary><p>Plan A: first date for which the preceding 14-day rainfall meets {p.thresholdMm} mm across every replay year. Plan B: modeled exposure = min(1, 0.68 × rainfall shortfall + 0.20 × excess rainfall after date + 0.12 × heat penalty). An allocation passes if its worst yearly modeled score is ≤ 0.60. Passed strategies are ordered by cost. These weights, cutoffs and all-years conditions are unvalidated experimental rules.</p>{ready&&<><p>Source: Open-Meteo historical ERA5 reanalysis, timezone Asia/Kolkata, regional location approximately {p.region}; rainfall mm and maximum temperature °C. Retrieved {new Date(p.weather!.retrievedAt).toLocaleString('en-IN')}. Transport used: {p.weather!.fetchTransports.join(', ')}. Retrieval time is not the observation date.</p><div className="report-source-links">{p.weather!.years.map((y,i)=><a key={y} href={p.weather!.sourceUrls[i]} target="_blank" rel="noreferrer">{y} historical source</a>)}</div></>}</details>
    <p className="report-limit">This is a district-level historical demonstration, not an instrument reading from your exact farm. No soil testing, validated yield forecasts, crop-failure probabilities, or sowing-safety certification is provided. Confirm current conditions and consult local agricultural guidance before real planting.</p>
  </section>;
}
