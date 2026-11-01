# SeedHedge v0.4.4 — Six-concern resolution and judging acceptance packet

**Scope:** Applies on top of the separate v0.4.3 guided review copy. Research prototype only. No sync reference files, GitHub branches or public deployment were changed by creating this update. The existing weather-heuristic and cost formulas are preserved.

## Farmer questions answered

1. **Soybean only?** Yes, deliberately. The existing weather screen and seed-rate assumptions are soybean-specific research placeholders. Other crops remain unavailable rather than silently reusing soybean assumptions. Step 1 now explains this limitation. Adding crops requires separate agronomic rules, seed rates, datasets and tests.
2. **Why is the weather evidence selector confusing?** The 2022–2025 mode is **retrospective ERA5 data**, not an issued forecast. The second mode is a wholly invented demonstration. The previous selector existed only on Step 1, while Steps 2 and 3 did not provide visible switching. v0.4.4 adds an accessible source switch on Steps 2–4 and keeps the active source obvious. When switching to fictional mode, the app cancels active historical requests and does not fetch new real data. Plan A intentionally cannot qualify dates in fictional mode. Synthetic Stress and Stable can still change Plan B. The screenshot showing “Historical reanalysis ready” indicates a historical load succeeded in that session; it does NOT independently prove all browsers/networks always work. The root cause of intermittent API failures remains undiagnosed without failed network responses or Vercel function logs.
3. **Why does Plan A cost the same on every date?** The formula uses acres × (seed quantity × seed price + labour + machinery) + the planting visit fee. The input rates are not date-specific. v0.4.4 explicitly explains that fact, and its rainfall chart adds **actual past temperature and experimental modeled exposure per date** for comparison. No yield, profit, crop-loss probability or agronomic-safety difference is invented. Adding a yield model needs observed outcomes and scientific validation.
4. **What is “weather intelligence”?** The label is replaced by “Past weather for the dates you chose.” The first chart shows preceding 14-day rainfall for each of four replay years. The supplementary grid shows the maximum 3-day temperature and the **unvalidated modeled index**. Temperature and rain after the replay date are historical observations known only retrospectively; they were not advance forecasts.
5. **Why one visit versus split?** The result now shows the best one-date and two-date options that passed, with cost and modeled index. The explanation names the decision rule: reject modeled-unacceptable options first, then rank the rest by estimated total cost. If both pass, one visit normally costs less because an extra visit adds charges. If no one-date option passes but a split does, the app may choose two dates. This does **not** prove spreading reduces losses or improves yield.
6. **Final farm report?** A dedicated panel on Step 4 includes district and acres, actual candidate date window, crop, source state, Plan A and Plan B explanations, every generated date’s prior-14-day minimum rainfall across four years, maximum post-date 3-day temperature, maximum modeled index, yearly rainfall in an expandable table, five illustrative one-day and two-day options, input-based costs, separate current forecast context, data-source links, and limitations. **Print / Save as PDF** calls the browser print dialog; the user chooses “Save as PDF”. The report is region-level, not a farm GPS/soil measurement. When in fictional demo mode, it hides observed historical tables rather than mixing inputs.

## Sequence for the live HackVerse judging demonstration

1. Step 1: Pick Jalna or Akola, 2 acres, soybean. Show the historical replay window **20 June–5 July 2024**, candidate interval of 2 or 3 days. Emphasize this is a replay demo, not future planting advice.
2. Step 2: Read the rain chart and move the experimentally selected rainfall amount. Point out that dates may have different rainfall and historical temperature even though a one-visit cost is identical under the entered rates.
3. Step 3: Compare the best one-visit option against the best split. Demonstrate a 70%/30% allocation and explain that exploring does not override the computed winner. Mention additional visit cost and that a split only wins if the experimental screen and ranking select it.
4. Step 4: Show the farm-specific report, its source/retrieval date, yearly weather evidence and cost breakdown. Use Print / Save as PDF if needed.
5. Failure demo: Switch explicitly to **Fictional demo**, show Plan A unavailable and Stress/Stable changing Plan B. Return to historical and show Retry/error states, without suggesting fictional data are real.

## Local Windows review setup

Full, **unsynced** review directory:

`C:\Users\Chaitany\Projects\SeedHedge-judge-review`

Download the ZIP and extract it into this directory. Review the file list before overwriting. These are paths **relative to the review project**:

- `src\App.tsx`
- `src\DecisionDashboard.tsx`
- `src\FarmReport.tsx` (new)
- `src\decision-explanations.ts` (new)
- `src\help.ts`
- `src\FarmHelp.tsx`
- `src\styles.css`
- `tests\decision-explanations.test.ts` (new)
- `tests\help.test.ts`
- `tests\browser_smoke.py`
- `docs\V044_HACKVERSE_SIX_CONCERNS.md` (new)

Validation commands from the review folder:

```cmd
cd /d "C:\Users\Chaitany\Projects\SeedHedge-judge-review"
npm ci
npm test
npm run build
npm run dev
```

For browser QA, with Vite running in a first terminal, run in a second terminal:

```cmd
cd /d "C:\Users\Chaitany\Projects\SeedHedge-judge-review"
python -m playwright install chromium
python tests\browser_smoke.py
```

Browser tests use deterministic mock weather, not real API validation. To check live retrieval, run:

```cmd
cd /d "C:\Users\Chaitany\Projects\SeedHedge-judge-review"
node scripts\check-live-weather.mjs jalna
```

The Vercel `/api/historical` fallback requires a Vercel environment. Local Vite cannot certify that function. Inspect actual production function logs on a separately approved Vercel Preview. Marathi speech requires the target device's supported voices and manual verification. No merge or deployment without explicit authorization.

## Tests achieved in isolated development workspace

- 52/52 Node analytical tests PASS (including five new visit/evidence tests and two grounded Q&A tests).
- TypeScript/JSX checked with development-only React compatibility type shims. **This is not a full Vite build.**
- Python browser QA script parses; six new browser scenarios written, **not executed** in Chromium here.
- No live Open-Meteo response, Vercel relay, Marathi audio, phone/browser QA or real deployment was certified in this workspace.
