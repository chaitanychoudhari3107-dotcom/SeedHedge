# Acceptance criteria (Release checklist)

## Engine (local validation available now)
- [x] Candidate count scales with date inputs (1, 2, 3 checked).
- [x] Allocation shares sum to 100%; no duplicate date in a strategy.
- [x] Cheaper weather-rejected strategies never win.
- [x] Under low-stress scenarios, a one-visit option wins on cost if all are acceptable.
- [x] Repeated mobilisation increases multi-visit expense.
- [x] Changing local price inputs changes computed totals.
- [x] No acceptable option => no winner.
- [x] Missing climate evidence => unknown rather than safe.
- [x] Out-of-window dates are rejected.
- [x] Invalid numbers and shares rejected.

## Browser, API and release (not yet validated)
- [ ] `npm install` completes in network-enabled environment.
- [ ] `npm run build` succeeds.
- [ ] Desktop and mobile Strategy Studio manually audited.
- [ ] Open-Meteo actual API response retrieved, timezone + units + dates checked.
- [ ] Costs update in UI on user edits; no budget field.
- [ ] All simulation labels visible and honest.
- [ ] Marathi/Hindi/English voice tested on target device, with text fallback.
- [ ] Public deployment browsable outside developer login, stable after refresh.
- [ ] Event report and separate voice-over demo video completed.

No field agronomic validation, forecast skill, adoption, financial improvement, or production-readiness certificate is claimed.
