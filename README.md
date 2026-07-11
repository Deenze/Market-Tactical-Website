# Market-Tactical-Website

My professional financial portfolio website — [markettactical.com](https://markettactical.com)

## How it works

Pure static HTML/CSS/JS (no build step) — deploys straight to GitHub Pages.

- `index.html` — home: animated hero, live headline stats, about section
- `market.html` — market outlook posts and investment approach
- `portfolio.html` — interactive performance charts, risk metrics, monthly data table
- `assets/css/style.css` — shared styles (dark theme default, light theme via toggle)
- `assets/js/data.js` — fetches live data from the published Google Sheet (CSV) with an embedded fallback
- `assets/js/main.js` — nav, theme toggle, scroll reveal, hero animation, counters
- `assets/js/portfolio.js` — Chart.js charts, metric cards, data table

## Updating the numbers

Just update the Google Sheet. The site fetches the published CSV on every page
load, so metrics, charts, and the "updated through" date refresh automatically.
If the sheet layout changes (column order or new tabs), update the parsing and
fallback data in `assets/js/data.js`.
