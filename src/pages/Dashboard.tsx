import React, { useMemo, useState } from 'react';
import { Trade, TradingAccount, UserProfile } from '../types';
import { calculatePerformance, calculateTraderScore, formatCurrency } from '../utils/calculations';
import { ResultBadge, DirectionBadge } from '../components/common/Badge';
import { Activity, ChevronRight, Focus, LayoutGrid, Minimize2, ShieldCheck, TrendingUp, BarChart3, CircleDollarSign, Target, ShieldAlert, Star, Info } from 'lucide-react';

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
            <div className="mt-5 rounded-2xl border border-[#dce7ee] bg-white overflow-hidden shadow-[0_10px_30px_rgba(11,31,53,0.045)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#e4ebef]">
          <DashboardMetricCard
            label="EQUITY"
            icon={BarChart3}
            value={formatCurrency(equity)}
            accent="mint"
            secondary={`${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`}
            progress={Math.max(0, Math.min(100, roi))}
            footerLeft={`Initial: ${formatCurrency(capital)}`}
            footerRight={`Actuel: ${formatCurrency(equity)}`}
          />
          <DashboardMetricCard
            label="P&L"
            icon={CircleDollarSign}
            value={formatCurrency(metrics.totalPnl)}
            accent={metrics.totalPnl >= 0 ? "mint" : "rose"}
            secondary={`${metrics.totalTrades} trade${metrics.totalTrades > 1 ? "s" : ""}`}
            progress={Math.max(0, Math.min(100, roi))}
            footerLeft="Résultat"
            footerRight={formatCurrency(metrics.totalPnl)}
          />
          <DashboardMetricCard
            label="WIN RATE"
            icon={Target}
            value={`${metrics.winRate.toFixed(1)}%`}
            accent="amber"
            secondary={`${metrics.winningTrades}W · ${metrics.losingTrades}L`}
            progress={Math.max(0, Math.min(100, metrics.winRate))}
            footerLeft="Total trades"
            footerRight={String(metrics.totalTrades)}
          />
          <DashboardMetricCard
            label="DRAWDOWN"
            icon={ShieldAlert}
            value={`-${metrics.maxDrawdownPercent.toFixed(1)}%`}
            accent={metrics.maxDrawdownPercent > 5 ? "rose" : "mint"}
            secondary={metrics.maxDrawdownPercent > 5 ? "À surveiller" : "Sous contrôle"}
            progress={Math.max(0, Math.min(100, (metrics.maxDrawdownPercent / 10) * 100))}
            footerLeft="Limite"
            footerRight={`Disponible: ${Math.max(0, 10 - metrics.maxDrawdownPercent).toFixed(1)}%`}
          />
          <DashboardMetricCard
            label="TRADER SCORE"
            icon={Star}
            value={score.isSufficientData ? `${score.overallScore}/100` : "—"}
            accent="indigo"
            secondary={score.isSufficientData ? "Indice global" : "Min. 5 trades"}
            progress={score.isSufficientData ? score.overallScore : 0}
            footerLeft="Performance"
            footerRight={score.isSufficientData ? "Score" : "—"}
          />
        </div>
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

  return <div className="space-y-5">{situation}{modeBar}<div className="grid grid-cols-1 xl:grid-cols-3 gap-4"><div className="xl:col-span-2 p-5 rounded-2xl card-premium"><div className="flex justify-between mb-2"><div><h2 className="text-sm font-bold text-[#10233a]">Courbe d'equity</h2><p className="text-[10px] text-[#8798a8]">Votre progression en un coup d'œil.</p></div><span className="text-[10px] px-2 py-1 rounded-full bg-[#e7faf3] text-[#087b59]">Dynamique</span></div>{chart}</div><div className="p-2 rounded-2xl card-premium"><DisciplineGauge value={score.overallScore} sufficient={score.isSufficientData} /></div></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><div className="p-5 rounded-2xl card-premium"><h2 className="text-sm font-bold text-[#10233a] mb-4">Risque & contrôle</h2><Metric label="Drawdown" value={`-${metrics.maxDrawdownPercent.toFixed(1)}%`} sub={metrics.maxDrawdownPercent>5?'À surveiller':'Sous contrôle'} tone={metrics.maxDrawdownPercent>5?'negative':'positive'} /><Metric label="Profit Factor" value={metrics.profitFactor.toFixed(2)} sub="Gains / pertes" /><Metric label="Expectancy" value={formatCurrency(metrics.expectancy)} sub="Par trade" tone={metrics.expectancy>=0?'positive':'negative'} /></div><div className="p-5 rounded-2xl card-premium"><h2 className="text-sm font-bold text-[#10233a] mb-4">Lecture pratique</h2><div className="grid grid-cols-2 gap-2.5"><Metric label="Trade moyen" value={metrics.totalTrades?formatCurrency(metrics.totalPnl/metrics.totalTrades):'$0'} sub="P&L moyen" /><Metric label="Avg R" value={metrics.avgRR.toFixed(2)} sub="Ratio moyen" /><Metric label="Gains moyens" value={formatCurrency(metrics.avgWin)} sub={`${metrics.winningTrades} gagnants`} /><Metric label="Pertes moyennes" value={formatCurrency(metrics.avgLoss)} sub={`${metrics.losingTrades} pertes`} /></div></div></div>{recentTrades(6)}</div>;
}

