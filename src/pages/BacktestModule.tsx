import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, ChevronDown, CircleHelp, Crosshair, Eraser, Expand, Minus, MousePointer2, Pause, Play, Plus, RotateCcw, Ruler, Settings2, TrendingDown, TrendingUp, X, ZoomIn, ZoomOut } from 'lucide-react';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type Tool = 'cursor' | 'crosshair' | 'trend' | 'horizontal' | 'vertical' | 'rectangle' | 'measure';
type Drawing = { id: number; tool: Tool; x1: number; y1: number; x2: number; y2: number };
type SimOrder = { side: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; index: number; result?: number };
const GREEN = '#089981';
const RED = '#f23645';
const DATA_NOTICE = 'Bougies synthétiques de démonstration — aucune cotation historique réelle n’est chargée.';
const price = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const timeLabel = (t: number) => new Date(t * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' });

function makeCandles(): Candle[] {
  const out: Candle[] = [];
  let close = 2328.4, seed = 812733;
  const rand = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  let t = Date.UTC(2024, 0, 2) / 1000;
  for (let i = 0; i < 1800; i++) {
    const open = close;
    close = Math.max(1800, open + Math.sin(i / 33) * .42 + Math.sin(i / 9) * .16 + (rand() - .49) * 2.5);
    out.push({ time: t + i * 900, open: +open.toFixed(2), close: +close.toFixed(2), high: +(Math.max(open, close) + rand() * 1.6).toFixed(2), low: +(Math.min(open, close) - rand() * 1.6).toFixed(2), volume: Math.round(50 + rand() * 450) });
  }
  return out;
}
const DATA = makeCandles();

function ema(values: number[], period: number) {
  const alpha = 2 / (period + 1);
  return values.reduce<number[]>((arr, value, i) => { arr.push(i === 0 ? value : value * alpha + arr[i - 1] * (1 - alpha)); return arr; }, []);
}

export function BacktestModule() {
  const [timeframe, setTimeframe] = useState('M15');
  const [tool, setTool] = useState<Tool>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [showVolume, setShowVolume] = useState(true);
  const [showEMA, setShowEMA] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(260);
  const [visibleCount, setVisibleCount] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [balance, setBalance] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const [slDistance, setSlDistance] = useState(3);
  const [rr, setRr] = useState(2);
  const [orders, setOrders] = useState<SimOrder[]>([]);
  const [notice, setNotice] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  const candles = useMemo(() => {
    const factor = timeframe === 'M1' ? 1 : timeframe === 'M5' ? 5 : timeframe === 'M15' ? 15 : timeframe === 'H1' ? 60 : timeframe === 'H4' ? 240 : 1440;
    if (factor === 15) return DATA;
    const group = Math.max(1, Math.round(factor / 15));
    const out: Candle[] = [];
    for (let i = 0; i < DATA.length; i += group) {
      const s = DATA.slice(i, i + group);
      if (s.length) out.push({ time: s[0].time, open: s[0].open, high: Math.max(...s.map(c => c.high)), low: Math.min(...s.map(c => c.low)), close: s[s.length - 1].close, volume: s.reduce((n, c) => n + c.volume, 0) });
    }
    return out;
  }, [timeframe]);
  const lastIndex = Math.min(currentIndex, candles.length - 1);
  const start = Math.max(0, lastIndex - visibleCount + 1);
  const visible = candles.slice(start, lastIndex + 1);
  const current = candles[lastIndex];
  const closeValues = visible.map(c => c.close);
  const emaValues = useMemo(() => ema(closeValues, 20), [visible.length, lastIndex, timeframe]);
  const maxPrice = Math.max(...visible.map(c => c.high), current?.close || 0) + 1;
  const minPrice = Math.min(...visible.map(c => c.low), current?.close || 0) - 1;
  const range = Math.max(maxPrice - minPrice, .01);
  const plot = { left: 18, right: 1100, top: 22, bottom: 478 };
  const xFor = (i: number) => plot.left + (i + .5) * (plot.right - plot.left) / Math.max(visible.length, 1);
  const yFor = (p: number) => plot.bottom - (p - minPrice) / range * (plot.bottom - plot.top);
  const priceForY = (y: number) => minPrice + (plot.bottom - y) / (plot.bottom - plot.top) * range;
  const xForTime = (x: number) => Math.max(0, Math.min(1, (x - plot.left) / (plot.right - plot.left)));
  const closedOrders = orders.filter(o => o.result !== undefined);
  const wins = closedOrders.filter(o => (o.result || 0) > 0);
  const netPnl = closedOrders.reduce((n, o) => n + (o.result || 0), 0);
  const winRate = closedOrders.length ? wins.length / closedOrders.length * 100 : 0;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setCurrentIndex(i => {
      if (i >= candles.length - 1) { setPlaying(false); return i; }
      const next = i + 1;
      const candle = candles[next];
      setOrders(previous => previous.map(o => {
        if (o.result !== undefined) return o;
        const slHit = o.side === 'BUY' ? candle.low <= o.sl : candle.high >= o.sl;
        const tpHit = o.side === 'BUY' ? candle.high >= o.tp : candle.low <= o.tp;
        if (!slHit && !tpHit) return o;
        const result = slHit ? -(balance * riskPct / 100) : balance * riskPct / 100 * rr;
        setBalance(b => b + result);
        setNotice(`Trade clôturé sur ${slHit ? 'SL' : 'TP'} : ${result.toFixed(2)} USD (simulation)`);
        return { ...o, result };
      }));
      return next;
    }), Math.max(80, 1000 / speed));
    return () => window.clearInterval(timer);
  }, [playing, speed, candles, balance, riskPct, rr]);

  const selectTool = (next: Tool) => { setTool(next); setDraft(null); };
  const pointerPosition = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: plot.left, y: plot.top };
    const rect = svg.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 1200, y: (event.clientY - rect.top) / rect.height * 620 };
  };
  const onChartClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (tool === 'cursor') return;
    const p = pointerPosition(event);
    const x = Math.max(plot.left, Math.min(plot.right, p.x));
    const y = Math.max(plot.top, Math.min(plot.bottom, p.y));
    if (tool === 'horizontal' || tool === 'vertical') {
      setDrawings(ds => [...ds, { id: Date.now(), tool, x1: tool === 'vertical' ? x : plot.left, x2: tool === 'vertical' ? x : plot.right, y1: tool === 'horizontal' ? y : plot.top, y2: tool === 'horizontal' ? y : plot.bottom }]);
      return;
    }
    if (!draft) setDraft({ id: Date.now(), tool, x1: x, y1: y, x2: x, y2: y });
    else { setDrawings(ds => [...ds, { ...draft, x2: x, y2: y }]); setDraft(null); }
  };
  const placeOrder = (side: 'BUY' | 'SELL') => {
    if (!current) return;
    const entry = current.close;
    const distance = Math.max(.01, slDistance);
    setOrders(os => [...os, { side, entry, sl: side === 'BUY' ? entry - distance : entry + distance, tp: side === 'BUY' ? entry + distance * rr : entry - distance * rr, index: lastIndex }]);
    setNotice(`${side === 'BUY' ? 'Achat' : 'Vente'} simulé à ${price(entry)}`);
  };
  const reset = () => { setPlaying(false); setCurrentIndex(Math.min(260, candles.length - 1)); setOrders([]); setBalance(10000); setDrawings([]); setDraft(null); setNotice('Session réinitialisée.'); };

  const toolButtons: { id: Tool; label: string; icon: React.ElementType }[] = [
    { id: 'cursor', label: 'Sélection', icon: MousePointer2 }, { id: 'crosshair', label: 'Réticule', icon: Crosshair },
    { id: 'trend', label: 'Ligne de tendance', icon: TrendingUp }, { id: 'horizontal', label: 'Ligne horizontale', icon: Minus },
    { id: 'vertical', label: 'Ligne verticale', icon: Activity }, { id: 'rectangle', label: 'Rectangle', icon: Expand }, { id: 'measure', label: 'Mesure', icon: Ruler }
  ];

  return <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#131722] text-[#d1d4dc]" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
    <header className="flex min-h-[54px] flex-wrap items-center gap-2 border-b border-[#2a2e39] bg-[#131722] px-3 py-2">
      <div className="flex items-center gap-2 border-r border-[#2a2e39] pr-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2962ff] text-xs font-black text-white">IAM</span><div><div className="text-sm font-bold text-white">Chart Studio</div><div className="text-[9px] uppercase tracking-[.18em] text-[#787b86]">Independent replay</div></div></div>
      <button className="rounded px-3 py-2 text-sm font-bold text-white hover:bg-[#2a2e39]">XAUUSD <ChevronDown className="ml-1 inline h-3 w-3" /></button>
      <span className="hidden text-xs text-[#787b86] md:inline">Gold / U.S. Dollar</span>
      <div className="flex items-center gap-1 rounded-md bg-[#1e222d] p-1">{['M1','M5','M15','H1','H4','D1'].map(tf => <button key={tf} onClick={() => { setTimeframe(tf); setCurrentIndex(Math.min(lastIndex, DATA.length - 1)); }} className={`rounded px-2 py-1 text-xs font-semibold ${timeframe === tf ? 'bg-[#2962ff] text-white' : 'text-[#aab0bd] hover:bg-[#2a2e39]'}`}>{tf}</button>)}</div>
      <button onClick={() => setShowMenu(v => !v)} className="flex items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-[#2a2e39]"><Activity className="h-4 w-4" /> Indicateurs</button>
      <div className="ml-auto flex items-center gap-2"><span className="hidden text-[10px] text-[#787b86] lg:inline">SIMULATION LOCALE</span><button title="Réinitialiser" onClick={reset} className="rounded-md p-2 hover:bg-[#2a2e39]"><RotateCcw className="h-4 w-4" /></button><button title="Fermer le plein écran" onClick={() => setNotice('Le graphique reste en plein écran dans l’onglet Backtest.')} className="rounded-md p-2 hover:bg-[#2a2e39]"><Settings2 className="h-4 w-4" /></button></div>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[48px] shrink-0 flex-col items-center gap-1 border-r border-[#2a2e39] bg-[#131722] py-2">{toolButtons.map(({ id, label, icon: Icon }) => <button key={id} title={label} onClick={() => selectTool(id)} className={`rounded-lg p-2.5 ${tool === id ? 'bg-[#2962ff] text-white' : 'text-[#848996] hover:bg-[#2a2e39] hover:text-white'}`}><Icon className="h-[18px] w-[18px]" /></button>)}<div className="my-2 h-px w-7 bg-[#2a2e39]" /><button title="Effacer les dessins" onClick={() => { setDrawings([]); setDraft(null); }} className="rounded-lg p-2.5 text-[#848996] hover:bg-[#2a2e39]"><Eraser className="h-[18px] w-[18px]" /></button><button title="Zoom avant" onClick={() => setVisibleCount(n => Math.max(25, n - 15))} className="rounded-lg p-2.5 text-[#848996] hover:bg-[#2a2e39]"><ZoomIn className="h-[18px] w-[18px]" /></button><button title="Zoom arrière" onClick={() => setVisibleCount(n => Math.min(300, n + 15))} className="rounded-lg p-2.5 text-[#848996] hover:bg-[#2a2e39]"><ZoomOut className="h-[18px] w-[18px]" /></button></aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#131722]">
        <div className="flex min-h-[44px] flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#2a2e39] px-4 py-2 text-xs"><span className="font-bold text-white">XAUUSD · {timeframe}</span>{current && <><span>O <b className="text-white">{price(current.open)}</b></span><span>H <b className="text-white">{price(current.high)}</b></span><span>B <b className="text-white">{price(current.low)}</b></span><span>C <b className={current.close >= current.open ? 'text-[#089981]' : 'text-[#f23645]'}>{price(current.close)}</b></span><span className={current.close >= current.open ? 'text-[#089981]' : 'text-[#f23645]'}>{(current.close-current.open).toFixed(2)} ({((current.close-current.open)/current.open*100).toFixed(2)}%)</span><span className="ml-auto text-[#787b86]">{timeLabel(current.time)} UTC</span></>}</div>
        {showMenu && <div className="flex flex-wrap items-center gap-4 border-b border-[#2a2e39] bg-[#1e222d] px-4 py-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={showEMA} onChange={e => setShowEMA(e.target.checked)} /> EMA 20</label><label className="flex items-center gap-2"><input type="checkbox" checked={showRSI} onChange={e => setShowRSI(e.target.checked)} /> RSI 14 (panneau inférieur)</label><label className="flex items-center gap-2"><input type="checkbox" checked={showVolume} onChange={e => setShowVolume(e.target.checked)} /> Volume</label></div>}
        <div className="relative min-h-0 flex-1">
          <svg ref={svgRef} viewBox="0 0 1200 620" preserveAspectRatio="none" onClick={onChartClick} onMouseMove={e => { if (draft) { const p = pointerPosition(e); setDraft(d => d ? { ...d, x2: Math.max(plot.left, Math.min(plot.right, p.x)), y2: Math.max(plot.top, Math.min(plot.bottom, p.y)) } : d); } }} className={`h-full w-full ${tool === 'cursor' ? 'cursor-default' : 'cursor-crosshair'}`} role="img" aria-label="Graphique XAUUSD, données de démonstration synthétiques">
            <rect width="1200" height="620" fill="#131722" />
            {Array.from({length: 8}, (_,i) => { const y=plot.top+i*(plot.bottom-plot.top)/7; return <g key={i}><line x1={plot.left} x2="1150" y1={y} y2={y} stroke="#2a2e39" strokeWidth=".8"/><text x="1158" y={y+4} fontSize="11" fill="#787b86">{price(maxPrice-i*range/7)}</text></g>; })}
            {Array.from({length: 9}, (_,i) => { const x=plot.left+i*(plot.right-plot.left)/8; return <line key={i} x1={x} x2={x} y1={plot.top} y2="560" stroke="#242834" strokeWidth=".7"/>; })}
            {visible.map((c,i) => { const x=xFor(i), step=(plot.right-plot.left)/Math.max(visible.length,1), w=Math.max(1.2,Math.min(8,step*.62)), up=c.close>=c.open, color=up?GREEN:RED; return <g key={c.time}><line x1={x} x2={x} y1={yFor(c.high)} y2={yFor(c.low)} stroke={color} strokeWidth="1"/><rect x={x-w/2} y={yFor(Math.max(c.open,c.close))} width={w} height={Math.max(1,yFor(Math.min(c.open,c.close))-yFor(Math.max(c.open,c.close)))} fill={color}/>{showVolume && <rect x={x-w/2} y={590-c.volume/500*24} width={w} height={c.volume/500*24} fill={color} opacity=".48"/>}</g>; })}
            {showEMA && <polyline points={emaValues.map((v,i)=>`${xFor(i)},${yFor(v)}`).join(' ')} fill="none" stroke="#f0b90b" strokeWidth="1.5" />}
            {orders.map((o,i)=><g key={i}><line x1={plot.left} x2="1148" y1={yFor(o.entry)} y2={yFor(o.entry)} stroke={o.side==='BUY'?GREEN:RED} strokeDasharray="5 3"/><line x1={plot.left} x2="1148" y1={yFor(o.sl)} y2={yFor(o.sl)} stroke={RED} strokeDasharray="3 4"/><line x1={plot.left} x2="1148" y1={yFor(o.tp)} y2={yFor(o.tp)} stroke={GREEN} strokeDasharray="3 4"/><text x="28" y={yFor(o.entry)-5} fontSize="10" fill={o.side==='BUY'?GREEN:RED}>{o.side} {price(o.entry)}{o.result!==undefined?' · '+o.result.toFixed(2)+'$':''}</text></g>)}
            {[...drawings, ...(draft?[draft]:[])].map(d=>{const color=d.tool==='measure'?'#f0b90b':'#2962ff'; if(d.tool==='horizontal') return <line key={d.id} x1={d.x1} x2={d.x2} y1={d.y1} y2={d.y2} stroke={color} strokeWidth="1.5"/>; if(d.tool==='vertical') return <line key={d.id} x1={d.x1} x2={d.x2} y1={d.y1} y2={d.y2} stroke={color} strokeWidth="1.5"/>; if(d.tool==='rectangle') return <rect key={d.id} x={Math.min(d.x1,d.x2)} y={Math.min(d.y1,d.y2)} width={Math.abs(d.x2-d.x1)} height={Math.abs(d.y2-d.y1)} fill="#2962ff" fillOpacity=".08" stroke={color} strokeWidth="1.5"/>; return <g key={d.id}><line x1={d.x1} x2={d.x2} y1={d.y1} y2={d.y2} stroke={color} strokeWidth="1.5"/>{d.tool==='measure'&&<text x={(d.x1+d.x2)/2} y={(d.y1+d.y2)/2-7} fill="#f0b90b" fontSize="12">{(priceForY(d.y2)-priceForY(d.y1)).toFixed(2)}</text>}</g>;})}
            {current && <g><line x1={plot.left} x2="1150" y1={yFor(current.close)} y2={yFor(current.close)} stroke={current.close>=current.open?GREEN:RED} strokeDasharray="4 4"/><rect x="1103" y={yFor(current.close)-10} width="94" height="20" rx="2" fill={current.close>=current.open?GREEN:RED}/><text x="1150" y={yFor(current.close)+4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">{price(current.close)}</text></g>}
            {visible.filter((_,i)=>i%Math.max(1,Math.floor(visible.length/7))===0).map((c)=> <text key={c.time} x={xFor(visible.indexOf(c))} y="612" textAnchor="middle" fontSize="10" fill="#787b86">{new Date(c.time*1000).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',timeZone:'UTC'})}</text>)}
            {showRSI && <g><rect x="18" y="490" width="1082" height="62" fill="#1e222d" opacity=".95"/><text x="25" y="505" fill="#aab0bd" fontSize="10">RSI 14 · aperçu</text><line x1="18" x2="1100" y1="520" y2="520" stroke="#787b86" strokeDasharray="3 3"/><polyline points={visible.map((c,i)=>{const prior=visible[Math.max(0,i-14)].close;const r=50+(c.close-prior)*4;return `${xFor(i)},${Math.max(493,Math.min(550,r))}`;}).join(' ')} fill="none" stroke="#ab47bc" strokeWidth="1.3"/></g>}
          </svg>
          <div className="pointer-events-none absolute left-4 top-3 rounded bg-[#131722]/80 px-2 py-1 text-[10px] text-[#787b86]">XAUUSD · Gold Spot · {timeframe} · {visible.length} bougies visibles</div>
          <div className="pointer-events-none absolute bottom-2 left-4 rounded bg-[#131722]/90 px-2 py-1 text-[10px] text-amber-300">DÉMO · HISTORIQUE SYNTHÉTIQUE</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#2a2e39] bg-[#1e222d] px-3 py-2"><button onClick={() => setCurrentIndex(i=>Math.max(0,i-1))} title="Bougie précédente" className="rounded p-2 hover:bg-[#2a2e39]"><ChevronDown className="h-4 w-4 rotate-90"/></button><button onClick={() => setPlaying(v=>!v)} className="flex items-center gap-2 rounded-md bg-[#2962ff] px-4 py-2 text-xs font-bold text-white hover:bg-blue-600">{playing?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}{playing?'Pause':'Replay'}</button><button onClick={()=>setCurrentIndex(i=>Math.min(candles.length-1,i+1))} title="Bougie suivante" className="rounded p-2 hover:bg-[#2a2e39]"><ChevronDown className="h-4 w-4 -rotate-90"/></button><select value={speed} onChange={e=>setSpeed(Number(e.target.value))} className="rounded border border-[#363a45] bg-[#131722] px-2 py-2 text-xs text-white"><option value={0.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={5}>5×</option><option value={10}>10×</option></select><span className="text-[10px] text-[#787b86]">Barre de replay</span><input aria-label="Position du replay" type="range" min="0" max={candles.length-1} value={lastIndex} onChange={e=>{setPlaying(false);setCurrentIndex(Number(e.target.value));}} className="min-w-[120px] flex-1 accent-[#2962ff]"/><span className="min-w-[84px] text-right text-[10px] text-[#aab0bd]">{lastIndex+1}/{candles.length}</span></div>
      </main>
      <aside className="hidden w-[250px] shrink-0 flex-col overflow-y-auto border-l border-[#2a2e39] bg-[#131722] xl:flex">
        <div className="border-b border-[#2a2e39] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wider text-[#aab0bd]">Panneau de trading</h2><BarChart3 className="h-4 w-4 text-[#787b86]"/></div><div className="text-[10px] text-[#787b86]">XAUUSD · SIMULATEUR</div><div className="mt-1 text-2xl font-bold text-white">{current?price(current.close):'—'}</div><div className="mt-1 text-[10px] text-[#787b86]">Prix de la bougie active</div></div>
        <div className="space-y-3 border-b border-[#2a2e39] p-4"><div className="grid grid-cols-2 gap-2"><button onClick={()=>placeOrder('BUY')} className="rounded-md bg-[#089981] py-3 text-xs font-bold text-white hover:brightness-110"><TrendingUp className="mr-1 inline h-4 w-4"/>Acheter</button><button onClick={()=>placeOrder('SELL')} className="rounded-md bg-[#f23645] py-3 text-xs font-bold text-white hover:brightness-110"><TrendingDown className="mr-1 inline h-4 w-4"/>Vendre</button></div><label className="block text-[11px] text-[#aab0bd]">Risque (%)<div className="mt-1 flex items-center gap-2"><input type="number" min=".1" max="10" step=".1" value={riskPct} onChange={e=>setRiskPct(Number(e.target.value))} className="w-full rounded border border-[#363a45] bg-[#1e222d] px-2 py-2 text-sm text-white"/><span>%</span></div></label><label className="block text-[11px] text-[#aab0bd]">Stop Loss (distance USD)<input type="number" min=".1" step=".1" value={slDistance} onChange={e=>setSlDistance(Number(e.target.value))} className="mt-1 w-full rounded border border-[#363a45] bg-[#1e222d] px-2 py-2 text-sm text-white"/></label><label className="block text-[11px] text-[#aab0bd]">Ratio risque / rendement<select value={rr} onChange={e=>setRr(Number(e.target.value))} className="mt-1 w-full rounded border border-[#363a45] bg-[#1e222d] px-2 py-2 text-sm text-white"><option value={1}>1:1</option><option value={1.5}>1:1.5</option><option value={2}>1:2</option><option value={3}>1:3</option><option value={4}>1:4</option></select></label><div className="rounded-md bg-[#1e222d] p-3"><div className="text-[10px] text-[#787b86]">Solde simulé</div><div className="mt-1 text-lg font-bold text-white">{balance.toLocaleString('fr-FR',{style:'currency',currency:'USD'})}</div><div className={`mt-1 text-xs ${netPnl>=0?'text-[#089981]':'text-[#f23645]'}`}>P&L clôturé {netPnl>=0?'+':''}{netPnl.toFixed(2)} USD</div></div></div>
        <div className="border-b border-[#2a2e39] p-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#aab0bd]">Statistiques</h3><div className="space-y-3">{[{label:'Trades clôturés',value:String(closedOrders.length)},{label:'Win rate',value:winRate.toFixed(1)+'%'},{label:'Gagnants',value:String(wins.length)},{label:'Perdants',value:String(closedOrders.length-wins.length)}].map(m=><div key={m.label} className="flex items-center justify-between text-xs"><span className="text-[#787b86]">{m.label}</span><span className="font-semibold text-white">{m.value}</span></div>)}</div></div>
        <div className="p-4"><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#aab0bd]">Outils de dessin</h3><p className="text-[11px] leading-5 text-[#787b86]">Choisissez un outil à gauche. Pour une ligne, cliquez une fois. Pour une tendance, un rectangle ou une mesure, cliquez deux fois sur le graphique.</p><div className="mt-3 rounded-md border border-[#363a45] p-3 text-[10px] leading-4 text-[#aab0bd]"><CircleHelp className="mr-1 inline h-3 w-3"/>Les positions sont virtuelles. Le calcul est une simulation pédagogique.</div></div>
      </aside>
    </div>
    {notice && <div role="status" className="absolute bottom-[74px] left-1/2 z-20 max-w-[90vw] -translate-x-1/2 rounded-lg border border-[#363a45] bg-[#1e222d] px-4 py-2 text-xs text-white shadow-xl">{notice}</div>}
    <footer className="flex min-h-[25px] items-center justify-between border-t border-[#2a2e39] bg-[#131722] px-3 text-[9px] text-[#787b86]"><span>Chart Studio · interface indépendante · prototype local</span><span>Historique réel XAUUSD : non connecté</span></footer>
  </div>;
}
