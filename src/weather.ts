/** Real historical reanalysis. These inputs are NOT forecasts issued on the historical sowing dates. */
import type { HazardScenario } from './engine.ts';
import type { Region } from './regions.ts';

export type HistoricalDay = { date: string; precipitationMm: number; maxTempC: number };
export type HistoricalWeather = { days: HistoricalDay[]; fetchedAt: string; sourceUrl: string; timezone: string };
export type HistoricalReplay = {
  region: Region;
  years: number[];
  dailyByYear: Record<number, HistoricalDay[]>;
  sourceUrls: string[];
  retrievedAt: string;
  scenarios: HazardScenario[];
  diagnostics: Record<string, Record<number, { precedingRainMm: number; followingRainMm: number; maxTempC: number; modeledExposure: number }>>;
};
export const REPLAY_YEARS = [2022, 2023, 2024, 2025];
export const SOWING_DATES = ['2024-06-20', '2024-06-24', '2024-06-28', '2024-07-02', '2024-07-05'];

export function historicalUrl(region: Region, year: number): string {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  Object.entries({ latitude: String(region.latitude), longitude: String(region.longitude),
    start_date: `${year}-06-01`, end_date: `${year}-07-10`, daily: 'precipitation_sum,temperature_2m_max',
    timezone: 'Asia/Kolkata', precipitation_unit: 'mm', temperature_unit: 'celsius' })
    .forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}
export async function fetchHistoricalYear(region: Region, year: number, signal?: AbortSignal): Promise<HistoricalWeather> {
  const url = historicalUrl(region, year);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status} for ${year}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Malformed weather response');
  const obj = data as Record<string, unknown>;
  const daily = obj.daily as Record<string, unknown> | undefined;
  const units = obj.daily_units as Record<string, unknown> | undefined;
  if (obj.timezone !== 'Asia/Kolkata' || units?.precipitation_sum !== 'mm' || units?.temperature_2m_max !== '°C' ||
      !daily || !Array.isArray(daily.time) || !Array.isArray(daily.precipitation_sum) || !Array.isArray(daily.temperature_2m_max)) {
    throw new Error(`Incompatible weather timezone, units or arrays for ${year}`);
  }
  const dates = daily.time as unknown[];
  const rain = daily.precipitation_sum as unknown[];
  const temps = daily.temperature_2m_max as unknown[];
  if (dates.length !== 40 || dates.length !== rain.length || dates.length !== temps.length) {
    throw new Error(`Incomplete historical window for ${year}`);
  }
  const days = dates.map((date, i): HistoricalDay => {
    const p = rain[i], t = temps[i];
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        typeof p !== 'number' || !Number.isFinite(p) || p < 0 ||
        typeof t !== 'number' || !Number.isFinite(t) || t < -30 || t > 65) {
      throw new Error(`Missing or invalid rainfall/temperature in ${year}`);
    }
    return { date, precipitationMm: p, maxTempC: t };
  });
  return { days, fetchedAt: new Date().toISOString(), sourceUrl: url, timezone: 'Asia/Kolkata' };
}

/**
 * Exploration-only heuristic: rainfall accumulated in prior 14 days, 3-day rainfall after sowing,
 * and maximum temperature. 100 mm preceding rain is informed by ICAR-NSRI soybean advisory;
 * heat/precipitation penalty magnitudes and 0.60 strategy cutoff are UNVALIDATED product assumptions.
 * Result is a dimensionless comparative index, never crop-loss probability or a safety certificate.
 */
export function heuristicExposure(days: HistoricalDay[], monthDay: string) {
  const index = days.findIndex(d => d.date.slice(5) === monthDay);
  if (index < 14 || index + 2 >= days.length) return null;
  const past = days.slice(index - 14, index);
  const coming = days.slice(index, index + 3);
  if (past.length !== 14 || coming.length !== 3) return null;
  const precedingRainMm = past.reduce((sum, d) => sum + d.precipitationMm, 0);
  const followingRainMm = coming.reduce((sum, d) => sum + d.precipitationMm, 0);
  const maxTempC = Math.max(...coming.map(d => d.maxTempC));
  // Heuristic components, NOT validated agronomic limits.
  const rainfallShortfall = Math.max(0, (100 - precedingRainMm) / 100);
  const excessRain = Math.max(0, (followingRainMm - 85) / 85);
  const highHeat = Math.max(0, (maxTempC - 36) / 10);
  const modeledExposure = Math.round(Math.min(1, .68 * rainfallShortfall + .20 * excessRain + .12 * highHeat) * 100) / 100;
  return { precedingRainMm, followingRainMm, maxTempC, modeledExposure };
}

