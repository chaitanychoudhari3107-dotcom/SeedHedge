import { useMemo, useState } from 'react';
import type { CostRates, Strategy } from './engine.ts';
import { strategyBreakdown } from './strategy-insight.ts';
import { rainfallThresholdPlan, comparePlans } from './approaches.ts';
import type { HistoricalReplay } from './weather.ts';

type Props = {
  weather: HistoricalReplay | null;
  loading: boolean;
  error: string | null;
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
  onRetry: () => void;
  onDemo: () => void;
};
const INR = (n: number) => `₹${n.toLocaleString('en-IN', {maximumFractionDigits:0})}`;
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-IN', {day:'numeric',month:'short'}).format(new Date(`${date}T12:00:00`));
const allocation = (s: Strategy) => s.allocations.map(a => `${Math.round(a.share * 100)}% ${dateLabel(a.date)}`).join(' + ');

export default function DecisionDashboard(props: Props) {
  const {weather, loading, error, mode, simulation, region, area, dates, rates, threshold, onThresholdChange, winner, selected,
    acceptableCount, strategyCount, onRetry, onDemo} = props;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const ready = mode === 'historical' && !!weather && !loading && !error;
  const planA = useMemo(() => rainfallThresholdPlan(ready ? weather : null, dates, area, rates, threshold),
    [ready, weather, dates, area, rates, threshold]);
  const compared = comparePlans(planA, winner);
  const state = mode === 'synthetic' ? 'simulated' : loading ? 'loading' : error ? 'error' : ready ? 'ready' : 'unavailable';
  const years = weather?.years ?? [];
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
    state === 'error' ? 'Historical evidence could not be verified. Neither method can issue a real-data result.' :
    state === 'simulated' ? `Simulation: ${simulation === 'stress' ? 'stress' : 'stable'} assumptions are active for Plan B. Plan A requires actual historical rainfall and is intentionally unavailable.` :
    aCost !== null && bCost !== null ? compared.explanation :
    aCost === null && bCost !== null ? `Only Plan B passes its experimental screen (${allocation(b!)} at ${INR(bCost)}). No direct cost winner between two qualified approaches can be declared.` :
    aCost !== null && bCost === null ? `Only Plan A meets its rainfall rule (${dateLabel(planA.date!)} at ${INR(aCost)}). Plan B has no modeled-acceptable strategy.` :
    'Neither approach currently has a rule-qualified result. Adjust assumptions to explore sensitivity; do not treat a model threshold as an agronomic recommendation.';
  return <section className="decision-hub" id="plans" aria-label="Plan A versus Plan B decision dashboard">
    <header className="hub-header">
      <div><span className="hub-kicker">DECISION INTELLIGENCE / SOYBEAN · KHARIF</span><h2>Two methods. One farmer. <em>Clear trade-offs.</em></h2><p>Transparent historical replay, identical farmer inputs, and independent experimental decision rules.</p></div>
      <div className={`hub-state hub-state-${state}`} role="status">{state === 'ready' ? '● Historical data verified' : state === 'simulated' ? '◇ SYNTHETIC DEMO' : state === 'loading' ? '◌ Loading historical weather' : '⚠ Real evidence unavailable'}</div>
    </header>
    <div className="hub-kpis" aria-label="Shared farmer inputs">
      <div><span>FARM LOCATION</span><strong>{region}, Maharashtra</strong></div><div><span>FARM SIZE</span><strong>{area} acres</strong></div><div><span>SUPPORTED CROP</span><strong>Soybean · Kharif</strong></div><div><span>CANDIDATE DATES</span><strong>{dates.length} selected</strong></div>
    </div>
    {state === 'error' && <div className="hub-network" role="alert"><strong>Historical data could not be retrieved.</strong><p>{error}</p><button type="button" onClick={onRetry}>Retry historical source</button><button type="button" onClick={onDemo}>Switch to clearly labeled demonstration</button></div>}
    <div className="hub-plan-grid">
      <article className="hub-plan hub-plan-a">
        <div className="hub-plan-top"><span className="hub-plan-number">01</span><div><span className="hub-kicker">METHOD A / RAINFALL THRESHOLD</span><h3>Wait for sufficient rainfall</h3></div></div>
        <p className="hub-muted">Checks preceding 14-day rainfall against one experimental minimum in <b>every</b> historical replay year.</p>
        <label htmlFor="rainfall-threshold" className="hub-control-label">Rainfall threshold <output htmlFor="rainfall-threshold">{threshold} mm</output></label>
        <input aria-label="Experimental preceding rainfall threshold" type="range" id="rainfall-threshold" min="20" max="200" step="10" value={threshold} onChange={e => onThresholdChange(Number(e.target.value))}/>
        <div className="hub-ticks"><span>20 mm</span><span>100 mm</span><span>200 mm</span></div>
        <div className="hub-answer"><span>RULE OUTCOME</span><strong>{!ready ? (state==='simulated'?'Unavailable in synthetic mode':state==='loading'?'Awaiting historical evidence':'No verified evidence') : planA.date ? `${dateLabel(planA.date)} · ${INR(aCost ?? 0)}` : `No date meets ${threshold} mm in all ${years.length} replay years`}</strong><small>{ready ? (planA.date ? 'First candidate that satisfies the all-years rule' : 'Evidence is complete; the rule did not qualify any candidate') : 'No rainfall-rule result is inferred from missing or simulated data'}</small></div>
        <div className="hub-method-foot"><span>Planting visits: {planA.date ? '1' : '—'}</span><span>Cost: {aCost===null?'—':INR(aCost)}</span></div>
      </article>
      <article className="hub-plan hub-plan-b">
        <div className="hub-plan-top"><span className="hub-plan-number">02</span><div><span className="hub-kicker">METHOD B / STAGGERED WEATHER SCREEN</span><h3>Compare single and split dates</h3></div></div>
        <p className="hub-muted">Screens date allocations against the worst modeled exposure, then ranks acceptable strategies by estimated sowing cost.</p>
        <div className="hub-bmetrics"><div><span>STRATEGIES TESTED</span><strong>{strategyCount}</strong></div><div><span>MODELED ACCEPTABLE</span><strong>{planBReady?acceptableCount:'—'}</strong></div><div><span>EXPERIMENTAL CUTOFF</span><strong>0.60</strong></div></div>
        <div className="hub-answer"><span>MODELED OUTCOME</span><strong>{!planBReady ? 'Awaiting historical evidence' : b ? `${allocation(b)} · ${INR(b.cost)}` : 'No modeled-acceptable allocation'}</strong><small>{b ? `Worst exposure index ${b.maximumExposure?.toFixed(2) ?? 'unknown'} · ${b.visits} planting visit${b.visits===1?'':'s'}` : 'No strategy automatically passes the current screen'}</small></div>
        {b && <div className="hub-field" role="img" aria-label={`Farm allocation visualization: ${allocation(b)}`}>{Array.from({length:20},(_,i)=>{ const first=b.allocations[0]?.share??1; return <i key={i} className={i/20 < first?'hub-field-first':'hub-field-second'}/>; })}</div>}
        <div className="hub-method-foot"><span>Cost: {bCost===null?'—':INR(bCost)}</span><span>Model: {mode==='historical'?'2022–2025 replay':`${simulation} simulation`}</span></div>
      </article>
    </div>
    <div className="hub-verdict" role="status"><div className="hub-verdict-icon">↔</div><div><strong>Comparison insight</strong><p>{comparisonMessage}</p></div></div>
    <div className="hub-detail-grid">
      <article className="hub-subpanel"><div className="hub-section-top"><div><span className="hub-kicker">WEATHER INTELLIGENCE</span><h3>14-day rainfall by candidate date</h3></div><span className="hub-mini">Historical mm</span></div>
        {ready ? <><div className="hub-rain-key"><span>Threshold: {threshold} mm</span><span>2022 / 2023 / 2024 / 2025</span></div><div className="hub-rain-rows">{candidateRows.map(r=><div className="hub-rain-row" key={r.date}><div><strong>{dateLabel(r.date)}</strong><span className={r.eligible?'hub-qualifies':'hub-not-qualified'}>{r.eligible?'All years pass':'Not all pass'}</span></div><div className="hub-year-bars">{r.values.map((v,i)=><div className="hub-year-track" key={years[i]} title={`${years[i]}: ${v===null?'missing':`${v.toFixed(1)} mm`}`}><i style={{width:`${(v??0)/rainMax*100}%`}}/><small>{v===null?'—':Math.round(v)}</small></div>)}</div></div>)}</div><p className="hub-footnote">All four historical years are shown; eligibility requires every year to reach the selected threshold. Hover a bar for source-year rainfall.</p></> : <p className="hub-placeholder">{state==='loading'?'Retrieving measured-input reanalysis…':'Historical weather chart requires complete real source data. Synthetic values are not displayed here.'}</p>}
      </article>
      <article className="hub-subpanel"><div className="hub-section-top"><div><span className="hub-kicker">SHARED COST MODEL</span><h3>What each planting costs</h3></div><span className="hub-mini">INR · estimates</span></div>
        <div className="hub-cost-rows"><div><span>Plan A · single visit</span><b>{aCost===null?'Not qualified':INR(aCost)}</b></div><div><span>Plan B · {b?.visits??'—'} visit(s)</span><b>{bCost===null?'Not qualified':INR(bCost)}</b></div><div><span>Each additional visit adds</span><b>{INR(rates.mobilizationPerVisit+rates.otherPerVisit)}</b></div></div>
        {bBreakdown && <div className="hub-cost-stack" aria-label="Plan B cost breakdown">{([['Seeds',bBreakdown.seed],['Labour',bBreakdown.labor],['Machinery',bBreakdown.machinery],['Visits',bBreakdown.perVisit]] as const).map(([key,value])=><div key={key} title={`${key}: ${INR(value)}`} style={{flexGrow:Math.max(0,value),flexBasis:0}}/>)}</div>}
        <p className="hub-footnote">Cost = acreage × (seed quantity × seed price + labour + machinery) + visits × (mobilisation + other fees). Rates are farmer-editable, unverified estimates. No farmer budget required.</p>
        {selected && b && selected.id!==b.id && <p className="hub-exploring">Your explored allocation: {allocation(selected)}. It does not replace the modeled Plan B result.</p>}
      </article>
    </div>
    <details className="hub-science" open={detailsOpen} onToggle={e=>setDetailsOpen(e.currentTarget.open)}><summary>Methods, formula, sensitivity and source trace</summary><div className="hub-science-grid"><p><b>Plan A:</b> First candidate with preceding 14-day rainfall ≥ {threshold} mm for each replay year. This strict all-years requirement is experimental, not a validated sowing rule. Historical replay years are not a probabilistic forecast.</p><p><b>Plan B:</b> exposure = min(1, 0.68 × rainfall shortfall + 0.20 × excess 3-day rainfall + 0.12 × heat penalty). Reject modeled exposure above 0.60, then minimize cost among acceptable strategies. Weights, cutoffs and outcomes are unvalidated.</p></div>
      {ready && <><p className="hub-footnote">Threshold sensitivity (same historical data):</p><div className="hub-sensitivity">{[60,80,100,120,140,160,180].map(t=>{const p=rainfallThresholdPlan(weather,dates,area,rates,t);return <div key={t}><span>{t} mm</span><b>{p.date ? dateLabel(p.date) : 'No date'}</b></div>})}</div></>}
      <p className="hub-footnote">Data source: {ready?<><a href={weather?.sourceUrls[2]} target="_blank" rel="noreferrer">Open-Meteo historical archive (2024)</a> · Retrieved {new Date(weather!.retrievedAt).toLocaleString('en-IN')} · Transport: {weather?.fetchTransports.join(', ')}.</>:'No verified historical response for the active mode.'} Reanalysis is retrospective, not an issued sowing-date forecast. Synthetic demonstration outputs must never be described as historical observation or certified crop advice.</p>
    </details>
  </section>;
}
