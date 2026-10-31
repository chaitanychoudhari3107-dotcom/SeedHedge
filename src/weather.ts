/** Authentic weather context, deliberately NOT wired to synthetic agronomic risk scores. */
export type HistoricalDay = { date: string; precipitationMm: number; maxTempC: number };
export type HistoricalWeather = { days: HistoricalDay[]; fetchedAt: string; sourceUrl: string; timezone: string };
export async function fetchHistoricalContext(signal?: AbortSignal): Promise<HistoricalWeather> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  Object.entries({ latitude: '20.70', longitude: '77.00', start_date: '2024-06-14', end_date: '2024-06-30',
    daily: 'precipitation_sum,temperature_2m_max', timezone: 'Asia/Kolkata', precipitation_unit: 'mm', temperature_unit: 'celsius' })
    .forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) throw new Error(`Weather API HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Weather response invalid');
  const x = data as Record<string, unknown>;
  const daily = x.daily as Record<string, unknown> | undefined;
  const units = x.daily_units as Record<string, unknown> | undefined;
  if (x.timezone !== 'Asia/Kolkata' || units?.precipitation_sum !== 'mm' || units?.temperature_2m_max !== '°C' || !daily ||
      !Array.isArray(daily.time) || !Array.isArray(daily.precipitation_sum) || !Array.isArray(daily.temperature_2m_max)) {
    throw new Error('Unexpected timezone, units, or daily arrays');
  }
  const { time, precipitation_sum: precipitation, temperature_2m_max: maxTemp } = daily;
  if (time.length !== precipitation.length || time.length !== maxTemp.length || time.length === 0) throw new Error('Unaligned weather arrays');
  const days: HistoricalDay[] = time.map((date: unknown, i: number) => {
    const p = precipitation[i]; const t = maxTemp[i];
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof p !== 'number' || typeof t !== 'number' ||
        !Number.isFinite(p) || !Number.isFinite(t) || p < 0) throw new Error('Missing or invalid historical values');
    return { date, precipitationMm: p, maxTempC: t };
  });
  return { days, fetchedAt: new Date().toISOString(), sourceUrl: url.toString(), timezone: x.timezone as string };
}
