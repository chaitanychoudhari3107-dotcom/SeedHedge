import { useEffect, useMemo, useState } from 'react';
import { analyze, defaultRates, type CostRates, type Strategy } from './engine.ts';
import { strategyBreakdown, strategyScenarioRows, modelComparison } from './strategy-insight.ts';
import { rainfallThresholdPlan, comparePlans } from './approaches.ts';
import { calmScenarios, demoScenarios } from './fixtures.ts';
import { REGIONS } from './regions.ts';
import { databaseConfigured, fetchReferenceRates } from './database.ts';
import { fetchCurrentForecast, fetchHistoricalReplay, SOWING_DATES, type HistoricalReplay, type HistoricalDay } from './weather.ts';

type Language = 'en-IN' | 'mr-IN' | 'hi-IN';
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
const text: Record<Language, (s: Strategy) => string> = {
  'en-IN': s => `Under the selected weather model, the lowest-cost acceptable strategy is ${allocationName(s)} at an estimated ${money(s.cost)}. These are demonstration assumptions, not certified crop advice.`,
  'mr-IN': s => `निवडलेल्या हवामान मॉडेलनुसार, सर्वात कमी खर्चाचा स्वीकारार्ह पर्याय ${allocationName(s)} आहे. अंदाजित खर्च ${money(s.cost)} आहे. हा नमुना आहे, प्रमाणित कृषी सल्ला नाही.`,
  'hi-IN': s => `चुने गए मौसम मॉडल के अनुसार सबसे कम लागत वाली स्वीकार्य योजना ${allocationName(s)} है। अनुमानित खर्च ${money(s.cost)} है। यह प्रमाणित कृषि सलाह नहीं है।`,
};
export default function App() {
  const [area, setArea] = useState(2);
  const [enabledDates, setEnabledDates] = useState<string[]>(SOWING_DATES);
  const [regionId, setRegionId] = useState('akola');
  const [weatherMode, setWeatherMode] = useState<'historical' | 'synthetic'>('historical');
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [rainfallThreshold, setRainfallThreshold] = useState(100);
  const [demoGuideOpen, setDemoGuideOpen] = useState(true);
  const [databaseNote, setDatabaseNote] = useState('');
  const [rates, setRates] = useState<CostRates>(storedRates);
  const [mode, setMode] = useState<'stress' | 'calm'>('stress');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitEarly, setSplitEarly] = useState(SOWING_DATES[0]);
  const [splitLate, setSplitLate] = useState(SOWING_DATES[1]);
  const [splitPercent, setSplitPercent] = useState(50);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('mr-IN');
  const [weather, setWeather] = useState<HistoricalReplay | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [currentForecast, setCurrentForecast] = useState<HistoricalDay[] | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem('seedhedge-rates', JSON.stringify(rates)); } catch { /* optional storage */ } }, [rates]);
  const region = REGIONS.find(r => r.id === regionId) ?? REGIONS[0];
  useEffect(() => {
    const controller = new AbortController();
    setWeather(null);
    setWeatherError(null);
    setLoadingWeather(true);
    setCurrentForecast(null); setForecastError(null);
    fetchCurrentForecast(region, controller.signal)
      .then(data => { if (!controller.signal.aborted) setCurrentForecast(data.daily); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setForecastError(error instanceof Error ? error.message : 'Forecast unavailable'); });
    fetchHistoricalReplay(region, controller.signal)
      .then(data => { if (!controller.signal.aborted) setWeather(data); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setWeatherError(error instanceof Error ? error.message : 'Historical weather unavailable'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingWeather(false); });
    return () => controller.abort();
  }, [regionId, reloadKey]);
  const scenarios = weatherMode === 'synthetic' ? (mode === 'stress' ? demoScenarios : calmScenarios) : (weather?.scenarios ?? []);
  const result = useMemo(() => analyze({ dates: enabledDates, farmAcres: area, rates, scenarios, threshold: .60, approvedDates: new Set(SOWING_DATES), increment: .10 }), [enabledDates, area, rates, scenarios]);
  const selected = result.strategies.find(s => s.id === selectedId);
  const active = selected ?? result.winner ?? result.strategies[0];
  const accepted = result.strategies.filter(s => s.verdict === 'acceptable');
  const rejected = result.strategies.filter(s => s.verdict === 'unacceptable');
  const ranked = [...accepted].sort((a, b) => a.cost - b.cost || (a.maximumExposure ?? 99) - (b.maximumExposure ?? 99));
  const chosenDates = active?.allocations ?? [];
  // Date identity, not allocation order, determines plot color and legend identity.
  const dateColorIndex = (date: string) => SOWING_DATES.indexOf(date);
  const pairDates = enabledDates.length >= 2 ? enabledDates : [];
  const firstSplitDate = pairDates.includes(splitEarly) ? splitEarly : pairDates[0];
  const secondSplitDate = pairDates.includes(splitLate) && splitLate !== firstSplitDate ? splitLate : pairDates.find(d => d !== firstSplitDate);
  // Reflect the currently explored split; single-date exploration retains the last split draft.
  const editorFirstDate = active?.allocations.length === 2 ? active.allocations[0].date : firstSplitDate;
  const editorSecondDate = active?.allocations.length === 2 ? active.allocations[1].date : secondSplitDate;
  const editorPercent = active?.allocations.length === 2 ? Math.round(active.allocations[0].share * 100) : splitPercent;
  const selectedVsWinner = result.winner && active ? modelComparison(result.winner, active) : null;
  const planA = useMemo(() => rainfallThresholdPlan(weatherMode === 'historical' ? weather : null, enabledDates, area, rates, rainfallThreshold), [weatherMode, weather, enabledDates, area, rates, rainfallThreshold]);
  const planComparison = comparePlans(planA, result.winner);
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
  const speak = () => {
    if (!('speechSynthesis' in window) || !result.winner) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${weatherMode === 'historical' ? 'Historical reanalysis comparison. ' : 'Synthetic demonstration. '}${text[language](result.winner)}`);
    utterance.lang = language;
    utterance.rate = .92;
    window.speechSynthesis.speak(utterance);
  };
  return <div className="app">
    <aside id="app-navigation" className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-icon">✳</span><span>seed<span className="brand-bold">hedge</span><small>AGRICULTURAL INTELLIGENCE</small></span></div>
      <div className="nav-meta">WORKSPACE</div>
      <a href="#studio" onClick={() => setMobileNavOpen(false)} className="nav-item active"><span>◈</span> Strategy studio</a>
      <a href="#analysis" onClick={() => setMobileNavOpen(false)} className="nav-item"><span>◇</span> Comparison &amp; evidence</a>
      <a href="#evidence" onClick={() => setMobileNavOpen(false)} className="nav-item"><span>▤</span> Weather evidence</a>
      <a href="#costs" onClick={() => setMobileNavOpen(false)} className="nav-item"><span>⌁</span> Local cost settings</a>
      <div className="sidebar-bottom"><div className="badge-light">● Research prototype</div><p>Made for HACKVERSE 2026<br/>No validated crop-safety claims</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><button type="button" className="mobile-menu-btn" aria-expanded={mobileNavOpen} aria-controls="app-navigation" onClick={() => setMobileNavOpen(v => !v)}>☰ <span>Menu</span></button><div className="breadcrumb">SeedHedge <span>/</span> Strategy Studio</div><div className="top-actions"><span className="live-dot"/> {weatherMode === 'historical' ? 'Historical replay' : 'Synthetic demo'} · {region.label} <span className="avatar">SH</span></div></header>
      <div className="content" id="studio">
        <div className="eyebrow">DECIDE WITH CLARITY <span>✦</span> WEATHER FIRST, COST SECOND</div>
        <div className="hero"><div><h1>Plant with a plan.<br/><em>Not a guess.</em></h1><p>Compare single-date and staggered sowing under climate uncertainty—then find the least expensive strategy that passes the modeled weather screens.</p></div><div className="hero-art" aria-hidden="true"><div className="sun"/><div className="hill hill-back"/><div className="hill hill-front"/><div className="hero-caption">ONE FARM.<br/>MORE THAN ONE WAY FORWARD.</div></div></div>
        <div className="notice"><span>ⓘ</span><div><b>Research replay — not current sowing advice.</b> Weather inputs come from Open-Meteo historical reanalysis for 2022–2025 when the API succeeds. The exposure formula and 0.60 decision cutoff are <b>unvalidated modeling assumptions</b>, not agronomic safety standards, crop-failure probabilities or forecasts available in 2024. The simulation mode uses wholly invented values.</div></div>
        <div className="stats"><div className="stat"><span>Generated strategies</span><strong>{result.strategies.length}</strong><small>Calculated from selected sowing dates</small></div><div className="stat"><span>Screened acceptable</span><strong>{loadingWeather && weatherMode === 'historical' ? 'Loading…' : `${accepted.length} / ${result.strategies.length}`}</strong><small>Based on selected weather model</small></div><div className="stat"><span>Lowest acceptable cost</span><strong>{loadingWeather && weatherMode === 'historical' ? 'Loading…' : result.winner ? money(result.winner.cost) : '—'}</strong><small>Estimated, adjustable local rates</small></div></div>
        <section className="panel v04-case" aria-label="Demonstration case study">
          <div className="panel-heading"><div><span className="section-label">DEMO STORY / HISTORICAL REPLAY</span><h2>One farmer. Two approaches. One transparent comparison.</h2></div><button className="reset-btn" type="button" onClick={() => setDemoGuideOpen(x => !x)}>{demoGuideOpen ? 'Hide walkthrough' : 'Show walkthrough'}</button></div>
          {demoGuideOpen && <div className="v04-story"><p><b>Farmer:</b> {region.label}, Maharashtra · <b>Area:</b> {area} acres · <b>Crop:</b> soybean, Kharif. Candidate dates are June–July 2024 historical counterfactuals—not today's planting advice.</p><p><b>Uncertainty:</b> how much rain has already fallen and how different planting splits behave under replayed years. <b>Demo:</b> compare Plan A with Plan B, change rainfall cutoff, explore split allocations, inspect provenance, then switch Stress/Stable to explain simulated sensitivity.</p></div>}
        </section>
        <section className="panel v04-dual" id="plans" aria-label="Two distinct prototype sowing approaches">
          <div className="panel-heading"><div><span className="section-label">TWO INDEPENDENT METHODS / ONE FARMER INPUT</span><h2>Plan A vs Plan B</h2></div><span className="mini-pill">Research comparison · not agronomic advice</span></div>
          <div className="v04-plan-grid">
            <article className="v04-plan-card"><span className="section-label">PLAN A · RAINFALL-THRESHOLD RULE</span><h3>Wait for preceding rainfall</h3>
              <label htmlFor="rainfall-threshold">Experimental 14-day rainfall minimum: <b>{rainfallThreshold} mm</b></label>
              <input type="range" id="rainfall-threshold" min="20" max="200" step="10" value={rainfallThreshold} onChange={e => setRainfallThreshold(Number(e.target.value))}/>
              <p><b>Inputs:</b> 14 days of rainfall preceding each candidate date, across all available replay years. No future rainfall is used for Plan A qualification.</p>
              <strong className="v04-result">{loadingWeather && weatherMode === 'historical' ? 'Loading historical evidence…' : planA.date ? `${friendlyDate(planA.date)} · ${money(planA.cost ?? 0)}` : 'No date qualifies / insufficient evidence'}</strong>
              <p>{planA.explanation}</p>
              {planA.rainByYear.length > 0 && <p className="v04-analog">Last candidate rainfall by year: {planA.rainByYear.map(x => `${x.year}: ${x.rainMm === null ? 'missing' : `${x.rainMm.toFixed(0)} mm`}`).join(' · ')}</p>}
              <p className="v04-caveat">The all-years rule and chosen millimetre cutoff are prototype assumptions, not validated requirements. It may yield no plan.</p>
            </article>
            <article className="v04-plan-card"><span className="section-label">PLAN B · STAGGERED EXPOSURE SCREEN</span><h3>Explore single vs split sowing</h3>
              <p><b>Inputs:</b> the same dates, area and editable costs; historical scenario scores or explicitly simulated scenarios.</p>
              <strong className="v04-result">{loadingWeather && weatherMode === 'historical' ? 'Loading historical evidence…' : result.winner ? `${allocationName(result.winner)} · ${money(result.winner.cost)}` : 'No modeled-acceptable allocation'}</strong>
              <p><b>Formula:</b> exposure = min(1, 0.68 × rainfall shortfall + 0.20 × 3-day excess rainfall + 0.12 × heat). Strategy exposure is allocation-weighted; its worst replay year must be ≤ 0.60.</p>
              <p><b>Cost:</b> acres × (seed kg/acre × seed price + labour + machinery) + number of visits × (mobilisation + other charges).</p>
              <p className="v04-caveat">Weights, weather cutoffs and screen are unvalidated modeling assumptions; split planting has not been shown here to reduce crop loss.</p>
            </article>
          </div>
          <div className="v04-verdict" role="status"><b>Trade-off:</b> {planComparison.explanation} {planA.date && result.winner ? `Plan A uses one planting visit; Plan B uses ${result.winner.visits}.` : ''} Both approaches use the same acreage and cost rates. No agronomic superiority is claimed.</div>
          <div className="v04-provenance">Historical source: <a target="_blank" rel="noreferrer" href={weather?.sourceUrls[2] ?? 'https://open-meteo.com/en/docs/historical-weather-api'}>Open-Meteo archive reanalysis ↗</a>. {weather ? `Retrieved ${new Date(weather.retrievedAt).toLocaleString('en-IN')}. Transport: ${weather.fetchTransports?.includes('vercel-relay') ? 'same-origin Vercel relay and/or direct' : 'direct browser API'}.` : 'Live request unverified or pending.'} Synthetic mode is an explicitly fictional demonstration and cannot evaluate Plan A.</div>
        </section>
        <div className="studio-grid">
          <section className="panel config"><div className="panel-heading"><div><span className="section-label">01 / INPUT</span><h2>Your farm</h2></div><span className="small-icon">⚙</span></div>
            <label htmlFor="region">Region</label><select id="region" className="field-select" value={regionId} onChange={e => { setRegionId(e.target.value); setSelectedId(null); setDatabaseNote(''); }}>{REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}, {r.state}</option>)}</select>
            <label htmlFor="crop">Crop (supported pilot)</label><select id="crop" className="field-select" value="soybean" disabled><option value="soybean">Soybean · Kharif</option></select><p className="input-help">Only soybean is currently modeled. Other crops require validated crop-specific rules.</p>
            <label htmlFor="area">Farm area (acres)</label><input id="area" type="number" step="0.25" min="0.25" max="1000" value={area} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0 && v <= 1000) setArea(v); }}/>
            <label>Compare candidate dates <small>(demo window)</small></label><div className="date-toggles">{SOWING_DATES.map(date => { const on = enabledDates.includes(date); return <button type="button" key={date} className={on ? 'date-on' : ''} aria-pressed={on} disabled={on && enabledDates.length === 1} onClick={() => { setEnabledDates(old => on ? old.filter(x => x !== date) : [...old, date].sort()); setSelectedId(null); }}>{friendlyDate(date)}</button>; })}</div>
            <label htmlFor="weather-mode">Weather evidence mode</label>
            <select id="weather-mode" className="field-select" value={weatherMode} onChange={e => { setWeatherMode(e.target.value as 'historical' | 'synthetic'); setSelectedId(null); }}><option value="historical">Real 2022–2025 reanalysis</option><option value="synthetic">Synthetic UI demo only</option></select>
            {weatherMode === 'synthetic' && <><div className="segmented"><button type="button" className={mode === 'stress' ? 'selected' : ''} onClick={() => {setMode('stress');setSelectedId(null);}}>Stress test</button><button type="button" className={mode === 'calm' ? 'selected' : ''} onClick={() => {setMode('calm');setSelectedId(null);}}>Stable</button></div><p className="input-help" role="status">Active simulation: {mode === 'stress' ? 'Stress · three simulated adverse weather scenarios' : 'Stable · two simulated lower-exposure scenarios'}. {accepted.length} strategies currently pass the experimental 0.60 screen. {active?.maximumExposure === null ? 'The explored strategy has unknown exposure.' : `Explored strategy worst modeled index: ${active?.maximumExposure?.toFixed(2) ?? 'not available'}.`} Cost rates are unchanged.</p></>}
            <div className="source-state" role="status">{weatherMode === 'synthetic' ? 'Synthetic example — NOT real weather.' : loadingWeather ? 'Fetching historical Open-Meteo weather…' : weatherError ? `Unavailable: ${weatherError}` : weather ? `Loaded ${weather.years.join(', ')} reanalysis for ${region.label}.` : 'No weather evidence.'}{weatherMode === 'historical' && <button type="button" onClick={() => setReloadKey(v => v + 1)}>↻ Retry</button>}</div>
            {weatherMode === 'historical' && weatherError && <div className="weather-recovery" role="alert"><strong>Historical weather could not load.</strong><p>{weatherError}</p><button type="button" onClick={() => setReloadKey(v => v + 1)}>Retry real weather</button><button type="button" onClick={() => { setWeatherMode('synthetic'); setMode('stress'); setSelectedId(null); }}>Use clearly labeled synthetic demo</button></div>}
            <div className="info-card"><b>How we decide</b><p>1. Screen whole-planting strategies against weather assumptions.<br/>2. Remove unacceptable/unknown strategies.<br/>3. Choose the lowest estimated cost remaining.</p></div>
          </section>
          <section className="panel farm-panel"><div className="panel-heading"><div><span className="section-label">02 / EXPLORE</span><h2>Virtual farm allocation</h2></div><span className="mini-pill">Interactive preview</span></div>
            <label htmlFor="strategy-select" className="strategy-label">Explore planting strategy</label>
            <select id="strategy-select" className="field-select strategy-select" value={active?.id ?? ''} onChange={e => { const chosen = result.strategies.find(s => s.id === e.target.value); if (chosen) chooseStrategy(chosen); }} disabled={result.strategies.length === 0}>{result.strategies.map(s => <option key={s.id} value={s.id}>{allocationName(s)} · {s.verdict} · {money(s.cost)}</option>)}</select>
            <p className="input-help">You are exploring an alternative. It does not overwrite SeedHedge's calculated recommendation.</p>
            <div className="strategy-quick-cards" aria-label="Quick strategy choices">
              {featuredStrategies.map(s => <button type="button" key={s.id} className={`quick-card ${active?.id === s.id ? 'quick-active' : ''}`} aria-pressed={active?.id === s.id} onClick={() => chooseStrategy(s)}>
                <span>{s.id === result.winner?.id ? '★ Recommended' : s.allocations.length === 1 ? 'Single sowing' : 'Split sowing'}</span>
                <strong>{allocationName(s)}</strong><small>{s.verdict} · {money(s.cost)}</small>
              </button>)}
            </div>
            <div className="allocation-editor"><div className="allocation-head"><strong>Build a split strategy</strong><span>10% increments · exploratory</span></div>
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
              {Array.from({ length: 100 }, (_, i) => { const chosen = chosenDates.find((_, j) => i < Math.round(chosenDates.slice(0, j + 1).reduce((t, x) => t + x.share, 0) * 100)); return <span key={i} data-date={chosen?.date ?? ''} className={`plot-cell ${chosen ? `plot-${dateColorIndex(chosen.date)}` : 'plot-empty'}`} />; })}
              <span className="farm-overlay">YOUR FIELD<br/><small>{area} ACRES</small></span>
            </div>
            <div className="legend" aria-label="Colors for selected sowing dates">{chosenDates.length ? chosenDates.map(a => <span key={a.date} data-date={a.date}><i className={`key-${dateColorIndex(a.date)}`}/> {friendlyDate(a.date)} · {Math.round(a.share * 100)}%</span>) : <span>No allocation selected</span>}</div>
            <div className="selection"><b>Selected allocation</b><span>{active ? allocationName(active) : '—'}</span></div>
            <div className="selection-sub">{active ? `Exploring: ${active.verdict.toUpperCase()} under the selected model · ${money(active.cost)}. ${active.reason}` : 'No candidate selected.'}</div>
          </section>
          <section className="panel decision"><div className="panel-heading"><div><span className="section-label">03 / DECISION</span><h2>Strategy intelligence</h2></div><span className="small-icon">✺</span></div>
            {result.winner ? <><div className="winner-label">✓ Lowest-cost modeled-acceptable strategy</div><div className="winner-value">{allocationName(result.winner)}</div><div className="decision-price">{money(result.winner.cost)}<small> estimated sowing cost</small></div><p className="decision-body">{result.winner.reason} {weatherMode === 'synthetic' ? 'Synthetic scenarios only.' : 'Historical reanalysis scenario comparison, not a live planting forecast.'}</p></> : <><div className="winner-label uncertain">{weatherMode === 'historical' && !weather ? weatherError ? 'Weather unavailable — cannot rank' : loadingWeather ? 'Loading historical evidence — results pending' : 'Waiting for historical evidence' : 'No strategy passes the current model'}</div><p>{weatherError || 'Insufficient evidence or no options pass the demonstration threshold. No recommendation is forced.'}</p></>}
            <div className="decision-divider"/><div className="assistant-title">🎙 SeedHedge Voice <span>Beta</span></div><p className="subtle">Hear the computed explanation. Playback depends on your browser's installed voices.</p>
            <div className="voice-tools"><select aria-label="Voice language" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="mr-IN">मराठी</option><option value="hi-IN">हिन्दी</option><option value="en-IN">English</option></select><button onClick={speak} disabled={!result.winner || !('speechSynthesis' in window)}>▶ Explain</button></div>
            <p className="voice-copy">{result.winner ? `${weatherMode === 'historical' ? 'Historical replay, not a forecast. ' : 'Synthetic scenario. '}${text[language](result.winner)}` : 'No strategy passed the current model.'}</p>
          </section>
        </div>
        <section className="panel table-panel"><div className="panel-heading"><div><span className="section-label">04 / COMPARE</span><h2>Every strategy, transparently</h2></div><span className="mini-pill">{accepted.length} acceptable · {rejected.length} rejected</span></div><div className="table-wrap"><table><thead><tr><th>Planting allocation</th><th>Weather screen</th><th>Worst modeled exposure</th><th>Visits</th><th>Estimated cost</th></tr></thead><tbody>{[...ranked, ...result.strategies.filter(s => s.verdict !== 'acceptable')].map(s => <tr key={s.id} className={`${active?.id === s.id ? 'row-active' : ''}`}><td><button className="strategy-table-button" type="button" aria-pressed={active?.id === s.id} onClick={() => chooseStrategy(s)}>{allocationName(s)}</button>{result.winner?.id === s.id && <span className="winner-tag">BEST COST</span>}</td><td><span className={`status status-${s.verdict}`}>{s.verdict}</span></td><td>{s.maximumExposure === null ? 'Unknown' : `${(s.maximumExposure * 100).toFixed(0)} / 100`}</td><td>{s.visits}</td><td><b>{money(s.cost)}</b></td></tr>)}</tbody></table></div><div className="table-foot">Weather screening has absolute priority. Cost ranks only acceptable strategies. Choose a strategy using the row button, quick cards, or allocation slider. Exploring does not change the computed winner.</div></section>
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
              {weatherMode === 'historical' && weather && <details className="diagnostics-detail"><summary>Show historical reanalysis inputs behind the heuristic</summary><div className="trace-table-wrap"><table className="trace-table"><thead><tr><th>Planting date</th><th>Historical year</th><th>Previous 14-day rain</th><th>Next 3-day rain</th><th>Max temp</th><th>Index</th></tr></thead><tbody>{active.allocations.flatMap(a => weather.years.map(year => ({date:a.date,year,d:weather.diagnostics[a.date]?.[year]}))).map(x => <tr key={`${x.date}-${x.year}`}><td>{friendlyDate(x.date)}</td><td>{x.year}</td><td>{x.d ? `${x.d.precedingRainMm.toFixed(1)} mm` : 'Missing'}</td><td>{x.d ? `${x.d.followingRainMm.toFixed(1)} mm` : 'Missing'}</td><td>{x.d ? `${x.d.maxTempC.toFixed(1)} °C` : 'Missing'}</td><td>{x.d ? x.d.modeledExposure.toFixed(2) : 'Unknown'}</td></tr>)}</tbody></table></div></details>}
              {breakdown && <details className="diagnostics-detail"><summary>Show estimated sowing cost breakdown</summary><div className="cost-lines"><span>Seeds <b>{money(breakdown.seed)}</b></span><span>Labour <b>{money(breakdown.labor)}</b></span><span>Machinery <b>{money(breakdown.machinery)}</b></span><span>Repeat visits and other charges <b>{money(breakdown.perVisit)}</b></span><span>Total <b>{money(breakdown.total)}</b></span></div></details>}
              <p className="science-disclaimer">Historical reanalysis is not an issued forecast or farm measurement. The index combines historical rainfall and temperature using unvalidated weights. The 0.60 cutoff is not an agronomic safety threshold; status is <b>modeled acceptance only</b>, never crop-safety certification.</p>
            </> : <p className="weather-empty">Choose a strategy to see the breakdown.</p>}
          </section>
        </div>
        <div className="bottom-grid">
          <section className="panel costs" id="costs"><div className="panel-heading"><div><span className="section-label">05 / LOCAL ECONOMICS</span><h2>Adjustable cost settings</h2></div><button className="reset-btn" onClick={() => setRates(defaultRates)}>Reset example rates</button></div><p className="subtle">Example rates, not verified market prices. Enter actual local charges. No budget field is required.</p><div className="db-actions"><button type="button" disabled={!databaseConfigured} onClick={loadDatabaseRates}>↧ Load regional example rates from PostgreSQL</button><small>{databaseConfigured ? 'Supabase PostgreSQL configured · read-only demo reference values' : 'Optional database not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY after running supabase/schema.sql.'}</small>{databaseNote && <p role="status">{databaseNote}</p>}</div><div className="rate-grid">{rateKeys.map(({ key, label, unit }) => <label key={key}>{label}<div className="rate-input"><input type="number" min="0" step="1" value={rates[key]} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= 0) setRates(old => ({ ...old, [key]: value })); }}/><span>{unit}</span></div></label>)}</div></section>
          <section className="panel weather-panel" id="evidence"><div className="panel-heading"><div><span className="section-label">06 / REAL DATA CONTEXT</span><h2>Historical weather, {region.label}</h2></div><span className="mini-pill">Open-Meteo · Jun 2024</span></div>
            {weather ? <><p className="subtle">Daily rainfall, June 2024, {region.label}. Historical reanalysis is used in the default counterfactual scenario comparison; it is <b>not</b> a forecast originally issued before these sowing dates.</p><div className="rain-chart" aria-label="Historical daily rainfall bar chart">{weather.dailyByYear[2024].map(d => <div key={d.date} className="rain-column" title={`${d.date}: ${d.precipitationMm} mm`}><i style={{height: `${Math.max(2, Math.min(100, d.precipitationMm / Math.max(1, ...weather.dailyByYear[2024].map(w => w.precipitationMm)) * 100))}%`}} /></div>)}</div><div className="chart-label">1 JUN <span>10 JUL</span></div><div className="evidence-link"><a href={weather.sourceUrls[2]} target="_blank" rel="noreferrer">View 2024 source request ↗</a><span>Retrieved {new Date(weather.retrievedAt).toLocaleString('en-IN')}</span></div></> : <div className="weather-empty">{weatherError ? `Source unavailable: ${weatherError}. No replacement data invented.` : 'Retrieving historical weather and checking units…'}</div>}
            <div className="forecast-box"><b>Current 7-day weather forecast — {region.label}</b><p>Separate live forecast context. It is NOT used to score historical soybean sowing dates.</p>{currentForecast ? <div className="forecast-days">{currentForecast.map(d => <span key={d.date}><strong>{friendlyDate(d.date)}</strong><small>{d.precipitationMm.toFixed(1)} mm rain</small><small>{d.maxTempC.toFixed(0)}°C max</small></span>)}</div> : <p role="status">{forecastError ? `Forecast unavailable: ${forecastError}` : 'Fetching current forecast…'}</p>}</div>
            <p className="source-note">ICAR-NSRI recommends sowing soybean after monsoon onset and about 100 mm of rain; this prototype uses a 14-day retrospective rainfall approximation. Additional heat/rain exposure weights and the pass threshold are UNVALIDATED heuristics. Reanalysis is not a field measurement. No crop-loss, agronomic-safety or forecast-skill claim is made. <a href="https://icar-nsri.res.in/pdfdoc/Advisory2026/June%281-7%29%2C%202026.pdf" target="_blank" rel="noreferrer">ICAR soybean advisory ↗</a></p></section>
        </div>
        <footer>SeedHedge · HACKVERSE 2026 <span>Prototype 0.4 · Dual-approach comparison · Screening heuristic requires expert validation</span></footer>
      </div>
    </main>
  </div>;
}
