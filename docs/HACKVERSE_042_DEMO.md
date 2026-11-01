# SeedHedge — honest 90-second HackVerse judging demo (v0.4.2)

## 0–15 seconds — the problem
A small soybean farmer must decide **when and whether to plant all at once** while monsoon rainfall is uncertain. Generic date lists ignore their location, chosen window and local sowing charges. SeedHedge compares two transparent prototype rules; it is **not certified agronomic advice**.

## 15–35 seconds — the farmer's inputs
Open **Your farm and dates**. Select Akola, 2 acres, soybean (the only supported crop), and set the replay window to **20 June–5 July 2024**. Explain that you chose the window and **the app generated** up to five candidate dates within it. Edit one labour or mobilisation rate to show costs responding. Dates are historical replay examples: **we are not claiming to predict the next season**.

## 35–60 seconds — the comparison
Open **Plan A vs Plan B**. Plan A looks at rain in the 14 days preceding each candidate, and asks if the experimental minimum was met in each of four historical years. Plan B scores the same dates against historical rain/heat scenarios, then ranks modeled-acceptable allocations by estimated cost. All years are retrospective ERA5 reanalysis from Open-Meteo; outcomes are not forecasts available to a farmer in 2024. If a plan has no qualifying option, say so. Expand **For judges: formulas, assumptions and weather sources** to show provenance and the unvalidated weights.

## 60–75 seconds — the explanation
Point to the main answer, estimated cost, and **Ask about your result**. Ask “Why Plan A?” and “How is cost calculated?” The helper answers from the current screen. It is intentionally a **rule-based, offline, grounded Q&A panel**, not a cloud-powered generative AI chatbot. Show that the Marathi explanation always remains readable; audio is optional and only available with an installed matching Marathi voice.

## 75–90 seconds — prove failure handling
If weather has loaded, press **Retry real weather** after showing current provenance. For a *controlled* failure demonstration, use browser DevTools Network tab to block `archive-api.open-meteo.com` and `/api/historical` (or set offline), then Retry. Describe the **loading → partial/unavailable → retry** states. The app must **not** present a real-data recommendation from incomplete weather. Deliberately switch to **Synthetic UI demo only**, show the fictional label and Stress/Stable difference, and clearly state **“These values are invented for demonstration, not live observations.”**

## What judges should hear
- **One farmer input, two methods, same data and local rates.** No farmer budget required.
- Plan A and B are **experimental methods**, not a proven way to prevent crop loss or guarantee harvest.
- Weather source: **Open-Meteo ERA5 reanalysis, 2022–2025**, downloaded for the selected region; current 7-day forecast is displayed separately and does not drive the historical decision.
- In the demo, the **sowing window is selected by the farmer**; candidate dates are **generated automatically**. The sample window is historical, not a verified personalized future sowing schedule.
- Failures and unavailable Marathi voices are reported rather than disguised.

## Strict release claims
Do not claim live API uptime, public deployment certification, mobile/browser certification, scientific validation, future yield prediction or Marathi audio support unless tested independently in the actual target environment. Do not merge/deploy this patch without separate authorization.
