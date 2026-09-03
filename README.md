# Market-Tactical-Website

My professional financial portfolio website — [markettactical.com](https://markettactical.com)

## How it works

Pure static HTML/CSS/JS (no build step) — deploys straight to GitHub Pages.

- `index.html` — home: animated hero, live headline stats, about section
- `market.html` — live markets dashboard (self-updating TradingView widgets)
- `portfolio.html` — interactive performance charts, risk metrics, monthly data table
- `assets/css/style.css` — shared styles (dark theme default, light theme via toggle)
- `portfolio.json` — the portfolio data file (summary metrics + monthly returns)
- `assets/js/data.js` — loads portfolio.json; while its preferGoogleSheet flag is true, the published Google Sheet (CSV) is fetched too and whichever record reaches a later month is used
- `assets/js/main.js` — nav, theme toggle, scroll reveal, hero animation, counters
- `assets/js/portfolio.js` — Chart.js charts, metric cards, data table
- `assets/js/markets.js` — TradingView widget embeds (ticker, overview, heatmap, news)

## Updating the numbers

Two options:

1. **Google Sheet (default)** — update the sheet as usual; the site fetches the
   published CSV on every page load. Refresh `portfolio.json` occasionally so
   the fallback stays current.
2. **portfolio.json only** — set `"preferGoogleSheet": false` in
   `portfolio.json` and edit that file each month (add a row to `monthly`,
   update `summary`). The site then serves it exclusively.

If the sheet layout changes (column order or new tabs), update the parsing in
`assets/js/data.js`.
