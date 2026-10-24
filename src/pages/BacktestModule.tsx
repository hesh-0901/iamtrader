import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CandlestickData, CandlestickSeries, IChartApi, ISeriesApi, Time, LineStyle } from 'lightweight-charts';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { addTrade } from '../services/firestore';
import { ArrowDown, ArrowUp, BrainCircuit, ChartCandlestick, ChevronRight, CircleDollarSign, Play, Pause, RotateCcw, Save, SkipForward, Target, TrendingDown, TrendingUp } from 'lucide-react';

type Candle = CandlestickData<Time> & { volume: number };
type Side = 'BUY' | 'SELL';
type SimTrade = { id: string; side: Side; entry: number; sl: number; tp: number; riskAmount: number; riskPct: number; status: 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN'; pnl: number; openedAt: string; closedAt?: string; exit?: number; closeReason?: string };
const START_BALANCE = 10000;
const DATA_NOTICE = 'Jeu de démonstration synthétique — ne représente pas des cotations historiques réelles.';

function makeDemoCandles(): Candle[] {
  // Reproducible local data: fully offline, deliberately labelled synthetic.
  const result: Candle[] = [];
  let close = 2328.4;
  const start = Date.UTC(2024, 0, 2, 0, 0, 0) / 1000;
  let seed = 812733;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 900; i++) {
    const open = close;
    const drift = Math.sin(i / 33) * 0.42 + Math.sin(i / 9) * 0.16 + (rand() - 0.49) * 2.5;
    close = Math.max(1800, open + drift);
    const high = Math.max(open, close) + rand() * 1.6;
    const low = Math.min(open, close) - rand() * 1.6;
    result.push({ time: (start + i * 15 * 60) as Time, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume: Math.round(50 + rand() * 450) });
  }
  return result;
}
const DATA = makeDemoCandles();
const money = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const price = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (time: Time) => new Date(Number(time) * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' });

export function BacktestModule({ onAskChloe }: { onAskChloe?: (summary: string) => void }) {
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<Array<{ remove: () => void }>>([]);
  const [timeframe, setTimeframe] = useState<'M15' | 'H1' | 'D1'>('M15');
  const [currentIndex, setCurrentIndex] = useState(120);
  const [speed, setSpeed] = useState(1000);
  const [playing, setPlaying] = useState(false);
  const [balance, setBalance] = useState(START_BALANCE);
  const [riskPct, setRiskPct] = useState(1);
  const [slDistance, setSlDistance] = useState(3);
  const [rr, setRr] = useState(2);
  const [position, setPosition] = useState<SimTrade | null>(null);
  const [trades, setTrades] = useState<SimTrade[]>([]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);

  const candles = useMemo(() => {
    const factor = timeframe === 'M15' ? 1 : timeframe === 'H1' ? 4 : 96;
    if (factor === 1) return DATA;
    const grouped: Candle[] = [];
    for (let i = 0; i < DATA.length; i += factor) {
      const slice = DATA.slice(i, i + factor);
      if (!slice.length) continue;
      grouped.push({ time: slice[0].time, open: slice[0].open, high: Math.max(...slice.map(c => c.high)), low: Math.min(...slice.map(c => c.low)), close: slice[slice.length - 1].close, volume: slice.reduce((sum, c) => sum + c.volume, 0) });
    }
    return grouped;
  }, [timeframe]);
  const visible = useMemo(() => candles.slice(0, Math.min(currentIndex + 1, candles.length)), [candles, currentIndex]);
  const closed = trades.filter(t => t.status !== 'OPEN');
  const wins = closed.filter(t => t.pnl > 0);
  const grossWin = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(closed.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const winrate = closed.length ? wins.length / closed.length * 100 : 0;
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0;
  const avgRR = closed.length ? closed.reduce((sum, t) => sum + t.pnl / Math.max(t.riskAmount, 0.01), 0) / closed.length : 0;
  const currentCandle = visible[visible.length - 1];

  const clearPriceLines = useCallback(() => {
    const series = candleSeriesRef.current;
    if (series) priceLinesRef.current.forEach(line => { try { series.removePriceLine(line as any); } catch {} });
    priceLinesRef.current = [];
  }, []);

  useEffect(() => {
    if (!chartContainer.current) return;
    const chart = createChart(chartContainer.current, {
      autoSize: true, layout: { background: { color: '#ffffff' }, textColor: '#64748b', fontFamily: 'Inter, sans-serif' },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      rightPriceScale: { borderColor: '#e2e8f0' }, timeScale: { borderColor: '#e2e8f0', timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: '#94a3b8', style: LineStyle.Dashed }, horzLine: { color: '#94a3b8', style: LineStyle.Dashed } }
    });
    const series = chart.addSeries(CandlestickSeries, { upColor: '#00a982', downColor: '#f05252', borderUpColor: '#00a982', borderDownColor: '#f05252', wickUpColor: '#00a982', wickDownColor: '#f05252' });
    chartRef.current = chart; candleSeriesRef.current = series;
    const resizeObserver = new ResizeObserver(() => chart.timeScale().fitContent());
    resizeObserver.observe(chartContainer.current);
    return () => { resizeObserver.disconnect(); chart.remove(); chartRef.current = null; candleSeriesRef.current = null; priceLinesRef.current = []; };
  }, []);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series || !visible.length) return;
    series.setData(visible);
    chartRef.current?.timeScale().fitContent();
    clearPriceLines();
    if (position?.status === 'OPEN') {
      const lines = [
        { price: position.entry, color: '#0b1f35', title: 'Entrée' },
        { price: position.sl, color: '#f05252', title: 'SL' },
        { price: position.tp, color: '#00a982', title: 'TP' }
      ];
      lines.forEach(line => priceLinesRef.current.push(series.createPriceLine({ price: line.price, color: line.color, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: line.title })));
    }
  }, [visible, position, clearPriceLines]);

  const advanceOne = useCallback(() => {
    setCurrentIndex(index => {
      if (index >= candles.length - 1) { setPlaying(false); return index; }
      const nextIndex = index + 1;
      const candle = candles[nextIndex];
      setPosition(open => {
        if (!open || open.status !== 'OPEN') return open;
        const slTouched = open.side === 'BUY' ? candle.low <= open.sl : candle.high >= open.sl;
        const tpTouched = open.side === 'BUY' ? candle.high >= open.tp : candle.low <= open.tp;
        // Conservative bar-only rule: if SL and TP are both inside one candle, SL is assumed first.
        const reason = slTouched ? 'SL' : tpTouched ? 'TP' : '';
        if (!reason) return open;
        const exit = reason === 'SL' ? open.sl : open.tp;
        const pnl = reason === 'SL' ? -open.riskAmount : open.riskAmount * rr;
        const closedTrade: SimTrade = { ...open, status: pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN', pnl, exit, closeReason: reason, closedAt: dateLabel(candle.time) };
        setTrades(previous => previous.map(t => t.id === open.id ? closedTrade : t));
        setBalance(previous => previous + pnl);
        setNotice(`Trade clôturé sur ${reason} · ${money(pnl)}`);
        return null;
      });
      return nextIndex;
    });
  }, [candles, rr]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(advanceOne, speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, advanceOne]);
  useEffect(() => { if (currentIndex >= candles.length - 1) setPlaying(false); }, [currentIndex, candles.length]);

  const placeOrder = (side: Side) => {
    if (!currentCandle || position?.status === 'OPEN') return;
    const entry = currentCandle.close;
    const distance = Math.max(0.01, slDistance);
    const riskAmount = balance * riskPct / 100;
    const sl = side === 'BUY' ? entry - distance : entry + distance;
    const tp = side === 'BUY' ? entry + distance * rr : entry - distance * rr;
    const trade: SimTrade = { id: `bt-${Date.now()}`, side, entry, sl, tp, riskAmount, riskPct, status: 'OPEN', pnl: 0, openedAt: dateLabel(currentCandle.time) };
    setPosition(trade); setTrades(previous => [...previous, trade]); setNotice(`${side === 'BUY' ? 'Achat' : 'Vente'} virtuel ouvert à ${price(entry)}`); setSessionSaved(false);
  };

  const reset = () => { setPlaying(false); setCurrentIndex(Math.min(120, candles.length - 1)); setBalance(START_BALANCE); setPosition(null); setTrades([]); setNotice('Session réinitialisée.'); setSessionSaved(false); };

  const summary = useMemo(() => JSON.stringify({
    symbol: 'XAUUSD', timeframe, dataType: 'synthetic-demo', startingBalance: START_BALANCE, finalBalance: balance,
    netPnl: balance - START_BALANCE, trades: trades.map(({ id, ...trade }) => trade), winrate: +winrate.toFixed(2),
    profitFactor: Number.isFinite(profitFactor) ? +profitFactor.toFixed(2) : 'Infinity', averageR: +avgRR.toFixed(2),
    note: DATA_NOTICE
  }, null, 2), [timeframe, balance, trades, winrate, profitFactor, avgRR]);

  const saveSession = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setNotice('Connectez-vous pour enregistrer la session.'); return; }
    if (!trades.length) { setNotice('Effectuez au moins un trade avant l’enregistrement.'); return; }
    setSaving(true); setNotice('');
    try {
      await addDoc(collection(db, 'backtestSessions'), {
        userId: uid, symbol: 'XAUUSD', timeframe, startingBalance: START_BALANCE, finalBalance: balance,
        netPnl: balance - START_BALANCE, tradeCount: trades.length, winrate, profitFactor: Number.isFinite(profitFactor) ? profitFactor : null,
        averageR: avgRR, trades, summaryJson: summary, dataType: 'synthetic-demo', createdAt: serverTimestamp()
      });
      for (const trade of closed) {
        await addTrade({
          userId: uid, accountId: '', symbol: 'XAUUSD', direction: trade.side,
          result: trade.pnl > 0 ? 'WIN' : trade.pnl < 0 ? 'LOSS' : 'BREAKEVEN',
          pnl: trade.pnl, commission: 0, entryDate: new Date().toISOString(), exitDate: new Date().toISOString(),
          entryPrice: trade.entry, exitPrice: trade.exit || trade.entry, stopLoss: trade.sl, takeProfit: trade.tp,
          setup: 'Backtest XAUUSD', session: 'Backtest', emotion: 'NEUTRAL', notes: `Trade issu d’une simulation ${trade.openedAt}; sortie ${trade.closedAt || ''}; raison ${trade.closeReason || ''}; dataset synthétique de démonstration.`,
          rMultiple: trade.riskAmount ? trade.pnl / trade.riskAmount : 0
        } as any);
      }
      setSessionSaved(true); setNotice('Session enregistrée et trades clôturés ajoutés au Journal.');
    } catch (error) {
      console.error('[Backtest] Save failed', error);
      setNotice('Enregistrement incomplet. Vérifiez les autorisations Firestore avant de réessayer.');
    } finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700"><ChartCandlestick className="h-3.5 w-3.5" /> Replay de marché · mode simulation</div><h1 className="text-2xl font-black tracking-tight text-[#0b1f35]">Backtest XAUUSD</h1><p className="mt-1 text-xs leading-5 text-slate-500">Avancez bougie par bougie, gérez votre risque et mesurez votre exécution.</p></div>
      <button onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"><RotateCcw className="h-4 w-4" /> Réinitialiser</button>
    </header>
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Données de démonstration.</strong> {DATA_NOTICE} Le replay fonctionne hors ligne et ne doit pas être utilisé comme historique de marché réel.</div>
    {notice && <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{label:'Balance',value:money(balance),icon:CircleDollarSign},{label:'P&L net',value:money(balance-START_BALANCE),icon:balance>=START_BALANCE?TrendingUp:TrendingDown},{label:'Winrate',value:winrate.toFixed(1)+'%',icon:Target},{label:'Trades clôturés',value:String(closed.length),icon:ChartCandlestick}].map(metric=>{const Icon=metric.icon;return <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400"><span>{metric.label}</span><Icon className="h-4 w-4 text-emerald-600"/></div><p className="mt-2 text-xl font-black tabular-nums text-[#0b1f35]">{metric.value}</p></div>})}
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3 sm:px-4"><div><p className="text-sm font-extrabold text-[#0b1f35]">XAUUSD <span className="text-[10px] font-semibold text-slate-400">GOLD · synthétique</span></p><p className="mt-1 text-[10px] text-slate-500">{currentCandle ? dateLabel(currentCandle.time) : '—'} · Bougie {currentIndex+1}/{candles.length}</p></div><div className="flex gap-1 rounded-lg bg-slate-100 p-1">{(['M15','H1','D1'] as const).map(tf=><button key={tf} onClick={()=>{setPlaying(false);setTimeframe(tf);setCurrentIndex(Math.min(currentIndex,Math.ceil(DATA.length/(tf==='M15'?1:tf==='H1'?4:96))-1));setPosition(null)}} className={`rounded-md px-3 py-1.5 text-xs font-bold ${timeframe===tf?'bg-white text-emerald-700 shadow-sm':'text-slate-500'}`}>{tf}</button>)}</div></div>
        <div ref={chartContainer} className="h-[360px] w-full sm:h-[480px]" />
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3"><button onClick={()=>setPlaying(v=>!v)} disabled={currentIndex>=candles.length-1} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f35] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{playing?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}{playing?'Pause':'Play'}</button><button onClick={advanceOne} disabled={playing||currentIndex>=candles.length-1} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-40"><SkipForward className="h-4 w-4"/>Bougie suivante</button><label className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">Vitesse<select value={speed} onChange={e=>setSpeed(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value={500}>0,5 s</option><option value={1000}>1 s</option><option value={2000}>2 s</option></select></label></div>
        <div className="px-4 pb-4"><input aria-label="Position du replay" type="range" min={0} max={candles.length-1} value={currentIndex} onChange={e=>{setPlaying(false);setCurrentIndex(Number(e.target.value))}} className="w-full accent-emerald-600"/><div className="flex justify-between text-[9px] text-slate-400"><span>Début</span><span>Départ : <input type="date" aria-label="Date de départ" value={new Date(Number(candles[Math.min(currentIndex,candles.length-1)].time)*1000).toISOString().slice(0,10)} onChange={e=>{const target=Date.parse(e.target.value+'T00:00:00Z')/1000;const index=candles.findIndex(c=>Number(c.time)>=target);if(index>=0){setPlaying(false);setCurrentIndex(index)}}} className="rounded border border-slate-200 px-1 py-0.5 text-slate-600"/></span><span>Fin</span></div></div>
      </section>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-extrabold text-[#0b1f35]">Passage d’ordre virtuel</h2><p className="mt-1 text-[10px] text-slate-500">Entrée au cours de clôture affiché.</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>placeOrder('BUY')} disabled={!currentCandle||!!position} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-xs font-extrabold text-white disabled:opacity-40"><ArrowUp className="h-4 w-4"/>Buy</button><button onClick={()=>placeOrder('SELL')} disabled={!currentCandle||!!position} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-3 text-xs font-extrabold text-white disabled:opacity-40"><ArrowDown className="h-4 w-4"/>Sell</button></div><div className="mt-4 space-y-3"><label className="block text-[10px] font-bold text-slate-500">Risque (% balance)<input type="number" min="0.1" max="10" step="0.1" value={riskPct} onChange={e=>setRiskPct(Math.max(.1,Math.min(10,Number(e.target.value)||.1)))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"/></label><label className="block text-[10px] font-bold text-slate-500">Distance SL (prix XAUUSD)<input type="number" min="0.1" step="0.1" value={slDistance} onChange={e=>setSlDistance(Math.max(.1,Number(e.target.value)||.1))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"/></label><label className="block text-[10px] font-bold text-slate-500">Ratio Risk/Reward<select value={rr} onChange={e=>setRr(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value={1}>1:1</option><option value={1.5}>1:1,5</option><option value={2}>1:2</option><option value={3}>1:3</option></select></label></div>{position?.status==='OPEN'&&<div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs"><p className="font-bold text-emerald-900">Position ouverte · {position.side}</p><p className="mt-1 text-slate-600">Entrée {price(position.entry)} · SL {price(position.sl)} · TP {price(position.tp)}</p><p className="mt-1 text-slate-500">Risque estimé : {money(position.riskAmount)}</p></div>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-extrabold text-[#0b1f35]">Qualité d’exécution</h2><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><span className="text-slate-500">Profit Factor</span><strong>{profitFactor===Infinity?'∞':profitFactor.toFixed(2)}</strong></div><div className="flex justify-between"><span className="text-slate-500">R moyen</span><strong>{avgRR.toFixed(2)}R</strong></div><div className="flex justify-between"><span className="text-slate-500">Trades exécutés</span><strong>{trades.length}</strong></div><div className="flex justify-between"><span className="text-slate-500">Position</span><strong>{position?'Ouverte':'Aucune'}</strong></div></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-extrabold text-[#0b1f35]">Fin de session</h2><p className="mt-1 text-[10px] leading-5 text-slate-500">Enregistrez les trades clôturés dans le Journal et conservez le résumé de session.</p><button onClick={()=>void saveSession()} disabled={saving||!trades.length||sessionSaved} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a982] px-3 py-3 text-xs font-extrabold text-white disabled:opacity-40">{saving?<span>Enregistrement…</span>:<><Save className="h-4 w-4"/>{sessionSaved?'Session enregistrée':'Enregistrer dans mon Journal'}</>}</button><button onClick={()=>onAskChloe?.('Analyse cette session de backtest XAUUSD avec esprit critique. Les données de marché utilisées sont synthétiques, pas historiques réelles. Résumé JSON :\n'+summary)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><BrainCircuit className="h-4 w-4"/>Analyser avec Chloé</button><p className="mt-2 break-all text-[9px] text-slate-400">Résumé JSON prêt pour l’analyse IA.</p></section>
      </aside>
    </div>
  </div>;
}
