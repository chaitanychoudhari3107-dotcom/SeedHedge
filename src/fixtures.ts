import type { HazardScenario } from './engine.ts';
/** Fake normalized hazard inputs: algorithm DEMO ONLY, not real weather, probabilities or measured crop losses. */
export const dates = ['2024-06-18', '2024-06-22', '2024-06-26'];
export const demoScenarios: HazardScenario[] = [
  { id: 'late', label: 'Delayed monsoon (simulated)', byDate: { '2024-06-18': .90, '2024-06-22': .20, '2024-06-26': .40 } },
  { id: 'rain', label: 'Heavy rainfall (simulated)', byDate: { '2024-06-18': .10, '2024-06-22': .85, '2024-06-26': .30 } },
  { id: 'hot', label: 'Dry heat (simulated)', byDate: { '2024-06-18': .25, '2024-06-22': .25, '2024-06-26': .85 } },
];
export const calmScenarios: HazardScenario[] = [
  { id: 'calm', label: 'Low-variability weather (simulated)', byDate: { '2024-06-18': .18, '2024-06-22': .15, '2024-06-26': .21 } },
  { id: 'calm2', label: 'Moderate weather (simulated)', byDate: { '2024-06-18': .29, '2024-06-22': .24, '2024-06-26': .31 } },
];
