export interface MarketQuote {
  symbol: string;
  providerSymbol: string;
  price: number;
  currency: string | null;
  bid: number | null;
  ask: number | null;
  change: number | null;
  changePercent: number | null;
  timestamp: string | null;
  marketState: string | null;
  source: 'Yahoo Finance';
  isProxy: boolean;
  note: string;
}

interface YahooChartResponse {
  chart?: {
    error?: { description?: string; code?: string } | null;
    result?: Array<{
      meta?: {
        currency?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        bid?: number;
        ask?: number;
        marketState?: string;
        exchangeName?: string;
      };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }> | null;
  };
}

interface SymbolMapping {
  ticker: string;
  proxy?: boolean;
  note?: string;
}

const INDEX_SYMBOLS: Record<string, string> = {
  US30: '^DJI', DJ30: '^DJI', DOW30: '^DJI',
  NAS100: '^NDX', USTEC: '^NDX', NASDAQ100: '^NDX',
  SPX500: '^GSPC', US500: '^GSPC', SP500: '^GSPC',
  GER40: '^GDAXI', DAX40: '^GDAXI',
  UK100: '^FTSE', FTSE100: '^FTSE',
  JPN225: '^N225', JP225: '^N225',
  AUS200: '^AXJO', FRA40: '^FCHI',
  HK50: '^HSI', CHINA50: '000016.SS',
};

const FUTURE_SYMBOLS: Record<string, string> = {
  ES: 'ES=F', MES: 'MES=F', NQ: 'NQ=F', MNQ: 'MNQ=F',
  YM: 'YM=F', MYM: 'MYM=F', RTY: 'RTY=F', M2K: 'M2K=F',
  GC: 'GC=F', MGC: 'MGC=F', SI: 'SI=F', HG: 'HG=F',
  CL: 'CL=F', MCL: 'MCL=F', NG: 'NG=F', ZB: 'ZB=F',
  ZN: 'ZN=F', ZC: 'ZC=F', ZW: 'ZW=F', ZS: 'ZS=F',
};

function mapSymbol(raw: string): SymbolMapping {
  const symbol = raw.trim().toUpperCase();
  if (INDEX_SYMBOLS[symbol]) {
    return { ticker: INDEX_SYMBOLS[symbol], proxy: true, note: 'Indice de référence utilisé comme proxy : il peut différer du CFD proposé par votre broker.' };
  }
  if (FUTURE_SYMBOLS[symbol]) return { ticker: FUTURE_SYMBOLS[symbol] };
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|LTC|BCH|AVAX|DOT|LINK|TRX|TON|XLM|SHIB)(USD|USDT)$/.test(symbol)) {
    const base = symbol.replace(/USDT?$/, '');
    return { ticker: base + '-USD', note: symbol.endsWith('USDT') ? 'La cotation USD est utilisée comme approximation de la paire USDT.' : undefined };
  }
  if (/^[A-Z]{6}$/.test(symbol)) return { ticker: symbol + '=X' };
  if (symbol === 'XAUUSD') return { ticker: 'XAUUSD=X', note: 'La disponibilité du symbole spot dépend du fournisseur.' };
  if (symbol === 'XAGUSD') return { ticker: 'XAGUSD=X', note: 'La disponibilité du symbole spot dépend du fournisseur.' };
  return { ticker: symbol };
}

function validNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Best-effort public quote lookup. No API key is required; coverage and delays depend on Yahoo Finance. */
export async function getMarketQuote(rawSymbol: string): Promise<MarketQuote | null> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{1,24}$/.test(symbol)) return null;
  const mapping = mapSymbol(symbol);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const url = new URL('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(mapping.ticker));
    url.searchParams.set('range', '5d');
    url.searchParams.set('interval', '1d');
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 IAMTRADER/1.0' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json() as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const meta = result?.meta;
    const price = validNumber(meta?.regularMarketPrice) ??
      validNumber(result?.indicators?.quote?.[0]?.close?.filter(value => value != null).slice(-1)[0]);
    if (!meta || !price) return null;
    const previous = validNumber(meta.chartPreviousClose) ?? validNumber(meta.previousClose);
    const change = previous ? price - previous : null;
    const changePercent = previous ? (change! / previous) * 100 : null;
    return {
      symbol,
      providerSymbol: mapping.ticker,
      price,
      currency: typeof meta.currency === 'string' ? meta.currency : null,
      bid: validNumber(meta.bid),
      ask: validNumber(meta.ask),
      change,
      changePercent,
      timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
      marketState: typeof meta.marketState === 'string' ? meta.marketState : null,
      source: 'Yahoo Finance',
      isProxy: Boolean(mapping.proxy),
      note: [mapping.note, 'Cotation publique susceptible d’être différée. Vérifiez le prix et le symbole chez votre broker avant toute exécution.'].filter(Boolean).join(' '),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
