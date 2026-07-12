/* Market Tactical — portfolio data layer.
   Source of truth is portfolio.json in the repository. While its
   preferGoogleSheet flag is true, the published Google Sheet (CSV) is tried
   first so the site tracks the sheet automatically, and portfolio.json is the
   fallback; set the flag to false to serve portfolio.json exclusively. */

window.MT = (function () {
  'use strict';

  var PORTFOLIO_JSON = 'portfolio.json';

  var SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSU9Z7gx7nccvXMvdgPL9ZbhVQDwYhxfEz7jL5Vxw_Hhv4tbDnBBP8XUaTLnau3AAor6b5FtYwhB5Ne/pub';
  var SUMMARY_CSV = SHEET_BASE + '?gid=422018548&single=true&output=csv';
  var DETAIL_CSV = SHEET_BASE + '?gid=1598303926&single=true&output=csv';

  var GROWTH_START = 100000;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cell = '';
    var inQuotes = false;
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

  /* "0.45%" -> 0.45 ; "1.139786683" -> 1.139786683 */
  function num(s) {
    if (s == null) return NaN;
    return parseFloat(String(s).replace(/[%,$\s]/g, ''));
  }

  /* The sheet uses both "25-Jan" and "Jan-26" — handle either order. */
  function monthLabel(raw) {
    var parts = String(raw).trim().split(/[-/ ]+/);
    if (parts.length !== 2) return String(raw);
    var a = parts[0], b = parts[1];
    var m, y;
    if (/^\d+$/.test(a)) { y = a; m = b; } else { m = a; y = b; }
    m = m.slice(0, 3);
    m = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    if (MONTHS.indexOf(m) === -1) return String(raw);
    return m + ' ' + (y.length === 2 ? y : y.slice(-2));
  }

  function parseSheetSummary(rows) {
    if (rows.length < 2) return null;
    var v = rows[1];
    var s = {
      sharpe: num(v[0]),
      information: num(v[1]),
      sortino: num(v[2]),
      beta: num(v[3]),
      alphaAnnual: num(v[5]),
      cagr: num(v[6])
    };
    for (var k in s) { if (isNaN(s[k])) return null; }
    return s;
  }

  function parseSheetDetail(rows) {
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0] || r.length < 4) continue;
      var spy = num(r[1]);
      var port = num(r[3]);
      if (isNaN(spy) || isNaN(port)) continue;
      /* SP500 column is a raw fraction (0.0233); Modified-Dietz is "%" text. */
      out.push({ label: monthLabel(r[0]), spy: spy * 100, port: port });
    }
    return out.length ? out : null;
  }

  /* portfolio.json -> internal shape */
  function parseLocalSummary(json) {
    if (!json || !json.summary) return null;
    var s = json.summary;
    var out = {
      sharpe: num(s.sharpe),
      information: num(s.informationRatio),
      sortino: num(s.sortino),
      beta: num(s.beta),
      alphaAnnual: num(s.alphaAnnualized),
      cagr: num(s.cagr)
    };
    for (var k in out) { if (isNaN(out[k])) return null; }
    return out;
  }

  function parseLocalMonthly(json) {
    if (!json || !Array.isArray(json.monthly)) return null;
    var out = [];
    json.monthly.forEach(function (m) {
      var port = num(m.portfolio);
      var spy = num(m.sp500);
      if (!m.month || isNaN(port) || isNaN(spy)) return;
      out.push({ label: monthLabel(m.month), port: port, spy: spy });
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

  /* Derived series ----------------------------------------------------- */

  function growthSeries(monthly, start) {
    var port = [start], spy = [start];
    monthly.forEach(function (m) {
      port.push(port[port.length - 1] * (1 + m.port / 100));
      spy.push(spy[spy.length - 1] * (1 + m.spy / 100));
    });
    return { labels: ['Start'].concat(monthly.map(function (m) { return m.label; })), port: port, spy: spy };
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

  function build(summary, monthly, source) {
    return {
      source: source, /* 'sheet' | 'json' */
      live: source === 'sheet',
      summary: summary,
      monthly: monthly,
      growth: growthSeries(monthly, GROWTH_START),
      growthStart: GROWTH_START,
      portCumulative: cumulativeReturn(monthly, 'port'),
      spyCumulative: cumulativeReturn(monthly, 'spy'),
      updatedLabel: lastUpdatedLabel(monthly),
      sinceLabel: monthly[0].label
    };
  }

  var promise = null;

  function getData() {
    if (promise) return promise;
    promise = fetchJson(PORTFOLIO_JSON).catch(function () { return null; }).then(function (json) {
      var localSummary = parseLocalSummary(json);
      var localMonthly = parseLocalMonthly(json);
      var preferSheet = !json || json.preferGoogleSheet !== false;

      if (!preferSheet && localSummary && localMonthly) {
        return build(localSummary, localMonthly, 'json');
      }

      return Promise.all([
        fetchCsv(SUMMARY_CSV).then(parseSheetSummary).catch(function () { return null; }),
        fetchCsv(DETAIL_CSV).then(parseSheetDetail).catch(function () { return null; })
      ]).then(function (res) {
        if (res[0] && res[1]) return build(res[0], res[1], 'sheet');
        if (localSummary && localMonthly) return build(localSummary, localMonthly, 'json');
        return null; /* nothing available — pages keep their static fallbacks */
      });
    });
    return promise;
  }

  return { getData: getData };
})();
