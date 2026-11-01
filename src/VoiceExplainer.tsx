import { useEffect, useMemo, useState } from 'react';
import type { Strategy } from './engine.ts';
type Language = 'mr-IN' | 'hi-IN' | 'en-IN';
const dateLabel = (v: string) => new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short'}).format(new Date(`${v}T12:00:00`));
const rs = (v: number) => `₹${v.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
function voiceText(lang: Language, winner: Strategy | null, mode: 'historical' | 'synthetic') {
  const prefix = mode==='synthetic';
  if (!winner) return lang==='mr-IN' ? 'सध्या विश्वासार्ह निष्कर्ष उपलब्ध नाही. हवामानाची माहिती तपासा किंवा नमुना मोड निवडा.' : lang==='hi-IN' ? 'अभी कोई मॉडल परिणाम उपलब्ध नहीं है। कृपया मौसम डेटा जांचें।' : 'No modeled result is available. Please check the weather evidence.';
  const marathiDate=(v:string)=>new Intl.DateTimeFormat('mr-IN',{day:'numeric',month:'long'}).format(new Date(`${v}T12:00:00`));
  const dates = winner.allocations.map(a=>`${Math.round(a.share*100)} टक्के ${marathiDate(a.date)}`).join(' आणि ');
  if (lang==='mr-IN') return `${prefix?'हा काल्पनिक नमुना आहे.':'हा पूर्वीच्या हवामानावर आधारित अभ्यास आहे; आजचा हवामान अंदाज नाही.'} प्रयोगात्मक नियमांनुसार पर्याय: ${dates}. अंदाजे पेरणी खर्च ${rs(winner.cost)}. प्रत्यक्ष पेरणीपूर्वी स्थानिक कृषी तज्ज्ञांचा सल्ला घ्या.`;
  if (lang==='hi-IN') return `${prefix?'यह काल्पनिक प्रदर्शन है।':'यह पुराने मौसम का अध्ययन है, आज का पूर्वानुमान नहीं।'} मॉडल के अनुसार विकल्प: ${winner.allocations.map(a=>`${Math.round(a.share*100)} प्रतिशत ${dateLabel(a.date)}`).join(' और ')}। अनुमानित खर्च ${rs(winner.cost)}। स्थानीय कृषि विशेषज्ञ से सलाह लें।`;
  return `${prefix?'This is a fictional demonstration.':'This is a historical replay, not a forecast for today.'} The modeled option is ${winner.allocations.map(a=>`${Math.round(a.share*100)} percent on ${dateLabel(a.date)}`).join(' and ')}, estimated cost ${rs(winner.cost)}. Consult local agronomic guidance before planting.`;
}
export default function VoiceExplainer({winner,mode}: {winner:Strategy|null;mode:'historical'|'synthetic'}) {
  const [language,setLanguage]=useState<Language>('mr-IN');
  const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
  const [speaking,setSpeaking]=useState(false);
  const [status,setStatus]=useState('');
  const explanation=voiceText(language,winner,mode);
  const supported=typeof window!=='undefined'&&'speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
  useEffect(()=>{
    if (!supported) return;
    const speech=window.speechSynthesis;
    const refresh=()=>setVoices(speech.getVoices());
    refresh(); speech.addEventListener('voiceschanged',refresh);
    return ()=>{speech.removeEventListener('voiceschanged',refresh);speech.cancel();};
  },[supported]);
  const voice=useMemo(()=>voices.find(v=>v.lang.toLowerCase()===language.toLowerCase())??null,[voices,language]);
  const stop=()=>{if(supported) window.speechSynthesis.cancel();setSpeaking(false);setStatus('Playback stopped.');};
  const play=()=>{
    if (!supported || !voice || !winner) {setStatus('A matching installed voice and a modeled result are required. Read the text below instead.');return;}
    window.speechSynthesis.cancel();
    const item = new SpeechSynthesisUtterance(explanation);
    item.lang=language;item.voice=voice;item.rate=0.88;
    item.onstart=()=>{setSpeaking(true);setStatus('Playing explanation.');};
    item.onend=()=>{setSpeaking(false);setStatus('Playback finished.');};
    item.onerror=e=>{setSpeaking(false);setStatus(`Voice playback unavailable (${e.error}). Read the explanation below.`);};
    try{window.speechSynthesis.speak(item);}catch{setSpeaking(false);setStatus('Speech could not start. Read the text below.');}
  };
  return <div className="voice-explainer"><strong>Listen to the explanation</strong><p className="subtle">Playback uses voices installed on this device, not an online Marathi voice service. Text always remains available.</p><div className="voice-tools"><select aria-label="Voice language" value={language} onChange={e=>{stop();setStatus('');setLanguage(e.target.value as Language)}}><option value="mr-IN">मराठी</option><option value="hi-IN">हिन्दी</option><option value="en-IN">English</option></select><button type="button" onClick={speaking?stop:play} disabled={!winner||!supported||(!speaking&&!voice)}>{speaking?'■ Stop':'▶ Play'}</button></div><p className="voice-status" role="status">{status||(supported?(voice?`Installed voice: ${voice.name}`:`No ${language} voice installed. Text is available below.`):'Speech playback is unavailable in this browser. Read below.')}</p><p className="voice-copy" lang={language}>{explanation}</p></div>;
}
