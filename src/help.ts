/** No LLM or remote chatbot is involved: explain only audited values on screen. */
import type { Strategy, CostRates } from './engine.ts';
import type { RainfallPlan } from './approaches.ts';
import { explainPlantingVisits } from './decision-explanations.ts';
export type HelpContext = {
  location: string; acres: number; dates: string[];
  source: 'historical' | 'synthetic'; loading: boolean; weatherError: string | null;
  planA: RainfallPlan; planB: Strategy | null; strategies?: Strategy[]; rates: CostRates;
};
const rupees = (v: number) => `₹${v.toLocaleString('en-IN', {maximumFractionDigits: 0})}`;
const date = (v: string) => v.slice(8, 10) + ' ' + new Intl.DateTimeFormat('en-IN',{month:'short'}).format(new Date(`${v}T12:00:00`));
const allocation = (s: Strategy) => s.allocations.map(a => `${Math.round(a.share * 100)}% on ${date(a.date)}`).join(' and ');
export function explainQuestion(question: string, context: HelpContext): string {
  const q = question.toLowerCase().trim();
  if (!q) return 'Type a question about your dates, weather evidence, costs or the two plans.';
  if (/(crop|soybean|soya|cotton|rice|wheat|भात|सोयाबीन)/i.test(q)) return 'This version models soybean (Kharif) only. Crop-specific sowing and risk rules for cotton, rice or other crops have not been implemented or validated, so selecting another crop would be misleading.';
  if (/(one day|two day|two date|multiple visit|single visit|why split|when split|all at once)/i.test(q)) {
    const choice=explainPlantingVisits(context.strategies??(context.planB?[context.planB]:[]),context.planB,context.rates);
    return `${choice.title}. ${choice.reason} An extra planting visit costs ${rupees(choice.visitIncrement)} under your current example rates. This model has no measured yield or crop-loss outcome.`;
  }
  if (/(weather intelligence|historical weather|weather evidence model)/i.test(q)) {
    return context.source==='synthetic'?'The weather display is using clearly invented DEMO inputs, not historical observation. Plan A cannot evaluate a rainfall threshold in this mode.':'The weather evidence section compares past rainfall during the 14 days before each candidate date and temperature from replayed years. It uses 2022–2025 ERA5 historical data; it is not a live forecast or predicted farm loss.';
  }
  if (/(yield|output|harvest|profit|produce|more risk|same price)/i.test(q)) return 'The price estimate for one planting visit stays the same across dates because the model uses identical seed, labour and machinery rates for all dates. Past rainfall, temperature and modeled exposure can vary by date, but SeedHedge has no validated yield or profit model and cannot claim a particular date produces more harvest.';
  if (/(hello|hi|नमस्कार|help|what can)/i.test(q)) return 'I can explain Plan A, Plan B, the dates, the weather source, the estimated cost, and what to do when weather cannot load. I only use values visible in this app.';
  if (/(weather|rain|source|api|forecast|live|real|डेटा|हवामान)/i.test(q)) {
    if (context.source === 'synthetic') return 'This is a SYNTHETIC DEMO, using invented scenarios. There is no live or historical weather evidence for these calculations. Switch to historical replay to request ERA5 data.';
    if (context.loading) return 'Weather is still loading. No historical recommendation is final yet. You can wait or use Retry.';
    if (context.weatherError) return `Historical weather could not be fully verified: ${context.weatherError} Try Retry. The app does not replace missing evidence with invented values.`;
    return 'Plan A and Plan B use Open-Meteo ERA5 historical reanalysis from 2022–2025 for the selected location and 2024 replay dates. It was observed/reanalysed after those dates, so it is NOT an advance forecast or a guarantee for an upcoming season.';
  }
  if (/(date|window|when|sow|पेरणी|तारीख)/i.test(q)) {
    return context.dates.length ? `You selected the historical replay window; the app generated these candidate dates: ${context.dates.map(date).join(', ')}. They are 2024 replay examples, not verified dates to sow today. Change the start/end date fields to explore a different period.` : 'No valid candidate dates are selected. Correct the start/end dates in the farm form.';
  }
  if (/(plan a|rainfall rule|first plan|minimum rain)/i.test(q)) {
    if (context.source === 'synthetic' || context.loading || context.weatherError) return 'Plan A needs complete historical rainfall evidence. It will not give a result from missing or fictional rainfall.';
    return context.planA.date ? `Plan A chooses ${date(context.planA.date)} because it is the earliest candidate whose PREVIOUS 14 days of rainfall met the experimental ${context.planA.thresholdMm} mm rule in every replay year. Estimated sowing cost: ${rupees(context.planA.cost ?? 0)}. This rule has not been validated for field advice.` : `Plan A found no candidate that met ${context.planA.thresholdMm} mm rainfall in every replay year. That means the rule did not qualify a date—not that the data were invented or that sowing is unsafe.`;
  }
  if (/(plan b|split|stagger|second plan|strategy)/i.test(q)) {
    return context.planB ? `Plan B's lowest-cost modeled-acceptable allocation is ${allocation(context.planB)}. Estimated cost is ${rupees(context.planB.cost)} for ${context.acres} acres and ${context.planB.visits} planting visit(s). It first applies an experimental historical/simulated weather screen; no crop-safety or yield claim is made.` : 'Plan B has no modeled-acceptable result for the available evidence and selected assumptions. Try changing the experimental assumptions or verifying weather access.';
  }
  if (/(cost|price|rupee|₹|expense|लागत|खर्च)/i.test(q)) {
    const r=context.rates; return `Estimated cost = ${context.acres} acres × (${r.seedKgPerAcre} kg seed/acre × ${rupees(r.seedPricePerKg)}/kg + ${rupees(r.laborPerAcre)} labour/acre + ${rupees(r.machineryPerAcre)} machinery/acre) + ${rupees(r.mobilizationPerVisit+r.otherPerVisit)} per planting visit. Local rates are editable examples, not verified quotations. A farmer budget is not required.`;
  }
  if (/(next|action|why|recommend|safe|harvest|risk|uncertain)/i.test(q)) {
    if (context.loading || context.weatherError) return 'Next step: retry historical weather or deliberately choose the labeled synthetic demo. No real-data result is established while evidence is missing.';
    return 'Review both approaches and their assumptions, check current local conditions, and seek local agronomic guidance before acting. Neither plan predicts yield, guarantees a harvest, or certifies sowing safety.';
  }
  return 'I cannot answer that from the current farm inputs and weather evidence. Ask about Plan A, Plan B, cost, candidate dates, weather sources, or the next step. I do not generate forecasts or invent farm advice.';
}
