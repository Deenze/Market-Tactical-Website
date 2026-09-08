/* Market Tactical: portfolio data layer.

   Source of truth is the Google Sheet, read live through its CSV endpoint on
   every page load:
     "All data"     monthly inputs and derived columns, one row per month
     "Metrics"      every performance and risk statistic, computed by the
                    sheet's own formulas (label, vs price, vs total, SE, convention)
     "Rolling 12m"  trailing 12-month regression statistics

   portfolio.json is the offline fallback for the monthly series (headline
   metrics are then computed here instead) and the only home of the
   Nasdaq 100 comparison column, which is merged onto the sheet series by month.
   Set "preferGoogleSheet": false in portfolio.json to skip the sheet entirely. */

window.MT = (function () {
  'use strict';

  var SHEET_ID = '1mKt_mD3YIft_QOw7TffRbx9GNyOMXdp5_bKlB6sSmmQ';
  var SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit';
  var PORTFOLIO_JSON = 'portfolio.json';
  var GROWTH_START = 100000;

  function tabUrl(name) {
    return 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(name);
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  /* ---------- parsing helpers ---------- */

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

  /* "51.63%" -> 51.63 ; "1.4145" -> 1.4145 ; "" -> NaN */
  function num(s) {
    if (s == null) return NaN;
    var t = String(s).replace(/[%,$\s]/g, '');
    if (t === '') return NaN;
    return parseFloat(t);
  }

  /* The sheet uses both "25-Jan" and "Jan-26": handle either order. */
  function monthLabel(raw) {
    var parts = String(raw).trim().split(/[-/ ]+/);
    if (parts.length !== 2) return String(raw).trim();
    var a = parts[0], b = parts[1], m, y;
    if (/^\d+$/.test(a)) { y = a; m = b; } else { m = a; y = b; }
    m = m.slice(0, 3);
    m = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    if (MONTHS.indexOf(m) === -1) return String(raw).trim();
    return m + ' ' + (y.length === 2 ? y : y.slice(-2));
  }

  function findCol(header, re, fallback) {
    for (var i = 0; i < header.length; i++) if (re.test(String(header[i]).toLowerCase())) return i;
    return fallback;
  }

  /* "All data" tab. Values arrive already formatted by the sheet ("2.33%"), so
     num() yields percent units directly. Note rows below the data have no
     numeric return and are skipped. */
  function parseAllData(rows) {
    if (!rows || rows.length < 2) return null;
    var h = rows[0];
    var cPrice = findCol(h, /price return/, 1);
    var cTotal = findCol(h, /total return/, 3);
    var cRf = findCol(h, /^rf/, 4);
    var cMd = findCol(h, /dietz/, 5);
    var cDd = findCol(h, /^drawdown/, 13);
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      var port = num(r[cMd]), spy = num(r[cTotal]);
      if (isNaN(port) || isNaN(spy)) continue;
      var price = num(r[cPrice]), rf = num(r[cRf]), dd = num(r[cDd]);
      out.push({
        label: monthLabel(r[0]),
        port: port,
        spy: spy,
        spyPrice: isNaN(price) ? NaN : price,
        rf: isNaN(rf) ? 0 : rf,
        drawdown: isNaN(dd) ? NaN : dd,
        ndx: NaN
      });
    }
    return out.length ? out : null;
  }

  function prettyHeading(s) {
    s = String(s).replace(/\s+/g, ' ').trim();
    var i = s.indexOf('(');
    var head = (i > -1 ? s.slice(0, i) : s).trim();
    var tail = i > -1 ? ' ' + s.slice(i).trim() : '';
    return head.charAt(0).toUpperCase() + head.slice(1).toLowerCase() + tail;
  }

  /* "Metrics" tab: [label, vs price, vs total, SE, convention]. Rows with no
     numbers are section headings. The first CSV row is a merged header. */
  function parseMetrics(rows) {
    if (!rows || rows.length < 2) return null;
    var groups = [], byLabel = {};
    var current = { title: 'Sample', rows: [] };
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var label = String(r[0] || '').trim();
      if (!label) continue;
      var price = String(r[1] || '').trim();
      var total = String(r[2] || '').trim();
      var se = String(r[3] || '').trim();
      var convention = String(r[4] || '').trim();
      if (!price && !total && !se) {
        if (current.rows.length) groups.push(current);
        current = { title: prettyHeading(label), rows: [] };
        continue;
      }
      var row = {
        label: label, price: price, total: total, se: se, convention: convention,
        priceNum: num(price), totalNum: num(total), seNum: num(se)
      };
      current.rows.push(row);
      byLabel[label.toLowerCase()] = row;
    }
    if (current.rows.length) groups.push(current);
    return groups.length ? { groups: groups, byLabel: byLabel } : null;
  }

  /* "Rolling 12m" tab: [month, beta, r-squared, alpha (ann), vol (ann), 12m return] */
  function parseRolling(rows) {
    if (!rows || rows.length < 2) return null;
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var beta = num(r[1]);
      if (!r[0] || isNaN(beta)) continue;
      out.push({
        label: monthLabel(r[0]),
        beta: beta, rsq: num(r[2]), alpha: num(r[3]), vol: num(r[4]), ret12: num(r[5]),
        raw: { beta: String(r[1]).trim(), rsq: String(r[2] || '').trim(), alpha: String(r[3] || '').trim(),
          vol: String(r[4] || '').trim(), ret12: String(r[5] || '').trim() }
      });
    }
    return out.length ? out : null;
  }

  /* portfolio.json: { monthly: [{ month, portfolio, sp500, nasdaq100, rf }] }, all in percent */
  function parseLocalMonthly(json) {
    if (!json || !Array.isArray(json.monthly)) return null;
    var out = [];
    json.monthly.forEach(function (m) {
      var port = num(m.portfolio), spy = num(m.sp500), rf = num(m.rf), ndx = num(m.nasdaq100);
      if (!m.month || isNaN(port) || isNaN(spy)) return;
      out.push({ label: monthLabel(m.month), port: port, spy: spy, spyPrice: NaN, rf: isNaN(rf) ? 0 : rf, drawdown: NaN, ndx: ndx });
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

  /* ---------- statistics for the offline fallback (inputs as fractions) ---------- */

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

  /* Same conventions as the sheet's Metrics tab. Percent in, percent out. */
  function computeSummary(monthly) {
    var n = monthly.length;
    var port = monthly.map(function (m) { return m.port / 100; });
    var spy = monthly.map(function (m) { return m.spy / 100; });
    var rf = monthly.map(function (m) { return m.rf / 100; });
    var excess = port.map(function (p, i) { return p - rf[i]; });
    var benchExcess = spy.map(function (s, i) { return s - rf[i]; });
    var active = port.map(function (p, i) { return p - spy[i]; });
    var SQ12 = Math.sqrt(12);

    var sharpe = mean(excess) / Math.sqrt(sampleVar(excess)) * SQ12;
    var trackingError = Math.sqrt(sampleVar(active)) * SQ12;
    var information = mean(active) * 12 / trackingError;

    var dsum = 0;
    excess.forEach(function (e) { if (e < 0) dsum += e * e; });
    var downsideDev = Math.sqrt(dsum / n) * SQ12;
    var sortino = downsideDev > 0 ? mean(excess) * 12 / downsideDev : NaN;

    var beta = sampleCov(excess, benchExcess) / sampleVar(benchExcess);
    var alphaMonthly = mean(excess) - beta * mean(benchExcess);
    var correlation = sampleCov(excess, benchExcess) / Math.sqrt(sampleVar(excess) * sampleVar(benchExcess));

    var wins = 0;
    port.forEach(function (p) { if (p > 0) wins++; });

    var cum = 1, peak = 1, maxDD = 0, maxDDLabel = '', gs = 1;
    var drawdown = [0];
    for (var i = 0; i < n; i++) {
      cum *= 1 + port[i];
      gs *= 1 + spy[i];
      if (cum > peak) peak = cum;
      var dd = cum / peak - 1;
      drawdown.push(dd * 100);
      if (dd < maxDD) { maxDD = dd; maxDDLabel = monthly[i].label; }
    }

    return {
      months: n,
      cumulative: (cum - 1) * 100,
      benchCumulative: (gs - 1) * 100,
      cagr: (Math.pow(cum, 12 / n) - 1) * 100,
      volatility: Math.sqrt(sampleVar(port)) * SQ12 * 100,
      downsideDev: downsideDev * 100,
      sharpe: sharpe,
      sortino: sortino,
      beta: beta,
      betaLow: NaN,
      betaHigh: NaN,
      alphaMonthly: alphaMonthly * 100,
      alphaAnnual: alphaMonthly * 1200,
      alphaP: NaN,
      information: information,
      informationP: NaN,
      trackingError: trackingError * 100,
      hitRate: wins / n * 100,
      rsq: correlation * correlation,
      correlation: correlation,
      maxDrawdown: maxDD * 100,
      maxDrawdownMonth: maxDDLabel,
      drawdown: drawdown
    };
  }

  /* Headline numbers straight from the sheet's Metrics tab ("vs S&P TOTAL return" column). */
  function summaryFromMetrics(metrics, monthly) {
    function g(label) {
      var r = metrics.byLabel[label.toLowerCase()];
      return r ? r.totalNum : NaN;
    }
    var drawdown = [0], minDD = 0, minLabel = '';
    monthly.forEach(function (m) {
      var v = isFinite(m.drawdown) ? m.drawdown : null;
      drawdown.push(v);
      if (v !== null && v < minDD) { minDD = v; minLabel = m.label; }
    });
    return {
      months: g('Months of data (n)'),
      cumulative: g('Cumulative return'),
      benchCumulative: g('Benchmark cumulative return'),
      cagr: g('CAGR (annualised)'),
      volatility: g('Annualised volatility'),
      downsideDev: g('Downside deviation (annualised)'),
      sharpe: g('Sharpe ratio'),
      sortino: g('Sortino ratio'),
      beta: g('Beta'),
      betaLow: g('95% CI low, beta'),
      betaHigh: g('95% CI high, beta'),
      alphaMonthly: g('Alpha (monthly)'),
      alphaAnnual: g('Alpha (annualised)'),
      alphaP: g('p-value, alpha'),
      information: g('Information ratio'),
      informationP: g('p-value, information ratio'),
      trackingError: g('Tracking error (annualised)'),
      hitRate: g('Hit rate (months > 0)'),
      rsq: g('R-squared'),
      correlation: g('Correlation'),
      maxDrawdown: g('Maximum drawdown'),
      maxDrawdownMonth: minLabel,
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
        ndx.push(null);
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
    var last = monthly[monthly.length - 1].label;
    var parts = last.split(' ');
    var idx = MONTHS.indexOf(parts[0]);
    if (idx === -1) return last;
    return MONTHS_FULL[idx] + ' 20' + parts[1];
  }

  function build(monthly, source, metrics, rolling) {
    var growth = growthSeries(monthly, GROWTH_START);
    return {
      source: source, /* 'sheet' | 'json' */
      live: source === 'sheet',
      sheetUrl: SHEET_URL,
      monthly: monthly,
      metrics: metrics || null,
      rolling: rolling || null,
      summary: metrics ? summaryFromMetrics(metrics, monthly) : computeSummary(monthly),
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
      if (json && json.preferGoogleSheet === false && local) return build(local, 'json');

      return Promise.all([
        fetchCsv(tabUrl('All data')).then(parseAllData).catch(function () { return null; }),
        fetchCsv(tabUrl('Metrics')).then(parseMetrics).catch(function () { return null; }),
        fetchCsv(tabUrl('Rolling 12m')).then(parseRolling).catch(function () { return null; })
      ]).then(function (res) {
        var sheet = res[0];
        if (sheet) {
          if (local) {
            var ndxByLabel = {};
            local.forEach(function (m) { ndxByLabel[m.label] = m.ndx; });
            sheet.forEach(function (m) {
              if (isFinite(ndxByLabel[m.label])) m.ndx = ndxByLabel[m.label];
            });
          }
          return build(sheet, 'sheet', res[1], res[2]);
        }
        if (local) return build(local, 'json');
        return null;
      });
    });
    return promise;
  }

  return { getData: getData, computeSummary: computeSummary, sheetUrl: SHEET_URL };
})();
