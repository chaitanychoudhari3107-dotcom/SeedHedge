/** One transparent suggestion based exclusively on the two existing experimental models. */
import type { Strategy } from './engine.ts';

export type FarmerSuggestion = {
  kind: 'loading' | 'missing' | 'demo' | 'both' | 'rain-only' | 'split-only' | 'neither';
  plan: Strategy | null;
  rainDate: string | null;
  agreement: boolean;
  reason: 'loading' | 'missing' | 'demo' | 'same-date' | 'different-dates' | 'rain-only' | 'split-only' | 'neither';
};
export function makeFarmerSuggestion(input: {
  weatherMode: 'historical' | 'synthetic';
  weatherReady: boolean;
  loading: boolean;
  rainDate: string | null;
  winner: Strategy | null;
}): FarmerSuggestion {
  const {weatherMode,weatherReady,loading,rainDate,winner}=input;
  if (weatherMode === 'historical' && loading) return {kind:'loading',plan:null,rainDate:null,agreement:false,reason:'loading'};
  if (weatherMode === 'historical' && !weatherReady) return {kind:'missing',plan:null,rainDate:null,agreement:false,reason:'missing'};
  if (weatherMode === 'synthetic') return {kind:'demo',plan:winner,rainDate:null,agreement:false,reason:'demo'};
  if (rainDate && winner) {
    const agreement=winner.allocations.length===1 && winner.allocations[0].date===rainDate;
    return {kind:'both',plan:winner,rainDate,agreement,reason:agreement?'same-date':'different-dates'};
  }
  if (rainDate) return {kind:'rain-only',plan:null,rainDate,agreement:false,reason:'rain-only'};
  if (winner) return {kind:'split-only',plan:winner,rainDate:null,agreement:false,reason:'split-only'};
  return {kind:'neither',plan:null,rainDate:null,agreement:false,reason:'neither'};
}
