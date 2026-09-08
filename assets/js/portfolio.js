/* Market Tactical: portfolio page. Metric cards, charts and tables, all fed by MT.getData(). */
(function () {
  'use strict';

  if (!window.MT || !window.Chart) return;

  var root = document.documentElement;
  var charts = [];

  function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function chartColors() {
    return {
      portfolio: cssVar('--series-portfolio'),
      benchmark: cssVar('--series-benchmark'),
      nasdaq: cssVar('--series-nasdaq'),
      down: cssVar('--down'),
      ref: cssVar('--text-3'),
      grid: cssVar('--grid-line'),
      ink: cssVar('--text-3'),
      tooltipBg: cssVar('--card-2'),
      tooltipInk: cssVar('--text')
    };
  }

  function fmtPct(v, digits) {
    return (v >= 0 ? '+' : '') + v.toFixed(digits == null ? 2 : digits) + '%';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function show(id, visible) {
    var el = document.getElementById(id);
    if (el) el.hidden = !visible;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function baseOptions(c, kind) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.tooltipBg,
          titleColor: c.tooltipInk,
          bodyColor: c.tooltipInk,
          borderColor: cssVar('--border-strong'),
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          boxPadding: 6,
          usePointStyle: true,
          filter: function (item) { return !item.dataset.isReference; },
          callbacks: {
            label: function (item) {
              var v = item.parsed.y;
              var text = kind === '$' ? '$' + Math.round(v).toLocaleString('en-US')
                : kind === 'x' ? v.toFixed(2)
                : fmtPct(v, 2);
              return ' ' + item.dataset.label + ': ' + text;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: c.grid },
          ticks: { color: c.ink, maxRotation: 0, autoSkipPadding: 14, font: { size: 11 } }
        },
        y: {
          grid: { color: c.grid },
          border: { display: false },
          max: kind === 'dd' ? 0 : undefined,
          ticks: {
            color: c.ink,
            font: { size: 11 },
            callback: function (v) {
              return kind === '$' ? '$' + Number(v).toLocaleString('en-US')
                : kind === 'x' ? Number(v).toFixed(1)
                : v + '%';
            }
          }
        }
      }
    };
  }

  function register(chart, restyle) { charts.push({ chart: chart, restyle: restyle }); }

  /* ---------- charts ---------- */

  function buildGrowthChart(d) {
    var el = document.getElementById('growthChart');
    if (!el) return;
    var c = chartColors();
    var chart = new Chart(el, {
      type: 'line',
      data: {
        labels: d.growth.labels,
        datasets: [
          { label: 'Portfolio', data: d.growth.port, borderColor: c.portfolio, backgroundColor: c.portfolio + '22',
            fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: c.portfolio, tension: 0.25 },
          { label: 'S&P 500', data: d.growth.spy, borderColor: c.benchmark,
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: c.benchmark, tension: 0.25 },
          { label: 'Nasdaq 100 (QQQ)', data: d.growth.ndx, borderColor: c.nasdaq, spanGaps: false,
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: c.nasdaq, tension: 0.25 }
        ]
      },
      options: baseOptions(c, '$')
    });
    register(chart, function () {
      var cc = chartColors();
      chart.data.datasets[0].borderColor = cc.portfolio;
      chart.data.datasets[0].backgroundColor = cc.portfolio + '22';
      chart.data.datasets[1].borderColor = cc.benchmark;
      chart.data.datasets[2].borderColor = cc.nasdaq;
      chart.options = baseOptions(cc, '$');
      chart.update();
    });
  }

  function buildMonthlyChart(d) {
    var el = document.getElementById('monthlyChart');
    if (!el) return;
    var c = chartColors();
    var chart = new Chart(el, {
      type: 'bar',
      data: {
        labels: d.monthly.map(function (m) { return m.label; }),
        datasets: [
          { label: 'Portfolio', data: d.monthly.map(function (m) { return m.port; }), backgroundColor: c.portfolio, borderRadius: 4, maxBarThickness: 26 },
          { label: 'S&P 500', data: d.monthly.map(function (m) { return m.spy; }), backgroundColor: c.benchmark, borderRadius: 4, maxBarThickness: 26 }
        ]
      },
      options: baseOptions(c, '%')
    });
    register(chart, function () {
      var cc = chartColors();
      chart.data.datasets[0].backgroundColor = cc.portfolio;
      chart.data.datasets[1].backgroundColor = cc.benchmark;
      chart.options = baseOptions(cc, '%');
      chart.update();
    });
  }

  function buildDrawdownChart(d) {
    var el = document.getElementById('drawdownChart');
    if (!el) return;
    var c = chartColors();
    var chart = new Chart(el, {
      type: 'line',
      data: {
        labels: d.growth.labels,
        datasets: [
          { label: 'Drawdown', data: d.summary.drawdown, borderColor: c.down, backgroundColor: c.down + '26',
            fill: 'origin', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: c.down, tension: 0.2 }
        ]
      },
      options: baseOptions(c, 'dd')
    });
    register(chart, function () {
      var cc = chartColors();
      chart.data.datasets[0].borderColor = cc.down;
      chart.data.datasets[0].backgroundColor = cc.down + '26';
      chart.options = baseOptions(cc, 'dd');
      chart.update();
    });
  }

  function buildRollingChart(d) {
    var el = document.getElementById('rollingChart');
    if (!el || !d.rolling) return;
    var c = chartColors();
    var labels = d.rolling.map(function (r) { return r.label; });
    var chart = new Chart(el, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Rolling 12-month beta', data: d.rolling.map(function (r) { return r.beta; }), borderColor: c.portfolio,
            backgroundColor: c.portfolio + '22', fill: false, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
            pointBackgroundColor: c.portfolio, tension: 0.2 },
          { label: 'Beta of 1.0 (moves with the index)', data: labels.map(function () { return 1; }), borderColor: c.ref,
            borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, isReference: true }
        ]
      },
      options: baseOptions(c, 'x')
    });
    register(chart, function () {
      var cc = chartColors();
      chart.data.datasets[0].borderColor = cc.portfolio;
      chart.data.datasets[0].pointBackgroundColor = cc.portfolio;
      chart.data.datasets[1].borderColor = cc.ref;
      chart.options = baseOptions(cc, 'x');
      chart.update();
    });
  }

  /* ---------- text and tables ---------- */

  function fillLegends(d) {
    var pEnd = d.growth.port[d.growth.port.length - 1];
    var sEnd = d.growth.spy[d.growth.spy.length - 1];
    setText('growthPortVal', '$' + Math.round(pEnd).toLocaleString('en-US') + ' (' + fmtPct(d.portCumulative, 1) + ')');
    setText('growthSpyVal', '$' + Math.round(sEnd).toLocaleString('en-US') + ' (' + fmtPct(d.spyCumulative, 1) + ')');
    var nEnd = d.growth.ndx[d.growth.ndx.length - 1];
    setText('growthNdxVal', d.growth.ndxAvailable && nEnd != null
      ? '$' + Math.round(nEnd).toLocaleString('en-US') + ' (' + fmtPct(d.ndxCumulative, 1) + ')'
      : 'n/a');

    var best = d.monthly.reduce(function (a, b) { return b.port > a.port ? b : a; });
    var worst = d.monthly.reduce(function (a, b) { return b.port < a.port ? b : a; });
    setText('monthlyBestVal', fmtPct(best.port, 1) + ' (' + best.label + ')');
    setText('monthlyWorstVal', fmtPct(worst.port, 1) + ' (' + worst.label + ')');
    var s = d.summary;
    setText('drawdownMaxVal', isFinite(s.maxDrawdown)
      ? s.maxDrawdown.toFixed(1) + '%' + (s.maxDrawdownMonth ? ' (' + s.maxDrawdownMonth + ')' : '')
      : 'n/a');
    if (d.rolling) {
      var last = d.rolling[d.rolling.length - 1];
      setText('rollingLatestVal', last.beta.toFixed(2) + ' (' + last.label + ')');
    }
  }

  function fillMetrics(d) {
    var s = d.summary;
    var defs = [
      { id: 'mCagr', value: s.cagr, decimals: 1, suffix: '%' },
      { id: 'mVol', value: s.volatility, decimals: 1, suffix: '%' },
      { id: 'mSharpe', value: s.sharpe, decimals: 2 },
      { id: 'mSortino', value: s.sortino, decimals: 2 },
      { id: 'mMaxDD', value: s.maxDrawdown, decimals: 1, suffix: '%' },
      { id: 'mBeta', value: s.beta, decimals: 2 },
      { id: 'mAlpha', value: s.alphaAnnual, decimals: 1, suffix: '%' },
      { id: 'mInfo', value: s.information, decimals: 2 },
      { id: 'mHit', value: s.hitRate, decimals: 0, suffix: '%' },
      { id: 'mRsq', value: s.rsq, decimals: 2 }
    ];
    defs.forEach(function (m) {
      var el = document.getElementById(m.id);
      if (!el) return;
      if (isFinite(m.value)) mtCountUp(el, m.value, { decimals: m.decimals, suffix: m.suffix || '' });
      else el.textContent = 'n/a';
    });

    if (isFinite(s.months)) setText('mMonths', String(Math.round(s.months)));
    if (isFinite(s.downsideDev)) setText('mVolSub', 'Downside deviation ' + s.downsideDev.toFixed(1) + '%, annualised.');
    if (s.maxDrawdownMonth) setText('mMaxDDSub', 'Largest peak-to-trough decline of the month-end value (' + s.maxDrawdownMonth + ').');
    if (isFinite(s.betaLow) && isFinite(s.betaHigh)) {
      setText('mBetaSub', '95% confidence interval ' + s.betaLow.toFixed(2) + ' to ' + s.betaHigh.toFixed(2) + '.');
    }
    if (isFinite(s.alphaMonthly)) {
      setText('mAlphaSub', fmtPct(s.alphaMonthly, 2) + ' per month, times 12.' +
        (isFinite(s.alphaP) ? ' p-value ' + s.alphaP.toFixed(2) + '.' : ''));
    }
    if (isFinite(s.trackingError)) {
      setText('mInfoSub', 'Tracking error ' + s.trackingError.toFixed(1) + '%.' +
        (isFinite(s.informationP) ? ' p-value ' + s.informationP.toFixed(2) + '.' : ''));
    }
    if (isFinite(s.correlation)) setText('mRsqSub', 'Correlation with the S&P 500: ' + s.correlation.toFixed(2) + '.');
  }

  function fillMonthlyTable(d) {
    var body = document.getElementById('monthlyTableBody');
    if (!body) return;
    var html = '';
    d.monthly.forEach(function (m) {
      var diff = m.port - m.spy;
      html += '<tr><td>' + esc(m.label) + '</td>' +
        '<td class="' + (m.port >= 0 ? 'pos' : 'neg') + '">' + fmtPct(m.port) + '</td>' +
        '<td class="' + (m.spy >= 0 ? 'pos' : 'neg') + '">' + fmtPct(m.spy) + '</td>' +
        (isFinite(m.ndx)
          ? '<td class="' + (m.ndx >= 0 ? 'pos' : 'neg') + '">' + fmtPct(m.ndx) + '</td>'
          : '<td>n/a</td>') +
        '<td class="' + (diff >= 0 ? 'pos' : 'neg') + '">' + fmtPct(diff) + '</td></tr>';
    });
    body.innerHTML = html;
  }

  function fillMetricsTable(d) {
    var body = document.getElementById('metricsTableBody');
    show('metricsDetails', !!d.metrics);
    if (!body || !d.metrics) return;
    var html = '';
    d.metrics.groups.forEach(function (g) {
      html += '<tr class="group"><th colspan="5">' + esc(g.title) + '</th></tr>';
      g.rows.forEach(function (r) {
        html += '<tr><td>' + esc(r.label) + '</td>' +
          '<td>' + esc(r.price || '') + '</td>' +
          '<td>' + esc(r.total || '') + '</td>' +
          '<td>' + esc(r.se || '') + '</td>' +
          '<td class="conv">' + esc(r.convention || '') + '</td></tr>';
      });
    });
    body.innerHTML = html;
  }

  function fillRollingTable(d) {
    var body = document.getElementById('rollingTableBody');
    show('rollingPanel', !!d.rolling);
    show('rollingDetails', !!d.rolling);
    if (!body || !d.rolling) return;
    var html = '';
    d.rolling.forEach(function (r) {
      html += '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.raw.beta) + '</td><td>' + esc(r.raw.rsq) + '</td>' +
        '<td>' + esc(r.raw.alpha) + '</td><td>' + esc(r.raw.vol) + '</td><td>' + esc(r.raw.ret12) + '</td></tr>';
    });
    body.innerHTML = html;
  }

  function fillUpdated(d) {
    setText('updatedLabel', 'Updated through ' + d.updatedLabel + (d.live ? ' · live from the source spreadsheet' : ' · offline copy'));
    document.querySelectorAll('[data-since]').forEach(function (n) { n.textContent = d.sinceLabel; });
    document.querySelectorAll('[data-sheet-link]').forEach(function (a) { a.href = d.sheetUrl; });
  }

  MT.getData().then(function (d) {
    if (!d) {
      setText('updatedLabel', 'Performance data is temporarily unavailable');
      return;
    }
    fillUpdated(d);
    fillMetrics(d);
    fillLegends(d);
    buildGrowthChart(d);
    buildMonthlyChart(d);
    buildDrawdownChart(d);
    buildRollingChart(d);
    fillMonthlyTable(d);
    fillMetricsTable(d);
    fillRollingTable(d);
  });

  document.addEventListener('mt:theme', function () {
    charts.forEach(function (c) { c.restyle(); });
  });
})();
