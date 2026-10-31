# UI/UX handoff

Product should look premium and approachable, not a bank-style analytics wall or a generic farming chatbot.

**Concept:** an agricultural strategy laboratory with warm ivory surfaces, forest-green type, sage fields, optional muted gold and jade accents. Clear hierarchy, generous spacing, dignified mobile experience.

## Primary screen
1. Summary of selected pilot farm and historical-demo notice.
2. Three concise statistics: strategies generated, acceptable, cheapest acceptable.
3. Configuration panel, interactive allocation grid, and computed decision explanation.
4. Strategy comparison table including rejected options **with explanations** and estimated costs.
5. Editable rate settings and separate historical-data provenance view.
6. Regional-language spoken explanation, only as enhancement; text always accessible.

## Critical visual behavior
- Clear distinction: acceptable under *configured model* ≠ agronomically safe in the real world.
- Risk/exposure bars or values must not be represented as probabilities of loss.
- Changing simulation mode must alter evaluation results; never animate a hardcoded winner.
- Clicking a losing strategy may preview it, but it must not mutate the official recommendation.
- Units, currency, visit counts, and evidence status should be evident.
- No dark-pattern controls or invented market prices, weather alerts or savings claims.

## UI acceptance
Keyboard navigation, sufficient text contrast, 320–1440px layouts, visible focus indicators, loading/error/no-data state, reduced motion support where animated components are added.
