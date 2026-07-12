/* Market Tactical — portfolio page: metric cards, charts, data table */
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
      grid: cssVar('--grid-line'),
      ink: cssVar('--text-3'),
      tooltipBg: cssVar('--card-2'),
      tooltipInk: cssVar('--text')
    };
  }

  function baseOptions(c, valueSuffix) {
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
          callbacks: {
            label: function (item) {
              var v = item.parsed.y;
              var text = valueSuffix === '$'
                ? '$' + Math.round(v).toLocaleString('en-US')
                : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
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
          ticks: {
            color: c.ink,
            font: { size: 11 },
            callback: function (v) {
              return valueSuffix === '$'
                ? '$' + Number(v).toLocaleString('en-US')
                : v + '%';
            }
          }
        }
      }
    };
  }

  function buildGrowthChart(d) {
    var el = document.getElementById('growthChart');
    if (!el) return;
    var c = chartColors();
    var chart = new Chart(el, {
      type: 'line',
      data: {
        labels: d.growth.labels,
        datasets: [
          {
            label: 'Portfolio',
            data: d.growth.port,
            borderColor: c.portfolio,
            backgroundColor: c.portfolio + '22',
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: c.portfolio,
            tension: 0.25
          },
          {
            label: 'S&P 500',
            data: d.growth.spy,
            borderColor: c.benchmark,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: c.benchmark,
            tension: 0.25
          }
        ]
      },
      options: baseOptions(c, '$')
    });
    charts.push({ chart: chart, restyle: function () {
      var cc = chartColors();
      chart.data.datasets[0].borderColor = cc.portfolio;
      chart.data.datasets[0].backgroundColor = cc.portfolio + '22';
      chart.data.datasets[1].borderColor = cc.benchmark;
      chart.options = baseOptions(cc, '$');
      chart.update();
    } });
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
          {
            label: 'Portfolio',
            data: d.monthly.map(function (m) { return m.port; }),
            backgroundColor: c.portfolio,
            borderRadius: 4,
            maxBarThickness: 26
          },
          {
            label: 'S&P 500',
            data: d.monthly.map(function (m) { return m.spy; }),
            backgroundColor: c.benchmark,
            borderRadius: 4,
            maxBarThickness: 26
          }
        ]
      },
      options: baseOptions(c, '%')
    });
    charts.push({ chart: chart, restyle: function () {
      var cc = chartColors();
      chart.data.datasets[0].backgroundColor = cc.portfolio;
      chart.data.datasets[1].backgroundColor = cc.benchmark;
      chart.options = baseOptions(cc, '%');
      chart.update();
    } });
  }

  function fillLegends(d) {
    var pEnd = d.growth.port[d.growth.port.length - 1];
    var sEnd = d.growth.spy[d.growth.spy.length - 1];
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('growthPortVal', '$' + Math.round(pEnd).toLocaleString('en-US') +
      ' (' + (d.portCumulative >= 0 ? '+' : '') + d.portCumulative.toFixed(1) + '%)');
    set('growthSpyVal', '$' + Math.round(sEnd).toLocaleString('en-US') +
      ' (' + (d.spyCumulative >= 0 ? '+' : '') + d.spyCumulative.toFixed(1) + '%)');

    var best = d.monthly.reduce(function (a, b) { return b.port > a.port ? b : a; });
    var worst = d.monthly.reduce(function (a, b) { return b.port < a.port ? b : a; });
    set('monthlyBestVal', '+' + best.port.toFixed(1) + '% (' + best.label + ')');
    set('monthlyWorstVal', worst.port.toFixed(1) + '% (' + worst.label + ')');
  }

  function fillMetrics(d) {
    var s = d.summary;
    var defs = [
      { id: 'mCagr', value: s.cagr, decimals: 1, suffix: '%' },
      { id: 'mSharpe', value: s.sharpe, decimals: 2 },
      { id: 'mSortino', value: s.sortino, decimals: 2 },
      { id: 'mInfo', value: s.information, decimals: 2 },
      { id: 'mAlpha', value: s.alphaAnnual, decimals: 1, suffix: '%' },
      { id: 'mBeta', value: s.beta, decimals: 2 }
    ];
    defs.forEach(function (m) {
      var el = document.getElementById(m.id);
      if (el) mtCountUp(el, m.value, { decimals: m.decimals, suffix: m.suffix || '' });
    });
  }

  function fillTable(d) {
    var body = document.getElementById('monthlyTableBody');
    if (!body) return;
    var html = '';
    d.monthly.forEach(function (m) {
      var diff = m.port - m.spy;
      html += '<tr><td>' + m.label + '</td>' +
        '<td class="' + (m.port >= 0 ? 'pos' : 'neg') + '">' + (m.port >= 0 ? '+' : '') + m.port.toFixed(2) + '%</td>' +
        '<td class="' + (m.spy >= 0 ? 'pos' : 'neg') + '">' + (m.spy >= 0 ? '+' : '') + m.spy.toFixed(2) + '%</td>' +
        '<td class="' + (diff >= 0 ? 'pos' : 'neg') + '">' + (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%</td></tr>';
    });
    body.innerHTML = html;
  }

  function fillUpdated(d) {
    var el = document.getElementById('updatedLabel');
    if (el) el.textContent = 'Updated through ' + d.updatedLabel +
      (d.live ? ' · live from source data' : '');
    document.querySelectorAll('[data-since]').forEach(function (n) {
      n.textContent = d.sinceLabel;
    });
  }

  MT.getData().then(function (d) {
    if (!d) {
      var el = document.getElementById('updatedLabel');
      if (el) el.textContent = 'Performance data is temporarily unavailable';
      return;
    }
    fillUpdated(d);
    fillMetrics(d);
    fillLegends(d);
    buildGrowthChart(d);
    buildMonthlyChart(d);
    fillTable(d);
  });

  document.addEventListener('mt:theme', function () {
    charts.forEach(function (c) { c.restyle(); });
  });
})();
