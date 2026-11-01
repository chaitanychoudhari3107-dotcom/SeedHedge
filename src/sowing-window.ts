/** A farmer-selected period within the available 2024 historical-replay sample.
 * The prototype is NOT a forward-looking planting-date recommender. */
export const REPLAY_WINDOW_MIN = '2024-06-15';
export const REPLAY_WINDOW_MAX = '2024-07-08';
export const DEMO_WINDOW_START = '2024-06-20';
export const DEMO_WINDOW_END = '2024-07-05';

export type CandidateWindow = { dates: string[]; error: string | null; start: string; end: string; intervalDays: number };
export const DEFAULT_INTERVAL_DAYS = 3;
export const DATE_INTERVAL_OPTIONS = [1, 2, 3, 5, 7] as const;
const DAY = 86400000;
const isISO = (v: string) => /^\d{4}-\d\d-\d\d$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const dayNumber = (v: string) => Date.parse(`${v}T00:00:00Z`) / DAY;
const asISO = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);

/** Candidate dates are generated at farmer-selected intervals, not from a fixed five-date list.
 * The historic replay dataset covers only 15 June–8 July 2024 and must not be
 * interpreted as a forecast for a future season. Both plans share these dates.
 * The end date is always included so the requested interval is represented.
 */
export function candidatesForWindow(start: string, end: string, intervalDays: number = DEFAULT_INTERVAL_DAYS): CandidateWindow {
  const empty = (error: string): CandidateWindow => ({ start, end, intervalDays, dates: [], error });
  if (!isISO(start) || !isISO(end)) return empty('Enter a valid starting and ending date.');
  if (start > end) return empty('The end date must be on or after the start date. Your inputs have been kept.');
  if (start < REPLAY_WINDOW_MIN || end > REPLAY_WINDOW_MAX) {
    return empty(`Historical demo supports ${REPLAY_WINDOW_MIN} to ${REPLAY_WINDOW_MAX}. Select dates inside this range; no present-day forecast is implied.`);
  }
  if (!Number.isInteger(intervalDays) || !DATE_INTERVAL_OPTIONS.some(n => n === intervalDays)) {
    return empty('Choose an available number of days between planting options.');
  }
  const a = dayNumber(start), b = dayNumber(end);
  const dates: string[] = [];
  for (let d = a; d <= b; d += intervalDays) dates.push(asISO(d));
  if (dates.at(-1) !== end) dates.push(end);
  return { start, end, intervalDays, dates, error: null };
}
