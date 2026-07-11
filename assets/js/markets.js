/* Market Tactical — live markets dashboard.
   Renders TradingView's free embed widgets (no API key, self-updating).
   Widgets are re-rendered on theme change since each iframe bakes in a theme. */
(function () {
  'use strict';

  var EMBED_BASE = 'https://s3.tradingview.com/external-embedding/';

  function theme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function render(id, script, config) {
    var host = document.getElementById(id);
    if (!host) return;
    host.innerHTML = '';
    var container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    var widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    container.appendChild(widget);
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.async = true;
    s.src = EMBED_BASE + script;
    s.innerHTML = JSON.stringify(config);
    container.appendChild(s);
    host.appendChild(container);
  }

  function renderAll() {
    var t = theme();

    render('twTickerTape', 'embed-widget-ticker-tape.js', {
      symbols: [
        { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
        { proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq 100' },
        { proName: 'FOREXCOM:DJI', title: 'Dow 30' },
        { proName: 'CAPITALCOM:VIX', title: 'VIX' },
        { proName: 'TVC:GOLD', title: 'Gold' },
        { proName: 'TVC:USOIL', title: 'Crude Oil' },
        { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
        { proName: 'FX_IDC:EURUSD', title: 'EUR/USD' }
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: t,
      locale: 'en'
    });

    render('twOverview', 'embed-widget-market-overview.js', {
      colorTheme: t,
      dateRange: '3M',
      showChart: true,
      locale: 'en',
      width: '100%',
      height: '100%',
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: true,
      tabs: [
        {
          title: 'Indices',
          symbols: [
            { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
            { s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100' },
            { s: 'FOREXCOM:DJI', d: 'Dow 30' },
            { s: 'CAPITALCOM:VIX', d: 'VIX' },
            { s: 'INDEX:NKY', d: 'Nikkei 225' },
            { s: 'INDEX:DEU40', d: 'DAX' }
          ]
        },
        {
          title: 'Commodities',
          symbols: [
            { s: 'TVC:GOLD', d: 'Gold' },
            { s: 'TVC:SILVER', d: 'Silver' },
            { s: 'TVC:USOIL', d: 'Crude Oil' },
            { s: 'NYMEX:NG1!', d: 'Natural Gas' },
            { s: 'COMEX:HG1!', d: 'Copper' }
          ]
        },
        {
          title: 'Crypto',
          symbols: [
            { s: 'BITSTAMP:BTCUSD', d: 'Bitcoin' },
            { s: 'BITSTAMP:ETHUSD', d: 'Ethereum' },
            { s: 'BINANCE:SOLUSDT', d: 'Solana' }
          ]
        },
        {
          title: 'Bonds & FX',
          symbols: [
            { s: 'TVC:US10Y', d: 'US 10Y Yield' },
            { s: 'TVC:US02Y', d: 'US 2Y Yield' },
            { s: 'TVC:DXY', d: 'Dollar Index' },
            { s: 'FX_IDC:EURUSD', d: 'EUR/USD' }
          ]
        }
      ]
    });

    render('twNews', 'embed-widget-timeline.js', {
      feedMode: 'market',
      market: 'stock',
      isTransparent: true,
      displayMode: 'regular',
      width: '100%',
      height: '100%',
      colorTheme: t,
      locale: 'en'
    });

    render('twHeatmap', 'embed-widget-stock-heatmap.js', {
      exchanges: [],
      dataSource: 'SPX500',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: t,
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%'
    });
  }

  renderAll();

  document.addEventListener('mt:theme', function () {
    /* small delay so CSS variables settle before widgets rebuild */
    setTimeout(renderAll, 60);
  });
})();
