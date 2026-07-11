/* Market Tactical — portfolio data layer.
   Fetches live numbers from the published Google Sheet (CSV). If the fetch
   fails (offline, Google hiccup), the embedded fallback below is used, so the
   site never shows empty charts. Update the Google Sheet and the site follows. */

window.MT = (function () {
  'use strict';

  var SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSU9Z7gx7nccvXMvdgPL9ZbhVQDwYhxfEz7jL5Vxw_Hhv4tbDnBBP8XUaTLnau3AAor6b5FtYwhB5Ne/pub';
  var SUMMARY_CSV = SHEET_BASE + '?gid=422018548&single=true&output=csv';
  var DETAIL_CSV = SHEET_BASE + '?gid=1598303926&single=true&output=csv';

  /* Snapshot of the sheet as of Feb 2026 — used only if the live fetch fails. */
  var FALLBACK = {
    summary: {
      sharpe: 1.14,
      information: 0.99,
      sortino: 1.06,
      beta: 2.42,
      alphaAnnual: 5.4,
      cagr: 40.3
    },
    monthly: [
      { label: 'Jan 25', spy: 2.33, port: -8.25 },
      { label: 'Feb 25', spy: -0.25, port: 4.04 },
      { label: 'Mar 25', spy: -5.97, port: -16.08 },
      { label: 'Apr 25', spy: -0.51, port: 5.16 },
      { label: 'May 25', spy: 5.09, port: 20.35 },
      { label: 'Jun 25', spy: 5.23, port: 12.56 },
      { label: 'Jul 25', spy: 2.46, port: 3.43 },
      { label: 'Aug 25', spy: 2.75, port: 5.0 },
      { label: 'Sep 25', spy: 4.48, port: 10.31 },
      { label: 'Oct 25', spy: 2.63, port: 5.98 },
      { label: 'Nov 25', spy: -0.48, port: 0.3 },
      { label: 'Dec 25', spy: 0.49, port: 3.31 },
      { label: 'Jan 26', spy: 1.37, port: 2.46 },
      { label: 'Feb 26', spy: -0.9, port: -3.5 }
    ]
  };

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

  function parseSummary(rows) {
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

  function parseDetail(rows) {
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

  function fetchCsv(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(parseCsv);
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

  var promise = null;

  function getData() {
    if (promise) return promise;
    promise = Promise.all([
      fetchCsv(SUMMARY_CSV).then(parseSummary).catch(function () { return null; }),
      fetchCsv(DETAIL_CSV).then(parseDetail).catch(function () { return null; })
    ]).then(function (res) {
      var summary = res[0] || FALLBACK.summary;
      var monthly = res[1] || FALLBACK.monthly;
      var live = !!(res[0] && res[1]);
      return {
        live: live,
        summary: summary,
        monthly: monthly,
        growth: growthSeries(monthly, 10000),
        portCumulative: cumulativeReturn(monthly, 'port'),
        spyCumulative: cumulativeReturn(monthly, 'spy'),
        updatedLabel: lastUpdatedLabel(monthly),
        sinceLabel: monthly[0].label
      };
    });
    return promise;
  }

  return { getData: getData, fallback: FALLBACK };
})();
