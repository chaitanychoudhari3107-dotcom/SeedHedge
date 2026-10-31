# SeedHedge v0.3.1 — focused interaction stabilization

## Scope
- Split date and percentage editor derives values from the **active selected strategy** if it is a split. Every picker/slider change selects a corresponding real generated strategy. Disabling a candidate date clears stale selection and reverts to a valid available strategy.
- Plot cells and dynamic legend use immutable sowing-date color identities across all five dates. A single-date July 5 strategy uses the fifth date's color.
- The top strip accurately labels synthetic demo mode. Historical API loading/error indication and evidence separation remain intact.
- Chromium regression tests cover the selection-date reset, slider re-selection, single-date and split-date legend colors; previous browser test assertion case issue is corrected. The weather algorithm remains unchanged.

## Release gates
1. npm test and npm run build PASS.
2. SeedHedge Browser QA chromium PASS for the exact candidate SHA.
3. Open the Vercel preview and verify actual Open-Meteo responses by switching Akola → Jalna, that provenance matches and failures force unknown, plus desktop and mobile interaction.
4. Merge only after human approval, then certify exact published SHA and interactions on the production URL.

No database, ML, crop-extension or scientific scoring changes are authorized in this patch. The existing exposure formula remains exploratory, not agronomically validated.
