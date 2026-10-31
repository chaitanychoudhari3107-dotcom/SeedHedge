import type { HazardScenario } from './engine.ts';
/** Fake normalized hazard inputs: algorithm DEMO ONLY, not real weather, probabilities or measured crop losses. */
export const dates = ['2024-06-18', '2024-06-22', '2024-06-26'];
export const demoScenarios: HazardScenario[] = [
  { id: 'late', label: 'Delayed monsoon (simulated)', byDate: { '2024-06-20': .90, '2024-06-24': .35, '2024-06-18': .90, '2024-06-22': .20, '2024-06-26': .40, '2024-06-28': .55, '2024-07-02': .30, '2024-07-05': .45 } },
  { id: 'rain', label: 'Heavy rainfall (simulated)', byDate: { '2024-06-20': .10, '2024-06-24': .85, '2024-06-18': .10, '2024-06-22': .85, '2024-06-26': .30, '2024-06-28': .50, '2024-07-02': .15, '2024-07-05': .65 } },
  { id: 'hot', label: 'Dry heat (simulated)', byDate: { '2024-06-20': .25, '2024-06-24': .20, '2024-06-18': .25, '2024-06-22': .25, '2024-06-26': .85, '2024-06-28': .22, '2024-07-02': .65, '2024-07-05': .30 } },
];
export const calmScenarios: HazardScenario[] = [
  { id: 'calm', label: 'Low-variability weather (simulated)', byDate: { '2024-06-20': .18, '2024-06-24': .17, '2024-06-18': .18, '2024-06-22': .15, '2024-06-26': .21, '2024-06-28': .17, '2024-07-02': .21, '2024-07-05': .20 } },
  { id: 'calm2', label: 'Moderate weather (simulated)', byDate: { '2024-06-20': .29, '2024-06-24': .28, '2024-06-18': .29, '2024-06-22': .24, '2024-06-26': .31, '2024-06-28': .30, '2024-07-02': .29, '2024-07-05': .31 } },
];
