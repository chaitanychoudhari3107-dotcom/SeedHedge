import { useEffect, useMemo, useState } from 'react';
import { analyze, defaultRates, type CostRates, type Strategy } from './engine.ts';
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
  const [databaseNote, setDatabaseNote] = useState('');
  const [rates, setRates] = useState<CostRates>(storedRates);
  const [mode, setMode] = useState<'stress' | 'calm'>('stress');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const result = useMemo(() => analyze({ dates: enabledDates, farmAcres: area, rates, scenarios, threshold: .60, approvedDates: new Set(SOWING_DATES) }), [enabledDates, area, rates, scenarios]);
  const selected = result.strategies.find(s => s.id === selectedId);
  const active = selected ?? result.winner ?? result.strategies[0];
  const accepted = result.strategies.filter(s => s.verdict === 'acceptable');
  const rejected = result.strategies.filter(s => s.verdict === 'unacceptable');
  const ranked = [...accepted].sort((a, b) => a.cost - b.cost || (a.maximumExposure ?? 99) - (b.maximumExposure ?? 99));
  const chosenDates = active?.allocations ?? [];
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
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon">✳</span><span>seed<span className="brand-bold">hedge</span><small>AGRICULTURAL INTELLIGENCE</small></span></div>
      <div className="nav-meta">WORKSPACE</div>
      <a href="#studio" className="nav-item active"><span>◈</span> Strategy studio</a>
      <a href="#evidence" className="nav-item"><span>▤</span> Weather evidence</a>
      <a href="#costs" className="nav-item"><span>⌁</span> Local cost settings</a>
      <div className="sidebar-bottom"><div className="badge-light">● Research prototype</div><p>Made for HACKVERSE 2026<br/>No validated crop-safety claims</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">SeedHedge <span>/</span> Strategy Studio</div><div className="top-actions"><span className="live-dot"/> Historical replay · {region.label} <span className="avatar">SH</span></div></header>
      <div className="content" id="studio">
        <div className="eyebrow">DECIDE WITH CLARITY <span>✦</span> WEATHER FIRST, COST SECOND</div>
        <div className="hero"><div><h1>Plant with a plan.<br/><em>Not a guess.</em></h1><p>Compare single-date and staggered sowing under climate uncertainty—then find the least expensive strategy that passes the modeled weather screens.</p></div><div className="hero-art" aria-hidden="true"><div className="sun"/><div className="hill hill-back"/><div className="hill hill-front"/><div className="hero-caption">ONE FARM.<br/>MORE THAN ONE WAY FORWARD.</div></div></div>
        <div className="notice"><span>ⓘ</span><div><b>Research replay — not current sowing advice.</b> Weather inputs come from Open-Meteo historical reanalysis for 2022–2025 when the API succeeds. The exposure formula and 0.60 decision cutoff are <b>unvalidated modeling assumptions</b>, not agronomic safety standards, crop-failure probabilities or forecasts available in 2024. The simulation mode uses wholly invented values.</div></div>
        <div className="stats"><div className="stat"><span>Generated strategies</span><strong>{result.strategies.length}</strong><small>Calculated from selected sowing dates</small></div><div className="stat"><span>Screened acceptable</span><strong>{accepted.length}<span className="tiny"> / {result.strategies.length}</span></strong><small>Based on selected weather model</small></div><div className="stat"><span>Lowest acceptable cost</span><strong>{result.winner ? money(result.winner.cost) : '—'}</strong><small>Estimated, adjustable local rates</small></div></div>
        <div className="studio-grid">
          <section className="panel config"><div className="panel-heading"><div><span className="section-label">01 / INPUT</span><h2>Your farm</h2></div><span className="small-icon">⚙</span></div>
            <label htmlFor="region">Region</label><select id="region" className="field-select" value={regionId} onChange={e => { setRegionId(e.target.value); setSelectedId(null); setDatabaseNote(''); }}>{REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}, {r.state}</option>)}</select>
            <label htmlFor="crop">Crop (supported pilot)</label><select id="crop" className="field-select" value="soybean" disabled><option value="soybean">Soybean · Kharif</option></select><p className="input-help">Only soybean is currently modeled. Other crops require validated crop-specific rules.</p>
            <label htmlFor="area">Farm area (acres)</label><input id="area" type="number" step="0.25" min="0.25" max="1000" value={area} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0 && v <= 1000) setArea(v); }}/>
            <label>Compare candidate dates <small>(demo window)</small></label><div className="date-toggles">{SOWING_DATES.map(date => { const on = enabledDates.includes(date); return <button type="button" key={date} className={on ? 'date-on' : ''} aria-pressed={on} disabled={on && enabledDates.length === 1} onClick={() => setEnabledDates(old => on ? old.filter(x => x !== date) : [...old, date])}>{friendlyDate(date)}</button>; })}</div>
            <label htmlFor="weather-mode">Weather evidence mode</label>
            <select id="weather-mode" className="field-select" value={weatherMode} onChange={e => { setWeatherMode(e.target.value as 'historical' | 'synthetic'); setSelectedId(null); }}><option value="historical">Real 2022–2025 reanalysis</option><option value="synthetic">Synthetic UI demo only</option></select>
            {weatherMode === 'synthetic' && <div className="segmented"><button type="button" className={mode === 'stress' ? 'selected' : ''} onClick={() => setMode('stress')}>Stress test</button><button type="button" className={mode === 'calm' ? 'selected' : ''} onClick={() => setMode('calm')}>Stable</button></div>}
            <div className="source-state" role="status">{weatherMode === 'synthetic' ? 'Synthetic example — NOT real weather.' : loadingWeather ? 'Fetching historical Open-Meteo weather…' : weatherError ? `Unavailable: ${weatherError}` : weather ? `Loaded ${weather.years.join(', ')} reanalysis for ${region.label}.` : 'No weather evidence.'}{weatherMode === 'historical' && <button type="button" onClick={() => setReloadKey(v => v + 1)}>↻ Retry</button>}</div>
            <div className="info-card"><b>How we decide</b><p>1. Screen whole-planting strategies against weather assumptions.<br/>2. Remove unacceptable/unknown strategies.<br/>3. Choose the lowest estimated cost remaining.</p></div>
          </section>
          <section className="panel farm-panel"><div className="panel-heading"><div><span className="section-label">02 / EXPLORE</span><h2>Virtual farm allocation</h2></div><span className="mini-pill">Interactive preview</span></div>
            <label htmlFor="strategy-select" className="strategy-label">Explore planting strategy</label>
            <select id="strategy-select" className="field-select strategy-select" value={active?.id ?? ''} onChange={e => setSelectedId(e.target.value)} disabled={result.strategies.length === 0}>{result.strategies.map(s => <option key={s.id} value={s.id}>{allocationName(s)} · {s.verdict} · {money(s.cost)}</option>)}</select>
            <p className="input-help">This changes the visualized option, not the automatic lowest-cost acceptable recommendation.</p>
            <div className="farm-plot" role="img" aria-label="A stylized farm grid colored by the selected sowing allocation">
              {Array.from({ length: 100 }, (_, i) => { const chosen = chosenDates.findIndex((_, j) => i < Math.round(chosenDates.slice(0, j + 1).reduce((t, x) => t + x.share, 0) * 100)); return <span key={i} className={`plot-cell plot-${Math.max(0, chosen)}`} />; })}
              <span className="farm-overlay">YOUR FIELD<br/><small>{area} ACRES</small></span>
            </div>
            <div className="legend"><span><i className="key-0"/> {friendlyDate(SOWING_DATES[0])}</span><span><i className="key-1"/> {friendlyDate(SOWING_DATES[1])}</span><span><i className="key-2"/> {friendlyDate(SOWING_DATES[2])}</span></div>
            <div className="selection"><b>Selected allocation</b><span>{active ? allocationName(active) : '—'}</span></div>
            <div className="selection-sub">{active ? `Exploring: ${active.verdict.toUpperCase()} under the selected model · ${money(active.cost)}. ${active.reason}` : 'No candidate selected.'}</div>
          </section>
          <section className="panel decision"><div className="panel-heading"><div><span className="section-label">03 / DECISION</span><h2>Strategy intelligence</h2></div><span className="small-icon">✺</span></div>
            {result.winner ? <><div className="winner-label">✓ Lowest-cost modeled-acceptable strategy</div><div className="winner-value">{allocationName(result.winner)}</div><div className="decision-price">{money(result.winner.cost)}<small> estimated sowing cost</small></div><p className="decision-body">{result.winner.reason} {weatherMode === 'synthetic' ? 'Synthetic scenarios only.' : 'Historical reanalysis scenario comparison, not a live planting forecast.'}</p></> : <><div className="winner-label uncertain">{weatherMode === 'historical' && !weather ? 'Waiting for verified weather inputs' : 'No strategy passes the current model'}</div><p>{weatherError || 'Insufficient evidence or no options pass the demonstration threshold. No recommendation is forced.'}</p></>}
            <div className="decision-divider"/><div className="assistant-title">🎙 SeedHedge Voice <span>Beta</span></div><p className="subtle">Hear the computed explanation. Playback depends on your browser's installed voices.</p>
            <div className="voice-tools"><select aria-label="Voice language" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="mr-IN">मराठी</option><option value="hi-IN">हिन्दी</option><option value="en-IN">English</option></select><button onClick={speak} disabled={!result.winner || !('speechSynthesis' in window)}>▶ Explain</button></div>
            <p className="voice-copy">{result.winner ? `${weatherMode === 'historical' ? 'Historical replay, not a forecast. ' : 'Synthetic scenario. '}${text[language](result.winner)}` : 'No strategy passed the current model.'}</p>
          </section>
        </div>
        <section className="panel table-panel"><div className="panel-heading"><div><span className="section-label">04 / COMPARE</span><h2>Every strategy, transparently</h2></div><span className="mini-pill">{accepted.length} acceptable · {rejected.length} rejected</span></div><div className="table-wrap"><table><thead><tr><th>Planting allocation</th><th>Weather screen</th><th>Worst modeled exposure</th><th>Visits</th><th>Estimated cost</th></tr></thead><tbody>{[...ranked, ...result.strategies.filter(s => s.verdict !== 'acceptable')].map(s => <tr key={s.id} onClick={() => setSelectedId(s.id)} title={s.reason} className={`${active.id === s.id ? 'row-active' : ''}`} tabIndex={0} onKeyDown={e => { if(e.key === 'Enter') setSelectedId(s.id); }}><td><b>{allocationName(s)}</b>{result.winner?.id === s.id && <span className="winner-tag">BEST COST</span>}</td><td><span className={`status status-${s.verdict}`}>{s.verdict}</span></td><td>{s.maximumExposure === null ? 'Unknown' : `${(s.maximumExposure * 100).toFixed(0)} / 100`}</td><td>{s.visits}</td><td><b>{money(s.cost)}</b></td></tr>)}</tbody></table></div><div className="table-foot">Weather screening has absolute priority. Cost ranks only acceptable strategies. Clicking any row explores that strategy; it does not change the winner.</div></section>
        <div className="bottom-grid">
          <section className="panel costs" id="costs"><div className="panel-heading"><div><span className="section-label">05 / LOCAL ECONOMICS</span><h2>Adjustable cost settings</h2></div><button className="reset-btn" onClick={() => setRates(defaultRates)}>Reset example rates</button></div><p className="subtle">Example rates, not verified market prices. Enter actual local charges. No budget field is required.</p><div className="db-actions"><button type="button" disabled={!databaseConfigured} onClick={loadDatabaseRates}>↧ Load regional example rates from PostgreSQL</button><small>{databaseConfigured ? 'Supabase PostgreSQL configured · read-only demo reference values' : 'Optional database not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY after running supabase/schema.sql.'}</small>{databaseNote && <p role="status">{databaseNote}</p>}</div><div className="rate-grid">{rateKeys.map(({ key, label, unit }) => <label key={key}>{label}<div className="rate-input"><input type="number" min="0" step="1" value={rates[key]} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= 0) setRates(old => ({ ...old, [key]: value })); }}/><span>{unit}</span></div></label>)}</div></section>
          <section className="panel weather-panel" id="evidence"><div className="panel-heading"><div><span className="section-label">06 / REAL DATA CONTEXT</span><h2>Historical weather, {region.label}</h2></div><span className="mini-pill">Open-Meteo · Jun 2024</span></div>
            {weather ? <><p className="subtle">Daily rainfall, June 2024, {region.label}. Historical reanalysis is used in the default counterfactual scenario comparison; it is <b>not</b> a forecast originally issued before these sowing dates.</p><div className="rain-chart" aria-label="Historical daily rainfall bar chart">{weather.dailyByYear[2024].map(d => <div key={d.date} className="rain-column" title={`${d.date}: ${d.precipitationMm} mm`}><i style={{height: `${Math.max(2, Math.min(100, d.precipitationMm / Math.max(1, ...weather.dailyByYear[2024].map(w => w.precipitationMm)) * 100))}%`}} /></div>)}</div><div className="chart-label">1 JUN <span>10 JUL</span></div><div className="evidence-link"><a href={weather.sourceUrls[2]} target="_blank" rel="noreferrer">View 2024 source request ↗</a><span>Retrieved {new Date(weather.retrievedAt).toLocaleString('en-IN')}</span></div></> : <div className="weather-empty">{weatherError ? `Source unavailable: ${weatherError}. No replacement data invented.` : 'Retrieving historical weather and checking units…'}</div>}
            <div className="forecast-box"><b>Current 7-day weather forecast — {region.label}</b><p>Separate live forecast context. It is NOT used to score historical soybean sowing dates.</p>{currentForecast ? <div className="forecast-days">{currentForecast.map(d => <span key={d.date}><strong>{friendlyDate(d.date)}</strong><small>{d.precipitationMm.toFixed(1)} mm rain</small><small>{d.maxTempC.toFixed(0)}°C max</small></span>)}</div> : <p role="status">{forecastError ? `Forecast unavailable: ${forecastError}` : 'Fetching current forecast…'}</p>}</div>
            <p className="source-note">ICAR-NSRI recommends sowing soybean after monsoon onset and about 100 mm of rain; this prototype uses a 14-day retrospective rainfall approximation. Additional heat/rain exposure weights and the pass threshold are UNVALIDATED heuristics. Reanalysis is not a field measurement. No crop-loss, agronomic-safety or forecast-skill claim is made. <a href="https://icar-nsri.res.in/pdfdoc/Advisory2026/June%281-7%29%2C%202026.pdf" target="_blank" rel="noreferrer">ICAR soybean advisory ↗</a></p></section>
        </div>
        <footer>SeedHedge · HACKVERSE 2026 <span>Prototype 0.2 · Reanalysis replay · Screening heuristic requires expert validation</span></footer>
      </div>
    </main>
  </div>;
}
