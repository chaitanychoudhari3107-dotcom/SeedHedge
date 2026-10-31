/** Restricted same-origin Vercel relay for Open-Meteo historical weather.
 * The endpoint never accepts an arbitrary upstream URL, preventing open-proxy/SSRF use. */
import { REGIONS } from '../src/regions.ts';
import { historicalUrl, REPLAY_YEARS } from '../src/weather.ts';

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const region = REGIONS.find(r => r.id === params.get('region'));
  const rawYear = params.get('year');
  const year = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : NaN;
  if (!region || !REPLAY_YEARS.includes(year)) {
    return Response.json({error: 'Unsupported region/year'}, {status: 400, headers: {'Cache-Control':'no-store'}});
  }
  try {
    const response = await fetch(historicalUrl(region, year), { signal: AbortSignal.timeout(16000) });
    if (!response.ok) return Response.json({error:`Upstream weather API returned HTTP ${response.status}`,year}, {status:502,headers:{'Cache-Control':'no-store'}});
    const body = await response.text();
    if (body.length > 250_000) throw new Error('Unexpectedly large historical weather response');
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || !('daily' in parsed)) throw new Error('Upstream response lacks daily data');
    return new Response(body, {status:200,headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800',
      'X-Weather-Provider':'Open-Meteo ERA5'
    }});
  } catch(e) {
    return Response.json({error:e instanceof Error?e.message:'Weather relay failed',year}, {status:502, headers:{'Cache-Control':'no-store'}});
  }
}
