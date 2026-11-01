import { useEffect, useState } from 'react';
import { explainQuestion, type HelpContext } from './help.ts';
type Message = { role: 'farmer' | 'helper'; text: string };
export default function FarmHelp({context}: {context: HelpContext}) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  // A saved answer must never silently describe yesterday's inputs as today's.
  useEffect(() => {setMessages([]);}, [context.location, context.acres, context.dates.join('|'), context.source, context.loading, context.weatherError,
    context.planA.date, context.planA.thresholdMm, context.planB?.id, context.planB?.cost,
    ...Object.values(context.rates)]);
  const submit = () => {
    const q = draft.trim(); if (!q) return;
    const answer = explainQuestion(q, context);
    setMessages(prev => [...prev.slice(-11), {role:'farmer',text:q}, {role:'helper',text:answer}]);
    setDraft('');
  };
  return <section className="panel farm-help" aria-label="Ask about your farm results">
    <div className="panel-heading"><div><span className="section-label">ON-SCREEN HELP</span><h2>Ask about your result</h2></div><span className="mini-pill">Rule-based · no external AI</span></div>
    <p className="subtle">Ask a question about what you see here. This helper uses the current form and calculation, not a chatbot service. It cannot forecast crops or invent missing data.</p>
    <div className="help-shortcuts">
      {['Why Plan A?', 'Why one day or two?', 'Can I grow cotton?', 'How is cost calculated?', 'What is weather intelligence?'].map(q => <button key={q} type="button" onClick={() => setMessages(prev => [...prev.slice(-11),{role:'farmer',text:q},{role:'helper',text:explainQuestion(q, context)}])}>{q}</button>)}
    </div>
    <div className="help-thread" role="log" aria-live="polite" aria-label="Question and answer history">{messages.length ? messages.map((m,i) => <p key={i} className={`help-message help-${m.role}`}><b>{m.role==='farmer'?'You':'SeedHedge help'}:</b> {m.text}</p>) : <p className="subtle">Try “Why Plan A?” or “Where is the weather from?”</p>}</div>
    <form className="help-compose" onSubmit={e => {e.preventDefault();submit();}}><label htmlFor="farm-question" className="sr-only">Your question about this result</label><input id="farm-question" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ask about your dates, plans or costs" maxLength={240}/><button type="submit" disabled={!draft.trim()}>Send question</button></form>
  </section>;
}
