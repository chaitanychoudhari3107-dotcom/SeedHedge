import FarmerJourney from './FarmerJourney.tsx';
import DecisionDashboard from './DecisionDashboard.tsx';
import FarmHelp from './FarmHelp.tsx';
import VoiceExplainer from './VoiceExplainer.tsx';
import FarmReport from './FarmReport.tsx';
import { rainfallThresholdPlan } from './approaches.ts';
import { candidatesForWindow, DEMO_WINDOW_START, DEMO_WINDOW_END, REPLAY_WINDOW_MIN, REPLAY_WINDOW_MAX, DEFAULT_INTERVAL_DAYS, DATE_INTERVAL_OPTIONS } from './sowing-window.ts';
import { useEffect, useMemo, useState } from 'react';
import { analyze, defaultRates, type CostRates, type Strategy } from './engine.ts';
import { strategyBreakdown, strategyScenarioRows, modelComparison } from './strategy-insight.ts';
import { syntheticScenariosForDates } from './fixtures.ts';
import { REGIONS } from './regions.ts';
import { databaseConfigured, fetchReferenceRates } from './database.ts';
import { fetchCurrentForecast, fetchHistoricalReplay, replayForDates, IncompleteReplayError, type HistoricalReplay, type HistoricalDay } from './weather.ts';

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const friendlyDate = (date: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
const allocationName = (s: Strategy) => s.allocations.map(a => `${Math.round(a.share * 100)}% · ${friendlyDate(a.date)}`).join(' + ');
const rateKeys: { key: keyof CostRates; label: string; unit: string }[] = [
  { key: 'seedKgPerAcre', label: 'Seed quantity', unit: 'kg / acre' },
  { key: 'seedPricePerKg', label: 'Seed price', unit: '₹ / kg' },
  { key: 'laborPerAcre', label: 'Labour', unit: '₹ / acre' },
  { key: 'machineryPerAcre', label: 'Machinery', unit: '₹ / acre' },
  { key: 'mobilizationPerVisit', label: 'Mobilisation', unit: '₹ / visit' },
  { key: 'otherPerVisit', label: 'Other visit expenses', unit: '₹ / visit' },
];
function storedRates(): CostRates {
  try {
    const raw = localStorage.getItem('seedhedge-rates');
    if (!raw) return defaultRates;
    const obj = JSON.parse(raw) as CostRates;
    return Object.values(defaultRates).every((_, idx) => {
      const val = obj[Object.keys(defaultRates)[idx] as keyof CostRates];
      return typeof val === 'number' && Number.isFinite(val) && val >= 0;
    }) ? obj : defaultRates;
  } catch { return defaultRates; }
}
function describeWeatherFailure(error: string): string {
  if (/429|rate.limit/i.test(error)) return 'The weather provider is limiting requests at the moment. Try again later; your farm details are saved on screen.';
  if (/timeout|timed out|aborterror/i.test(error)) return 'The weather service did not respond in time. Check your internet connection and retry.';
  if (/missing|invalid|incomplete|arrays|units|timezone/i.test(error)) return 'The weather service returned missing or inconsistent records. This app will not calculate a historical result from them.';
  if (/network|fetch|cors|blocked/i.test(error)) return 'Your browser could not reach the weather service. Check connectivity, browser restrictions, or the same-origin relay.';
  return 'Historical weather could not be loaded for all required years. Retry or use the clearly labeled fictional demo.';
}
export default function App() {
  const [detailedView, setDetailedView] = useState(false);
  const [area, setArea] = useState(2);
  const [demoExample, setDemoExample] = useState(true);
  const [windowStart, setWindowStart] = useState(DEMO_WINDOW_START);
  const [windowEnd, setWindowEnd] = useState(DEMO_WINDOW_END);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [intervalDays, setIntervalDays] = useState(DEFAULT_INTERVAL_DAYS);
  const [stage, setStage] = useState(0);
  const [strategyRowsLimit, setStrategyRowsLimit] = useState(60);
  const stages = ['Your farm', 'Check rainfall', 'Compare planting days', 'Your answer'];
  const candidateWindow = useMemo(() => candidatesForWindow(windowStart, windowEnd, intervalDays), [windowStart, windowEnd, intervalDays]);
  const invalidWindow = Boolean(candidateWindow.error);
  const canSwapDates = invalidWindow && windowStart > windowEnd &&
    windowEnd >= REPLAY_WINDOW_MIN && windowStart <= REPLAY_WINDOW_MAX;
  const generatedDates = candidateWindow.dates;
  const canProceed = !invalidWindow && generatedDates.length > 0;
  const goToStage = (next: number) => {
    if (next < 0 || next >= stages.length || (next > 0 && !canProceed)) return;
    setStage(next);
    requestAnimationFrame(() => { document.getElementById('guided-flow')?.scrollIntoView({behavior: 'smooth', block: 'start'}); document.querySelector<HTMLElement>('.guide-step-heading')?.focus({preventScroll:true}); });
  };
  const enabledDates = generatedDates.filter(date => !excludedDates.includes(date));
  const [regionId, setRegionId] = useState('akola');
  const [weatherMode, setWeatherMode] = useState<'historical' | 'synthetic'>('historical');
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [rainfallThreshold, setRainfallThreshold] = useState(100);
  const [demoGuideOpen, setDemoGuideOpen] = useState(false);
  const [databaseNote, setDatabaseNote] = useState('');
  const [rates, setRates] = useState<CostRates>(storedRates);
  const [mode, setMode] = useState<'stress' | 'calm'>('stress');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitEarly, setSplitEarly] = useState(DEMO_WINDOW_START);
  const [splitLate, setSplitLate] = useState('2024-06-24');
  const [splitPercent, setSplitPercent] = useState(50);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [weather, setWeather] = useState<HistoricalReplay | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [partialYears, setPartialYears] = useState<number[]>([]);
  const [currentForecast, setCurrentForecast] = useState<HistoricalDay[] | null>(null);
  const [forecastSourceUrl, setForecastSourceUrl] = useState<string | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem('seedhedge-rates', JSON.stringify(rates)); } catch { /* optional storage */ } }, [rates]);
  const region = REGIONS.find(r => r.id === regionId) ?? REGIONS[0];
  useEffect(() => {
    const controller = new AbortController();
    setWeather(null);
    setWeatherError(null); setPartialYears([]);
    setLoadingWeather(true);
    setCurrentForecast(null); setForecastSourceUrl(null); setForecastError(null);
    // Practice mode deliberately makes no real weather request; never mix response sources.
    if (weatherMode === 'synthetic') { setLoadingWeather(false); return () => controller.abort(); }
    fetchCurrentForecast(region, controller.signal)
      .then(data => { if (!controller.signal.aborted) {setCurrentForecast(data.daily); setForecastSourceUrl(data.sourceUrl);} })
      .catch((error: unknown) => { if (!controller.signal.aborted) setForecastError(error instanceof Error ? error.message : 'Forecast unavailable'); });
    fetchHistoricalReplay(region, controller.signal)
      .then(data => { if (!controller.signal.aborted) setWeather(data); })
      .catch((error: unknown) => { if (!controller.signal.aborted) { setWeatherError(error instanceof Error ? error.message : 'Historical weather unavailable'); if (error instanceof IncompleteReplayError) setPartialYears(error.loadedYears); } })
      .finally(() => { if (!controller.signal.aborted) setLoadingWeather(false); });
    return () => controller.abort();
  }, [regionId, reloadKey, weatherMode]);
  const replay = useMemo(() => weather ? replayForDates(weather, enabledDates) : null, [weather, enabledDates.join('|')]);
  const scenarios = useMemo(() => weatherMode === 'synthetic' ? syntheticScenariosForDates(enabledDates, mode) : (replay?.scenarios ?? []), [weatherMode, mode, replay, enabledDates.join('|')]);
  const canEvaluate = weatherMode === 'synthetic' || (Boolean(replay) && !loadingWeather && !weatherError);
  const result = useMemo(() => analyze({ dates: canEvaluate ? enabledDates : [], farmAcres: area, rates, scenarios, threshold: .60, approvedDates: new Set(enabledDates), increment: .10 }), [canEvaluate, enabledDates.join('|'), area, rates, scenarios]);
  const planA = useMemo(() => rainfallThresholdPlan(weatherMode === 'historical' && !loadingWeather && !weatherError ? replay : null, enabledDates, area, rates, rainfallThreshold), [weatherMode, loadingWeather, weatherError, replay, enabledDates.join('|'), area, rates, rainfallThreshold]);
  const selected = result.strategies.find(s => s.id === selectedId);
  const active = selected ?? result.winner ?? result.strategies[0];
  const accepted = result.strategies.filter(s => s.verdict === 'acceptable');
  const rejected = result.strategies.filter(s => s.verdict === 'unacceptable');
  const ranked = [...accepted].sort((a, b) => a.cost - b.cost || (a.maximumExposure ?? 99) - (b.maximumExposure ?? 99));
  const chosenDates = active?.allocations ?? [];
  // Date identity, not allocation order, determines plot color and legend identity.
  const dateColorIndex = (date: string) => generatedDates.indexOf(date);
  // Golden-angle hues keep even 20+ candidate dates distinguishable in the farm preview.
  const dateColor = (date: string) => `hsl(${Math.round((Math.max(0,dateColorIndex(date))*137.508 + 133) % 360)} 38% 46%)`;
  const friendlyWeatherError = weatherError ? describeWeatherFailure(weatherError) : null;
  const pairDates = enabledDates.length >= 2 ? enabledDates : [];
  const firstSplitDate = pairDates.includes(splitEarly) ? splitEarly : pairDates[0];
  const secondSplitDate = pairDates.includes(splitLate) && splitLate !== firstSplitDate ? splitLate : pairDates.find(d => d !== firstSplitDate);
  // Reflect the currently explored split; single-date exploration retains the last split draft.
  const editorFirstDate = active?.allocations.length === 2 ? active.allocations[0].date : firstSplitDate;
  const editorSecondDate = active?.allocations.length === 2 ? active.allocations[1].date : secondSplitDate;
  const editorPercent = active?.allocations.length === 2 ? Math.round(active.allocations[0].share * 100) : splitPercent;
  const selectedVsWinner = result.winner && active ? modelComparison(result.winner, active) : null;
  const featuredStrategies = [result.winner, result.strategies.find(s => s.allocations.length === 1 && s.id !== result.winner?.id),
    result.strategies.find(s => s.allocations.length === 2 && s.verdict === 'acceptable' && s.id !== result.winner?.id),
    result.strategies.find(s => s.allocations.length === 2 && s.id !== result.winner?.id && s.verdict !== 'acceptable')]
    .filter((s): s is Strategy => Boolean(s)).filter((s, i, all) => all.findIndex(x => x.id === s.id) === i);
  const selectSplit = (early: string, late: string, percentage: number) => {
    if (!early || !late || early >= late || !pairDates.includes(early) || !pairDates.includes(late) ||
        !Number.isInteger(percentage) || percentage < 10 || percentage > 90) return;
    const match = result.strategies.find(s => s.allocations.length === 2 &&
      s.allocations.some(a => a.date === early && Math.abs(a.share * 100 - percentage) < .001) &&
      s.allocations.some(a => a.date === late && Math.abs(a.share * 100 - (100 - percentage)) < .001));
    if (match) {
      setSelectedId(match.id);
      setSplitEarly(early);
      setSplitLate(late);
      setSplitPercent(percentage);
    }
  };
  const chooseStrategy = (s: Strategy) => {
    setSelectedId(s.id);
    if (s.allocations.length === 2) {
      setSplitEarly(s.allocations[0].date);
      setSplitLate(s.allocations[1].date);
      setSplitPercent(Math.round(s.allocations[0].share * 100));
    }
  };
  const displayedScenarios = active ? strategyScenarioRows(active, scenarios) : [];
  const breakdown = active ? strategyBreakdown(active, area, rates) : null;
  const loadDatabaseRates = async () => {
    setDatabaseNote('Loading database reference rates…');
    try {
      const saved = await fetchReferenceRates(regionId);
      if (!saved) { setDatabaseNote('No reference rates available for this region.'); return; }
      setRates(saved.rates);
      setDatabaseNote(`Loaded example rates for ${region.label} from PostgreSQL. Edit them below; they are NOT verified market prices.`);
    } catch (e: unknown) { setDatabaseNote(e instanceof Error ? e.message : 'Database unavailable'); }
  };
  if (!detailedView) return <FarmerJourney
    openDetailedView={() => setDetailedView(true)}
    regionId={regionId} setRegionId={v=>{setRegionId(v);setSelectedId(null);}}
    area={area} setArea={setArea}
    windowStart={windowStart} setWindowStart={v=>{setWindowStart(v);setDemoExample(false);setSelectedId(null);}}
    windowEnd={windowEnd} setWindowEnd={v=>{setWindowEnd(v);setDemoExample(false);setSelectedId(null);}}
    intervalDays={intervalDays} setIntervalDays={v=>{setIntervalDays(v);setDemoExample(false);setSelectedId(null);}}
    generatedDates={generatedDates} enabledDates={enabledDates} excludedDates={excludedDates} setExcludedDates={v=>{setExcludedDates(v);setSelectedId(null);}}
    windowError={candidateWindow.error} canSwapDates={canSwapDates}
    weatherMode={weatherMode} setWeatherMode={v=>{setWeatherMode(v);setSelectedId(null);}}
    simulation={mode} setSimulation={v=>{setMode(v);setSelectedId(null);}}
    weather={replay} loadingWeather={loadingWeather} weatherError={friendlyWeatherError} partialYears={partialYears} onRetry={()=>setReloadKey(v=>v+1)}
    forecast={currentForecast} forecastError={forecastError}
    rates={rates} setRates={setRates} threshold={rainfallThreshold} setThreshold={setRainfallThreshold}
    winner={canEvaluate?result.winner:null} strategies={canEvaluate?result.strategies:[]}
  />;
  return <div className="app">
    <aside id="app-navigation" className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-icon">✳</span><span>seed<span className="brand-bold">hedge</span><small>AGRICULTURAL INTELLIGENCE</small></span></div>
      <div className="nav-meta">WORKSPACE</div>
      <button type="button" onClick={() => { goToStage(0); setMobileNavOpen(false); }} className={`nav-item ${stage===0 ? 'active' : ''}`}><span>◈</span> Farm details</button>
      <button type="button" onClick={() => { goToStage(1); setMobileNavOpen(false); }} disabled={!canProceed} className={`nav-item ${stage===1 ? 'active' : ''}`}><span>◇</span> Rainfall chart</button>
      <button type="button" onClick={() => { goToStage(2); setMobileNavOpen(false); }} disabled={!canProceed} className={`nav-item ${stage===2 ? 'active' : ''}`}><span>▤</span> Two-date planting</button>
      <button type="button" onClick={() => { goToStage(3); setMobileNavOpen(false); }} disabled={!canProceed} className={`nav-item ${stage===3 ? 'active' : ''}`}><span>⌁</span> Results &amp; help</button>
      <div className="sidebar-bottom"><div className="badge-light">● Research prototype</div><p>Made for HACKVERSE 2026<br/>No validated crop-safety claims</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><button type="button" onClick={()=>setDetailedView(false)} className="reset-btn">← Farmer view</button><button type="button" className="mobile-menu-btn" aria-expanded={mobileNavOpen} aria-controls="app-navigation" onClick={() => setMobileNavOpen(v => !v)}>☰ <span>Menu</span></button><div className="breadcrumb">SeedHedge <span>/</span> Strategy Studio</div><div className="top-actions">{weatherMode === 'historical' ? 'Historical replay' : 'Synthetic demo'} · {region.label} <span className="avatar">SH</span></div></header>
      <div className="content guided-content" id="studio">
        <header className="guide-intro">
          <span className="section-label">SEEDHEDGE · HISTORICAL REPLAY DEMONSTRATION</span>
          <h1>Choose a sowing plan, step by step.</h1>
          <p>Enter your farm details, understand the rain, try planting on two dates, then compare the results. This is a research demonstration using past weather—not a forecast for sowing today.</p>
        </header>
        <nav id="guided-flow" className="guide-steps" aria-label="Sowing comparison steps">
          {stages.map((label,index) => <button key={label} type="button" aria-current={stage === index ? 'step' : undefined} disabled={index > 0 && !canProceed} className={`guide-step ${stage === index ? 'guide-step-active' : ''}`} onClick={() => goToStage(index)}>
            <span className="guide-step-number">{index+1}</span><span>{label}</span>
          </button>)}
        </nav>
        <div className="guide-panel">
          {stage === 0 && <>
            <div className="guide-step-heading" tabIndex={-1}><span>STEP 1 OF 4</span><h2>Tell us about your farm</h2><p>Only the dates you select for this 2024 historical example will be considered. Your farm details stay in place when you move between steps.</p></div>
          <section className="panel config farmer-setup" id="farm-setup"><div className="panel-heading"><div><span className="section-label">01 / INPUT</span><h2>1. Your farm and dates</h2></div><span className="small-icon">⚙</span></div>
            <label htmlFor="region">Region</label><select id="region" className="field-select" value={regionId} onChange={e => { setRegionId(e.target.value); setSelectedId(null); setDatabaseNote(''); }}>{REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}, {r.state}</option>)}</select>
            <label htmlFor="crop">Crop supported by this version</label><select id="crop" className="field-select" value="soybean" disabled><option value="soybean">Soybean · Kharif (only supported crop)</option></select><p className="input-help">Why only soybean? The rain rule, weather screening, and example seed rates were designed for a soybean prototype. Choosing rice, cotton, or another crop without separate rules would produce misleading results. We will add crops only after crop-specific evidence and validation.</p>
            <label htmlFor="area">Farm area (acres)</label><input id="area" type="number" step="0.25" min="0.25" max="1000" value={area} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0 && v <= 1000) setArea(v); }}/>
            <fieldset className="window-fields"><legend>Choose your sowing window <small>(2024 historical replay)</small></legend>
              <p className="input-help">You choose the start and end. You choose how frequently to consider planting dates. SeedHedge creates the same candidates for both plans. This is NOT a forecast for an upcoming season.</p>
              <div className="window-inputs"><label htmlFor="window-start">Start date<input id="window-start" type="date" aria-invalid={invalidWindow} aria-describedby={invalidWindow ? "window-validation" : undefined} min={REPLAY_WINDOW_MIN} max={REPLAY_WINDOW_MAX} value={windowStart} onChange={e=>{setWindowStart(e.target.value);setDemoExample(false);setExcludedDates([]);setSelectedId(null);}}/></label><label htmlFor="window-end">End date<input id="window-end" type="date" aria-invalid={invalidWindow} aria-describedby={invalidWindow ? "window-validation" : undefined} min={REPLAY_WINDOW_MIN} max={REPLAY_WINDOW_MAX} value={windowEnd} onChange={e=>{setWindowEnd(e.target.value);setDemoExample(false);setExcludedDates([]);setSelectedId(null);}}/></label></div>
              <label htmlFor="date-spacing" className="guide-spacing-label">How often should we consider a planting date?
                <select id="date-spacing" className="field-select" value={intervalDays} onChange={e => {setIntervalDays(Number(e.target.value));setExcludedDates([]);setSelectedId(null);setDemoExample(false);}}>
                  {DATE_INTERVAL_OPTIONS.map(n => <option value={n} key={n}>{n === 1 ? 'Every day' : `Every ${n} days`}</option>)}
                </select>
              </label>
              <p className="input-help">These dates are generated from your range—not fixed recommendations. The final date is always included. More dates mean more combinations to compare.</p>
              <button className="reset-btn" type="button" onClick={()=>{setWindowStart(DEMO_WINDOW_START);setWindowEnd(DEMO_WINDOW_END);setDemoExample(true);setIntervalDays(DEFAULT_INTERVAL_DAYS);setExcludedDates([]);setSelectedId(null);}}>Load clearly labeled Demo example</button>
              {candidateWindow.error ? <div id="window-validation" className="window-error" role="alert"><strong>Check your sowing dates.</strong><p>{candidateWindow.error} No comparison is calculated until the dates are valid; your farm details are preserved.</p>{canSwapDates && <button className="window-swap" type="button" onClick={() => { setWindowStart(windowEnd); setWindowEnd(windowStart); setDemoExample(false); setExcludedDates([]); setSelectedId(null); }}>Swap dates ({friendlyDate(windowEnd)} → {friendlyDate(windowStart)})</button>}</div> : <p className="window-success" role="status">{demoExample?'Demo example preset':'Farmer-selected historical window'}: {friendlyDate(windowStart)}–{friendlyDate(windowEnd)} 2024. The app generated {generatedDates.length} date(s). Select any dates you do not wish to compare below.</p>}
              <div className="date-toggles" aria-label="App-generated candidate sowing dates">{generatedDates.map(date=>{const on=enabledDates.includes(date);return <button type="button" key={date} aria-pressed={on} className={on?'date-on':''} disabled={on&&enabledDates.length<=1} onClick={()=>{setExcludedDates(old=>on?[...old,date]:old.filter(d=>d!==date));setSelectedId(null);}}>{friendlyDate(date)} <small>{on?'Included':'Excluded'}</small></button>;})}</div>
            </fieldset>
            <label htmlFor="weather-mode">Which weather information should we use?</label>
            <select id="weather-mode" className="field-select" value={weatherMode} onChange={e => { setWeatherMode(e.target.value as 'historical' | 'synthetic'); setSelectedId(null); }}><option value="historical">Actual PAST weather (2022–2025)</option><option value="synthetic">Practice mode — invented weather (DEMO)</option></select>
            <p className="input-help" role="status">{weatherMode==='historical'?'Historical mode: both plans use four retrospective years. These records are not today’s forecast. The next seven-day forecast, when available, is only separate context.':'DEMO mode: Plan B uses clearly fictional stress or calm weather and changes its result. Plan A is disabled because invented rain must not be treated as real rainfall.'}</p>
            {weatherMode === 'synthetic' && <><div className="segmented"><button type="button" className={mode === 'stress' ? 'selected' : ''} onClick={() => {setMode('stress');setSelectedId(null);}}>Stress test</button><button type="button" className={mode === 'calm' ? 'selected' : ''} onClick={() => {setMode('calm');setSelectedId(null);}}>Stable</button></div><p className="input-help" role="status">Active simulation: {mode === 'stress' ? 'Stress · three simulated adverse weather scenarios' : 'Stable · two simulated lower-exposure scenarios'}. {accepted.length} strategies currently pass the experimental 0.60 screen. {active?.maximumExposure === null ? 'The explored strategy has unknown exposure.' : `Explored strategy worst modeled index: ${active?.maximumExposure?.toFixed(2) ?? 'not available'}.`} Cost rates are unchanged.</p></>}
            <div className="source-state" role="status">{invalidWindow ? weatherMode === 'synthetic' ? 'FICTIONAL DEMO selected, but the sowing dates are invalid. Correct the dates to see a comparison.' : weatherError ? 'Weather retrieval failed and the sowing dates are invalid. Fix the dates before comparing plans.' : weather ? `Historical weather downloaded for ${weather.years.join(', ')} · ${region.label}. Your selected date range is invalid, so no comparison is calculated.` : loadingWeather ? 'Historical weather is loading, but the sowing dates need correction before comparing plans.' : 'Correct the sowing dates before comparing plans; no result is available.' : weatherMode === 'synthetic' ? 'FICTIONAL DEMO — no real weather.' : loadingWeather ? 'Loading Open-Meteo ERA5 historical records… no conclusion yet.' : weatherError ? partialYears.length ? `PARTIAL DATA: ${partialYears.join(', ')} loaded; remaining years failed. No historical result.` : 'Weather request failed. No real-data result.' : weather ? `Historical reanalysis ready for ${weather.years.join(', ')} · ${region.label} · dates ${friendlyDate(windowStart)}–${friendlyDate(windowEnd)}. Source: ERA5 via ${weather.fetchTransports.join(', ')}. This is past weather, not a current forecast.` : 'No historical evidence loaded.'}{weatherMode === 'historical' && !invalidWindow && <button type="button" onClick={() => setReloadKey(v => v + 1)}>↻ Retry</button>}</div>
            {weatherMode === 'historical' && weatherError && <div className="weather-recovery" role="alert"><strong>Historical weather is incomplete or unavailable.</strong><p>{friendlyWeatherError}</p><details><summary>Technical information for judges</summary><p>{weatherError}</p></details><p>Check your connection. Retry will keep your farm inputs. Or switch explicitly to a fictional demonstration.</p><button type="button" onClick={() => setReloadKey(v => v + 1)}>Retry real weather</button><button type="button" onClick={() => { setWeatherMode('synthetic'); setMode('stress'); setSelectedId(null); }}>Use clearly labeled synthetic demo</button></div>}

          </section>


            <details className="guide-optional-costs"><summary>Edit estimated sowing costs (optional)</summary>
          <section className="panel costs" id="costs"><div className="panel-heading"><div><span className="section-label">05 / LOCAL ECONOMICS</span><h2>Adjustable cost settings</h2></div><button className="reset-btn" onClick={() => setRates(defaultRates)}>Reset example rates</button></div><p className="subtle">Example rates, not verified market prices. Enter actual local charges. No budget field is required.</p><div className="db-actions"><button type="button" disabled={!databaseConfigured} onClick={loadDatabaseRates}>↧ Load regional example rates from PostgreSQL</button><small>{databaseConfigured ? 'Supabase PostgreSQL configured · read-only demo reference values' : 'Optional database not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY after running supabase/schema.sql.'}</small>{databaseNote && <p role="status">{databaseNote}</p>}</div><div className="rate-grid">{rateKeys.map(({ key, label, unit }) => <label key={key}>{label}<div className="rate-input"><input type="number" min="0" step="1" value={rates[key]} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= 0) setRates(old => ({ ...old, [key]: value })); }}/><span>{unit}</span></div></label>)}</div></section>

            </details>
          </>}
          {stage > 0 && <div className="guide-mode-switch" role="group" aria-label="Weather source for this step">
            <div><strong>Weather used for this step</strong><p>{weatherMode==='historical' ? 'REAL PAST RECORDS · 2022–2025. Not a forecast for a future harvest.' : `FICTIONAL DEMO · ${mode==='stress'?'stress':'stable'} weather. Plan A cannot use invented rainfall.`}</p></div>
            <label htmlFor="weather-mode-step">Change weather source</label>
            <select id="weather-mode-step" className="field-select" value={weatherMode} onChange={e=>{setWeatherMode(e.target.value as 'historical'|'synthetic');setSelectedId(null);}}><option value="historical">Historical data · real past records</option><option value="synthetic">Fictional demo · practice only</option></select>
            {weatherMode==='synthetic'&&<div className="segmented"><button type="button" aria-pressed={mode==='stress'} className={mode==='stress'?'selected':''} onClick={()=>{setMode('stress');setSelectedId(null);}}>Fictional stress</button><button type="button" aria-pressed={mode==='calm'} className={mode==='calm'?'selected':''} onClick={()=>{setMode('calm');setSelectedId(null);}}>Fictional stable</button></div>}
            {weatherMode==='historical' && weatherError && <button type="button" className="reset-btn" onClick={()=>setReloadKey(x=>x+1)}>Retry past weather</button>}
          </div>}
          {stage === 1 && <>
            <div className="guide-step-heading" tabIndex={-1}><span>STEP 2 OF 4 · FIRST WEATHER CHART</span><h2>Has enough rain fallen?</h2><p>Plan A checks rainfall in the 14 days before each generated date. Move the slider to see which dates meet the experimental rule. Then go directly to the two-date planting comparison.</p></div>
        <DecisionDashboard view="rain"
          weather={replay} loading={loadingWeather} error={friendlyWeatherError} partialYears={partialYears}
          mode={weatherMode} simulation={mode} region={region.label}
          area={area} dates={enabledDates} rates={rates}
          threshold={rainfallThreshold} onThresholdChange={setRainfallThreshold}
          winner={result.winner} selected={active} acceptableCount={accepted.length}
          strategyCount={result.strategies.length} strategies={result.strategies}
          onRetry={() => setReloadKey(v => v + 1)}
          onDemo={() => { setWeatherMode('synthetic'); setMode('stress'); setSelectedId(null); }}
        />

          </>}
          {stage === 2 && <>
            <div className="guide-step-heading" tabIndex={-1}><span>STEP 3 OF 4 · PLANTING SPLIT</span><h2>All on one day, or divide the farm?</h2><p>Plan B compares planting in one visit with dividing your acres across two dates. Adjust the split and watch the selected farm area and estimated cost change.</p></div>
        <DecisionDashboard view="split"
          weather={replay} loading={loadingWeather} error={friendlyWeatherError} partialYears={partialYears}
          mode={weatherMode} simulation={mode} region={region.label}
          area={area} dates={enabledDates} rates={rates}
          threshold={rainfallThreshold} onThresholdChange={setRainfallThreshold}
          winner={result.winner} selected={active} acceptableCount={accepted.length}
          strategyCount={result.strategies.length} strategies={result.strategies}
          onRetry={() => setReloadKey(v => v + 1)}
          onDemo={() => { setWeatherMode('synthetic'); setMode('stress'); setSelectedId(null); }}
        />

        <div className="studio-grid">
          <section className="panel farm-panel"><div className="panel-heading"><div><span className="section-label">02 / EXPLORE</span><h2>Virtual farm allocation</h2></div><span className="mini-pill">Interactive preview</span></div>
            <label htmlFor="strategy-select" className="strategy-label">Explore a sowing option</label>
            <select id="strategy-select" className="field-select strategy-select" value={active?.id ?? ''} onChange={e => { const chosen = result.strategies.find(s => s.id === e.target.value); if (chosen) chooseStrategy(chosen); }} disabled={result.strategies.length === 0}>{result.strategies.map(s => <option key={s.id} value={s.id}>{allocationName(s)} · {s.verdict} · {money(s.cost)}</option>)}</select>
            <p className="input-help">You are exploring an alternative. It does not overwrite SeedHedge's calculated recommendation.</p>
            <div className="strategy-quick-cards" aria-label="Quick strategy choices">
              {featuredStrategies.map(s => <button type="button" key={s.id} className={`quick-card ${active?.id === s.id ? 'quick-active' : ''}`} aria-pressed={active?.id === s.id} onClick={() => chooseStrategy(s)}>
                <span>{s.id === result.winner?.id ? '★ Recommended' : s.allocations.length === 1 ? 'One planting date' : 'Two planting dates'}</span>
                <strong>{allocationName(s)}</strong><small>{s.verdict} · {money(s.cost)}</small>
              </button>)}
            </div>
            <div className="allocation-editor"><div className="allocation-head"><strong>Plant on two different dates</strong><span>10% increments · exploratory</span></div>
              {pairDates.length >= 2 && secondSplitDate ? <>
                <div className="allocation-pickers"><label>First date<select aria-label="Split first date" className="field-select" value={editorFirstDate} onChange={e => { const d=e.target.value; const other = d === editorSecondDate ? pairDates.find(x => x !== d) : editorSecondDate; if (other) selectSplit(d, other, editorPercent); }}>{pairDates.filter(d => editorSecondDate !== undefined && d < editorSecondDate).map(d => <option key={d} value={d}>{friendlyDate(d)}</option>)}</select></label>
                <label>Second date<select aria-label="Split second date" className="field-select" value={editorSecondDate} onChange={e => selectSplit(editorFirstDate, e.target.value, editorPercent)}>{pairDates.filter(d => d > editorFirstDate).map(d => <option key={d} value={d}>{friendlyDate(d)}</option>)}</select></label></div>
                <label htmlFor="allocation-slider" className="allocation-slider-label">First-date allocation: <b>{editorPercent}% / {100-editorPercent}%</b></label>
                <input id="allocation-slider" type="range" min="10" max="90" step="10" value={editorPercent} onChange={e => selectSplit(editorFirstDate,editorSecondDate ?? '',Number(e.target.value))}/>
                {active?.allocations.length !== 2 && <p className="input-help" role="status">Currently viewing a single-date strategy. Moving the slider will select a split strategy.</p>}
                <p className="input-help">Adjust the split to inspect a recalculated weather and cost outcome. If it fails screening, it remains an exploratory option—not a recommendation.</p>
              </> : <p className="input-help">Enable at least two candidate dates to explore split strategies.</p>}
            </div>
            <div className="farm-plot" role="img" aria-label="A stylized farm grid colored by the selected sowing allocation">
              {Array.from({ length: 100 }, (_, i) => { const chosen = chosenDates.find((_, j) => i < Math.round(chosenDates.slice(0, j + 1).reduce((t, x) => t + x.share, 0) * 100)); return <span key={i} data-date={chosen?.date ?? ''} className="plot-cell" style={{backgroundColor: chosen ? dateColor(chosen.date) : '#e8eee5'}} />; })}
              <span className="farm-overlay">YOUR FIELD<br/><small>{area} ACRES</small></span>
            </div>
            <div className="legend" aria-label="Colors for selected sowing dates">{chosenDates.length ? chosenDates.map(a => <span key={a.date} data-date={a.date}><i style={{backgroundColor:dateColor(a.date)}}/> {friendlyDate(a.date)} · {Math.round(a.share * 100)}%</span>) : <span>No allocation selected</span>}</div>
            <div className="selection"><b>Selected allocation</b><span>{active ? allocationName(active) : '—'}</span></div>
            <div className="selection-sub">{active ? `Exploring: ${active.verdict.toUpperCase()} under the selected model · ${money(active.cost)}. ${active.reason}` : 'No candidate selected.'}</div>
          </section>
          <section className="panel decision"><div className="panel-heading"><div><span className="section-label">03 / DECISION</span><h2>Your modeled answer</h2></div><span className="small-icon">✺</span></div>
            {result.winner ? <><div className="winner-label">✓ Lowest estimated cost after experimental weather checks</div><div className="winner-value">{allocationName(result.winner)}</div><div className="decision-price">{money(result.winner.cost)}<small> estimated sowing cost</small></div><p className="decision-body">{result.winner.reason} {weatherMode === 'synthetic' ? 'Synthetic scenarios only.' : 'Historical reanalysis scenario comparison, not a live planting forecast.'}</p></> : <><div className="winner-label uncertain">{weatherMode === 'historical' && !weather ? weatherError ? 'Weather unavailable — cannot rank' : loadingWeather ? 'Loading historical evidence — results pending' : 'Waiting for historical evidence' : 'No strategy passes the current model'}</div><p>{weatherError || 'Insufficient evidence or no options pass the demonstration threshold. No recommendation is forced.'}</p></>}
            <div className="decision-divider"/><VoiceExplainer winner={result.winner} mode={weatherMode}/>
          </section>
        </div>

          </>}
          {stage === 3 && <>
            <div className="guide-step-heading" tabIndex={-1}><span>STEP 4 OF 4 · RESULT</span><h2>Your modeled result and what it means</h2><p>See the suggested option, compare both approaches, and ask a simple question. All costs are estimates using the same local rates.</p></div>
        <div className="farmer-first" role="status"><span className="section-label">YOUR ANSWER · RESEARCH PROTOTYPE</span>
          <h2>{candidateWindow.error ? 'Choose a valid date range first' : weatherMode==='historical'&&loadingWeather ? 'Checking historical weather…' : weatherMode==='historical'&&weatherError ? 'Weather information incomplete — no recommendation' : result.winner ? `Modeled option: ${allocationName(result.winner)}` : 'No planting option passes the current experimental rule'}</h2>
          <p>{weatherMode==='synthetic'?'FICTIONAL DEMO: these dates and modeled results use invented weather scenarios.':`Historical replay for ${region.label} using 2022–2025 ERA5 records. The dates refer to 2024; this is NOT advice for sowing today.`} {result.winner && !(weatherMode==='historical' && (loadingWeather||weatherError)) ? `Estimated sowing cost: ${money(result.winner.cost)}. See Plan A vs Plan B below for the reason and limitations.` : 'Please review your farm inputs and weather status before interpreting a result.'}</p>
          <div className="farmer-first-actions"><button type="button" onClick={() => goToStage(0)}>Change farm details</button><button type="button" onClick={() => goToStage(1)}>See the rain check</button><a href="#farm-help">Ask a question</a></div>
        </div>

        <div className="stats"><div className="stat"><span>Planting options to compare</span><strong>{invalidWindow ? '—' : !canEvaluate && weatherMode==='historical' ? 'Pending' : result.strategies.length}</strong><small>{invalidWindow ? 'Fix your start and end dates first' : 'Generated from your selected sowing window'}</small></div><div className="stat"><span>Options passing the model</span><strong>{invalidWindow ? '—' : !canEvaluate && weatherMode === 'historical' ? loadingWeather?'Loading…':'Unavailable' : `${accepted.length} / ${result.strategies.length}`}</strong><small>{invalidWindow ? 'No comparison has been run' : 'Experimental screening, not crop-safety advice'}</small></div><div className="stat"><span>Lowest qualifying estimated cost</span><strong>{invalidWindow ? '—' : !canEvaluate && weatherMode === 'historical' ? loadingWeather?'Loading…':'Unavailable' : result.winner ? money(result.winner.cost) : '—'}</strong><small>{invalidWindow ? 'Available after correcting the dates' : 'Same local rates for both plans'}</small></div></div>

        <DecisionDashboard view="compare"
          weather={replay} loading={loadingWeather} error={friendlyWeatherError} partialYears={partialYears}
          mode={weatherMode} simulation={mode} region={region.label}
          area={area} dates={enabledDates} rates={rates}
          threshold={rainfallThreshold} onThresholdChange={setRainfallThreshold}
          winner={result.winner} selected={active} acceptableCount={accepted.length}
          strategyCount={result.strategies.length} strategies={result.strategies}
          onRetry={() => setReloadKey(v => v + 1)}
          onDemo={() => { setWeatherMode('synthetic'); setMode('stress'); setSelectedId(null); }}
        />

        <FarmReport region={region.label} area={area} dates={enabledDates} windowStart={windowStart} windowEnd={windowEnd} demoExample={demoExample} mode={weatherMode} simulation={mode}
          weather={replay} loading={loadingWeather} weatherError={friendlyWeatherError} forecast={currentForecast} forecastSource={forecastSourceUrl} forecastError={forecastError}
          rates={rates} thresholdMm={rainfallThreshold} strategies={result.strategies} winner={result.winner}/>

        <div id="farm-help"><FarmHelp context={{location:region.label,acres:area,dates:enabledDates,source:weatherMode,loading:loadingWeather,weatherError:friendlyWeatherError,planA,planB:result.winner,strategies:result.strategies,rates}} /></div>

            <details className="guide-advanced"><summary>More evidence and all modeled planting options · for judges</summary>
        <section className="panel v04-case" aria-label="Demonstration case study">
          <div className="panel-heading"><div><span className="section-label">DEMO STORY / HISTORICAL REPLAY</span><h2>One farmer. Two approaches. One transparent comparison.</h2></div><button className="reset-btn" type="button" onClick={() => setDemoGuideOpen(x => !x)}>{demoGuideOpen ? 'Hide walkthrough' : 'Show walkthrough'}</button></div>
          {demoGuideOpen && <div className="v04-story"><p><b>Farmer:</b> {region.label}, Maharashtra · <b>Area:</b> {area} acres · <b>Crop:</b> soybean, Kharif. You selected a 2024 historical replay window. The app generates candidates in that window; they are not today's sowing advice.</p><p><b>Uncertainty:</b> how much rain has already fallen and how different planting splits behave under replayed years. <b>Demo:</b> compare Plan A with Plan B, change rainfall cutoff, explore split allocations, inspect provenance, then switch Stress/Stable to explain simulated sensitivity.</p></div>}
        </section>

        <section className="panel table-panel"><div className="panel-heading"><div><span className="section-label">04 / COMPARE</span><h2>Every strategy, transparently</h2></div><span className="mini-pill">{accepted.length} acceptable · {rejected.length} rejected</span></div><div className="table-wrap"><table><thead><tr><th>Planting allocation</th><th>Weather screen</th><th>Worst modeled exposure</th><th>Visits</th><th>Estimated cost</th></tr></thead><tbody>{[...ranked, ...result.strategies.filter(s => s.verdict !== 'acceptable')].slice(0, strategyRowsLimit).map(s => <tr key={s.id} className={`${active?.id === s.id ? 'row-active' : ''}`}><td><button className="strategy-table-button" type="button" aria-pressed={active?.id === s.id} onClick={() => chooseStrategy(s)}>{allocationName(s)}</button>{result.winner?.id === s.id && <span className="winner-tag">BEST COST</span>}</td><td><span className={`status status-${s.verdict}`}>{s.verdict}</span></td><td>{s.maximumExposure === null ? 'Unknown' : `${(s.maximumExposure * 100).toFixed(0)} / 100`}</td><td>{s.visits}</td><td><b>{money(s.cost)}</b></td></tr>)}</tbody></table></div>{result.strategies.length > strategyRowsLimit && <button type="button" className="guide-more-rows" onClick={() => setStrategyRowsLimit(n => n + 60)}>Show next 60 of {result.strategies.length} modeled options</button>}
<div className="table-foot">Weather screening has absolute priority. Cost ranks only acceptable strategies. Choose a strategy using the row button, quick cards, or allocation slider. Exploring does not change the computed winner.</div></section>

        <div className="analysis-grid" id="analysis">
          <section className="panel comparison-panel"><div className="panel-heading"><div><span className="section-label">05 / TRADE-OFFS</span><h2>Recommended vs your selection</h2></div><span className="mini-pill">Live calculation</span></div>
            {result.winner && active && selectedVsWinner ? <>
              <div className="comparison-cards">
                <div className="comparison-card recommended"><div className="comparison-tag">★ Automatically recommended</div><strong>{allocationName(result.winner)}</strong><div className="comparison-cost">{money(result.winner.cost)}</div><span className={`status status-${result.winner.verdict}`}>{result.winner.verdict}</span><p>Maximum modeled exposure: {result.winner.maximumExposure === null ? 'Unknown' : (result.winner.maximumExposure * 100).toFixed(0) + ' / 100'}</p></div>
                <div className="comparison-card explored"><div className="comparison-tag">◈ You are exploring</div><strong>{allocationName(active)}</strong><div className="comparison-cost">{money(active.cost)}</div><span className={`status status-${active.verdict}`}>{active.verdict}</span><p>Maximum modeled exposure: {active.maximumExposure === null ? 'Unknown' : (active.maximumExposure * 100).toFixed(0) + ' / 100'}</p></div>
              </div>
              <p className="comparison-summary" role="status">{selectedVsWinner.same ? 'You are exploring the recommended strategy.' : `${selectedVsWinner.extraCost > 0 ? money(selectedVsWinner.extraCost) + ' more' : selectedVsWinner.extraCost < 0 ? money(-selectedVsWinner.extraCost) + ' less' : 'The same cost'} than the recommended option. ${active.verdict !== 'acceptable' ? 'This selected strategy does not pass the modeled weather screening, so its lower cost cannot make it the recommendation.' : 'Weather screening is applied before cost comparison.'}`}</p>
            </> : <p className="weather-empty">No strategy currently passes the modeled screening. You may still explore alternatives, but there is no recommended winner.</p>}
          </section>
          <section className="panel transparency-panel"><div className="panel-heading"><div><span className="section-label">06 / SCIENTIFIC TRACE</span><h2>Why this strategy received its status</h2></div><span className="mini-pill">Auditable</span></div>
            {active ? <><p className="subtle">Selected: <b>{allocationName(active)}</b>. Classification: <b>{active.verdict}</b>. {active.reason}</p>
              <div className="metrics-strip"><span><small>Maximum modeled index</small><strong>{active.maximumExposure === null ? 'Unknown' : active.maximumExposure.toFixed(2)}</strong></span><span><small>Experimental cutoff</small><strong>0.60</strong></span><span><small>Planting visits</small><strong>{active.visits}</strong></span></div>
              <div className="trace-table-wrap"><table className="trace-table"><thead><tr><th>Weather scenario</th><th>Weighted exposure</th><th>Criterion</th></tr></thead><tbody>{displayedScenarios.length ? displayedScenarios.map(row => <tr key={row.id}><td>{row.label}</td><td>{row.exposure === null ? 'Missing' : row.exposure.toFixed(2)}</td><td>{row.exposure === null ? 'Unknown' : row.exposure > .60 ? 'Above cutoff' : 'At/below cutoff'}</td></tr>) : <tr><td colSpan={3}>No weather scenario data available.</td></tr>}</tbody></table></div>
              {weatherMode === 'historical' && replay && <details className="diagnostics-detail"><summary>Show historical reanalysis inputs behind the heuristic</summary><div className="trace-table-wrap"><table className="trace-table"><thead><tr><th>Planting date</th><th>Historical year</th><th>Previous 14-day rain</th><th>Next 3-day rain</th><th>Max temp</th><th>Index</th></tr></thead><tbody>{active.allocations.flatMap(a => replay.years.map(year => ({date:a.date,year,d:replay.diagnostics[a.date]?.[year]}))).map(x => <tr key={`${x.date}-${x.year}`}><td>{friendlyDate(x.date)}</td><td>{x.year}</td><td>{x.d ? `${x.d.precedingRainMm.toFixed(1)} mm` : 'Missing'}</td><td>{x.d ? `${x.d.followingRainMm.toFixed(1)} mm` : 'Missing'}</td><td>{x.d ? `${x.d.maxTempC.toFixed(1)} °C` : 'Missing'}</td><td>{x.d ? x.d.modeledExposure.toFixed(2) : 'Unknown'}</td></tr>)}</tbody></table></div></details>}
              {breakdown && <details className="diagnostics-detail"><summary>Show estimated sowing cost breakdown</summary><div className="cost-lines"><span>Seeds <b>{money(breakdown.seed)}</b></span><span>Labour <b>{money(breakdown.labor)}</b></span><span>Machinery <b>{money(breakdown.machinery)}</b></span><span>Repeat visits and other charges <b>{money(breakdown.perVisit)}</b></span><span>Total <b>{money(breakdown.total)}</b></span></div></details>}
              <p className="science-disclaimer">Historical reanalysis is not an issued forecast or farm measurement. The index combines historical rainfall and temperature using unvalidated weights. The 0.60 cutoff is not an agronomic safety threshold; status is <b>modeled acceptance only</b>, never crop-safety certification.</p>
            </> : <p className="weather-empty">Choose a strategy to see the breakdown.</p>}
          </section>
        </div>

          <section className="panel weather-panel" id="evidence"><div className="panel-heading"><div><span className="section-label">06 / REAL DATA CONTEXT</span><h2>Historical weather, {region.label}</h2></div><span className="mini-pill">Open-Meteo · Jun 2024</span></div>
            {weather && weatherMode === 'historical' ? <><p className="subtle">Daily rainfall, June 2024, {region.label}. Historical reanalysis is used in the default counterfactual scenario comparison; it is <b>not</b> a forecast originally issued before these sowing dates.</p><div className="rain-chart" aria-label="Historical daily rainfall bar chart">{weather.dailyByYear[2024].map(d => <div key={d.date} className="rain-column" title={`${d.date}: ${d.precipitationMm} mm`}><i style={{height: `${Math.max(2, Math.min(100, d.precipitationMm / Math.max(1, ...weather.dailyByYear[2024].map(w => w.precipitationMm)) * 100))}%`}} /></div>)}</div><div className="chart-label">1 JUN <span>10 JUL</span></div><div className="evidence-link"><a href={weather.sourceUrls[2]} target="_blank" rel="noreferrer">View 2024 source request ↗</a><span>Retrieved {new Date(weather.retrievedAt).toLocaleString('en-IN')}</span></div></> : <div className="weather-empty">{weatherError ? `Source unavailable: ${weatherError}. No replacement data invented.` : 'No historical records are shown in this mode. Use Historical replay to fetch source data.'}</div>}
            <div className="forecast-box"><b>Separate current 7-day forecast (NOT used in plans) — {region.label}</b><p>Separate live forecast context. It is NOT used to score historical soybean sowing dates.</p>{weatherMode === 'synthetic' ? <p role="status">Current forecast was not requested in fictional demo mode. No live weather is used here.</p> : currentForecast ? <div className="forecast-days">{currentForecast.map(d => <span key={d.date}><strong>{friendlyDate(d.date)}</strong><small>{d.precipitationMm.toFixed(1)} mm rain</small><small>{d.maxTempC.toFixed(0)}°C max</small></span>)}</div> : <p role="status">{forecastError ? `Current forecast unavailable (not used by either plan): ${describeWeatherFailure(forecastError)}` : 'Fetching current forecast…'}</p>}{forecastSourceUrl && <p className="source-note"><a href={forecastSourceUrl} target="_blank" rel="noreferrer">View current forecast source request</a> · Open-Meteo forecast API · not used in either historical plan.</p>}</div>
            <p className="source-note">ICAR-NSRI recommends sowing soybean after monsoon onset and about 100 mm of rain; this prototype uses a 14-day retrospective rainfall approximation. Additional heat/rain exposure weights and the pass threshold are UNVALIDATED heuristics. Reanalysis is not a field measurement. No crop-loss, agronomic-safety or forecast-skill claim is made. <a href="https://icar-nsri.res.in/pdfdoc/Advisory2026/June%281-7%29%2C%202026.pdf" target="_blank" rel="noreferrer">ICAR soybean advisory ↗</a></p></section>

            </details>
          </>}
        </div>
        <div className="guide-actions">
          {stage > 0 && <button type="button" className="guide-back" onClick={() => goToStage(stage - 1)}>← Previous: {stages[stage-1]}</button>}
          {stage < stages.length - 1 && <button type="button" className="guide-next" disabled={!canProceed} onClick={() => goToStage(stage + 1)}>Continue to {stages[stage+1]} →</button>}
          {stage === stages.length - 1 && <button type="button" className="guide-back" onClick={() => goToStage(0)}>Change farm details</button>}
        </div>
        <footer>SeedHedge · HACKVERSE 2026 <span>Review 0.4.4 · Guided farmer journey + explainable farm report · 2024 historical replay · Screening heuristic requires expert validation</span></footer>
      </div>
    </main>
  </div>;
}
