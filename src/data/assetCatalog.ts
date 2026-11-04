import type { TradingInstrumentCategory } from '../types';

export type AssetDataStatus = 'indicative' | 'broker-dependent' | 'reference-only';

export interface CatalogAsset {
  symbol: string;
  name: string;
  category: TradingInstrumentCategory;
  market: string;
  aliases?: string[];
  brokers?: string[];
  priceStep?: number;
  valuePerPriceUnit?: number;
  dataStatus: AssetDataStatus;
  note: string;
}

const majorBrokers = ['Exness', 'IC Markets', 'Pepperstone', 'XM', 'FP Markets', 'AvaTrade', 'Eightcap', 'OANDA', 'FTMO', 'FundedNext'];

const forexPairs = [
  ['EURUSD','Euro / US Dollar'],['GBPUSD','British Pound / US Dollar'],['USDJPY','US Dollar / Japanese Yen'],['USDCHF','US Dollar / Swiss Franc'],['USDCAD','US Dollar / Canadian Dollar'],['AUDUSD','Australian Dollar / US Dollar'],['NZDUSD','New Zealand Dollar / US Dollar'],
  ['EURGBP','Euro / British Pound'],['EURJPY','Euro / Japanese Yen'],['EURCHF','Euro / Swiss Franc'],['EURCAD','Euro / Canadian Dollar'],['EURAUD','Euro / Australian Dollar'],['EURNZD','Euro / New Zealand Dollar'],
  ['GBPJPY','British Pound / Japanese Yen'],['GBPCHF','British Pound / Swiss Franc'],['GBPCAD','British Pound / Canadian Dollar'],['GBPAUD','British Pound / Australian Dollar'],['GBPNZD','British Pound / New Zealand Dollar'],
  ['AUDJPY','Australian Dollar / Japanese Yen'],['AUDCAD','Australian Dollar / Canadian Dollar'],['AUDCHF','Australian Dollar / Swiss Franc'],['AUDNZD','Australian Dollar / New Zealand Dollar'],
  ['NZDJPY','New Zealand Dollar / Japanese Yen'],['NZDCAD','New Zealand Dollar / Canadian Dollar'],['NZDCHF','New Zealand Dollar / Swiss Franc'],
  ['CADJPY','Canadian Dollar / Japanese Yen'],['CADCHF','Canadian Dollar / Swiss Franc'],['CHFJPY','Swiss Franc / Japanese Yen'],
  ['USDSGD','US Dollar / Singapore Dollar'],['USDHKD','US Dollar / Hong Kong Dollar'],['USDCNH','US Dollar / Offshore Chinese Yuan'],['USDZAR','US Dollar / South African Rand'],['USDMXN','US Dollar / Mexican Peso'],['USDTRY','US Dollar / Turkish Lira'],['USDNOK','US Dollar / Norwegian Krone'],['USDSEK','US Dollar / Swedish Krona'],['USDDKK','US Dollar / Danish Krone'],['USDPLN','US Dollar / Polish Zloty'],['USDHUF','US Dollar / Hungarian Forint'],['USDCZK','US Dollar / Czech Koruna'],['USDTHB','US Dollar / Thai Baht'],['USDINR','US Dollar / Indian Rupee'],['USDILS','US Dollar / Israeli Shekel']
] as const;

