# Architecture and workstream ownership

**Stack:** React 19 + TypeScript + Vite, custom CSS (temporary UI foundation); browser-local persistence; Node 22 native TypeScript-strip tests. No backend database or trained ML is necessary for the bounded MVP. A design workstream may introduce Tailwind/shadcn later only after preserving engine tests and responsive behavior.

## Boundary contracts
- `src/engine.ts`: pure functions and types (`CostRates`, `HazardScenario`, `SowingAllocation`, `Strategy`, `analyze`). **Owns** candidate generation, weather-state classification, costs and ranking. Must never call a speech or generative AI service.
- `src/fixtures.ts`: **synthetic** demonstration scenarios with explicit limitations. Never advertise as genuine weather.
- `src/weather.ts`: real historical Open-Meteo daily data (`HistoricalWeather`) and validation. It does not currently feed the hazard screening. No fabricated fallback weather.
- `src/App.tsx`: orchestration of input controls and results; experimental voice synthesis reads *computed* summaries, not free-form recommendations.
- `src/styles.css`: responsive theme and layout; can be redesigned independently while keeping accessible semantics.
- `tests/engine.test.ts`: invariants, negative cases and weather-before-cost ranking.

## Collaboration across three chats
**Chat A (product/science)** owns `docs/*`, future crop-rule provenance, acceptance criteria, model validity, and contracts. No code rewrites without an agreed contract revision.

**Chat B (build/testing/deploy)** owns `src/engine.ts`, `src/weather.ts`, tests, package tooling and deployment. Locks behavior behind tests.

**Chat C (UI/UX)** owns `src/App.tsx`, `src/styles.css`, interaction documentation and accessibility after Chat B freezes exported domain contracts. Do not overwrite files concurrently; distinct PRs and narrow file ownership.

## Integration strategy
1. Agree on contract in docs.
2. Build work in isolated branches; don't deploy unverified code.
3. Preserve tests, validate each integration candidate, review UI and science statements.
4. Merge only an explicitly approved, working candidate.
5. Public URL, weather response, and multilingual speech must be separately verified on the deployed version.

## Weather data path
`https://archive-api.open-meteo.com/v1/archive` with Akola approximate coordinates, date interval, daily `precipitation_sum` and `temperature_2m_max`, timezone `Asia/Kolkata`; unit and array alignment are checked. Use the original source URL and UTC retrieval timestamp in UI. This is historical reanalysis, **not** a retrospective issued forecast or field measurement.

## Operational cautions
- Browser speech voices vary by installed platform; Marathi/Hindi playback is not universally available.
- No secrets or API tokens in frontend source.
- Cost rates are demo estimates unless edited by a user; storage is browser-local.
- The 0.60 screening limit and fixture indices are NOT sourced agricultural science.
