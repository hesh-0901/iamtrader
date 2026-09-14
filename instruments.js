export const INSTRUMENTS = Object.freeze({
  XAUUSD: { symbol:'XAUUSD', name:'Gold', contractSize:100, tickSize:0.01, pipSize:0.10, quoteCurrency:'USD', lotStep:0.01, minLot:0.01 },
  EURUSD: { symbol:'EURUSD', name:'Euro / US Dollar', contractSize:100000, tickSize:0.00001, pipSize:0.0001, quoteCurrency:'USD', lotStep:0.01, minLot:0.01 },
  GBPUSD: { symbol:'GBPUSD', name:'Pound / US Dollar', contractSize:100000, tickSize:0.00001, pipSize:0.0001, quoteCurrency:'USD', lotStep:0.01, minLot:0.01 },
  USDJPY: { symbol:'USDJPY', name:'US Dollar / Yen', contractSize:100000, tickSize:0.001, pipSize:0.01, quoteCurrency:'JPY', lotStep:0.01, minLot:0.01 },
  NAS100: { symbol:'NAS100', name:'Nasdaq 100', contractSize:10, tickSize:0.01, pipSize:1, quoteCurrency:'USD', lotStep:0.01, minLot:0.01 },
  US30: { symbol:'US30', name:'Dow Jones 30', contractSize:10, tickSize:0.01, pipSize:1, quoteCurrency:'USD', lotStep:0.01, minLot:0.01 },
  SPX500: { symbol:'SPX500', name:'S&P 500', contractSize:10, tickSize:0.01, pipSize:1, quoteCurrency:'USD', lotStep:0.01, minLot:0.01 },
  XAGUSD: { symbol:'XAGUSD', name:'Silver', contractSize:5000, tickSize:0.001, pipSize:0.01, quoteCurrency:'USD', lotStep:0.01, minLot:0.01 }
});

export function getInstrument(symbol){ return INSTRUMENTS[symbol] || null; }
