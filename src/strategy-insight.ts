import type { CostRates, HazardScenario, Strategy } from './engine.ts';

/** Reusable presentation-only calculations; never override the engine's screening decision. */
export function strategyBreakdown(strategy: Strategy, area: number, rates: CostRates) {
  const seed = area * rates.seedKgPerAcre * rates.seedPricePerKg;
  const labor = area * rates.laborPerAcre;
  const machinery = area * rates.machineryPerAcre;
  const perVisit = strategy.visits * (rates.mobilizationPerVisit + rates.otherPerVisit);
  return { seed, labor, machinery, perVisit, total: seed + labor + machinery + perVisit };
}
export function strategyScenarioRows(strategy: Strategy, scenarios: HazardScenario[]) {
  return scenarios.map(s => ({ id: s.id, label: s.label,
    exposure: strategy.exposures.find(e => e.scenarioId === s.id)?.exposure ?? null }));
}
export function modelComparison(winner: Strategy, selected: Strategy) {
  return { same: winner.id === selected.id, extraCost: selected.cost - winner.cost,
    selectedIsAcceptable: selected.verdict === 'acceptable',
    exposureDifference: winner.maximumExposure === null || selected.maximumExposure === null ? null :
      Math.round((selected.maximumExposure - winner.maximumExposure) * 100) / 100 };
}
