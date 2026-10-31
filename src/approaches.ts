/** Two independently explained *prototype* approaches; neither establishes crop safety. */
import { strategyCost, type CostRates, type Strategy } from './engine.ts';
import type { HistoricalReplay } from './weather.ts';

export type RainfallPlan = {
  date: string | null;
  cost: number | null;
  rainByYear: {year: number; rainMm: number | null; meetsRule: boolean}[];
  qualifiedCount: number;
  yearsCount: number;
  thresholdMm: number;
  explanation: string;
};

/** Rainfall-only rule: earliest date whose *preceding* 14-day accumulation is at least
 * thresholdMm in every observed replay year. Later observations never enter this rule. */
export function rainfallThresholdPlan(
  replay: HistoricalReplay | null,
  dates: string[],
  area: number,
  rates: CostRates,
  thresholdMm = 100,
): RainfallPlan {
  if (!Number.isFinite(thresholdMm) || thresholdMm < 0 || thresholdMm > 500) {
    throw new Error('Rainfall threshold must be between 0 and 500 mm');
  }
  const years = replay?.years ?? [];
  const candidates = [...new Set(dates)].sort();
  for (const date of candidates) {
    if (!years.length) break;
    const rainByYear = years.map(year => {
      const rainMm = replay?.diagnostics[date]?.[year]?.precedingRainMm ?? null;
      return { year, rainMm, meetsRule: rainMm !== null && rainMm >= thresholdMm };
    });
    if (rainByYear.every(row => row.meetsRule)) {
      return { date, cost: strategyCost([{date, share: 1}], area, rates), rainByYear,
        qualifiedCount: years.length, yearsCount: years.length, thresholdMm,
        explanation: `Earliest enabled date meeting the ${thresholdMm} mm preceding-14-day rainfall rule across all ${years.length} replay years. This conservative replay criterion is experimental.` };
    }
  }
  const lastDate = candidates.at(-1);
  const rainByYear = years.map(year => {
    const rainMm = lastDate ? replay?.diagnostics[lastDate]?.[year]?.precedingRainMm ?? null : null;
    return { year, rainMm, meetsRule: rainMm !== null && rainMm >= thresholdMm };
  });
  return { date: null, cost: null, rainByYear, qualifiedCount: rainByYear.filter(r => r.meetsRule).length,
    yearsCount: years.length, thresholdMm,
    explanation: years.length ? 'No enabled date meets the rule in every replay year; no Plan A recommendation is forced.' : 'Historical evidence unavailable. Plan A cannot be evaluated from simulated or missing observations.' };
}

export type PlanComparison = { difference: number | null; sameDate: boolean; explanation: string };
export function comparePlans(a: RainfallPlan, b: Strategy | null): PlanComparison {
  if (a.cost === null || !b || b.verdict !== 'acceptable') {
    return {difference: null, sameDate: false, explanation: 'A direct cost comparison is unavailable because one or both approaches have no qualified result.'};
  }
  const difference = b.cost - a.cost;
  return {difference, sameDate: b.allocations.length === 1 && b.allocations[0].date === a.date,
    explanation: difference > 0 ? `Plan B costs ₹${difference.toLocaleString('en-IN')} more, mainly because of additional sowing visits.` :
      difference < 0 ? `Plan B costs ₹${Math.abs(difference).toLocaleString('en-IN')} less under the same local rates.` :
        'Both approaches have equal estimated sowing costs under the same local rates.'};
}
