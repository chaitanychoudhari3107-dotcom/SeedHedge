# SeedHedge v0.4.2 — Source inspection, changes and release checklist

**Original source basis:** public GitHub repository `chaitanychoudhari3107-dotcom/SeedHedge`, `main` SHA `1ba3032f2a499d9a53660f11abc4831229df2d24`. This package was authored in a separate local working copy. No GitHub commits, reference-file changes, or deployments were performed by the authoring session.

## Current implementation before this patch
- `src/weather.ts`: `SOWING_DATES` was a constant five-day list in June/July **2024**, and archive requests were fixed to June 1–July 10 for replay years **2022–2025**. `historicalUrl` generates an Open-Meteo ERA5 request from region coordinates. `fetchHistoricalYear` checks HTTP status, time-zone, units, 40-day arrays, and values. `fetchWithRetry` previously had **no per-attempt timeout**. It uses a Vercel `/api/historical` relay for certain network or server errors, but the local Vite server cannot run that function by itself. `fetchHistoricalReplay` requires complete four-year evidence.
- `src/App.tsx`: controlled `enabledDates` and permitted `approvedDates` directly from `SOWING_DATES`. Changing region refetched the four historical records, but changing sowing dates did not generate new dates or re-evaluate weather for them. Weather formulas include prior-14-day rain, future 3-day rain, and temperature: historical **counterfactual**, not live prediction.
- `src/approaches.ts`: Plan A uses the earliest candidate passing preceding rainfall in *all* historical years; Plan B evaluates single/split allocations with `src/engine.ts`. Both use the same farm area and editable per-acre/per-visit rates. We did not modify their decision mathematics.
- `src/App.tsx`: “SeedHedge Voice” did only `speechSynthesis.speak`. There was no chatbot input, chat request, chat history, or remote LLM. Browser support and Marathi voice availability were not checked before enabling playback.
- `src/DecisionDashboard.tsx`: useful scientific trace existed but was presented as technical detail, and partial-year errors were not a distinct state.

## Patch details
- `src/sowing-window.ts`: explicit farmer-chosen start/end, strict date validation, **up to five** generated candidates including both endpoints; bounds **2024-06-15 through 2024-07-08**, so each candidate has sufficient prior 14-day and following 3-day observations in the existing **June 1–July 10** ERA5 request. The original June 20–July 5 period survives only as a clearly labeled *Demo example* preset. This is deliberately **not** arbitrary future-year sowing advice.
- `src/weather.ts`: `replayForDates` recalculates all historical scenario indices and Plan A diagnostics from the **same already-fetched four year series** when the farmer changes candidate dates. Date changes do not call the network again. Each network attempt has an eight-second timeout, plus the existing bounded retry/relay policy. Incomplete-year errors report which years loaded and **never** provide a partial-year recommendation.
- `src/fixtures.ts`: the synthetic Stress/Stable modes interpolate **fictional** values for new dates from existing fictional examples and label them accordingly. No invented weather is substituted for historical data.
- `src/App.tsx`: input setup before detailed comparison; main answer first; dynamic date controls; error recovery preserves inputs; partial/loading/error labels; live seven-day forecast remains separate and does not affect historic plans; cost settings remain adjustable with no budget input.
- `src/help.ts` + `src/FarmHelp.tsx`: deterministic on-screen Q&A, using current farm inputs, rates, mode, and model outcomes. This is **not a remotely hosted generative chatbot**. It explicitly declines questions beyond available evidence and clears old answers when inputs change.
- `src/VoiceExplainer.tsx`: readable English/Marathi/Hindi explanation always on screen; attempts audio **only** if the browser exposes a matching installed voice; play, stop, error feedback, and speech synthesis cleanup.
- `src/DecisionDashboard.tsx` + styles: wording is less technical and distinguishes loaded, partial, unavailable, and fictional states. Detailed formula and provenance remain in an expandable panel.
- Tests: `tests/sowing-window.test.ts`, `tests/help.test.ts`, `tests/replay-failure.test.ts`, extended Chromium smoke cases for date range, message grounding, partial years, and Marathi text availability.