const assets: CatalogAsset[] = [
  ...forexPairs.map(([symbol,name]) => ({ symbol,name,category:'forex' as const,market:'Forex',brokers:majorBrokers,dataStatus:'broker-dependent' as const,note:'Spécifications, précision et valeur du pip à confirmer auprès du broker et selon la devise du compte.' })),
  ...[
    ['XAUUSD','Gold / US Dollar'],['XAGUSD','Silver / US Dollar'],['XPTUSD','Platinum / US Dollar'],['XPDUSD','Palladium / US Dollar']
  ].map(([symbol,name])=>({symbol,name,category:'metal' as const,market:'Métaux',brokers:majorBrokers,dataStatus:'broker-dependent' as const,note:'Taille de contrat et valeur du point variables selon le broker.'})),
  ...[
    ['US30','Dow Jones 30'],['DJI','Dow Jones Industrial Average'],['NAS100','Nasdaq 100'],['USTEC','US Tech 100'],['SPX500','S&P 500'],['US500','US 500'],['US2000','Russell 2000'],['VIX','CBOE Volatility Index'],['GER40','Germany 40 / DAX'],['DE40','Germany 40'],['UK100','FTSE 100'],['FRA40','France 40 / CAC 40'],['EU50','Euro Stoxx 50'],['STOXX50','EURO STOXX 50'],['ESP35','Spain 35'],['NETH25','Netherlands 25'],['SWI20','Switzerland 20'],['AUS200','Australia 200'],['JPN225','Japan 225 / Nikkei'],['HK50','Hong Kong 50'],['CHINA50','China A50'],['SG20','Singapore 20'],['SA40','South Africa 40']
  ].map(([symbol,name])=>({symbol,name,category:'index' as const,market:'Indices cash',brokers:majorBrokers,dataStatus:'broker-dependent' as const,note:'Le symbole et la valeur du point varient selon le fournisseur.'})),
  ...[
    ['USOIL','WTI Crude Oil'],['UKOIL','Brent Crude Oil'],['XNGUSD','Natural Gas'],['COPPER','Copper'],['WHEAT','Wheat'],['CORN','Corn'],['SOYBEAN','Soybeans'],['COFFEE','Coffee'],['SUGAR','Sugar'],['COTTON','Cotton'],['COCOA','Cocoa']
  ].map(([symbol,name])=>({symbol,name,category:'commodity' as const,market:'Matières premières',brokers:majorBrokers,dataStatus:'broker-dependent' as const,note:'Contrat CFD ou futures à identifier avant de renseigner la valeur du tick.'})),
  ...[
    ['BTCUSD','Bitcoin / US Dollar'],['ETHUSD','Ethereum / US Dollar'],['LTCUSD','Litecoin / US Dollar'],['XRPUSD','XRP / US Dollar'],['BCHUSD','Bitcoin Cash / US Dollar'],['ADAUSD','Cardano / US Dollar'],['SOLUSD','Solana / US Dollar'],['DOTUSD','Polkadot / US Dollar'],['DOGEUSD','Dogecoin / US Dollar'],['AVAXUSD','Avalanche / US Dollar'],['LINKUSD','Chainlink / US Dollar'],['BNBUSD','BNB / US Dollar'],['TRXUSD','TRON / US Dollar'],['XLMUSD','Stellar / US Dollar'],['ETCUSD','Ethereum Classic / US Dollar']
  ].map(([symbol,name])=>({symbol,name,category:'crypto' as const,market:'Crypto',brokers:majorBrokers,dataStatus:'broker-dependent' as const,note:'Symbole, taille de contrat, financement et horaires dépendent de la plateforme.'})),
  ...[
    ['AAPL','Apple'],['MSFT','Microsoft'],['NVDA','NVIDIA'],['AMZN','Amazon'],['GOOGL','Alphabet Class A'],['META','Meta Platforms'],['TSLA','Tesla'],['BRK.B','Berkshire Hathaway B'],['JPM','JPMorgan Chase'],['V','Visa'],['MA','Mastercard'],['WMT','Walmart'],['LLY','Eli Lilly'],['AVGO','Broadcom'],['ORCL','Oracle'],['NFLX','Netflix'],['AMD','AMD'],['INTC','Intel'],['COST','Costco'],['DIS','Disney'],['KO','Coca-Cola'],['PEP','PepsiCo'],['BABA','Alibaba'],['TSM','Taiwan Semiconductor'],['SAP','SAP'],['ASML','ASML'],['MC.PA','LVMH'],['AIR.PA','Airbus'],['RACE','Ferrari'],['SONY','Sony']
  ].map(([symbol,name])=>({symbol,name,category:'stock' as const,market:'Actions',brokers:['Interactive Brokers','Saxo','IG','Pepperstone','Eightcap'],dataStatus:'broker-dependent' as const,note:'Place de cotation, devise, taille minimale et horaires à confirmer.'})),
  ...[
    ['SPY','SPDR S&P 500 ETF'],['QQQ','Invesco QQQ'],['DIA','SPDR Dow Jones ETF'],['IWM','iShares Russell 2000 ETF'],['GLD','SPDR Gold Shares'],['SLV','iShares Silver Trust'],['USO','United States Oil Fund'],['TLT','iShares 20+ Year Treasury ETF'],['EEM','iShares Emerging Markets ETF'],['VTI','Vanguard Total Stock Market ETF']
  ].map(([symbol,name])=>({symbol,name,category:'etf' as const,market:'ETF',brokers:['Interactive Brokers','Saxo','IG'],dataStatus:'broker-dependent' as const,note:'Vérifier la place de cotation, la devise et les conditions du broker.'})),
  ...[
    ['US10Y','US 10Y Treasury Yield'],['US30Y','US 30Y Treasury Yield'],['US02Y','US 2Y Treasury Yield'],['DE10Y','German 10Y Bund Yield'],['UK10Y','UK 10Y Gilt Yield']
  ].map(([symbol,name])=>({symbol,name,category:'bond' as const,market:'Obligations / rendements',brokers:['IG','TradingView data providers','Interactive Brokers'],dataStatus:'reference-only' as const,note:'Selon le broker, il peut s’agir d’un rendement indicatif et non d’un instrument négociable.'})),
  ...[
    ['ES','E-mini S&P 500'],['MES','Micro E-mini S&P 500'],['NQ','E-mini Nasdaq 100'],['MNQ','Micro E-mini Nasdaq 100'],['YM','E-mini Dow'],['MYM','Micro E-mini Dow'],['RTY','E-mini Russell 2000'],['M2K','Micro E-mini Russell 2000'],['GC','Gold Futures'],['MGC','Micro Gold Futures'],['SI','Silver Futures'],['CL','WTI Crude Oil Futures'],['MCL','Micro WTI Futures'],['NG','Natural Gas Futures'],['ZB','30Y US Treasury Bond Futures'],['ZN','10Y US Treasury Note Futures'],['ZF','5Y US Treasury Note Futures'],['ZT','2Y US Treasury Note Futures'],['6E','Euro FX Futures'],['6B','British Pound Futures'],['6J','Japanese Yen Futures'],['6A','Australian Dollar Futures'],['6C','Canadian Dollar Futures'],['6S','Swiss Franc Futures'],['ZC','Corn Futures'],['ZW','Wheat Futures'],['ZS','Soybean Futures']
  ].map(([symbol,name])=>({symbol,name,category:'futures' as const,market:'Futures',brokers:['CME','ICE','NinjaTrader','Interactive Brokers','Tradovate'],dataStatus:'broker-dependent' as const,note:'Contrat, échéance, multiplicateur et tick value dépendent de la série et de la bourse.'})),
  ...[
    ['V10','Volatility 10 Index'],['V25','Volatility 25 Index'],['V50','Volatility 50 Index'],['V75','Volatility 75 Index'],['V100','Volatility 100 Index'],
    ['V10_1S','Volatility 10 (1s) Index'],['V25_1S','Volatility 25 (1s) Index'],['V50_1S','Volatility 50 (1s) Index'],['V75_1S','Volatility 75 (1s) Index'],['V100_1S','Volatility 100 (1s) Index'],
    ['BOOM300','Boom 300 Index'],['BOOM500','Boom 500 Index'],['BOOM600','Boom 600 Index'],['BOOM900','Boom 900 Index'],['BOOM1000','Boom 1000 Index'],
    ['CRASH300','Crash 300 Index'],['CRASH500','Crash 500 Index'],['CRASH600','Crash 600 Index'],['CRASH900','Crash 900 Index'],['CRASH1000','Crash 1000 Index'],
    ['STEP','Step Index'],['JUMP10','Jump 10 Index'],['JUMP25','Jump 25 Index'],['JUMP50','Jump 50 Index'],['JUMP75','Jump 75 Index'],['JUMP100','Jump 100 Index'],
    ['RANGE_BREAK_100','Range Break 100 Index'],['RANGE_BREAK_200','Range Break 200 Index'],['DRIFT_SWITCH','Drift Switch Index']
  ].map(([symbol,name])=>({symbol,name,category:'synthetic' as const,market:'Indices synthétiques',brokers:['Deriv'],dataStatus:'broker-dependent' as const,note:'Produit propriétaire Deriv : vérifier le symbole exact, le contrat et la valeur du tick dans les spécifications du symbole Deriv.'})),
  ...[
    ['AAPL_C','Apple Call Option'],['AAPL_P','Apple Put Option'],['SPX_C','S&P 500 Call Option'],['SPX_P','S&P 500 Put Option'],['ES_OPTIONS','E-mini S&P 500 Options']
  ].map(([symbol,name])=>({symbol,name,category:'option' as const,market:'Options',brokers:['CME','CBOE','Interactive Brokers'],dataStatus:'reference-only' as const,note:'Le contrat doit inclure sous-jacent, échéance, strike, type call/put et multiplicateur.'}))
];

export const ASSET_CATALOG: CatalogAsset[] = assets;

export function searchAssetCatalog(query: string, limit = 30): CatalogAsset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return ASSET_CATALOG.slice(0, limit);
  return ASSET_CATALOG.filter(asset =>
    [asset.symbol, asset.name, asset.market, ...(asset.aliases || []), ...(asset.brokers || [])]
      .some(value => value.toLowerCase().includes(normalized))
  ).slice(0, limit);
}
