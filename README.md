# SeedHedge 🌱
**HACKVERSE 2026 · Predictive Climate-Smart Agriculture Planner · Independent Solution 2**

SeedHedge is a **weather-first, cost-second planting strategy explorer**, distinct from teammate **UnlockPlan** (agricultural task feasibility and minimal resource changes). SeedHedge compares how farmland may be allocated across sowing dates. It screens candidate whole-farm strategies against declared weather assumptions and recommends the *least expensive acceptable* strategy, without asking farmers for a budget or forcing split sowing.

## Run

Requires Node.js 22.12+ and network access to install dependencies.

```bash
npm install
npm run dev
npm test
npm run build
```

The UI includes a premium Strategy Studio, dynamic candidate generation, adjustable rates, transparent ranking, historical Open-Meteo data context (subject to API access), and browser-native English/Hindi/Marathi speech synthesis where voices are installed.

**Important:** This is a **v0.1 working-source prototype**. The hazard indices and screening limit are synthetic software fixtures; they are **not** validated crop rules or crop-failure probabilities. Historical weather is shown separately and does **not** silently certify the mock risk engine. It is not real-world agricultural advice.

See [Product specification](docs/PRODUCT_SPEC.md), [Architecture and three-chat handoff](docs/ARCHITECTURE.md), [Acceptance tests](docs/ACCEPTANCE_TESTS.md), and [UI/UX handoff](docs/DESIGN_HANDOFF.md).

## GitHub collaboration
The intended repository is `chaitanychoudhari3107-dotcom/SeedHedge`. A repository write was attempted through the connected GitHub integration but returned **403 Resource not accessible by integration**. These files were therefore prepared as a local downloadable starter, **not committed or deployed**. To publish them, grant the GitHub integration Contents write access on that repository or upload/commit them through an authorized local Git client. Preserve separate branches for development and UI/UX; do not push unfinished work directly to production.