## Confirmed verification in isolated authoring environment
- **41/41 Node.js unit tests passed** (`npm test`, Node 22.16.0) including new candidate generation and grounded helper tests.
- Strict `tsc` check passed for pure analytical TypeScript modules (weather, dates, engine, approaches, helper, etc.).
- TypeScript JSX `transpileModule` returned **zero syntax diagnostics** for App, DecisionDashboard, FarmHelp and VoiceExplainer.
- Python browser test source parsed successfully, but a running Vite/React bundle and real Chromium UI session **were not available** in the authoring environment. **Do not mark Chromium PASS**.
- `npm run build` in the isolated authoring environment could not complete because React and Vite dependencies were not installed and package registry/network access was unavailable. **Do not mark full build PASS**.
- Web access confirmed Open-Meteo's historical archive documents `models=era5`, timezone and daily variables, and Vercel documents `api/*.ts` method-export functions, but **no real Open-Meteo JSON response or public Vercel API response was verified**. Root cause of the reported intermittent failure remains undetermined without browser network traces or server logs.

## Local review workflow (do not change OneDrive synced reference project)
Create a **separate** clone outside OneDrive on Windows:

```cmd
mkdir "C:\Users\Chaitany\Projects"
cd /d "C:\Users\Chaitany\Projects"
git clone https://github.com/chaitanychoudhari3107-dotcom/SeedHedge.git SeedHedge-judge-review
cd /d "C:\Users\Chaitany\Projects\SeedHedge-judge-review"
git switch -c review/farmer-first-v042
```

Place the downloaded ZIP at `C:\Users\Chaitany\Downloads\SeedHedge-v0.4.2-farmer-first-review.zip` (adapt the literal path if your browser saved elsewhere), then extract into the **separate clone**:

```cmd
powershell -NoProfile -Command "Expand-Archive -LiteralPath 'C:\Users\Chaitany\Downloads\SeedHedge-v0.4.2-farmer-first-review.zip' -DestinationPath 'C:\Users\Chaitany\Projects\SeedHedge-judge-review' -Force"
cd /d "C:\Users\Chaitany\Projects\SeedHedge-judge-review"
npm ci
npm test
npm run build
npm run dev
```

If `npm ci` reports no lockfile, run `npm install` in the **separate clone only** and then run the checks. View `http://localhost:5173/#studio`. No push, PR, merge, or deployment is implied or authorized by this document.

## Required manual/CI release gates before any future deployment
1. Real Open-Meteo historical JSON for 2022, 2023, 2024, 2025, exact region and parameters; record status, date units, response time, CORS and errors for **direct and relay routes**. Inspect browser Network tab and Vercel Function logs. Do not infer real-data success from unit mocks.
2. Vite build and all Node tests PASS on actual new source files.
3. Desktop and 390px-mobile Chromium smoke tests PASS; verify date changes update **both** plans and chart, no dates appear outside window, no result during loading/partial failure, cost changes reflect every extra visit, chat send/keyboard and Marathi text work.
4. Actual target-browser `speechSynthesis` voice list includes a `mr-IN` voice and playback tested with human listening **before** claiming Marathi voice audio works. The feature must remain text-usable without a voice.
5. Manual Vercel Preview API and dashboard validation on exact candidate SHA **only when separately authorized**. Production release and merge require separate authorization. No synced reference files overwritten.
6. Scientific scope remains experimental; independent agronomic validation is still necessary for field-level sowing advice. We have not implemented a live future-season recommendation from current forecasts.

## Failure investigation notes
- Validated request structure in source: Open-Meteo archive `/v1/archive`, coordinates from the selected region, `start_date=YYYY-06-01`, `end_date=YYYY-07-10`, `daily=precipitation_sum,temperature_2m_max`, `models=era5`, `timezone=Asia/Kolkata`.
- Potential runtime failure categories: blocked/CORS or unavailable direct API, 429/rate limit, upstream 5xx, slow/no response, same-origin relay missing or failing, data-unit mismatch, partial daily values. These are **hypotheses until reproduced**. The local Vite server cannot execute the Vercel relay without a compatible dev server.
- The existing relay may return CDN-cached historical values by design and should not be called a "live forecast". Its source is ERA5 reanalysis, with a separate retrieval timestamp.
