# SeedHedge v0.4 update — Windows instructions

Project: `C:\Users\Chaitany\OneDrive\Pictures\Downloads\SeedHedge-starter-v0.1\SeedHedge`

The update ZIP contains **only changed/new files** laid out relative to the project root; do NOT replace your `.env` or Git history.

1. In Command Prompt:

```cmd
cd /d "C:\Users\Chaitany\OneDrive\Pictures\Downloads\SeedHedge-starter-v0.1\SeedHedge"
git status --short
git switch main
git pull --ff-only origin main
git switch -c feat/v04-dual-approach-weather
```

If status is not empty, preserve or commit your changes first. If branch exists already, `git switch feat/v04-dual-approach-weather`.

2. Save `SeedHedge-v0.4-dual-approach-update.zip` in `C:\Users\Chaitany\OneDrive\Pictures\Downloads\` and extract:

```cmd
powershell -NoProfile -Command "Expand-Archive -LiteralPath 'C:\Users\Chaitany\OneDrive\Pictures\Downloads\SeedHedge-v0.4-dual-approach-update.zip' -DestinationPath '.' -Force"
```

3. Verify (the new same-origin `/api/historical` fallback is available on Vercel deployments, not necessarily on the plain local Vite development server):

```cmd
npm test
npm run build
node scripts/check-live-weather.mjs akola
npm run dev
```

The live diagnostic requires internet access and may legitimately fail when the external API is unavailable. Never represent synthetic data as live. For local UI, open `http://localhost:5173/#studio`.

4. If tests/build pass, review exact diff and push branch:

```cmd
git status --short
git add src/App.tsx src/styles.css src/weather.ts src/approaches.ts api/historical.ts tests/approaches.test.ts tests/weather-retry.test.ts tests/historical-relay.test.ts tests/browser_smoke.py docs/V04_DUAL_APPROACH_REPORT.md docs/V04_DEMO_VIDEO_SCRIPT.md docs/V04_WINDOWS_INSTALL.md scripts/check-live-weather.mjs
git diff --cached --stat
git commit -m "feat: add dual-approach sowing comparison and resilient historical weather diagnostics"
git push -u origin feat/v04-dual-approach-weather
```

5. Create a PR to `main`, wait for all CI/Chromium checks, inspect Vercel preview with actual API requests (not only mocks), and **do not merge until preview verification**.
