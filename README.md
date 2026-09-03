# Market-Tactical-Website

My professional financial portfolio website — [markettactical.com](https://markettactical.com)

## How it works

Pure static HTML/CSS/JS (no build step) — deploys straight to GitHub Pages.

- `index.html` — home: animated hero, live headline stats, about section
- `market.html` — live markets dashboard (self-updating TradingView widgets)
- `portfolio.html` — interactive performance charts, risk metrics, monthly data table
- `assets/css/style.css` — shared styles (dark theme default, light theme via toggle)
- `portfolio.json` — the portfolio data file (monthly portfolio / S&P 500 total-return / risk-free returns)
- `assets/js/data.js` — loads portfolio.json (and the Google Sheet detail tab while preferGoogleSheet is true; the record reaching a later month wins) and computes every summary metric from the monthly series
- `assets/js/main.js` — nav, theme toggle, scroll reveal, hero animation, counters
- `assets/js/portfolio.js` — Chart.js charts, metric cards, data table
- `assets/js/markets.js` — TradingView widget embeds (ticker, overview, heatmap, news)

## Updating the numbers

Two options:

1. **Google Sheet (default)** — update the sheet as usual; the site fetches the
   published CSV on every page load. Refresh `portfolio.json` occasionally so
   the fallback stays current.
2. **portfolio.json only** — set `"preferGoogleSheet": false` in
   `portfolio.json` and edit that file each month (add a row to `monthly`).
   The site then serves it exclusively.

Summary metrics (CAGR, Sharpe, Sortino, information ratio, beta, alpha, max
drawdown) are never entered by hand — they are computed in the browser from
the monthly rows, using the methodology documented on the portfolio page.

If the sheet layout changes (column order or new tabs), update the parsing in
`assets/js/data.js`.
