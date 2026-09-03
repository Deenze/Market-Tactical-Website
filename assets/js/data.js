/* Market Tactical: portfolio data layer.

   Monthly returns come from portfolio.json in this repository and/or the
   published Google Sheet (detail tab). When both load, whichever reaches a
   later month is used (tie -> sheet); set "preferGoogleSheet": false in
   portfolio.json to use the file exclusively.

   Every summary metric on the site (CAGR, Sharpe, Sortino, information
   ratio, beta, alpha, max drawdown) is computed HERE from that monthly
   series with one documented methodology (see "Methodology" on the
   portfolio page). Nothing is read from a summary tab, so the metric cards,
   charts and the monthly table can never disagree with each other. */

window.MT = (function () {
  'use strict';

  var PORTFOLIO_JSON = 'portfolio.json';
  var SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSU9Z7gx7nccvXMvdgPL9ZbhVQDwYhxfEz7jL5Vxw_Hhv4tbDnBBP8XUaTLnau3AAor6b5FtYwhB5Ne/pub';
  var DETAIL_CSV = SHEET_BASE + '?gid=1598303926&single=true&output=csv';

  var GROWTH_START = 100000;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  /* ---------- parsing ---------- */

  function parseCsv(text) {
    var rows = [], row = [], cell = '', inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { cell += c; }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cell); cell = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        rows.push(row); row = [];
      } else {
        cell += c;
      }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* "0.45%" -> 0.45 ; "1.1397" -> 1.1397 */
  function num(s) {
    if (s == null) return NaN;
    return parseFloat(String(s).replace(/[%,$\s]/g, ''));
  }

  /* The sheet uses both "25-Jan" and "Jan-26": handle either order. */
  function monthLabel(raw) {
    var parts = String(raw).trim().split(/[-/ ]+/);
    if (parts.length !== 2) return String(raw);
    var a = parts[0], b = parts[1], m, y;
    if (/^\d+$/.test(a)) { y = a; m = b; } else { m = a; y = b; }
    m = m.slice(0, 3);
    m = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    if (MONTHS.indexOf(m) === -1) return String(raw);
    return m + ' ' + (y.length === 2 ? y : y.slice(-2));
  }

  /* "Aug 26" -> sortable integer; -1 if unparseable */
  function monthIndex(label) {
    var parts = String(label).split(' ');
    var m = MONTHS.indexOf(parts[0]);
    var y = parseInt(parts[1], 10);
    if (m === -1 || isNaN(y)) return -1;
    return (2000 + y) * 12 + m;
  }

  /* Sheet detail tab: Month | SP500 (fraction) | RF monthly (fraction) | Modified-Dietz (%) | ... */
  function parseSheetDetail(rows) {
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0] || r.length < 4) continue;
      var spy = num(r[1]), rf = num(r[2]), port = num(r[3]);
      if (isNaN(spy) || isNaN(port)) continue;
      out.push({ label: monthLabel(r[0]), port: port, spy: spy * 100, rf: isNaN(rf) ? 0 : rf * 100, ndx: NaN });
    }
    return out.length ? out : null;
  }

  /* portfolio.json: { monthly: [{ month, portfolio, sp500, rf }] }: all in percent */
  function parseLocalMonthly(json) {
    if (!json || !Array.isArray(json.monthly)) return null;
    var out = [];
    json.monthly.forEach(function (m) {
      var port = num(m.portfolio), spy = num(m.sp500), rf = num(m.rf), ndx = num(m.nasdaq100);
      if (!m.month || isNaN(port) || isNaN(spy)) return;
      out.push({ label: monthLabel(m.month), port: port, spy: spy, rf: isNaN(rf) ? 0 : rf, ndx: ndx });
    });
    return out.length ? out : null;
  }

  function fetchCsv(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(parseCsv);
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ---------- statistics (inputs as fractions) ---------- */

  function mean(a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return a.length ? s / a.length : NaN;
  }

  function sampleVar(a) {
    if (a.length < 2) return NaN;
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return s / (a.length - 1);
  }

  function sampleCov(a, b) {
    if (a.length < 2) return NaN;
    var ma = mean(a), mb = mean(b), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
    return s / (a.length - 1);
  }

  /* All metrics from the monthly series. Percent in, percent out. */
  function computeSummary(monthly) {
    var n = monthly.length;
    var port = monthly.map(function (m) { return m.port / 100; });
    var spy = monthly.map(function (m) { return m.spy / 100; });
    var rf = monthly.map(function (m) { return m.rf / 100; });
    var excess = port.map(function (p, i) { return p - rf[i]; });
    var active = port.map(function (p, i) { return p - spy[i]; });
    var SQ12 = Math.sqrt(12);

    var sharpe = mean(excess) / Math.sqrt(sampleVar(excess)) * SQ12;
    var information = mean(active) / Math.sqrt(sampleVar(active)) * SQ12;

    /* Sortino: downside deviation over ALL months, shortfall vs the risk-free rate */
    var dsum = 0;
    excess.forEach(function (e) { if (e < 0) dsum += e * e; });
    var downsideDev = Math.sqrt(dsum / n);
    var sortino = downsideDev > 0 ? mean(excess) / downsideDev * SQ12 : NaN;

    var beta = sampleCov(port, spy) / sampleVar(spy);
    var alphaMonthly = mean(port) - (mean(rf) + beta * (mean(spy) - mean(rf)));
    var alphaAnnual = Math.pow(1 + alphaMonthly, 12) - 1;

    /* growth, CAGR, drawdown */
    var cum = 1, peak = 1, maxDD = 0, maxDDLabel = '';
    var drawdown = [0];
    for (var i = 0; i < n; i++) {
      cum *= 1 + port[i];
      if (cum > peak) peak = cum;
      var dd = cum / peak - 1;
      drawdown.push(dd * 100);
      if (dd < maxDD) { maxDD = dd; maxDDLabel = monthly[i].label; }
    }
    var cagr = Math.pow(cum, 12 / n) - 1;

    return {
      months: n,
      sharpe: sharpe,
      information: information,
      sortino: sortino,
      beta: beta,
      alphaMonthly: alphaMonthly * 100,
      alphaAnnual: alphaAnnual * 100,
      cagr: cagr * 100,
      maxDrawdown: maxDD * 100,
      maxDrawdownMonth: maxDDLabel,
      drawdown: drawdown
    };
  }

  function growthSeries(monthly, start) {
    var port = [start], spy = [start], ndx = [start], ndxOk = true;
    monthly.forEach(function (m) {
      port.push(port[port.length - 1] * (1 + m.port / 100));
      spy.push(spy[spy.length - 1] * (1 + m.spy / 100));
      if (ndxOk && isFinite(m.ndx)) {
        ndx.push(ndx[ndx.length - 1] * (1 + m.ndx / 100));
      } else {
        ndxOk = false;
        ndx.push(null); /* comparison series stops where data is missing */
      }
    });
    return {
      labels: ['Start'].concat(monthly.map(function (m) { return m.label; })),
      port: port, spy: spy, ndx: ndx, ndxAvailable: ndxOk
    };
  }

  function cumulativeReturn(monthly, key) {
    var g = 1;
    monthly.forEach(function (m) { g *= 1 + m[key] / 100; });
    return (g - 1) * 100;
  }

  function lastUpdatedLabel(monthly) {
    var last = monthly[monthly.length - 1].label; /* e.g. "Feb 26" */
    var parts = last.split(' ');
    var idx = MONTHS.indexOf(parts[0]);
    if (idx === -1) return last;
    return MONTHS_FULL[idx] + ' 20' + parts[1];
  }

  function build(monthly, source) {
    var growth = growthSeries(monthly, GROWTH_START);
    return {
      source: source, /* 'sheet' | 'json' */
      live: source === 'sheet',
      monthly: monthly,
      summary: computeSummary(monthly),
      growth: growth,
      growthStart: GROWTH_START,
      portCumulative: cumulativeReturn(monthly, 'port'),
      spyCumulative: cumulativeReturn(monthly, 'spy'),
      ndxCumulative: growth.ndxAvailable ? cumulativeReturn(monthly, 'ndx') : null,
      updatedLabel: lastUpdatedLabel(monthly),
      sinceLabel: monthly[0].label
    };
  }

  var promise = null;

  function getData() {
    if (promise) return promise;
    promise = fetchJson(PORTFOLIO_JSON).catch(function () { return null; }).then(function (json) {
      var local = parseLocalMonthly(json);
      var preferSheet = !json || json.preferGoogleSheet !== false;

      if (!preferSheet && local) return build(local, 'json');

      return fetchCsv(DETAIL_CSV).then(parseSheetDetail).catch(function () { return null; })
        .then(function (sheet) {
          if (sheet && local) {
            /* The Nasdaq 100 comparison column lives only in portfolio.json: merge it in by month. */
            var ndxByLabel = {};
            local.forEach(function (m) { ndxByLabel[m.label] = m.ndx; });
            sheet.forEach(function (m) {
              if (!isFinite(m.ndx) && isFinite(ndxByLabel[m.label])) m.ndx = ndxByLabel[m.label];
            });
            var sheetLast = monthIndex(sheet[sheet.length - 1].label);
            var localLast = monthIndex(local[local.length - 1].label);
            return localLast > sheetLast ? build(local, 'json') : build(sheet, 'sheet');
          }
          if (sheet) return build(sheet, 'sheet');
          if (local) return build(local, 'json');
          return null; /* nothing available */
        });
    });
    return promise;
  }

  return { getData: getData, computeSummary: computeSummary };
})();
