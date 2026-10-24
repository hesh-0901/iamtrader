import { useEffect, useRef } from 'react';

const TRADINGVIEW_WIDGET_URL =
  'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

/**
 * Full-screen TradingView chart for OANDA:XAUUSD.
 * Market data and chart interactions are hosted by TradingView; IAMTRADER does
 * not fabricate prices or request private OANDA credentials for this widget.
 */
export function BacktestModule() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.replaceChildren();

    const widgetRoot = document.createElement('div');
    widgetRoot.className = 'tradingview-widget-container__widget';
    widgetRoot.style.width = '100%';
    widgetRoot.style.height = '100%';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = TRADINGVIEW_WIDGET_URL;
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: 'OANDA:XAUUSD',
      interval: '15',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'fr',
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      save_image: true,
      withdateranges: true,
      details: false,
      hotlist: false,
      studies: ['STD;RSI', 'STD;EMA'],
      support_host: 'https://www.tradingview.com',
    });

    container.append(widgetRoot, script);

    return () => {
      container.replaceChildren();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#131722] text-[#d1d4dc]"
      style={{ fontFamily: 'Inter, Arial, sans-serif' }}
    >
      <header className="flex min-h-[48px] shrink-0 items-center justify-between gap-3 border-b border-[#2a2e39] bg-[#131722] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2962ff] text-xs font-black text-white">
            IAM
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">XAUUSD · OANDA</div>
            <div className="text-[10px] text-[#787b86]">
              Graphique TradingView · données fournies par TradingView
            </div>
          </div>
        </div>
        <a
          href="https://www.tradingview.com/symbols/XAUUSD/?exchange=OANDA"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md border border-[#363a45] px-3 py-2 text-xs font-medium text-[#d1d4dc] hover:bg-[#1e222d]"
        >
          Ouvrir sur TradingView ↗
        </a>
      </header>

      <main className="min-h-0 flex-1">
        <div
          ref={containerRef}
          className="tradingview-widget-container h-full w-full"
          style={{ height: '100%', width: '100%' }}
          aria-label="Graphique TradingView OANDA XAUUSD"
        />
      </main>
    </div>
  );
}
