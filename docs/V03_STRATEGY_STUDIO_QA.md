# SeedHedge v0.3 — Focused Strategy Studio Update

## Scope: exactly four improvements

1. **Interactive strategy choice:** explicit quick-choice cards, functional strategy dropdown, ten-percent split-allocation slider, keyboard-accessible row buttons, and dynamic 95-candidate exploration from five dates. Choosing a strategy **does not override** the weather-first, lowest-cost recommendation.
2. **Transparent weather screening:** show selected candidate's worst historical modeled index, all historical analog scenarios, experimental cutoff, history provenance, original daily inputs per year/date, and explicit uncertainty. A scenario with missing data remains unknown. The model does **not** claim agronomic safety.
3. **Side-by-side tradeoffs:** automatically recommended vs selected alternative with cost, weather verdict, maximum modeled exposure, difference explanation, and actual itemized cost components from editable local rates.
4. **Desktop/mobile browser QA:** Chromium Playwright Python smoke tests using reproducible API mocks, covering strategy selection, slider, region request, local cost recalculation, weather API failure, explanation panels, and mobile navigation. New `.github/workflows/browser-qa.yml` runs on pull requests or manually. Automated browser QA remains **pending actual GitHub workflow execution** until reported PASS.

## Evidence integrity

- v0.3 corrects a pre-existing bug: synthetic demo fixture had no entries for the selectable June 20 or 24 dates, causing unknown results for those allocations. These values are **fake sample indices** and are **never** presented as real weather.
- Historical reanalysis comes from Open-Meteo for 2022–2025; it is **retrospective**, not a previously issued weather forecast.
- Climate-exposure weights, prior-rain window and 0.60 cutoff are **unvalidated heuristics**. All 'acceptable' labels refer only to the prototype screening model.
- Region selection remains limited to four Maharashtra examples. Soybean Kharif remains the only supported pilot. No farmer budget field is introduced.
- No additional database provisioning, ML training or conversational AI is performed in this update.

## Installation / contribution

Work from the actual repository directory (the directory with `package.json` and its own `.git`, not an extracted update folder).

```powershell
cd "C:\Users\Chaitany\OneDrive\Pictures\Downloads\SeedHedge-starter-v0.1\SeedHedge"
git rev-parse --show-toplevel
git status --short --branch
git switch main
git pull --ff-only origin main
git switch -c feat/strategy-studio-v03
# Extract the update ZIP into this current directory, overwriting only the packaged files.
npm ci
npm test
npm run build
npm run dev
```

Then locally verify five controls (region, strategy card, allocation slider, cost rate, weather mode). Push the feature branch and open a PR. Do not merge until CI and Vercel preview checks pass; keep public `main` unchanged until authorized.

## Browser QA

Browser QA is **automated but not yet verified** on a deployed instance in the packaging environment.

The PR workflow installs Chromium and runs `python tests/browser_smoke.py` against Vite with deterministic, explicitly **mocked** Open-Meteo responses. It does **not** validate live API access or scientific accuracy.

For manual local use (Node and Python installed):

1. Run `npm run dev` in one terminal.
2. In another: `pip install playwright==1.56.0; python -m playwright install chromium; python tests/browser_smoke.py`.
3. For real external API verification, manually inspect the Vercel preview in browser, switch the region, wait for the Open-Meteo archive and forecast fetches, inspect provenance and errors, and confirm the site remains responsive on 390px and 1440px widths.

## Acceptance criteria

- [ ] `npm ci` passes on target machine.
- [x] 19 Node engine/insight/weather tests pass in packaging environment.
- [ ] `npm run build` passes in GitHub CI (not executed in packaging environment).
- [ ] Browser QA Chromium action passes; desktop and mobile screenshot reviewed.
- [ ] Strategy slider and cards visibly change selection without changing winner unless weather or cost inputs change.
- [ ] Real API data or explicit failure visible; no fabricated substitute.
- [ ] Public preview verifies selected vs recommended and scientific disclosures.
- [ ] Separate owner authorization before merge and production deployment.
