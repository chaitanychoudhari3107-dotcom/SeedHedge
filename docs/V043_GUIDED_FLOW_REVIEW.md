# SeedHedge v0.4.3 — Guided Farmer Flow (review only)

## Baseline and preservation

This patch builds on **v0.4.2 Farmer-First Review** plus the **invalid date-window hotfix**. It does not alter the scientific exposure formula, economic cost formula, supported soybean crop, regions, weather provider, or the historical replay date limits. No remote repository, synced reference directory, or production deployment is changed by producing this package.

## Why there were only five dates

The previous implementation in `src/sowing-window.ts` generated at most five approximately evenly spaced dates (`ceil(windowLength / 4)`). This was a user-interface/performance decision, **not** an agronomic reason, personal farm limitation or requirement from the weather dataset. The original demonstration also contained five fixed 2024 dates; those are preserved as legacy examples where needed, **not used as a farmer-specific recommendation**.

## New date behavior

- The farmer selects a **start** and **end** between **15 June and 8 July 2024**, the supported historical replay period.
- The farmer selects a candidate interval: **every 1, 2, 3, 5 or 7 days**.
- The app generates matching candidate dates and **always includes the final selected date**; no arbitrary five-date ceiling remains.
- Default demo: **20 June–5 July 2024, every 3 days = 6 candidate dates**.
- Entire replay: **15 June–8 July, daily = 24 dates**.
- Farmer can exclude generated dates. Invalid/reversed dates block calculations; **Swap dates** preserves other inputs.
- **Both Plan A and Plan B use exactly the same included candidate list, location, weather source, and editable rates.**
- For `n` included dates, Plan B generates `n + 9*n*(n-1)/2` options (single-date plus 10%-increment two-date allocations). Six dates produce 141; 24 dates produce 2,508. For presentation performance, the technical table shows 60 rows at a time, with an explicit **Show next 60** button; the full selector still includes every modeled strategy.

The 2024 period remains a **historical teaching example** because the existing weather dataset is fixed to 1 June–10 July of each of 2022–2025, supplying 14 days before and 3 days after each candidate. The date-range control is **not** validated upcoming-season sowing advice. A genuine future-season product would need a separately reviewed forecast/time-window pipeline and agronomic logic.

## Screen sequence

1. **Your farm:** region, area, crop, historical sowing window, candidate spacing, included dates, real historical vs fictional demo mode. Editable cost rates in optional details.
2. **Check rainfall:** Plan A result and actual historical rainfall-by-date chart, plus the adjustable experimental rain rule.
3. **Compare planting days:** Plan B result and interactive split allocation, including two date selectors and farm preview. The modeled winner stays distinct from the strategy the farmer explores.
4. **Your answer:** plain-language modeled result, both plans together, estimated cost and grounded questions. Additional evidence and model details are collapsed under a judge-oriented disclosure.

A four-button progress navigation and Previous/Continue controls preserve the farm inputs. Invalid date windows prevent advancing. The mobile experience uses the same four-step layout and retains mobile navigation.

## Verification and release gate

- Run `npm test`, `npm run build`, `python tests/browser_smoke.py` (with Vite running), and `node scripts/check-live-weather.mjs akola` from the **separate review clone**, **not** the synced reference repository.
- Browser QA uses controlled weather mocks: it does **not** establish Open-Meteo production availability, relay behavior, or scientific prediction validity.
- On the real Vercel preview, check a live four-year request, invalid/partial data, Retry, source/date labels, 390px viewport, Marathi playback/stop availability, and local cost changes. Do not merge or deploy until separately authorized.
- In local Vite development, same-origin `/api/historical` Vercel functions may be unavailable; test the relay on a Vercel preview.

## Concise judging explanation

> Our older version compared five fixed dates to keep the screen simple. The new version lets the farmer choose a historical date window and how frequently to generate planting options. We show the rain evidence first, then how planting everything on one date compares with splitting the same acreage across two dates. The final page explains the modeled result and estimated costs. This uses retrospective weather and experimental rules, not a guaranteed or certified sowing forecast.
