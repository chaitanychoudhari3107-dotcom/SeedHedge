import { useMemo, useState } from 'react';
import type { CostRates, Strategy } from './engine.ts';
import { strategyBreakdown } from './strategy-insight.ts';
import { rainfallThresholdPlan, comparePlans } from './approaches.ts';
import type { HistoricalReplay } from './weather.ts';
import { explainPlantingVisits, explainSameDateCost, summarizeCandidateDates } from './decision-explanations.ts';

type Props = {
  view?: 'rain' | 'split' | 'compare';
  weather: HistoricalReplay | null;
  loading: boolean;
  error: string | null;
  partialYears: number[];
  mode: 'historical' | 'synthetic';
  simulation: 'stress' | 'calm';
  region: string;
  area: number;
  dates: string[];
  rates: CostRates;
  threshold: number;
  onThresholdChange: (v: number) => void;
  winner: Strategy | null;
  selected: Strategy | undefined;
  acceptableCount: number;
  strategyCount: number;
  strategies: Strategy[];
  onRetry: () => void;
  onDemo: () => void;
};
const INR = (n: number) => `₹${n.toLocaleString('en-IN', {maximumFractionDigits:0})}`;
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-IN', {day:'numeric',month:'short'}).format(new Date(`${date}T12:00:00`));
const allocation = (s: Strategy) => s.allocations.map(a => `${Math.round(a.share * 100)}% ${dateLabel(a.date)}`).join(' + ');

