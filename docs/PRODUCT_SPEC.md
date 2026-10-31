# SeedHedge — authoritative product specification (v0.1)

## Mission
HACKVERSE 2026, second solution for **Predictive Climate-Smart Agriculture Planner**. SeedHedge explores **how to distribute sowing commitments across dates under climate uncertainty** and chooses the **lowest-cost strategy that passes separately defined weather/agronomic screens**. It does not perform teammate UnlockPlan's task-prerequisite checking or enumeration of minimal resource changes.

## Frozen user requirements
1. Dynamic number of candidate strategies; five was only an example.
2. Weather suitability has absolute priority. Unacceptable strategies are excluded regardless of price.
3. Weather evidence can be insufficient; do **not** call that acceptable. If no acceptable options exist, show no winner.
4. Among acceptable strategies, choose the lowest estimated sowing cost. A lone acceptable strategy is first-ranked even if expensive; never promise that it is affordable.
5. **No farmer budget input**. Cost **rates are editable** (seed price and quantity, labour, machinery per area, and repeated mobilisation per sowing visit).
6. Support single-date and split-date strategies; **do not force splitting**.
7. Farm allocation visualization, scenario comparisons and explanations must derive from actual engine results.
8. Prioritize Marathi, Hindi and English voice explanations where the device supports them. Voice cannot invent agronomic advice or numbers; it reads computed outputs.
9. Premium responsive product appearance, accessible control labels, honest empty/error states.

## Pilot
Maharashtra, soybean Kharif, Akola example. Because the demo is being built in late October, the soybean planting workflow is explicitly historical/simulated—not a present-day sowing recommendation.

## Scientific gate
Current fixture has **synthetic normalized exposure indices and a developer-chosen acceptance threshold (0.60)**. The fixture establishes algorithm functionality only. It does **not** substantiate any particular sowing date, failure rate, yield, or loss avoidance. The candidate window is also an unvalidated demo list. Real farm recommendations require authoritative crop-specific rules, local fit, uncertainty evaluation, and expert validation.

- Historical weather reanalysis, when available, appears in a **separate evidence-context panel** and is **not secretly converted** into crop-safety classifications.
- Source labels distinguish synthetic, historic reanalysis, actual forecasts, farmer reports, and unknown.
- The risk index is not a likelihood of failure, insured loss, or a model calibrated to actual crop outcomes.

## Decision rule
1. Build valid one- or two-visit allocation candidates from available dates, excluding duplicate dates and zero-share visits.
2. Stage A: reject any candidate using a date outside the configured approved demo windows.
3. Stage B: under each provided scenario, calculate weighted exposure of the full allocation. Reject if the maximum exceeds the configured limit. If evidence is missing, classify as unknown instead.
4. Stage C: calculate seed + labour + machinery + per-visit cost for each candidate; cost does not rehabilitate a rejected strategy.
5. Rank acceptable options by total cost, then modeled exposure, then fewer visits, then deterministic ID.
6. Explain winner and alternatives; never imply split sowing always beats a single date.

### Why whole-strategy screening matters
If individual acceptable dates are screened and only cost breaks the tie, single-date sowing usually wins because splitting adds mobilisation expenses. Modeling **exposure across the whole allocation** allows a split plan to pass a robust scenario constraint that neither single-date strategy passes; this is a *hypothesis requiring agronomic validation*.

## MVP release gates
- Pure engine tests PASS.
- Browser UI renders and all controls respond on desktop/mobile.
- Weather endpoint returns valid data, or explicit "unavailable" is shown.
- Local rates change computed totals.
- Unsafe cheapest strategy rejected; no-safe state honest.
- No unsupported real-world safety/yield claims.
- Public deployment and voice playback require independent verification; neither is certified merely because code exists.
