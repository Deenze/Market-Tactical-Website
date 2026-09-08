# Market-Tactical-Website

My professional financial portfolio website: [markettactical.com](https://markettactical.com)

## How it works

Pure static HTML/CSS/JS (no build step). Deploys straight to GitHub Pages.

- `index.html`: home: animated hero, live headline stats, about section
- `market.html`: live markets dashboard (self-updating TradingView widgets)
- `portfolio.html`: interactive performance charts, risk metrics, monthly data table
- `assets/css/style.css`: shared styles (dark theme default, light theme via toggle)
- `portfolio.json`: offline fallback for the monthly series and the home of the Nasdaq 100 (QQQ) comparison column
- `assets/js/data.js`: reads the Google Sheet live (tabs All data, Metrics, Rolling 12m) through its CSV endpoint, merges the Nasdaq column from portfolio.json, and falls back to portfolio.json if the sheet is unreachable
- `assets/js/main.js`: nav, theme toggle, scroll reveal, hero animation, counters
- `assets/js/portfolio.js`: Chart.js charts, metric cards, data table
- `assets/js/markets.js`: TradingView widget embeds (ticker, overview, heatmap, news)

## Updating the numbers

Edit the Google Sheet (the "All data" tab, blue cells only: month label,
S&P price return, dividend yield, risk-free rate, Modified-Dietz return) and
drag the formula columns down one row. The site reads the sheet on every page
load, so the cards, charts, tables and the full metrics table update by
themselves. Add the month's QQQ return to `portfolio.json` so the Nasdaq 100
line keeps up.

Every statistic shown on the site is computed by the sheet's own formulas on
the "Metrics" tab; the site displays them and never recomputes them, except
in offline-fallback mode where it computes the headline cards from
`portfolio.json` with the same conventions.

The parser finds columns by header text and reads Metrics rows by label, so
adding rows or reordering columns in the sheet does not require code changes;
renaming a headline metric label does (see `summaryFromMetrics` in
`assets/js/data.js`).
