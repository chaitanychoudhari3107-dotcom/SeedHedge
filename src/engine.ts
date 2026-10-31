/** Pure, auditable decision engine. DEMONSTRATION hazard indices are not agronomic thresholds. */
export type WeatherVerdict = 'acceptable' | 'unacceptable' | 'unknown';
export type HazardScenario = {
  id: string; label: string; byDate: Record<string, number | null>;
};
export type CostRates = {
  seedKgPerAcre: number;
  seedPricePerKg: number;
  laborPerAcre: number;
  machineryPerAcre: number;
  mobilizationPerVisit: number;
  otherPerVisit: number;
};
export type SowingAllocation = { date: string; share: number };
export type Strategy = {
  id: string;
  allocations: SowingAllocation[];
  verdict: WeatherVerdict;
  maximumExposure: number | null;
  exposures: { scenarioId: string; exposure: number | null }[];
  cost: number;
  visits: number;
  reason: string;
};

export const defaultRates: CostRates = {
  seedKgPerAcre: 30,
  seedPricePerKg: 75,
  laborPerAcre: 850,
  machineryPerAcre: 1050,
  mobilizationPerVisit: 450,
  otherPerVisit: 0,
};

const round = (value: number) => Math.round(value * 100) / 100;

export function generateStrategies(dates: string[], increment = 0.25): SowingAllocation[][] {
  const unique = [...new Set(dates)].filter(Boolean).sort();
  if (!Number.isFinite(increment) || increment <= 0 || increment > 1 || Math.abs(1 / increment - Math.round(1 / increment)) > 1e-8) {
    throw new Error('Allocation increment must evenly divide 1.');
  }
  const output: SowingAllocation[][] = unique.map(date => [{ date, share: 1 }]);
  const steps = Math.round(1 / increment);
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      for (let n = 1; n < steps; n++) {
        output.push([{ date: unique[i], share: round(n * increment) }, { date: unique[j], share: round(1 - n * increment) }]);
      }
    }
  }
  return output;
}

export function strategyCost(allocations: SowingAllocation[], farmAcres: number, rates: CostRates): number {
  if (!Number.isFinite(farmAcres) || farmAcres <= 0) throw new Error('Farm area must be positive.');
  if (Object.values(rates).some(v => !Number.isFinite(v) || v < 0)) throw new Error('Rates must be finite and nonnegative.');
  if (allocations.length === 0 || allocations.some(a => a.share <= 0 || !Number.isFinite(a.share)) ||
      Math.abs(allocations.reduce((t, a) => t + a.share, 0) - 1) > 1e-8 ||
      new Set(allocations.map(a => a.date)).size !== allocations.length) {
    throw new Error('Allocations must sum to 100%, use unique dates and have positive shares.');
  }
  const variablePerAcre = rates.seedKgPerAcre * rates.seedPricePerKg + rates.laborPerAcre + rates.machineryPerAcre;
  return round(farmAcres * variablePerAcre + allocations.length * (rates.mobilizationPerVisit + rates.otherPerVisit));
}

export function evaluateStrategy(args: {
  allocations: SowingAllocation[];
  farmAcres: number;
  rates: CostRates;
  scenarios: HazardScenario[];
  threshold: number;
  approvedDates: Set<string>;
}): Strategy {
  const { allocations, farmAcres, rates, scenarios, threshold, approvedDates } = args;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Invalid demonstration threshold.');
  const cost = strategyCost(allocations, farmAcres, rates);
  const id = allocations.map(a => `${a.date}:${Math.round(a.share * 100)}`).join('|');
  const exposures = scenarios.map(s => {
    const values = allocations.map(a => s.byDate[a.date]);
    const missing = values.some(v => v === null || v === undefined || !Number.isFinite(v) || (v as number) < 0 || (v as number) > 1);
    return { scenarioId: s.id, exposure: missing ? null : round(allocations.reduce((sum, a, i) => sum + a.share * (values[i] as number), 0)) };
  });
  const missing = scenarios.length === 0 || exposures.some(e => e.exposure === null);
  const rejectedDates = allocations.filter(a => !approvedDates.has(a.date)).map(a => a.date);
  const maximumExposure = missing ? null : Math.max(...exposures.map(e => e.exposure as number));
  let verdict: WeatherVerdict;
  let reason: string;
  if (rejectedDates.length) {
    verdict = 'unacceptable'; reason = `Date outside configured allowed windows: ${rejectedDates.join(', ')}.`;
  } else if (missing) {
    verdict = 'unknown'; reason = 'Insufficient scenario evidence. No positive recommendation.';
  } else if ((maximumExposure as number) > threshold) {
    verdict = 'unacceptable'; reason = `Modeled worst-case exposure exceeds the configured ${threshold} demonstration limit.`;
  } else {
    verdict = 'acceptable'; reason = 'Passes the configured demonstration weather screens; not field-certified.';
  }
  return { id, allocations, verdict, maximumExposure, exposures, cost, visits: allocations.length, reason };
}

export function rankStrategies(strategies: Strategy[]): Strategy[] {
  return strategies.filter(s => s.verdict === 'acceptable').sort((a, b) =>
    a.cost - b.cost || (a.maximumExposure ?? Infinity) - (b.maximumExposure ?? Infinity) || a.visits - b.visits || a.id.localeCompare(b.id));
}

export function analyze(args: {
  dates: string[]; farmAcres: number; rates: CostRates; scenarios: HazardScenario[];
  threshold: number; approvedDates: Set<string>; increment?: number;
}): { strategies: Strategy[]; winner: Strategy | null } {
  const strategies = generateStrategies(args.dates, args.increment).map(allocations => evaluateStrategy({ ...args, allocations }));
  return { strategies, winner: rankStrategies(strategies)[0] ?? null };
}