function DisciplineGauge({ value, sufficient }: { value: number; sufficient: boolean }) {
  const score = Math.max(0, Math.min(100, value));
  const segments = 50;
  const activeSegments = Math.round((score / 100) * segments);
  const centerX = 120;
  const centerY = 116;
  const radius = 82;
  const strokeWidth = 8;
  const startAngle = -180;
  const anglePerSegment = 180 / segments;

  const polar = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return { x: centerX + radius * Math.cos(radians), y: centerY + radius * Math.sin(radians) };
  };

  const arcPath = (a0: number, a1: number) => {
    const p0 = polar(a0);
    const p1 = polar(a1);
    return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 0 1 ${p1.x} ${p1.y}`;
  };

  const segmentColor = (index: number) => {
    const pct = ((index + 0.5) / segments) * 100;
    if (pct <= 30) return '#ff3b30';
    if (pct <= 80) return '#ff9500';
    return '#34a853';
  };

  const label = !sufficient ? '—' : score >= 80 ? 'Excellent' : score >= 30 ? 'Bon' : 'À travailler';

  return (
    <div className="h-full rounded-2xl bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#10233a]">Score de discipline</h2>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#dfe5ea] text-[#71839a]" title="Score calculé à partir de vos performances">
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 flex justify-center">
        <svg viewBox="0 0 240 155" className="h-auto w-full max-w-[330px]" role="img" aria-label={`Score de discipline : ${sufficient ? `${Math.round(score)}%` : 'indisponible'}`}>
          <defs>
            <radialGradient id="scoreGaugeGlow" cx="50%" cy="72%" r="55%">
              <stop offset="0%" stopColor="#e8f7df" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M 28 116 A 92 92 0 0 1 212 116 L 198 116 A 78 78 0 0 0 42 116 Z" fill="url(#scoreGaugeGlow)" />
          {Array.from({ length: segments }).map((_, index) => {
            const gap = 0.9;
            const a0 = startAngle + index * anglePerSegment + gap;
            const a1 = startAngle + (index + 1) * anglePerSegment - gap;
            const active = sufficient && index < activeSegments;
            return (
              <path
                key={index}
                d={arcPath(a0, a1)}
                fill="none"
                stroke={active ? segmentColor(index) : '#9aa7b8'}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
              />
            );
          })}
          <text x="120" y="108" textAnchor="middle" className="fill-[#263238] text-[20px] font-bold">{sufficient ? `${Math.round(score)}%` : '—'}</text>
          <text x="120" y="123" textAnchor="middle" className="fill-[#34a853] text-[9px] font-semibold">{label}</text>
          <text x="23" y="136" className="fill-[#94a3b8] text-[8px] font-semibold">0%</text>
          <text x="77" y="61" className="fill-[#94a3b8] text-[8px] font-semibold">30%</text>
          <text x="120" y="46" textAnchor="middle" className="fill-[#94a3b8] text-[8px] font-semibold">50%</text>
          <text x="165" y="61" className="fill-[#94a3b8] text-[8px] font-semibold">80%</text>
          <text x="198" y="136" className="fill-[#94a3b8] text-[8px] font-semibold">100%</text>
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-[#71839a]">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#ff3b30]" />0 – 30%</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#ff9500]" />30 – 80%</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#34a853]" />80 – 100%</span>
      </div>
    </div>
  );
}

function DashboardMetricCard({
  label, icon: Icon, value, secondary, progress, footerLeft, footerRight, accent,
}: {
  label: string; icon: React.ElementType; value: string; secondary?: string; progress: number; footerLeft?: string; footerRight?: string;
  accent: 'mint' | 'rose' | 'amber' | 'indigo';
}) {
  const palette = {
    mint: { icon: 'bg-[#e7faf3] text-[#00a982]', fill: 'bg-[#08b77a]', value: 'text-[#0b1f35]', secondary: 'text-[#00a982] bg-[#e7faf3]' },
    rose: { icon: 'bg-[#fff0f4] text-[#ef476f]', fill: 'bg-[#ef476f]', value: 'text-[#ef476f]', secondary: 'text-[#ef476f] bg-[#fff0f4]' },
    amber: { icon: 'bg-[#fff7e5] text-[#d99020]', fill: 'bg-[#f59e0b]', value: 'text-[#0b1f35]', secondary: 'text-[#d99020] bg-[#fff7e5]' },
    indigo: { icon: 'bg-[#eef0ff] text-[#4f46e5]', fill: 'bg-[#4f46e5]', value: 'text-[#0b1f35]', secondary: 'text-[#4f46e5] bg-[#eef0ff]' },
  }[accent];
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const filled = Math.round(normalizedProgress / 2);
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${palette.icon}`}><Icon className="h-4 w-4" strokeWidth={2.2} /></span>
        <div className="flex min-w-0 items-center gap-1.5"><span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#71839a]">{label}</span><Info className="h-3 w-3 shrink-0 text-[#9aa9b8]" /></div>
      </div>
      <div className={`mt-3 text-[23px] font-bold tracking-tight font-mono tabular-nums ${palette.value}`}>{value}</div>
      <div className="mt-2 min-h-[24px]">{secondary && <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[9px] font-semibold ${palette.secondary}`}>{secondary}</span>}</div>
      <div className="mt-3">
        <div className="flex items-center gap-[2px] h-6" aria-label={`Progression ${normalizedProgress.toFixed(1)}%`}>
          {Array.from({ length: 50 }).map((_, index) => (
            <span
              key={index}
              className={`h-full min-w-0 flex-1 rounded-[1px] ${index < filled ? palette.fill : "bg-[#e6edf1]"}`}
            />
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-3 items-center text-[8px] font-medium text-[#91a0ad]">
          <span>0%</span>
          <span className="text-center font-semibold text-[#71839a]">{normalizedProgress.toFixed(1)}%</span>
          <span className="text-right">100%</span>
        </div>
      </div>
      <div className="mt-4 flex min-w-0 items-end justify-between gap-3 text-[9px]"><span className="min-w-0 truncate text-[#71839a]">{footerLeft}</span><span className="min-w-0 truncate text-right font-semibold text-[#00a982]">{footerRight}</span></div>
    </div>
  );
}
function Metric({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral'|'positive'|'negative' }) {
  return <div className="p-3 rounded-xl bg-[#f8fbfa] border border-[#e7efec] mb-2"><div className="text-[9px] uppercase tracking-wider font-semibold text-[#8a9aab]">{label}</div><div className={`mt-1 text-sm font-bold font-mono ${tone==='positive'?'text-[#008f63]':tone==='negative'?'text-[#e14d5d]':'text-[#10233a]'}`}>{value}</div>{sub && <div className="text-[9px] text-[#94a2ad] mt-0.5">{sub}</div>}</div>;
}
