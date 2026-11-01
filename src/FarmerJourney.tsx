import { useEffect, useMemo, useState } from 'react';
import type { CostRates, Strategy } from './engine.ts';
import { defaultRates } from './engine.ts';
import type { HistoricalDay, HistoricalReplay } from './weather.ts';
import { rainfallThresholdPlan } from './approaches.ts';
import { summarizeCandidateDates } from './decision-explanations.ts';
import { makeFarmerSuggestion } from './final-plan.ts';
import { choices, farmerText, type FarmerLanguage } from './farmer-language.ts';
import { REGIONS } from './regions.ts';
import { DATE_INTERVAL_OPTIONS, REPLAY_WINDOW_MAX, REPLAY_WINDOW_MIN } from './sowing-window.ts';
import './farmer.css';

type Props = {
  openDetailedView: () => void;
  regionId: string; setRegionId: (v: string) => void;
  area: number; setArea: (v: number) => void;
  windowStart: string; setWindowStart: (v: string) => void;
  windowEnd: string; setWindowEnd: (v: string) => void;
  intervalDays: number; setIntervalDays: (v: number) => void;
  generatedDates: string[]; enabledDates: string[]; excludedDates: string[]; setExcludedDates: (v:string[])=>void;
  windowError: string | null; canSwapDates: boolean;
  weatherMode: 'historical' | 'synthetic'; setWeatherMode: (v:'historical'|'synthetic')=>void;
  simulation: 'stress'|'calm'; setSimulation: (v:'stress'|'calm')=>void;
  weather: HistoricalReplay | null; loadingWeather: boolean; weatherError: string | null; partialYears:number[]; onRetry:()=>void;
  forecast: HistoricalDay[] | null; forecastError: string | null;
  rates: CostRates; setRates: (v: CostRates)=>void;
  threshold: number; setThreshold:(v:number)=>void;
  winner: Strategy | null; strategies: Strategy[];
};
const cost=(v:number)=>`₹${v.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const dateLabel=(v:string, lang:FarmerLanguage)=>new Intl.DateTimeFormat(lang==='mr'?'mr-IN':lang==='hi'?'hi-IN':'en-IN', {day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${v}T12:00:00Z`));
const option=(s:Strategy, lang:FarmerLanguage)=>s.allocations.map(a=>`${Math.round(a.share*100)}% ${dateLabel(a.date,lang)}`).join(' + ');
function best(strategies: Strategy[], visits:1|2):Strategy|null {return strategies.filter(s=>s.visits===visits&&s.verdict==='acceptable').sort((a,b)=>a.cost-b.cost||(a.maximumExposure??99)-(b.maximumExposure??99)||a.id.localeCompare(b.id))[0]??null;}
const rateFields: {key:keyof CostRates;name:string}[]=[
  {key:'seedKgPerAcre',name:'Seed needed per acre (kg)'},
  {key:'seedPricePerKg',name:'Seed price (₹/kg)'},
  {key:'laborPerAcre',name:'Labour (₹/acre)'},
  {key:'machineryPerAcre',name:'Machine (₹/acre)'},
  {key:'mobilizationPerVisit',name:'Travel/setup per visit (₹)'},
  {key:'otherPerVisit',name:'Other per visit (₹)'},
];
function rememberedLanguage():FarmerLanguage {
  try {const lang=localStorage.getItem('seedhedge-farmer-lang');return lang==='mr'||lang==='hi'||lang==='en'?lang:'en';}
  catch {return 'en';}
}
export default function FarmerJourney(p:Props) {
  const [language,setLanguage]=useState<FarmerLanguage>(rememberedLanguage);
  const [step,setStep]=useState(0);
  const [splitFirst,setSplitFirst]=useState('');
  const [splitSecond,setSplitSecond]=useState('');
  const [splitShare,setSplitShare]=useState(50);
  const [helpChoice,setHelpChoice]=useState<'cost'|'date'|'forecast'|null>(null);
  const [speechStatus,setSpeechStatus]=useState('');
  const [speaking,setSpeaking]=useState(false);
  const txt=(s:string)=>farmerText(language,s);
  const ready=p.weatherMode==='historical'&&!p.loadingWeather&&!p.weatherError&&!!p.weather;
  const rainPlan=useMemo(()=>rainfallThresholdPlan(ready?p.weather:null,p.enabledDates,p.area,p.rates,p.threshold),[ready,p.weather,p.enabledDates,p.area,p.rates,p.threshold]);
  const evidence=useMemo(()=>summarizeCandidateDates(ready?p.weather:null,p.enabledDates,p.threshold),[ready,p.weather,p.enabledDates,p.threshold]);
  const suggestion=makeFarmerSuggestion({weatherMode:p.weatherMode,weatherReady:ready,loading:p.loadingWeather,rainDate:rainPlan.date,winner:ready||p.weatherMode==='synthetic'?p.winner:null});
  const single=useMemo(()=>best(p.strategies,1),[p.strategies]);
  const split=useMemo(()=>best(p.strategies,2),[p.strategies]);
  const available=p.enabledDates;
  const first=available.includes(splitFirst)?splitFirst:available[0]??'';
  const second=available.includes(splitSecond)&&splitSecond!==first?splitSecond:available.find(v=>v!==first)??'';
  const selectedSplit=p.strategies.find(s=>s.allocations.length===2&&s.allocations.some(a=>a.date===first&&Math.round(a.share*100)===splitShare)&&s.allocations.some(a=>a.date===second&&Math.round(a.share*100)===100-splitShare));
  const invalid=!!p.windowError||p.enabledDates.length===0;
  const labels=['Check Weather','Enter Farm Details','Check My Plan','See My Action Plan'];
  const go=(next:number)=>{
    if(next<0||next>3||(next>1&&invalid))return;
    setStep(next);
    requestAnimationFrame(()=>document.getElementById('farmer-step-top')?.scrollIntoView({behavior:'smooth',block:'start'}));
  };
  useEffect(()=>{try{localStorage.setItem('seedhedge-farmer-lang',language);}catch{}},[language]);
  useEffect(()=>{if('speechSynthesis' in window)window.speechSynthesis.cancel();setSpeaking(false);setSpeechStatus('');},[language,step,p.winner?.id,p.weatherMode]);
  const sourceDescription=ready?txt('Past weather loaded'):p.weatherMode==='synthetic'?txt('Practice data is not real weather.'):p.loadingWeather?txt('Weather is loading'):p.partialYears.length?txt('Some years are missing'):txt('Weather could not be loaded');
  const suggestionTitle=()=>{
    if(suggestion.kind==='demo')return `${txt('Practice result — not real advice')}${suggestion.plan?': '+option(suggestion.plan,language):''}`;
    if(suggestion.plan)return `${txt('Suggested option for comparison')}: ${option(suggestion.plan,language)}`;
    if(suggestion.rainDate)return `${txt('First date that passed')}: ${dateLabel(suggestion.rainDate,language)}`;
    return txt('No final option yet');
  };
  const suggestionReason=()=>txt(({
    'loading':'Full weather data is still loading.',
    'missing':'Without complete past weather data we cannot give a historical comparison.',
    'demo':'These are made-up practice conditions, not a historical recommendation.',
    'same-date':'The two methods agree on the same single date.',
    'different-dates':'The methods give different dates or patterns. The cost-first option is shown for comparison, not as a proven safest choice.',
    'rain-only':'The rain rule has a date, but the one/two-day model has no passing option.',
    'split-only':'The rain rule found no qualifying date. The weather-screened option is shown for comparison only.',
    'neither':'Neither method found a qualifying option.',
  } as const)[suggestion.reason]);
  const nextAction=()=>suggestion.kind==='missing'||suggestion.kind==='loading'?txt('Try weather again without losing your farm details.'):suggestion.kind==='neither'?txt('Choose different dates or rainfall settings, then compare again.'):txt('Compare costs, check current field conditions, and ask local agricultural experts before sowing.');
  const speak=()=>{
    if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){setSpeechStatus(txt('Speech not available on this device; read the plan below.'));return;}
    if(speaking){window.speechSynthesis.cancel();setSpeaking(false);return;}
    const code=language==='mr'?'mr-IN':language==='hi'?'hi-IN':'en-IN';
    const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase()===code.toLowerCase());
    if(!voice){setSpeechStatus(txt('Speech not available on this device; read the plan below.'));return;}
    const phrase=new SpeechSynthesisUtterance(`${suggestionTitle()}. ${suggestionReason()} ${nextAction()}`);
    phrase.lang=code;phrase.voice=voice;phrase.rate=.9;
    phrase.onstart=()=>setSpeaking(true);
    phrase.onend=()=>setSpeaking(false);
    phrase.onerror=()=>{setSpeaking(false);setSpeechStatus(txt('Speech not available on this device; read the plan below.'));};
    window.speechSynthesis.speak(phrase);
  };
  const costBase=p.area*(p.rates.seedKgPerAcre*p.rates.seedPricePerKg+p.rates.laborPerAcre+p.rates.machineryPerAcre);
  const visitCost=p.rates.mobilizationPerVisit+p.rates.otherPerVisit;
  const qa=helpChoice==='cost'?`${txt('Total = acres × (seed + labour + machine) + the charge for each planting visit.')} ${p.area} ${language==='en'?'acres':''}: ${cost(costBase)} + ${cost(visitCost)} = ${cost(costBase+visitCost)}`:
    helpChoice==='date'?`${suggestionReason()} ${txt('This is a rule for comparing past rain, not a guarantee of a good crop.')}`:
    helpChoice==='forecast'?txt('These are past weather records. We do not predict next season’s rainfall here.') : '';
  return <div className="farmer-app" lang={language==='mr'?'mr':language==='hi'?'hi':'en'}>
    <header className="farmer-top">
      <div className="farmer-brand"><div className="farmer-mark" aria-hidden="true">✳</div><div><strong>SeedHedge</strong><small>{txt('Farmer view')}</small></div></div>
      <div className="farmer-top-actions"><label className="farmer-language"><span className="sr-only">Language</span><select aria-label="Language / भाषा" value={language} onChange={e=>setLanguage(e.target.value as FarmerLanguage)}>{choices.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label><button type="button" className="farmer-link-button" onClick={p.openDetailedView}>{txt('Detailed View')}</button></div>
    </header>
    <main className="farmer-wrap">
      <div className="farmer-intro"><span className="farmer-eyebrow">SEEDHEDGE · SOYBEAN</span><h1>{txt('SeedHedge helps you compare planting dates using past rain and estimated costs.')}</h1></div>
      <nav className="farmer-steps" id="farmer-step-top" aria-label="Farmer journey">
        {labels.map((s,i)=><button type="button" key={s} className={step===i?'farmer-step current':'farmer-step'} aria-current={step===i?'step':undefined} disabled={i>1&&invalid} onClick={()=>go(i)}><span>{i+1}</span>{txt(s)}</button>)}
      </nav>
      <div className="farmer-screen">
      {step===0&&<section className="farmer-section" aria-label="Check Weather">
        <div className="farmer-section-heading"><span>01 / 04</span><h2>{txt('Check Weather')}</h2><p>{txt('First, check the weather records for your region.')}</p></div>
        <div className="farmer-fields two"><label>{txt('Choose your region')}<select value={p.regionId} id="farmer-region" onChange={e=>p.setRegionId(e.target.value)}>{REGIONS.map(r=><option key={r.id} value={r.id}>{r.label}, Maharashtra</option>)}</select></label><label>{txt('Which weather should we use?')}<select id="farmer-weather-mode" value={p.weatherMode} onChange={e=>p.setWeatherMode(e.target.value as 'historical'|'synthetic')}><option value="historical">{txt('Past weather (2022–2025)')}</option><option value="synthetic">{txt('Practice with made-up weather')}</option></select></label></div>
        <div className={`farmer-state ${ready?'ok':p.weatherMode==='synthetic'?'demo':p.loadingWeather?'loading':'alert'}`} role="status"><strong>{sourceDescription}</strong><p>{txt(p.weatherMode==='synthetic'?'Practice data is not real weather.':ready?'These are past records, not a forecast for this season.':'No planting advice until full weather data is available.')}</p>{p.weatherMode==='historical'&&!ready&&<button type="button" onClick={p.onRetry} disabled={p.loadingWeather}>{txt('Try loading again')}</button>}</div>
        {p.weatherMode==='synthetic'&&<div className="farmer-choice"><button type="button" aria-pressed={p.simulation==='stress'} className={p.simulation==='stress'?'selected':''} onClick={()=>p.setSimulation('stress')}>{txt('Stress weather')}</button><button type="button" aria-pressed={p.simulation==='calm'} className={p.simulation==='calm'?'selected':''} onClick={()=>p.setSimulation('calm')}>{txt('Stable weather')}</button></div>}
        {p.weatherMode==='historical'&&<section className="farmer-forecast"><h3>{txt('Next 7 days (for information only)')}</h3><p>{txt('Today’s weather forecast is separate from the past-weather comparison.')}</p>{p.forecast?.length?<div className="farmer-forecast-days">{p.forecast.map(d=><div key={d.date}><strong>{dateLabel(d.date,language)}</strong><span>{d.precipitationMm.toFixed(1)} mm {txt('rain')}</span><span>{d.maxTempC.toFixed(0)} °C {txt('maximum')}</span></div>)}</div>:<p role="status">{p.forecastError?txt('Current forecast unavailable'):txt('Weather is loading')}</p>}</section>}
      </section>}
      {step===1&&<section className="farmer-section" aria-label="Enter Farm Details">
        <div className="farmer-section-heading"><span>02 / 04</span><h2>{txt('Enter Farm Details')}</h2><p>{txt('Tell us about your soybean farm.')}</p></div>
        <div className="farmer-fields two"><label>{txt('Crop')}<input value={txt('Soybean (supported crop)')} readOnly aria-label={txt('Crop')}/><small>{txt('Only soybean has rules in this version. We cannot safely reuse these rules for another crop.')}</small></label><label>{txt('How many acres?')}<input id="farmer-area" type="number" min="0.25" max="1000" step="0.25" value={p.area} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=.25&&n<=1000)p.setArea(n);}}/></label></div>
        <div className="farmer-fields two"><label>{txt('From which date?')}<input id="farmer-start" type="date" min={REPLAY_WINDOW_MIN} max={REPLAY_WINDOW_MAX} value={p.windowStart} onChange={e=>{p.setWindowStart(e.target.value);p.setExcludedDates([]);}}/></label><label>{txt('Until which date?')}<input id="farmer-end" type="date" min={REPLAY_WINDOW_MIN} max={REPLAY_WINDOW_MAX} value={p.windowEnd} onChange={e=>{p.setWindowEnd(e.target.value);p.setExcludedDates([]);}}/></label></div>
        {p.windowError&&<div className="farmer-state alert" role="alert"><strong>{txt('Check dates')}</strong><p>{txt('Choose dates between 15 June and 8 July 2024, with the starting date first.')}</p>{p.canSwapDates&&<button type="button" onClick={()=>{const d=p.windowStart;p.setWindowStart(p.windowEnd);p.setWindowEnd(d);p.setExcludedDates([]);}}>{txt('Swap dates')}</button>}</div>}
        <label className="farmer-inline-label">{txt('How often to compare dates?')}<select id="farmer-spacing" value={p.intervalDays} onChange={e=>{p.setIntervalDays(Number(e.target.value));p.setExcludedDates([]);}}>{DATE_INTERVAL_OPTIONS.map(n=><option key={n} value={n}>{txt(n===1?'Every day':`Every ${n} days`)}</option>)}</select></label>
        <h3>{txt('Dates to compare')} · {p.enabledDates.length}</h3><div className="farmer-date-chips">{p.generatedDates.map(d=><button key={d} type="button" aria-pressed={p.enabledDates.includes(d)} disabled={p.enabledDates.includes(d)&&p.enabledDates.length===1} onClick={()=>p.setExcludedDates(p.enabledDates.includes(d)?[...p.excludedDates,d]:p.excludedDates.filter(v=>v!==d))}>{dateLabel(d,language)} <small>{txt(p.enabledDates.includes(d)?'Included':'Excluded')}</small></button>)}</div>
        <details className="farmer-details"><summary>{txt('Change example prices')}</summary><p>{txt('These are example prices. Enter your actual local costs.')}</p><div className="farmer-fields two">{rateFields.map(f=><label key={f.key}>{txt(f.name)}<input type="number" min="0" step="1" value={p.rates[f.key]} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&v>=0)p.setRates({...p.rates,[f.key]:v});}}/></label>)}</div><button type="button" onClick={()=>p.setRates(defaultRates)}>{txt('Reset example prices')}</button></details>
      </section>}
      {step===2&&<section className="farmer-section" aria-label="Check My Plan">
        <div className="farmer-section-heading"><span>03 / 04</span><h2>{txt('Check My Plan')}</h2><p>{txt('Now compare two ways to plan the sowing.')}</p></div>
        <article className="farmer-method" id="farmer-rain"><div className="farmer-method-top"><span>01</span><h3>{txt('First: how much rain fell before each date?')}</h3></div>
          <p>{txt('A date passes only when all four past years had enough rain.')}</p>
          <label className="farmer-range">{txt('Rain to check')}: <strong>{p.threshold} mm</strong><input id="farmer-rain-threshold" type="range" min="20" max="200" step="10" value={p.threshold} onChange={e=>p.setThreshold(Number(e.target.value))}/></label>
          {ready?<><div className="farmer-rain-rows">{evidence.map(row=>{const passing=row.rainfall14ByYear.filter(y=>y.mm!==null&&y.mm>=p.threshold).length;return <details key={row.date} className="farmer-rain-row"><summary><strong>{dateLabel(row.date,language)}</strong><span>{passing}/4 {txt('years met the rain amount')}</span><span className={row.qualifiesRain?'pass':'no-pass'}>{txt(row.qualifiesRain?'Meets chosen rain amount':'Below chosen rain amount')}</span><span>{txt('Lowest of 4 years')}: <b>{row.minRain14?.toFixed(0)??'—'} mm</b></span></summary><div className="farmer-year-bars"><p>{txt('Rain in the last 14 days')}:</p>{row.rainfall14ByYear.map(yr=><div key={yr.year}><span>{yr.year}</span><div className="farmer-bar"><i style={{width:`${Math.min(100,((yr.mm??0)/Math.max(p.threshold,1))*100)}%`}}/></div><b>{yr.mm?.toFixed(0)??'—'} mm</b></div>)}</div></details>;})}</div><div className="farmer-simple-result"><strong>{rainPlan.date?`${txt('First date that passed')}: ${dateLabel(rainPlan.date,language)}`:txt('No date passed the rain rule')}</strong><p>{txt('This is a rule for comparing past rain, not a guarantee of a good crop.')}</p></div></>:<div className="farmer-state alert" role="status">{txt(p.weatherMode==='synthetic'?'Practice data is not real weather.':p.loadingWeather?'Weather is loading':'No planting advice until full weather data is available.')}</div>}
        </article>
        <article className="farmer-method" id="farmer-split"><div className="farmer-method-top"><span>02</span><h3>{txt('Second: plant on one day or two days?')}</h3></div><p>{txt('The model picked the cheapest option that passed its weather check.')}</p>
          <div className="farmer-plan-grid">{([['One planting visit',single],['Two planting visits',split]] as [string,Strategy|null][]).map(([title,s])=><div className={p.winner?.id===s?.id?'farmer-plan-card chosen':'farmer-plan-card'} key={title}><h4>{txt(title)}</h4>{s?<><strong>{option(s,language)}</strong><p>{txt('Estimated cost')}: <b>{cost(s.cost)}</b></p><small>{txt('Model score (lower means less modeled exposure)')}: {s.maximumExposure?.toFixed(2)??'—'}</small></>:<p>{txt('No option passed the weather check')}</p>}</div>)}</div>
          <div className="farmer-simple-result"><strong>{txt(p.winner?.visits===2?'Why two days?':'Why one day?')}</strong><p>{!p.winner?txt('No option passed the weather check'):single&&split?txt(single.cost<=split.cost?'Both passed; one visit costs less. Splitting is not automatically better.':'Both passed. Compare cost and model score.'):split?txt('Only a two-visit option passed this experimental weather check.'):txt('Only a one-visit option passed this experimental weather check.')}</p></div>
          {available.length>=2&&<details className="farmer-details"><summary>{txt('Try a different split')}</summary><div className="farmer-fields two"><label>{txt('First planting date')}<select value={first} onChange={e=>setSplitFirst(e.target.value)}>{available.map(d=><option key={d} value={d} disabled={d>=second}>{dateLabel(d,language)}</option>)}</select></label><label>{txt('Second planting date')}<select value={second} onChange={e=>setSplitSecond(e.target.value)}>{available.map(d=><option key={d} value={d} disabled={d<=first}>{dateLabel(d,language)}</option>)}</select></label></div><label className="farmer-range">{txt('Share planted first')}: {splitShare}%<input type="range" min="10" max="90" step="10" value={splitShare} onChange={e=>setSplitShare(Number(e.target.value))}/></label>{selectedSplit?<div className="farmer-preview"><div className="farmer-preview-field" role="img" aria-label={option(selectedSplit,language)}><div style={{width:`${splitShare}%`}}/><div style={{width:`${100-splitShare}%`}}/></div><p>{txt('Your selected split')}: {option(selectedSplit,language)} · {cost(selectedSplit.cost)} · {txt(selectedSplit.verdict==='acceptable'?'Passed model check':'Did not pass model check')}</p></div>:<p>{txt('No two-date comparison is available for these selections.')}</p>}<small>{txt('Changing this preview does not change the model’s chosen option.')}</small></details>}
          <p className="farmer-note">{txt('Local rates are examples; crop yield and profit are not predicted.')}</p>
        </article>
      </section>}
      {step===3&&<section className="farmer-section farmer-result" id="farmer-action-plan" aria-label="See My Action Plan">
        <div className="farmer-section-heading"><span>04 / 04</span><h2>{txt('Here is your farm plan')}</h2></div>
        <div className="farmer-final-head"><small>{txt('What did we find?')}</small><h3>{suggestionTitle()}</h3>{suggestion.plan&&<strong>{txt('Estimated cost')}: {cost(suggestion.plan.cost)}</strong>}{suggestion.rainDate&&<p>{txt('Plan A (rainfall)')}: {dateLabel(suggestion.rainDate,language)}</p>}</div>
        <div className="farmer-why-next"><article><h4>{txt('Why?')}</h4><p>{suggestionReason()}</p></article><article><h4>{txt('What can I do next?')}</h4><p>{nextAction()}</p>{suggestion.kind==='missing'&&<button type="button" onClick={p.onRetry} disabled={p.loadingWeather}>{txt('Try loading again')}</button>}</article></div>
        <h3>{txt('Farm summary')}</h3><div className="farmer-summary"><div><small>{txt('Region')}</small><strong>{REGIONS.find(r=>r.id===p.regionId)?.label}, Maharashtra</strong></div><div><small>{txt('Farm area')}</small><strong>{p.area} acres</strong></div><div><small>{txt('Crop')}</small><strong>{txt('Soybean (supported crop)')}</strong></div><div><small>{txt('Chosen dates')}</small><strong>{dateLabel(p.windowStart,language)} – {dateLabel(p.windowEnd,language)}</strong></div><div><small>{txt('One planting visit')}</small><strong>{cost(costBase+visitCost)}</strong></div><div><small>{txt('Two planting visits')}</small><strong>{cost(costBase+2*visitCost)}</strong></div></div>
        <div className="farmer-why-next"><article><h4>{txt('Plan A (rainfall)')}</h4><p>{p.weatherMode==='synthetic'?txt('Not checked with made-up rain'):!ready?txt('Could not check without full weather data'):rainPlan.date?`${dateLabel(rainPlan.date,language)} · ${cost(rainPlan.cost??0)}`:txt('No qualifying date')}</p></article><article><h4>{txt('Plan B (one/two days)')}</h4><p>{!ready&&p.weatherMode==='historical'?txt('Could not check without full weather data'):p.winner?`${option(p.winner,language)} · ${cost(p.winner.cost)}`:txt('No passing option')}</p></article></div>
        {ready&&<section className="farmer-report-weather"><h3>{txt('Rain details')} · {txt('Temperature information')}</h3><p>{txt('Rain and temperature are for the selected region, not a measurement on your farm.')}</p><div className="farmer-report-table-wrap"><table><thead><tr><th>{txt('Chosen dates')}</th><th>{txt('Lowest of 4 years')} (14d)</th><th>{txt('Highest temperature')}</th><th>{txt('Model score (lower means less modeled exposure)')}</th></tr></thead><tbody>{evidence.map(row=><tr key={row.date}><td>{dateLabel(row.date,language)}</td><td>{row.minRain14?.toFixed(1)??'—'} mm</td><td>{row.maxTemp3?.toFixed(1)??'—'} °C</td><td>{row.maxExposure?.toFixed(2)??'—'}</td></tr>)}</tbody></table></div></section>}
        <details className="farmer-details"><summary>{txt('Source and limitations')}</summary><p>{txt('These are past records, not a forecast for this season.')}</p><p>{txt('Local rates are examples; crop yield and profit are not predicted.')}</p>{ready&&p.weather?.years.map((year,i)=><p key={year}><a href={p.weather!.sourceUrls[i]} target="_blank" rel="noreferrer">{txt('Real historical data source')} · {year}</a></p>)}</details>
        <div className="farmer-results-actions"><button type="button" onClick={()=>window.print()}>{txt('Save or print plan')}</button><button type="button" onClick={speak}>{txt(speaking?'Stop listening':'Listen to your plan')}</button></div>{speechStatus&&<p className="farmer-note" role="status">{speechStatus}</p>}
        <section className="farmer-help"><h3>{txt('Show help')}</h3><div className="farmer-faq-buttons"><button type="button" onClick={()=>setHelpChoice('cost')}>{txt('How is the price calculated?')}</button><button type="button" onClick={()=>setHelpChoice('date')}>{txt('Why is there no date?')}</button><button type="button" onClick={()=>setHelpChoice('forecast')}>{txt('Is this today’s forecast?')}</button></div>{helpChoice&&<p role="status" className="farmer-faq-answer"><strong>{txt('Help answer')}:</strong> {qa}</p>}</section>
      </section>}
      <div className="farmer-bottom-actions"><button type="button" className="secondary" disabled={step===0} onClick={()=>go(step-1)}>{txt('Back')}</button>{step<3?<button type="button" className="primary" disabled={step===1&&invalid} onClick={()=>go(step+1)}>{txt('Next')}: {txt(labels[step+1])} →</button>:<button type="button" className="primary" onClick={()=>go(0)}>{txt('Start again')}</button>}</div>
      </div>
      <p className="farmer-bottom-note">{txt('These are past records, not a forecast for this season.')} {txt('Local rates are examples; crop yield and profit are not predicted.')}</p>
    </main>
  </div>;
}
