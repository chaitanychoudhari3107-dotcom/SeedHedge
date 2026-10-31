import { useEffect, useMemo, useState } from 'react';
import { analyze, defaultRates, type CostRates, type Strategy } from './engine.ts';
import { calmScenarios, dates, demoScenarios } from './fixtures.ts';
import { fetchHistoricalContext, type HistoricalWeather } from './weather.ts';

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
  'en-IN': s => `For the simulated weather scenarios, the lowest-cost acceptable strategy is ${allocationName(s)} at an estimated ${money(s.cost)}. These are demonstration assumptions, not certified crop advice.`,
  'mr-IN': s => `प्रात्यक्षिक हवामान परिस्थितीनुसार, सर्वात कमी खर्चाचा स्वीकारार्ह पर्याय ${allocationName(s)} आहे. अंदाजित खर्च ${money(s.cost)} आहे. हा नमुना आहे, प्रमाणित कृषी सल्ला नाही.`,
  'hi-IN': s => `प्रदर्शन के मौसम परिदृश्यों के अनुसार सबसे कम लागत वाली स्वीकार्य योजना ${allocationName(s)} है। अनुमानित खर्च ${money(s.cost)} है। यह प्रमाणित कृषि सलाह नहीं है।`,
};
export default function App() {
  const [area, setArea] = useState(2);
  const [enabledDates, setEnabledDates] = useState<string[]>(dates);
  const [rates, setRates] = useState<CostRates>(storedRates);
  const [mode, setMode] = useState<'stress' | 'calm'>('stress');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('mr-IN');
  const [weather, setWeather] = useState<HistoricalWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem('seedhedge-rates', JSON.stringify(rates)); } catch { /* optional storage */ } }, [rates]);
  useEffect(() => {
    const controller = new AbortController();
    fetchHistoricalContext(controller.signal).then(setWeather).catch((error: unknown) => {
      if (!controller.signal.aborted) setWeatherError(error instanceof Error ? error.message : 'Historical weather unavailable');
    });
    return () => controller.abort();
  }, []);
  const scenarios = mode === 'stress' ? demoScenarios : calmScenarios;
  const result = useMemo(() => analyze({ dates: enabledDates, farmAcres: area, rates, scenarios, threshold: .60, approvedDates: new Set(dates) }), [enabledDates, area, rates, scenarios]);
  const active = result.strategies.find(s => s.id === selectedId) ?? result.winner ?? result.strategies[0];
  const accepted = result.strategies.filter(s => s.verdict === 'acceptable');
  const rejected = result.strategies.filter(s => s.verdict === 'unacceptable');
  const ranked = [...accepted].sort((a, b) => a.cost - b.cost || (a.maximumExposure ?? 99) - (b.maximumExposure ?? 99));
  const chosenDates = active?.allocations ?? [];
  const speak = () => {
    if (!('speechSynthesis' in window) || !result.winner) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text[language](result.winner));
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
      <header className="topbar"><div className="breadcrumb">SeedHedge <span>/</span> Strategy Studio</div><div className="top-actions"><span className="live-dot"/> Historical demo · Maharashtra <span className="avatar">SH</span></div></header>
      <div className="content" id="studio">
        <div className="eyebrow">DECIDE WITH CLARITY <span>✦</span> WEATHER FIRST, COST SECOND</div>
        <div className="hero"><div><h1>Plant with a plan.<br/><em>Not a guess.</em></h1><p>Compare single-date and staggered sowing under climate uncertainty—then find the least expensive strategy that passes the modeled weather screens.</p></div><div className="hero-art" aria-hidden="true"><div className="sun"/><div className="hill hill-back"/><div className="hill hill-front"/><div className="hero-caption">ONE FARM.<br/>MORE THAN ONE WAY FORWARD.</div></div></div>
        <div className="notice"><span>ⓘ</span><div><b>Demonstration engine</b> — Strategy hazard indices and the 0.60 screening limit are <b>synthetic assumptions</b>, not agronomic standards or measured probabilities of crop failure. The separately fetched historical weather is shown only as evidence context.</div></div>
        <div className="stats"><div className="stat"><span>Generated strategies</span><strong>{result.strategies.length}</strong><small>Dynamic, based on available windows</small></div><div className="stat"><span>Screened acceptable</span><strong>{accepted.length}<span className="tiny"> / {result.strategies.length}</span></strong><small>Under scenario assumptions</small></div><div className="stat"><span>Lowest acceptable cost</span><strong>{result.winner ? money(result.winner.cost) : '—'}</strong><small>Estimated, adjustable local rates</small></div></div>
        <div className="studio-grid">
          <section className="panel config"><div className="panel-heading"><div><span className="section-label">01 / INPUT</span><h2>Your farm</h2></div><span className="small-icon">⚙</span></div>
            <label>Region <div className="static-input">Akola, Maharashtra <span>⌄</span></div></label>
            <label>Crop <div className="static-input">Soybean · Kharif <span>⌄</span></div></label>
            <label htmlFor="area">Farm area (acres)</label><input id="area" type="number" step="0.25" min="0.25" max="1000" value={area} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0 && v <= 1000) setArea(v); }}/>
            <label>Compare candidate dates <small>(demo window)</small></label><div className="date-toggles">{dates.map(date => { const on = enabledDates.includes(date); return <button type="button" key={date} className={on ? 'date-on' : ''} aria-pressed={on} disabled={on && enabledDates.length === 1} onClick={() => setEnabledDates(old => on ? old.filter(x => x !== date) : [...old, date])}>{friendlyDate(date)}</button>; })}</div>
            <label>Weather scenario set</label><div className="segmented"><button type="button" className={mode === 'stress' ? 'selected' : ''} onClick={() => setMode('stress')}>Stress test</button><button type="button" className={mode === 'calm' ? 'selected' : ''} onClick={() => setMode('calm')}>Stable</button></div>
            <div className="info-card"><b>How we decide</b><p>1. Screen whole-planting strategies against weather assumptions.<br/>2. Remove unacceptable/unknown strategies.<br/>3. Choose the lowest estimated cost remaining.</p></div>
          </section>
          <section className="panel farm-panel"><div className="panel-heading"><div><span className="section-label">02 / EXPLORE</span><h2>Virtual farm allocation</h2></div><span className="mini-pill">Interactive preview</span></div>
            <div className="farm-plot" role="img" aria-label="A stylized farm grid colored by the selected sowing allocation">
              {Array.from({ length: 100 }, (_, i) => { const chosen = chosenDates.findIndex((_, j) => i < Math.round(chosenDates.slice(0, j + 1).reduce((t, x) => t + x.share, 0) * 100)); return <span key={i} className={`plot-cell plot-${Math.max(0, chosen)}`} />; })}
              <span className="farm-overlay">YOUR FIELD<br/><small>{area} ACRES</small></span>
            </div>
            <div className="legend"><span><i className="key-0"/> {friendlyDate(dates[0])}</span><span><i className="key-1"/> {friendlyDate(dates[1])}</span><span><i className="key-2"/> {friendlyDate(dates[2])}</span></div>
            <div className="selection"><b>Selected allocation</b><span>{active ? allocationName(active) : '—'}</span></div>
            <div className="selection-sub">Choose a different strategy in the table to update this visual.</div>
          </section>
          <section className="panel decision"><div className="panel-heading"><div><span className="section-label">03 / DECISION</span><h2>Strategy intelligence</h2></div><span className="small-icon">✺</span></div>
            {result.winner ? <><div className="winner-label">✓ Lowest-cost acceptable strategy</div><div className="winner-value">{allocationName(result.winner)}</div><div className="decision-price">{money(result.winner.cost)}<small> estimated sowing cost</small></div><p className="decision-body">{result.winner.reason}</p></> : <><div className="winner-label uncertain">No acceptable strategy found</div><p>Change the demonstration assumptions or obtain more reliable evidence. No forced recommendation.</p></>}
            <div className="decision-divider"/><div className="assistant-title">🎙 SeedHedge Voice <span>Beta</span></div><p className="subtle">Hear the computed explanation. Playback depends on your browser's installed voices.</p>
            <div className="voice-tools"><select aria-label="Voice language" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="mr-IN">मराठी</option><option value="hi-IN">हिन्दी</option><option value="en-IN">English</option></select><button onClick={speak} disabled={!result.winner || !('speechSynthesis' in window)}>▶ Explain</button></div>
            <p className="voice-copy">{result.winner ? text[language](result.winner) : 'No strategy passed the current simulation.'}</p>
          </section>
        </div>
        <section className="panel table-panel"><div className="panel-heading"><div><span className="section-label">04 / COMPARE</span><h2>Every strategy, transparently</h2></div><span className="mini-pill">{accepted.length} acceptable · {rejected.length} rejected</span></div><div className="table-wrap"><table><thead><tr><th>Planting allocation</th><th>Weather screen</th><th>Worst modeled exposure</th><th>Visits</th><th>Estimated cost</th></tr></thead><tbody>{[...ranked, ...result.strategies.filter(s => s.verdict !== 'acceptable')].map(s => <tr key={s.id} onClick={() => setSelectedId(s.id)} title={s.reason} className={`${active.id === s.id ? 'row-active' : ''}`} tabIndex={0} onKeyDown={e => { if(e.key === 'Enter') setSelectedId(s.id); }}><td><b>{allocationName(s)}</b>{result.winner?.id === s.id && <span className="winner-tag">BEST COST</span>}</td><td><span className={`status status-${s.verdict}`}>{s.verdict}</span></td><td>{s.maximumExposure === null ? 'Unknown' : `${(s.maximumExposure * 100).toFixed(0)} / 100`}</td><td>{s.visits}</td><td><b>{money(s.cost)}</b></td></tr>)}</tbody></table></div><div className="table-foot">Weather screening has absolute priority. Cost ranks only acceptable strategies. Clicking any row explores that strategy; it does not change the winner.</div></section>
        <div className="bottom-grid">
          <section className="panel costs" id="costs"><div className="panel-heading"><div><span className="section-label">05 / LOCAL ECONOMICS</span><h2>Adjustable cost settings</h2></div><button className="reset-btn" onClick={() => setRates(defaultRates)}>Reset example rates</button></div><p className="subtle">Example rates, not verified market prices. Enter actual local charges. No budget field is required.</p><div className="rate-grid">{rateKeys.map(({ key, label, unit }) => <label key={key}>{label}<div className="rate-input"><input type="number" min="0" step="1" value={rates[key]} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= 0) setRates(old => ({ ...old, [key]: value })); }}/><span>{unit}</span></div></label>)}</div></section>
          <section className="panel weather-panel" id="evidence"><div className="panel-heading"><div><span className="section-label">06 / REAL DATA CONTEXT</span><h2>Historical weather, Akola</h2></div><span className="mini-pill">Open-Meteo · Jun 2024</span></div>
            {weather ? <><p className="subtle">Daily rainfall, 14–30 June 2024. Authentic reanalysis context; <b>not an input</b> to the simulated hazard-index screening.</p><div className="rain-chart" aria-label="Historical daily rainfall bar chart">{weather.days.map(d => <div key={d.date} className="rain-column" title={`${d.date}: ${d.precipitationMm} mm`}><i style={{height: `${Math.max(2, Math.min(100, d.precipitationMm / Math.max(1, ...weather.days.map(w => w.precipitationMm)) * 100))}%`}} /></div>)}</div><div className="chart-label">14 JUN <span>30 JUN</span></div><div className="evidence-link"><a href={weather.sourceUrl} target="_blank" rel="noreferrer">View source request ↗</a><span>Retrieved {new Date(weather.fetchedAt).toLocaleString('en-IN')}</span></div></> : <div className="weather-empty">{weatherError ? `Source unavailable: ${weatherError}. No replacement data invented.` : 'Retrieving historical weather and checking units…'}</div>}
            <p className="source-note">Reanalysis is not a field measurement. No claim of crop-loss reduction, field safety, or forecast skill is made here.</p></section>
        </div>
        <footer>SeedHedge · HACKVERSE 2026 <span>Prototype 0.1 · Simulation explicitly labeled · Scientific validation pending</span></footer>
      </div>
    </main>
  </div>;
}
