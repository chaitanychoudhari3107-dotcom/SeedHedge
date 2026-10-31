/** Optional read-only Supabase/PostgreSQL reference-rate integration.
 * The public anon key is not a secret. SQL policy permits SELECT only on seeded demo rates.
 * Never put service-role keys or farmer PII in Vite environment variables. */
import { defaultRates, type CostRates } from './engine.ts';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const databaseConfigured = Boolean(url && anonKey);
export type SavedRateExample = { region_id: string; crop_id: string; rates: CostRates; note: string; updated_at: string };
export async function fetchReferenceRates(regionId: string, signal?: AbortSignal): Promise<SavedRateExample | null> {
  if (!databaseConfigured) return null;
  if (!/^[a-z0-9_-]+$/.test(regionId)) throw new Error('Invalid region');
  const endpoint = new URL(`${url!.replace(/\/$/, '')}/rest/v1/seedhedge_demo_rates`);
  endpoint.searchParams.set('select', 'region_id,crop_id,rates,note,updated_at');
  endpoint.searchParams.set('region_id', `eq.${regionId}`);
  endpoint.searchParams.set('crop_id', 'eq.soybean');
  endpoint.searchParams.set('limit', '1');
  const response = await fetch(endpoint.toString(), { signal, headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey!}` } });
  if (!response.ok) throw new Error(`Database request failed: HTTP ${response.status}`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0] as SavedRateExample;
  if (!row || !row.rates || Object.keys(defaultRates).some(key => { const v = row.rates[key as keyof CostRates]; return typeof v !== 'number' || !Number.isFinite(v) || v < 0; }))
    throw new Error('Database cost-rate record invalid');
  return row;
}
