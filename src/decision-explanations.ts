/** Transparent comparisons of existing modeled results. Not yield or crop-loss forecasts. */
import type { CostRates, Strategy } from './engine.ts';
import type { HistoricalReplay } from './weather.ts';

const money = (n:number) => `₹${n.toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const allocation = (s: Strategy) => s.allocations.map(a=>`${Math.round(a.share*100)}% on ${a.date}`).join(' + ');

export type VisitComparison = {
  bestSingle: Strategy | null;
  bestSplit: Strategy | null;
  chosenVisits: number | null;
  title: string;
  reason: string;
  visitIncrement: number;
};
/** Explains *why* the cost-after-weather algorithm selected one or two dates. */
export function explainPlantingVisits(strategies: Strategy[], winner: Strategy | null, rates: CostRates): VisitComparison {
  const approved = strategies.filter(s=>s.verdict==='acceptable');
  const ordered = (visits:number) => approved.filter(s=>s.visits===visits).sort((a,b)=>a.cost-b.cost || (a.maximumExposure??99)-(b.maximumExposure??99) || a.id.localeCompare(b.id));
  const bestSingle=ordered(1)[0]??null;
  const bestSplit=ordered(2)[0]??null;
  const visitIncrement=rates.mobilizationPerVisit+rates.otherPerVisit;
  if (!winner) return {bestSingle,bestSplit,chosenVisits:null,title:'No planting plan passes the model yet',reason:'The weather records may be unavailable, or none of the tested allocations met the experimental rule. This is not proof that planting is unsafe.',visitIncrement};
  if (winner.visits===1) {
    if (!bestSplit) return {bestSingle,bestSplit,chosenVisits:1,title:'The model selected one planting visit',reason:`No two-date option passed the experimental weather check. The modeled one-date option (${allocation(winner)}) did. This does not establish that one-day planting is safer.`,visitIncrement};
    const saving=bestSplit.cost-winner.cost;
    return {bestSingle,bestSplit,chosenVisits:1,title:'One planting visit costs less among options that passed',reason:`Both one-date and two-date options passed the same experimental weather check. One-date planting is ${saving>0?money(saving)+' cheaper':saving===0?'the same estimated cost':'the chosen modeled option'} because two dates require an extra planting visit (${money(visitIncrement)} under your entered rates). The program ranks by cost after screening; it does not model yield or prove that splitting prevents loss.`,visitIncrement};
  }
  return {bestSingle,bestSplit,chosenVisits:2,title:'The model selected two planting dates',reason:bestSingle ? `Both visit types passed. The chosen allocation (${allocation(winner)}) ranked first under the cost-and-model tie-break rules. A split is not assumed to give more yield; review the cost and model-score difference.` : `No one-date option passed the current experimental weather screen, but a two-date allocation (${allocation(winner)}) did. This is the reason for two visits—not an assumption that every farmer should split. The extra visit adds ${money(visitIncrement)} under your rates.`,visitIncrement};
}

export type DateEvidence = {
  date: string;
  rainfall14ByYear: {year:number;mm:number|null}[];
  minRain14: number|null;
  maxTemp3: number|null;
  maxRain3: number|null;
  maxExposure: number|null;
  qualifiesRain: boolean;
};
/** Source-native annual diagnostic summaries. Do not reinterpret exposure as crop loss. */
export function summarizeCandidateDates(replay: HistoricalReplay | null, dates:string[], thresholdMm:number): DateEvidence[] {
  return [...new Set(dates)].sort().map(date=>{
    const years=replay?.years??[];
    const raw=years.map(year=>replay?.diagnostics[date]?.[year]);
    const rain14=raw.map(x=>x?.precedingRainMm??null);
    const hasAll=years.length>0&&raw.every(Boolean);
    return { date,
      rainfall14ByYear:years.map((year,i)=>({year,mm:rain14[i]})),
      minRain14:hasAll?Math.min(...(rain14 as number[])):null,
      maxTemp3:hasAll?Math.max(...raw.map(x=>x!.maxTempC)):null,
      maxRain3:hasAll?Math.max(...raw.map(x=>x!.followingRainMm)):null,
      maxExposure:hasAll?Math.max(...raw.map(x=>x!.modeledExposure)):null,
      qualifiesRain:hasAll&&rain14.every(v=>v!==null&&v>=thresholdMm),
    };
  });
}

/** Reasons for unchanged sowing costs at different dates under existing example rates. */
export function explainSameDateCost(area:number, rates:CostRates): string {
  const fixedPerAcre=rates.seedKgPerAcre*rates.seedPricePerKg+rates.laborPerAcre+rates.machineryPerAcre;
  const visit=rates.mobilizationPerVisit+rates.otherPerVisit;
  return `All one-day options currently cost the same (${money(area*fixedPerAcre+visit)}) because seed, labour and machinery rates do not vary by date in this model. The dates can differ in historical rainfall, temperature and modeled exposure, but the app has no measured crop yield or date-specific market-price data. It cannot claim that one date produces more harvest.`;
}