export default function DecisionDashboard(props: Props) {
  const {view = 'compare', weather, loading, error, partialYears, mode, simulation, region, area, dates, rates, threshold, onThresholdChange, winner, selected,
    acceptableCount, strategyCount, strategies, onRetry, onDemo} = props;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const ready = mode === 'historical' && !!weather && !loading && !error;
  const planA = useMemo(() => rainfallThresholdPlan(ready ? weather : null, dates, area, rates, threshold),
    [ready, weather, dates, area, rates, threshold]);
  const compared = comparePlans(planA, winner);
  const state = mode === 'synthetic' ? 'simulated' : loading ? 'loading' : error ? partialYears.length ? 'partial' : 'error' : ready ? 'ready' : 'unavailable';
  const years = weather?.years ?? [];
  const visits = useMemo(() => explainPlantingVisits(strategies, winner, rates), [strategies, winner, rates]);
  const dateEvidence = useMemo(() => summarizeCandidateDates(ready?weather:null, dates, threshold), [ready, weather, dates, threshold]);
  const candidateRows = ready ? [...dates].sort().map(date => ({date,
    values: years.map(year => weather?.diagnostics[date]?.[year]?.precedingRainMm ?? null),
    eligible: years.every(year => {
      const rain = weather?.diagnostics[date]?.[year]?.precedingRainMm;
      return rain !== undefined && rain >= threshold;
    })
  })) : [];
  const rainMax = Math.max(threshold, ...candidateRows.flatMap(r => r.values.filter((v):v is number=>v!==null)), 1);
  const planBReady = !(mode === 'historical' && !ready);
  const b = planBReady ? winner : null;
  const aCost = planA.date !== null ? planA.cost : null;
  const bCost = b?.cost ?? null;
  const bBreakdown = b ? strategyBreakdown(b, area, rates) : null;
  const comparisonMessage = state === 'loading' ? 'Historical evidence is loading. No result has been finalized.' :
    (state === 'error' || state === 'partial') ? 'Historical weather is missing or incomplete. No historical result can be issued. Your farm details have been preserved.' :
    state === 'simulated' ? `Simulation: ${simulation === 'stress' ? 'stress' : 'stable'} assumptions are active for Plan B. Plan A requires actual historical rainfall and is intentionally unavailable.` :
    aCost !== null && bCost !== null ? compared.explanation :
    aCost === null && bCost !== null ? `Only Plan B passes its experimental screen (${allocation(b!)} at ${INR(bCost)}). No direct cost winner between two qualified approaches can be declared.` :
    aCost !== null && bCost === null ? `Only Plan A meets its rainfall rule (${dateLabel(planA.date!)} at ${INR(aCost)}). Plan B has no modeled-acceptable strategy.` :
    'Neither approach currently has a rule-qualified result. Adjust assumptions to explore sensitivity; do not treat a model threshold as an agronomic recommendation.';
  return <section className={`decision-hub hub-view-${view}`} id="plans" aria-label="Plan A versus Plan B decision dashboard">
    <header className="hub-header">
      <div><span className="hub-kicker">DECISION INTELLIGENCE / SOYBEAN · KHARIF</span><h2>{view==='rain' ? 'Plan A: Check the rainfall' : view==='split' ? 'Plan B: Compare planting dates' : 'See what both plans tell you'}</h2><p>Plan A waits for enough past rainfall. Plan B compares planting on one or two dates. Both use the same farmer inputs. Research example only—not advice for today.</p></div>
      <div className={`hub-state hub-state-${state}`} role="status">{state === 'ready' ? '● ERA5 historical records loaded' : state === 'simulated' ? '◇ SYNTHETIC DEMO' : state === 'loading' ? '◌ Loading historical weather' : state === 'partial' ? '⚠ Partial historical records; no recommendation' : '⚠ Historical evidence unavailable'}</div>
    </header>
    <div className="hub-kpis" aria-label="Shared farmer inputs">
      <div><span>FARM LOCATION</span><strong>{region}, Maharashtra</strong></div><div><span>FARM SIZE</span><strong>{area} acres</strong></div><div><span>SUPPORTED CROP</span><strong>Soybean · Kharif</strong></div><div><span>APP-GENERATED DATES</span><strong>{dates.length} included</strong></div>
    </div>
    {(state === 'error' || state === 'partial') && <div className="hub-network" role="alert"><strong>{state==='partial'?`Only ${partialYears.length} of 4 years loaded. No result was calculated.`:'Historical weather could not be retrieved.'}</strong><p>{error}</p><p>Check your internet connection, then retry. Your location, dates and costs will stay unchanged. Demo mode is clearly fictional.</p><button type="button" onClick={onRetry}>Retry historical source</button><button type="button" onClick={onDemo}>Switch to clearly labeled demonstration</button></div>}
    <div className="hub-plan-grid">
      {(view === 'rain' || view === 'compare') && <article className="hub-plan hub-plan-a">
        <div className="hub-plan-top"><span className="hub-plan-number">01</span><div><span className="hub-kicker">PLAN A / RAIN FIRST</span><h3>Wait for enough rainfall</h3></div></div>
        <p className="hub-muted">Looks at rain that fell in the 14 days before each generated date. It picks the first date that meets the chosen rule in <b>all four</b> historical years. This experimental rule is not a crop-safety check.</p>
        <label htmlFor="rainfall-threshold" className="hub-control-label">Rain to check (experimental rule) <output htmlFor="rainfall-threshold">{threshold} mm</output></label>
        <input aria-label="Experimental preceding rainfall threshold" type="range" id="rainfall-threshold" min="20" max="200" step="10" value={threshold} onChange={e => onThresholdChange(Number(e.target.value))}/>
        <div className="hub-ticks"><span>20 mm</span><span>100 mm</span><span>200 mm</span></div>
        <div className="hub-answer"><span>RULE OUTCOME</span><strong>{!ready ? (state==='simulated'?'Unavailable in synthetic mode':state==='loading'?'Awaiting historical evidence':'No verified evidence') : planA.date ? `${dateLabel(planA.date)} · ${INR(aCost ?? 0)}` : `No date meets ${threshold} mm in all ${years.length} replay years`}</strong><small>{ready ? (planA.date ? 'This date was first to meet your rainfall rule in all four replay years. Changing your window or rule can change it.' : 'The historical records are complete, but no selected date met the rule in every year. Try adjusting the experimental rain amount or your date window.') : 'No rainfall-rule result is inferred from missing or simulated data'}</small></div>
        <div className="hub-method-foot"><span>Planting visits: {planA.date ? '1' : '—'}</span><span>Cost: {aCost===null?'—':INR(aCost)}</span></div>
        <div className="hub-farmer-explain"><strong>Why does the cost stay the same on other dates?</strong><p>{explainSameDateCost(area,rates)}</p></div>
      </article>}
      {(view === 'split' || view === 'compare') && <article className="hub-plan hub-plan-b">
        <div className="hub-plan-top"><span className="hub-plan-number">02</span><div><span className="hub-kicker">PLAN B / ONE DATE OR TWO</span><h3>Plant all at once or on two dates</h3></div></div>
        <p className="hub-muted">First compares the dates using the same historical weather records. Then it picks the lowest estimated cost among options that pass an experimental weather check. Splitting does not guarantee lower crop loss.</p>
        <div className="hub-bmetrics"><div><span>OPTIONS COMPARED</span><strong>{strategyCount}</strong></div><div><span>ONE-DATE OPTIONS PASSING</span><strong>{planBReady?strategies.filter(s=>s.visits===1&&s.verdict==='acceptable').length:'—'}</strong></div><div><span>TWO-DATE OPTIONS PASSING</span><strong>{planBReady?strategies.filter(s=>s.visits===2&&s.verdict==='acceptable').length:'—'}</strong></div></div>
        <p className="hub-model-count" role="status">{planBReady?`${acceptableCount} of ${strategyCount} options passed this experimental weather model.`:'No finalized historical option while data is incomplete.'} This is not a measured farm safety score.</p>
        <div className="hub-answer"><span>MODELED OUTCOME</span><strong>{!planBReady ? 'Awaiting historical evidence' : b ? `${allocation(b)} · ${INR(b.cost)}` : 'No option passes this experimental check'}</strong><small>{b ? `Worst exposure index ${b.maximumExposure?.toFixed(2) ?? 'unknown'} · ${b.visits} planting visit${b.visits===1?'':'s'}` : 'Try another date range or review the model assumptions. This does not prove sowing is unsafe.'}</small></div>
        {b && <div className="hub-field" role="img" aria-label={`Farm allocation visualization: ${allocation(b)}`}>{Array.from({length:20},(_,i)=>{ const first=b.allocations[0]?.share??1; return <i key={i} className={i/20 < first?'hub-field-first':'hub-field-second'}/>; })}</div>}
        <div className="hub-method-foot"><span>Cost: {bCost===null?'—':INR(bCost)}</span><span>Model: {mode==='historical'?'2022–2025 replay':`${simulation} simulation`}</span></div>
        <div className="hub-farmer-explain" role="status"><strong>{visits.title}</strong><p>{visits.reason}</p><div className="hub-choice-compare"><span>Best passing one-date option: <b>{visits.bestSingle?`${allocation(visits.bestSingle)} · ${INR(visits.bestSingle.cost)} · index ${visits.bestSingle.maximumExposure?.toFixed(2)??'unknown'}`:'none'}</b></span><span>Best passing two-date option: <b>{visits.bestSplit?`${allocation(visits.bestSplit)} · ${INR(visits.bestSplit.cost)} · index ${visits.bestSplit.maximumExposure?.toFixed(2)??'unknown'}`:'none'}</b></span></div></div>
      </article>}
    </div>
    {view === 'compare' && <div className="hub-verdict" role="status"><div className="hub-verdict-icon">↔</div><div><strong>What the results mean</strong><p>{comparisonMessage}</p></div></div>}
    <div className="hub-detail-grid">
      {(view === 'rain' || view === 'compare') && <article className="hub-subpanel"><div className="hub-section-top"><div><span className="hub-kicker">PAST WEATHER FOR THE DATES YOU CHOSE</span><h3>How much rain fell before each possible date?</h3></div><span className="hub-mini">Historical ERA5 · mm</span></div>
        {ready ? <><div className="hub-rain-key"><span>Threshold: {threshold} mm</span><span>2022 / 2023 / 2024 / 2025</span></div><div className="hub-rain-rows">{candidateRows.map(r=><div className="hub-rain-row" key={r.date}><div><strong>{dateLabel(r.date)}</strong><span className={r.eligible?'hub-qualifies':'hub-not-qualified'}>{r.eligible?'Met rule all years':'Rule not met'}</span></div><div className="hub-year-bars">{r.values.map((v,i)=><div className="hub-year-track" key={years[i]} title={`${years[i]}: ${v===null?'missing':`${v.toFixed(1)} mm`}`}><i style={{width:`${(v??0)/rainMax*100}%`}}/><small>{v===null?'—':Math.round(v)}</small></div>)}</div></div>)}</div><p className="hub-footnote">Each bar is rainfall in the previous 14 days for one historical year. The Plan A rule requires all years to reach the selected amount. This is a strict prototype test, not a crop-health prediction.</p>
        <div className="hub-date-evidence"><strong>Temperature and modeled weather exposure by date</strong><p>Temperature is the highest 3-day maximum over the replay years, including days after sowing; it was not known in advance. The modeled index is an unvalidated score, NOT crop-loss probability or expected yield.</p><div className="hub-date-evidence-list">{dateEvidence.map(row=><div key={row.date}><span>{dateLabel(row.date)}</span><span>Highest 3-day temp: {row.maxTemp3===null?'missing':`${row.maxTemp3.toFixed(1)} °C`}</span><span>Highest experimental index: {row.maxExposure===null?'unknown':row.maxExposure.toFixed(2)}</span></div>)}</div></div></> : <p className="hub-placeholder">{state==='loading'?'Retrieving measured-input reanalysis…':'Only complete historical weather records are shown here. This chart never displays fictional values as observed rain.'}</p>}
      </article>}
      {view === 'compare' && <article className="hub-subpanel"><div className="hub-section-top"><div><span className="hub-kicker">COST ESTIMATE · SAME FARM RATES</span><h3>What each option may cost</h3></div><span className="hub-mini">INR · estimates</span></div>
        <div className="hub-cost-rows"><div><span>Plan A · single visit</span><b>{aCost===null?'Not qualified':INR(aCost)}</b></div><div><span>Plan B · {b?.visits??'—'} visit(s)</span><b>{bCost===null?'Not qualified':INR(bCost)}</b></div><div><span>Each additional visit adds</span><b>{INR(rates.mobilizationPerVisit+rates.otherPerVisit)}</b></div></div>
        {bBreakdown && <div className="hub-cost-stack" aria-label="Plan B cost breakdown">{([['Seeds',bBreakdown.seed],['Labour',bBreakdown.labor],['Machinery',bBreakdown.machinery],['Visits',bBreakdown.perVisit]] as const).map(([key,value])=><div key={key} title={`${key}: ${INR(value)}`} style={{flexGrow:Math.max(0,value),flexBasis:0}}/>)}</div>}
        <p className="hub-footnote">Cost = acreage × (seed quantity × seed price + labour + machinery) + visits × (mobilisation + other fees). Rates are farmer-editable, unverified estimates. No farmer budget required.</p>
        {selected && b && selected.id!==b.id && <p className="hub-exploring">Your explored allocation: {allocation(selected)}. It does not replace the modeled Plan B result.</p>}
      </article>}
    </div>
    {view === 'compare' && <details className="hub-science" open={detailsOpen} onToggle={e=>setDetailsOpen(e.currentTarget.open)}><summary>For judges: formulas, assumptions and weather sources</summary><div className="hub-science-grid"><p><b>Plan A:</b> First candidate with preceding 14-day rainfall ≥ {threshold} mm for each replay year. This strict all-years requirement is experimental, not a validated sowing rule. Historical replay years are not a probabilistic forecast.</p><p><b>Plan B:</b> exposure = min(1, 0.68 × rainfall shortfall + 0.20 × excess 3-day rainfall + 0.12 × heat penalty). Reject modeled exposure above 0.60, then minimize cost among acceptable strategies. Weights, cutoffs and outcomes are unvalidated.</p></div>
      {ready && <><p className="hub-footnote">Threshold sensitivity (same historical data):</p><div className="hub-sensitivity">{[60,80,100,120,140,160,180].map(t=>{const p=rainfallThresholdPlan(weather,dates,area,rates,t);return <div key={t}><span>{t} mm</span><b>{p.date ? dateLabel(p.date) : 'No date'}</b></div>})}</div></>}
      <p className="hub-footnote">Data source: {ready?<><a href={weather?.sourceUrls[2]} target="_blank" rel="noreferrer">Open-Meteo historical archive (2024)</a> · Retrieved {new Date(weather!.retrievedAt).toLocaleString('en-IN')} · Transport: {weather?.fetchTransports.join(', ')}.</>:'No complete historical response is available for the active mode.'} Historical reanalysis was produced retrospectively and cannot be treated as a forecast available at sowing time. The Vercel relay may serve cached historical responses; retrieval time is not the underlying observation time. Synthetic demonstration outputs must never be described as historical observation or certified crop advice.</p>
    </details>}
  </section>;
}