export async function fetchHistoricalReplay(region: Region, signal?: AbortSignal): Promise<HistoricalReplay> {
  const results = await Promise.all(REPLAY_YEARS.map(year => fetchHistoricalYear(region, year, signal)));
  const dailyByYear: Record<number, HistoricalDay[]> = {};
  const diagnostics: HistoricalReplay['diagnostics'] = {};
  for (let i = 0; i < results.length; i++) dailyByYear[REPLAY_YEARS[i]] = results[i].days;
  const scenarios = REPLAY_YEARS.map(year => {
    const byDate: Record<string, number | null> = {};
    for (const date of SOWING_DATES) {
      const detail = heuristicExposure(dailyByYear[year], date.slice(5));
      byDate[date] = detail?.modeledExposure ?? null;
      if (detail) { diagnostics[date] ??= {}; diagnostics[date][year] = detail; }
    }
    return { id: `observed-${year}`, label: `${year} historical reanalysis (counterfactual analog)`, byDate };
  });
  return { region, years: REPLAY_YEARS, dailyByYear, sourceUrls: results.map(r => r.sourceUrl),
    retrievedAt: new Date().toISOString(), scenarios, diagnostics };
}

// Retained for compatibility with the starter's original weather-context API.
export async function fetchHistoricalContext(signal?: AbortSignal): Promise<HistoricalWeather> {
  return fetchHistoricalYear({ id: 'akola', label: 'Akola', state: 'Maharashtra', latitude: 20.7, longitude: 77 }, 2024, signal);
}

/** Current near-term forecast for situational awareness only.
 * Not fed into June/July 2024 historical sowing recommendations. */
export async function fetchCurrentForecast(region: Region, signal?: AbortSignal): Promise<{ daily: HistoricalDay[]; sourceUrl: string }> {
  const endpoint = new URL('https://api.open-meteo.com/v1/forecast');
  Object.entries({ latitude: String(region.latitude), longitude: String(region.longitude),
    daily: 'precipitation_sum,temperature_2m_max', forecast_days: '7', timezone: 'Asia/Kolkata',
    precipitation_unit: 'mm', temperature_unit: 'celsius' })
    .forEach(([key, value]) => endpoint.searchParams.set(key, value));
  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error(`Forecast API returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('Invalid forecast response');
  const obj = payload as Record<string, unknown>;
  const data = obj.daily as Record<string, unknown> | undefined;
  const units = obj.daily_units as Record<string, unknown> | undefined;
  if (obj.timezone !== 'Asia/Kolkata' || units?.precipitation_sum !== 'mm' ||
      units?.temperature_2m_max !== '°C' || !data || !Array.isArray(data.time) ||
      !Array.isArray(data.precipitation_sum) || !Array.isArray(data.temperature_2m_max) ||
      data.time.length !== data.precipitation_sum.length || data.time.length !== data.temperature_2m_max.length ||
      data.time.length === 0 || data.time.length > 7) throw new Error('Invalid forecast units or arrays');
  const daily = data.time.map((date: unknown, i: number): HistoricalDay => {
    const p = (data.precipitation_sum as unknown[])[i];
    const t = (data.temperature_2m_max as unknown[])[i];
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        typeof p !== 'number' || !Number.isFinite(p) || p < 0 ||
        typeof t !== 'number' || !Number.isFinite(t)) throw new Error('Forecast missing values');
    return { date, precipitationMm: p, maxTempC: t };
  });
  return { daily, sourceUrl: endpoint.toString() };
}
