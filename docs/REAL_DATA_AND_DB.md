# SeedHedge v0.2 — real-weather historical replay + optional PostgreSQL

## Implemented
- Four functional **Maharashtra region** selectors (Akola, Jalna, Nagpur, Pune) with real Open-Meteo archive API lat/lon requests.
- Current near-term (7-day) Open-Meteo Forecast API is shown as **separate context**, never conflated with historical replay.
- Actual strategy-exploration selector changes the farm visualization and chosen-strategy explanation. It does not change the auto-selected winner.
- Five selectable candidate dates between June 20 and July 5 **2024**, with dynamic single-date and two-date allocations (not a fixed number of strategies).
- Historical replay uses **four separate reanalysis year series, 2022–2025**. They are counterfactual analogs aligned on month/day to the 2024 planting candidates, NOT original forecasts issued in 2024.
- Missing, invalid, unaligned or failed API data yields no historical weather recommendation. The alternate synthetic demo mode is explicit.
- Editable seed, labor, machinery, and visit rates retained; **no budget input**.
- Optional read-only Supabase PostgreSQL cost-reference integration; not enabled without project credentials.

## Scientific limitations — critical
- ICAR-NSRI recommends waiting until monsoon onset / approximately **100 mm prior rain** before soybean sowing. We approximate prior rainfall with a **14-day** running window in historical reanalysis; the advisory does not endorse that exact window.
- Three-day heavy-rainfall threshold (85 mm), heat threshold (36 °C), component weights, and overall 0.60 strategy cutoff are **experimental design choices, NOT agronomic thresholds**.
- A model verdict of `acceptable` is **not a real-world safety statement**, yield/loss forecast, or a validated crop recommendation.
- Model uses historical reanalysis retrospectively. It is **not predictive** until a genuine present/future forecast with a crop-appropriate planting window is integrated and evaluated.
- Soybean is the **only pilot crop**. The crop selector is deliberately disabled rather than allowing an unsound generic algorithm.
- This demonstration does not implement an ML model.

## Database — optional genuine cloud PostgreSQL
The default prototype does **not** have a deployed database yet. To enable it safely:
1. Create a Supabase project you control.
2. Run `supabase/schema.sql` in SQL Editor. It creates a table for publicly readable **demo cost-reference rows** and enables RLS. Browser users receive SELECT-only access; the demo browser **cannot** write rows.
3. Copy `.env.example` to `.env.local` and replace placeholders with your project URL and **public anon/publishable key only**. Never use a `service_role` key in Vite; all VITE_ variables are public.
4. Restart Vite; select a region and press **Load regional example rates from PostgreSQL**. Rates remain editable in the browser; they are not verified market prices.
5. In Vercel Project → Settings → Environment Variables, add the same public values for Preview. Redeploy Preview, verify connection, then approve Production separately.
6. No farmer accounts or private farm data are saved. Authentic per-user cloud persistence needs authentication and separate owner-scoped RLS policies; it has NOT been implemented.

## Application setup
`npm ci` → `npm test` → `npm run build` → `npm run dev`.

## Sources
- Open-Meteo Historical Weather API: https://open-meteo.com/en/docs/historical-weather-api
- ICAR-National Soybean Research Institute June 2026 advisory: https://icar-nsri.res.in/pdfdoc/Advisory2026/June%281-7%29%2C%202026.pdf

## Release gate
Do not promote production solely on successful unit tests. Verify Vercel preview build, public-access status, API responses, region-change cancellation/errors, strategy selection, responsive UI, and cost recalculation. Preserve current production until preview passes.
