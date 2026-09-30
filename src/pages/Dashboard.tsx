import React, { useMemo, useState } from 'react';
import { Trade, TradingAccount, UserProfile } from '../types';
import { calculatePerformance, calculateTraderScore, formatCurrency } from '../utils/calculations';
import { ResultBadge, DirectionBadge } from '../components/common/Badge';
import { Activity, ChevronRight, Focus, LayoutGrid, Minimize2, ShieldCheck, TrendingUp } from 'lucide-react';

interface DashboardProps {
  trades: Trade[];
  accounts: TradingAccount[];
  selectedAccountId: string;
  userProfile?: UserProfile | null;
  onOpenNewTrade: () => void;
  onSelectTrade: (trade: Trade) => void;
  onNavigateToJournal: () => void;
}

type Mode = 'standard' | 'focus' | 'analysis' | 'compact';

const modes: Array<[Mode, string, React.ElementType]> = [
  ['standard', 'Standard', LayoutGrid],
  ['focus', 'Focus Trading', Focus],
  ['analysis', 'Analyse', Activity],
  ['compact', 'Compacte', Minimize2],
];

export function Dashboard({ trades, accounts, selectedAccountId, userProfile, onOpenNewTrade, onSelectTrade, onNavigateToJournal }: DashboardProps) {
  const account = accounts.find(item => item.id === selectedAccountId);
  const capital = account ? account.initialBalance : accounts.reduce((sum, item) => sum + item.initialBalance, 0);
  const metrics = useMemo(() => calculatePerformance(trades, capital), [trades, capital]);
  const score = useMemo(() => calculateTraderScore(trades), [trades]);
  const equity = capital + metrics.totalPnl;
  const roi = capital > 0 ? (metrics.totalPnl / capital) * 100 : 0;
  const [mode, setMode] = useState<Mode>(() => typeof window === 'undefined' ? 'standard' : (localStorage.getItem('iamtrader-dashboard-mode') as Mode) || 'standard');
  const [hover, setHover] = useState<number | null>(null);

  const curve = useMemo(() => {
    if (metrics.equityCurve.length < 2) return [];
    const values = metrics.equityCurve.map(item => item.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return metrics.equityCurve.map((item, index) => ({
      ...item,
      x: 24 + (index / (metrics.equityCurve.length - 1)) * 752,
      y: 190 - 24 - ((item.balance - min) / range) * 142,
    }));
  }, [metrics.equityCurve]);

  const setDashboardMode = (value: Mode) => {
    setMode(value);
    localStorage.setItem('iamtrader-dashboard-mode', value);
  };

  const situation = (
    <div className="rounded-2xl bg-white border border-[#dce7e3] p-5 shadow-[0_8px_24px_rgba(16,35,58,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5"><span className="text-[9px] font-semibold uppercase tracking-wider text-[#087b59] bg-[#e7faf3] border border-[#c9eee1] px-2 py-1 rounded-full">Situation actuelle</span><span className="text-[11px] text-[#71839a]">· {account?.name || 'Tous les comptes'}</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-[#10233a]">Bonjour {userProfile?.displayName || 'Trader'}</h1>
          <p className="text-xs text-[#71839a] mt-1">Capital, performance, risque et activité récente en une seule lecture.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mt-5">
        <Metric label="Equity" value={formatCurrency(equity)} sub={`${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`} />
        <Metric label="P&L" value={formatCurrency(metrics.totalPnl)} sub={`${metrics.totalTrades} trades`} tone={metrics.totalPnl >= 0 ? 'positive' : 'negative'} />
        <Metric label="Win rate" value={`${metrics.winRate.toFixed(1)}%`} sub={`${metrics.winningTrades}W · ${metrics.losingTrades}L`} />
        <Metric label="Drawdown" value={`-${metrics.maxDrawdownPercent.toFixed(1)}%`} sub={metrics.maxDrawdownPercent > 5 ? 'À surveiller' : 'Sous contrôle'} tone={metrics.maxDrawdownPercent > 5 ? 'negative' : 'positive'} />
        <Metric label="Trader Score" value={score.isSufficientData ? `${score.overallScore}/100` : '—'} sub={score.isSufficientData ? 'Indice global' : 'Min. 5 trades'} />
      </div>
    </div>
  );

  const chart = (
    <div className="relative">
      {curve.length > 1 ? (
        <>
          <svg viewBox="0 0 800 190" className="w-full h-56 overflow-visible" onMouseLeave={() => setHover(null)} onMouseMove={event => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 800;
            const index = curve.reduce((best, point, i) => Math.abs(point.x - x) < Math.abs(curve[best].x - x) ? i : best, 0);
            setHover(index);
          }}>
            <defs><linearGradient id="iam-equity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#08b77a" stopOpacity=".20" /><stop offset="100%" stopColor="#08b77a" stopOpacity="0" /></linearGradient></defs>
            <line x1="24" y1="24" x2="776" y2="24" stroke="#edf2f0" strokeDasharray="3 5" />
            <line x1="24" y1="95" x2="776" y2="95" stroke="#edf2f0" strokeDasharray="3 5" />
            <line x1="24" y1="166" x2="776" y2="166" stroke="#edf2f0" strokeDasharray="3 5" />
            <polygon points={`24,166 ${curve.map(p => `${p.x},${p.y}`).join(' ')} 776,166`} fill="url(#iam-equity-fill)" />
            <polyline points={curve.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#08b77a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {hover !== null && curve[hover] && <><line x1={curve[hover].x} y1="24" x2={curve[hover].x} y2="166" stroke="#b8cfc6" strokeDasharray="3 4" /><circle cx={curve[hover].x} cy={curve[hover].y} r="5" fill="white" stroke="#08b77a" strokeWidth="2.5" /></>}
          </svg>
          <div className="flex justify-between text-[9px] text-[#94a2ad] font-mono"><span>{new Date(curve[0].date).toLocaleDateString('fr-FR', {day:'2-digit',month:'short'})}</span><span>{new Date(curve[curve.length-1].date).toLocaleDateString('fr-FR', {day:'2-digit',month:'short'})}</span></div>
          {hover !== null && curve[hover] && <div className="absolute top-1 pointer-events-none px-3 py-2 rounded-xl bg-[#10233a]/95 text-white text-[10px] font-mono shadow-lg" style={{left:`${Math.min(Math.max(curve[hover].x / 8, 12), 88)}%`,transform:'translateX(-50%)'}}><div className="text-white/60">{new Date(curve[hover].date).toLocaleDateString('fr-FR')}</div><div className="font-bold">{formatCurrency(curve[hover].balance)}</div><div className={curve[hover].pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>P&L {formatCurrency(curve[hover].pnl)}</div></div>}
        </>
      ) : <div className="h-56 flex flex-col items-center justify-center rounded-xl bg-[#fbfdfc] border border-[#edf2f0]"><Activity className="w-5 h-5 text-[#a6b4bf] mb-2" /><span className="text-xs font-semibold text-[#62788d]">Courbe disponible après 2 trades</span><span className="text-[10px] text-[#98a7b3] mt-1">Votre progression apparaîtra automatiquement ici.</span></div>}
    </div>
  );

  const recentTrades = (limit: number) => (
    <div className="rounded-2xl bg-white border border-[#dce7e3] shadow-[0_8px_24px_rgba(16,35,58,0.04)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e7efec]"><div><h2 className="text-sm font-bold text-[#10233a]">Trades récents</h2><p className="text-[11px] text-[#8798a8] mt-0.5">Même lecture que le Journal.</p></div><button onClick={onNavigateToJournal} className="text-xs font-semibold text-[#087b59] inline-flex items-center gap-1 cursor-pointer">Journal <ChevronRight className="w-3.5 h-3.5" /></button></div>
      {trades.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead><tr className="bg-[#fbfdfc] border-b border-[#e7efec] text-[9px] uppercase tracking-wider text-[#7f91a1]"><th className="py-3 px-4">Date</th><th className="py-3 px-4">Symbol</th><th className="py-3 px-4">Direction</th><th className="py-3 px-4">Entrée</th><th className="py-3 px-4">Sortie</th><th className="py-3 px-4">Lot</th><th className="py-3 px-4">Risque</th><th className="py-3 px-4 text-right">P&L</th><th className="py-3 px-4 text-right">R</th><th className="py-3 px-4 text-right">Résultat</th></tr></thead><tbody>{trades.slice(0,limit).map(trade => <tr key={trade.id} onClick={() => onSelectTrade(trade)} className="border-b border-[#edf2f0] hover:bg-[#f7fbf9] cursor-pointer"><td className="py-3 px-4 font-mono text-[10px] text-[#71839a]">{new Date(trade.entryDate).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</td><td className="py-3 px-4 font-mono font-bold text-[#10233a]">{trade.symbol}</td><td className="py-3 px-4"><DirectionBadge direction={trade.direction} /></td><td className="py-3 px-4 font-mono text-[#5f748c]">{trade.entryPrice || '—'}</td><td className="py-3 px-4 font-mono text-[#5f748c]">{trade.exitPrice || '—'}</td><td className="py-3 px-4 font-mono text-[#71839a]">{trade.positionSize || '—'}</td><td className="py-3 px-4 font-mono text-[#71839a]">{trade.riskAmount ? formatCurrency(trade.riskAmount) : '—'}</td><td className={`py-3 px-4 text-right font-mono font-bold ${trade.pnl > 0 ? 'text-[#008f63]' : trade.pnl < 0 ? 'text-[#e14d5d]' : 'text-[#71839a]'}`}>{formatCurrency(trade.pnl)}</td><td className="py-3 px-4 text-right font-mono text-[#5f748c]">{trade.rMultiple !== undefined ? `${trade.rMultiple > 0 ? '+' : ''}${trade.rMultiple}R` : '—'}</td><td className="py-3 px-4 text-right"><ResultBadge result={trade.result} /></td></tr>)}</tbody></table></div> : <div className="py-10 text-center text-xs text-[#8798a8]">Aucun trade récent.</div>}
    </div>
  );

  const modeBar = <div className="flex flex-wrap gap-1.5 rounded-xl bg-white border border-[#dce7e3] p-1.5 shadow-[0_5px_18px_rgba(16,35,58,0.03)]">{modes.map(([value,label,Icon]) => <button key={value} onClick={() => setDashboardMode(value)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold cursor-pointer transition-all ${mode === value ? 'bg-[#10233a] text-white' : 'text-[#71839a] hover:bg-[#f3f7f5]'}`}><Icon className="w-3.5 h-3.5" />{label}</button>)}</div>;

  if (mode === 'focus') return <div className="space-y-5">{situation}{modeBar}<div className="grid grid-cols-1 xl:grid-cols-3 gap-4"><div className="xl:col-span-2 p-5 rounded-2xl card-premium"><div className="flex justify-between mb-2"><div><h2 className="text-sm font-bold text-[#10233a]">Equity</h2><p className="text-[10px] text-[#8798a8]">Progression du compte.</p></div><TrendingUp className="w-4 h-4 text-[#08b77a]" /></div>{chart}</div><div className="p-5 rounded-2xl card-premium"><h2 className="text-sm font-bold text-[#10233a] mb-3">À surveiller</h2><Metric label="Profit Factor" value={metrics.profitFactor.toFixed(2)} sub={metrics.profitFactor >= 1 ? 'Positif' : 'À travailler'} tone={metrics.profitFactor >= 1 ? 'positive' : 'negative'} /><Metric label="Expectancy" value={formatCurrency(metrics.expectancy)} sub="Par trade" tone={metrics.expectancy >= 0 ? 'positive' : 'negative'} /></div></div>{recentTrades(6)}</div>;

  if (mode === 'analysis') return <div className="space-y-5">{situation}{modeBar}<div className="grid grid-cols-2 xl:grid-cols-5 gap-3"><Metric label="Trades" value={String(metrics.totalTrades)} sub="Total" /><Metric label="Win rate" value={`${metrics.winRate.toFixed(1)}%`} sub="Gagnants" tone="positive" /><Metric label="Profit Factor" value={metrics.profitFactor.toFixed(2)} sub="Gains / pertes" /><Metric label="Expectancy" value={formatCurrency(metrics.expectancy)} sub="Par trade" tone={metrics.expectancy >= 0 ? 'positive' : 'negative'} /><Metric label="Avg R" value={metrics.avgRR.toFixed(2)} sub="Ratio moyen" /></div><div className="p-5 rounded-2xl card-premium"><h2 className="text-sm font-bold text-[#10233a] mb-1">Analyse de l'equity</h2><p className="text-[10px] text-[#8798a8] mb-2">Survolez pour lire chaque étape.</p>{chart}</div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="p-5 rounded-2xl card-premium"><h2 className="text-sm font-bold text-[#10233a] mb-4">Performance par instrument</h2>{Object.entries(trades.reduce<Record<string,number>>((map,t)=>{map[t.symbol]=(map[t.symbol]||0)+(Number(t.pnl)||0);return map;},{})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([symbol,pnl])=><div key={symbol} className="mb-3"><div className="flex justify-between text-xs mb-1"><span className="font-semibold text-[#314861]">{symbol}</span><span className={pnl>=0?'text-[#008f63]':'text-[#e14d5d]'}>{formatCurrency(pnl)}</span></div><div className="h-2 rounded-full bg-[#eef3f1]"><div className={`h-full rounded-full ${pnl>=0?'bg-[#08b77a]':'bg-[#e14d5d]'}`} style={{width:'100%'}} /></div></div>)}</div><div className="p-5 rounded-2xl card-premium"><h2 className="text-sm font-bold text-[#10233a] mb-4">Sessions</h2><div className="grid grid-cols-2 gap-2">{['Asia','London','Overlap','New York'].map(session=>{const list=trades.filter(t=>t.session===session);const pnl=list.reduce((s,t)=>s+(Number(t.pnl)||0),0);return <div key={session} className="p-3 rounded-xl bg-[#f8fbfa] border border-[#e7efec]"><div className="text-[11px] font-semibold text-[#314861]">{session}</div><div className={`text-sm font-bold font-mono mt-1 ${pnl>=0?'text-[#008f63]':'text-[#e14d5d]'}`}>{formatCurrency(pnl)}</div><div className="text-[9px] text-[#94a2ad]">{list.length} trade{list.length>1?'s':''}</div></div>})}</div></div></div>{recentTrades(8)}</div>;

  if (mode === 'compact') return <div className="space-y-4">{situation}{modeBar}<div className="p-4 rounded-2xl card-premium">{chart}</div>{recentTrades(5)}</div>;

  return <div className="space-y-5">{situation}{modeBar}<div className="grid grid-cols-1 xl:grid-cols-3 gap-4"><div className="xl:col-span-2 p-5 rounded-2xl card-premium"><div className="flex justify-between mb-2"><div><h2 className="text-sm font-bold text-[#10233a]">Courbe d'equity</h2><p className="text-[10px] text-[#8798a8]">Votre progression en un coup d'œil.</p></div><span className="text-[10px] px-2 py-1 rounded-full bg-[#e7faf3] text-[#087b59]">Dynamique</span></div>{chart}</div><div className="p-5 rounded-2xl card-premium"><div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-4 h-4 text-[#2f6bff]" /><h2 className="text-sm font-bold text-[#10233a]">Trader Score</h2></div><div className="text-4xl font-bold font-mono text-[#10233a] text-center py-4">{score.isSufficientData?score.overallScore:'—'}<span className="text-xs text-[#8798a8]">/100</span></div><div className="text-[10px] text-[#71839a] text-center">{score.isSufficientData?'Indice global de discipline':'Min. 5 trades requis'}</div></div></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="p-5 rounded-2xl card-premium"><h2 className="text-sm font-bold text-[#10233a] mb-4">Risque & contrôle</h2><Metric label="Drawdown" value={`-${metrics.maxDrawdownPercent.toFixed(1)}%`} sub={metrics.maxDrawdownPercent>5?'À surveiller':'Sous contrôle'} tone={metrics.maxDrawdownPercent>5?'negative':'positive'} /><Metric label="Profit Factor" value={metrics.profitFactor.toFixed(2)} sub="Gains / pertes" /><Metric label="Expectancy" value={formatCurrency(metrics.expectancy)} sub="Par trade" tone={metrics.expectancy>=0?'positive':'negative'} /></div><div className="p-5 rounded-2xl card-premium"><h2 className="text-sm font-bold text-[#10233a] mb-4">Lecture pratique</h2><div className="grid grid-cols-2 gap-2.5"><Metric label="Trade moyen" value={metrics.totalTrades?formatCurrency(metrics.totalPnl/metrics.totalTrades):'$0'} sub="P&L moyen" /><Metric label="Avg R" value={metrics.avgRR.toFixed(2)} sub="Ratio moyen" /><Metric label="Gains moyens" value={formatCurrency(metrics.avgWin)} sub={`${metrics.winningTrades} gagnants`} /><Metric label="Pertes moyennes" value={formatCurrency(metrics.avgLoss)} sub={`${metrics.losingTrades} pertes`} /></div></div></div>{recentTrades(6)}</div>;
}

function Metric({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral'|'positive'|'negative' }) {
  return <div className="p-3 rounded-xl bg-[#f8fbfa] border border-[#e7efec] mb-2"><div className="text-[9px] uppercase tracking-wider font-semibold text-[#8a9aab]">{label}</div><div className={`mt-1 text-sm font-bold font-mono ${tone==='positive'?'text-[#008f63]':tone==='negative'?'text-[#e14d5d]':'text-[#10233a]'}`}>{value}</div>{sub && <div className="text-[9px] text-[#94a2ad] mt-0.5">{sub}</div>}</div>;
}
