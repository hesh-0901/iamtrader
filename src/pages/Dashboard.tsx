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

  const intelligence = useMemo(() => {
    const closed = trades.filter(t => t.result !== 'OPEN').sort((a,b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    const sum = (items: Trade[]) => items.reduce((n,t) => n + (Number(t.pnl) || 0), 0);
    const group = (key: (t: Trade) => string) => {
      const map: Record<string,{pnl:number;count:number;wins:number;losses:number;rr:number}> = {};
      closed.forEach(t => {
        const k = key(t) || 'Non renseigné';
        const item = map[k] || {pnl:0,count:0,wins:0,losses:0,rr:0};
        item.pnl += Number(t.pnl) || 0;
        item.count++;
        if (t.result === 'WIN') item.wins++;
        if (t.result === 'LOSS') item.losses++;
        item.rr += Number(t.rMultiple) || 0;
        map[k] = item;
      });
      return Object.entries(map).map(([name,v]) => ({
        name, ...v, winRate: v.count ? (v.wins / v.count) * 100 : 0, avgR: v.count ? v.rr / v.count : 0
      })).sort((a,b) => b.pnl - a.pnl);
    };
    const byDay = group(t => t.entryDate.split('T')[0]);
    const bySession = group(t => t.session);
    const bySetup = group(t => t.setup?.trim() || 'Non renseigné');
    const bySymbol = group(t => t.symbol);
    const byDirection = group(t => t.direction);
    const byTimeframe = group(t => t.timeframe);
    const emotional = closed.filter(t => ['FOMO','Revenge','Fear','Overconfidence','Hesitation'].includes(t.emotion));
    const revenge = closed.filter(t => t.emotion === 'Revenge');
    const fomo = closed.filter(t => t.emotion === 'FOMO');
    const withSL = closed.filter(t => Number(t.stopLoss) > 0);
    const withTP = closed.filter(t => Number(t.takeProfit) > 0);
    const risks = closed.map(t => Number(t.riskAmount) || 0).filter(v => v > 0);
    const avgRisk = risks.length ? risks.reduce((a,b)=>a+b,0)/risks.length : 0;
    const maxRisk = risks.length ? Math.max(...risks) : 0;
    const riskPct = capital > 0 ? (avgRisk / capital) * 100 : 0;
    const uniqueDays = new Set(closed.map(t => t.entryDate.split('T')[0])).size;
    const avgTradesPerDay = uniqueDays ? closed.length / uniqueDays : 0;
    const lastDate = closed.length ? new Date(closed[closed.length - 1].entryDate).getTime() : 0;
    const recent7 = lastDate ? closed.filter(t => lastDate - new Date(t.entryDate).getTime() <= 7 * 86400000) : [];
    const recentPnl = sum(recent7);
    const recentWins = recent7.filter(t => t.pnl > 0).length;
    const recentGrossWin = recent7.filter(t => t.pnl > 0).reduce((n,t)=>n+t.pnl,0);
    const recentGrossLoss = recent7.filter(t => t.pnl < 0).reduce((n,t)=>n+Math.abs(t.pnl),0);
    const recentPF = recentGrossLoss ? recentGrossWin / recentGrossLoss : recentGrossWin > 0 ? 99.9 : 0;
    const recoveryFactor = metrics.maxDrawdownAmount > 0 ? metrics.totalPnl / metrics.maxDrawdownAmount : metrics.totalPnl > 0 ? 99.9 : 0;
    const bestDay = byDay[0];
    const worstDay = [...byDay].sort((a,b)=>a.pnl-b.pnl)[0];
    const bestSession = bySession[0];
    const bestSetup = bySetup[0];
    const bestSymbol = bySymbol[0];
    const bestDirection = byDirection[0];
    const bestTimeframe = byTimeframe[0];
    const actions: string[] = [];
    if (!closed.length) actions.push('Commencez par journaliser chaque exécution avec setup, risque et état émotionnel.');
    else if (closed.length < 5) actions.push('Continuez à construire un échantillon avant de tirer des conclusions solides.');
    if (closed.length >= 5 && metrics.profitFactor < 1) actions.push('Edge sous 1,00 PF : isolez les setups, sessions et instruments qui détruisent le résultat.');
    if (closed.length >= 5 && emotional.length / closed.length >= 0.2) actions.push('20%+ des trades sont émotionnels : surveillez FOMO, revanche et hésitation avant la prochaine entrée.');
    if (closed.length >= 5 && withSL.length / closed.length < 0.8) actions.push('Moins de 80% des trades ont un stop renseigné : standardisez le risque avant l’exécution.');
    if (metrics.currentStreak.type === 'LOSS' && metrics.currentStreak.count >= 3) actions.push('Série actuelle de ' + metrics.currentStreak.count + ' pertes : vérifiez le contexte et le respect du plan avant de reprendre.');
    if (metrics.maxDrawdownPercent >= 5) actions.push('Drawdown maximum de ' + metrics.maxDrawdownPercent.toFixed(1) + '% : traitez le drawdown comme une contrainte de risque, pas comme un objectif à récupérer.');
    if (!actions.length) actions.push('Le journal ne montre pas de signal comportemental majeur. Continuez à surveiller edge, risque et répétabilité.');
    return {
      closed, emotionalRate: closed.length ? emotional.length / closed.length * 100 : 0,
      revengeRate: closed.length ? revenge.length / closed.length * 100 : 0,
      fomoRate: closed.length ? fomo.length / closed.length * 100 : 0,
      slRate: closed.length ? withSL.length / closed.length * 100 : 0,
      tpRate: closed.length ? withTP.length / closed.length * 100 : 0,
      avgRisk, maxRisk, riskPct, avgTradesPerDay, recent7, recentPnl,
      recentWinRate: recent7.length ? recentWins / recent7.length * 100 : 0,
      recentPF, recoveryFactor,
      bestDay, worstDay, bestSession, bestSetup, bestSymbol, bestDirection, bestTimeframe,
      actions
    };
  }, [trades, capital, metrics]);


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

  const intelligenceStandard = (
    <div className="p-5 rounded-2xl card-premium">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div><h2 className="text-sm font-bold text-[#10233a]">Intelligence trader</h2><p className="text-[10px] text-[#8798a8]">Les informations utiles sont calculées automatiquement à partir du journal.</p></div>
        <div className="rounded-xl bg-[#e7faf3] px-2.5 py-1.5 text-[9px] font-bold text-[#087b59]">AUTO</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
        <InsightMini label="PF" value={metrics.profitFactor.toFixed(2)} sub="edge global" tone={metrics.profitFactor >= 1 ? 'positive' : 'negative'} />
        <InsightMini label="Expectancy" value={formatCurrency(metrics.expectancy)} sub="par trade" tone={metrics.expectancy >= 0 ? 'positive' : 'negative'} />
        <InsightMini label="Recovery" value={intelligence.recoveryFactor >= 99 ? '∞' : intelligence.recoveryFactor.toFixed(2)} sub="P&L / DD" tone={intelligence.recoveryFactor >= 1 ? 'positive' : 'negative'} />
        <InsightMini label="Risque moyen" value={intelligence.avgRisk ? formatCurrency(intelligence.avgRisk) : '—'} sub={intelligence.riskPct ? intelligence.riskPct.toFixed(2) + '% du capital' : 'non renseigné'} />
        <InsightMini label="Émotion" value={intelligence.emotionalRate.toFixed(0) + '%'} sub="trades émotionnels" tone={intelligence.emotionalRate <= 20 ? 'positive' : 'negative'} />
        <InsightMini label="Stop Loss" value={intelligence.slRate.toFixed(0) + '%'} sub="trades protégés" tone={intelligence.slRate >= 80 ? 'positive' : 'negative'} />
        <InsightMini label="7 derniers j." value={formatCurrency(intelligence.recentPnl)} sub={intelligence.recent7.length + ' trades · ' + intelligence.recentWinRate.toFixed(0) + '% win'} tone={intelligence.recentPnl >= 0 ? 'positive' : 'negative'} />
        <InsightMini label="Série" value={metrics.currentStreak.count ? (metrics.currentStreak.type === 'WIN' ? '+' : '-') + metrics.currentStreak.count : '—'} sub={metrics.currentStreak.type === 'WIN' ? 'victoires' : metrics.currentStreak.type === 'LOSS' ? 'pertes' : 'aucune'} tone={metrics.currentStreak.type === 'WIN' ? 'positive' : metrics.currentStreak.type === 'LOSS' ? 'negative' : 'neutral'} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <InsightBlock title="Où votre edge apparaît" items={[
          intelligence.bestSetup ? intelligence.bestSetup.name + ' · ' + formatCurrency(intelligence.bestSetup.pnl) + ' · ' + intelligence.bestSetup.winRate.toFixed(0) + '% win' : 'Setup : —',
          intelligence.bestSymbol ? intelligence.bestSymbol.name + ' · ' + formatCurrency(intelligence.bestSymbol.pnl) : 'Instrument : —',
          intelligence.bestSession ? intelligence.bestSession.name + ' · ' + formatCurrency(intelligence.bestSession.pnl) : 'Session : —',
          intelligence.bestDirection ? intelligence.bestDirection.name + ' · ' + formatCurrency(intelligence.bestDirection.pnl) : 'Direction : —',
        ]} />
        <InsightBlock title="Rythme & répétabilité" items={[
          intelligence.avgTradesPerDay.toFixed(1) + ' trade/jour en moyenne',
          intelligence.bestDay ? 'Meilleure journée : ' + intelligence.bestDay.name + ' · ' + formatCurrency(intelligence.bestDay.pnl) : 'Meilleure journée : —',
          intelligence.worstDay ? 'Journée la plus faible : ' + intelligence.worstDay.name + ' · ' + formatCurrency(intelligence.worstDay.pnl) : 'Journée la plus faible : —',
          'TP renseigné sur ' + intelligence.tpRate.toFixed(0) + '% des trades',
        ]} />
        <InsightBlock title="Action automatique" items={intelligence.actions.slice(0,3)} emphasis />
      </div>
    </div>
  );

  const intelligenceFocus = (
    <div className="p-4 rounded-2xl border border-[#dce7e3] bg-white shadow-[0_8px_24px_rgba(16,35,58,0.04)]">
      <div className="flex items-center justify-between mb-3"><div><h2 className="text-sm font-bold text-[#10233a]">Avant de trader</h2><p className="text-[10px] text-[#8798a8]">Lecture instantanée des contraintes du journal.</p></div><ShieldCheck className="w-4 h-4 text-[#08b77a]" /></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <InsightMini label="PF" value={metrics.profitFactor.toFixed(2)} sub="edge" tone={metrics.profitFactor >= 1 ? 'positive' : 'negative'} />
        <InsightMini label="Risque moyen" value={intelligence.avgRisk ? formatCurrency(intelligence.avgRisk) : '—'} sub={intelligence.riskPct ? intelligence.riskPct.toFixed(2) + '% capital' : 'non renseigné'} />
        <InsightMini label="Émotion" value={intelligence.emotionalRate.toFixed(0) + '%'} sub="historique" tone={intelligence.emotionalRate <= 20 ? 'positive' : 'negative'} />
        <InsightMini label="Série" value={metrics.currentStreak.count ? (metrics.currentStreak.type === 'WIN' ? '+' : '-') + metrics.currentStreak.count : '—'} sub="actuelle" tone={metrics.currentStreak.type === 'WIN' ? 'positive' : metrics.currentStreak.type === 'LOSS' ? 'negative' : 'neutral'} />
        <InsightMini label="DD max" value={'-' + metrics.maxDrawdownPercent.toFixed(1) + '%'} sub="observé" tone={metrics.maxDrawdownPercent <= 5 ? 'positive' : 'negative'} />
      </div>
      <div className="mt-3 rounded-xl bg-[#f8fbfa] border border-[#e7efec] p-3"><div className="text-[9px] uppercase tracking-wider font-bold text-[#087b59]">Point à contrôler</div><div className="mt-1 text-xs font-semibold text-[#314861]">{intelligence.actions[0]}</div></div>
    </div>
  );

  const intelligenceAnalysis = (
    <div className="p-5 rounded-2xl card-premium">
      <div className="flex items-center justify-between mb-4"><div><h2 className="text-sm font-bold text-[#10233a]">Diagnostic systématique</h2><p className="text-[10px] text-[#8798a8]">Le journal permet d'identifier où l'edge existe et où il se dégrade.</p></div><Activity className="w-4 h-4 text-[#08b77a]" /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <InsightMini label="PF" value={metrics.profitFactor.toFixed(2)} sub="global" tone={metrics.profitFactor >= 1 ? 'positive' : 'negative'} />
        <InsightMini label="PF 7j." value={intelligence.recent7.length ? intelligence.recentPF.toFixed(2) : '—'} sub={intelligence.recent7.length + ' trades'} tone={intelligence.recentPF >= 1 ? 'positive' : 'negative'} />
        <InsightMini label="Win 7j." value={intelligence.recentWinRate.toFixed(0) + '%'} sub="récent" />
        <InsightMini label="Risque max" value={intelligence.maxRisk ? formatCurrency(intelligence.maxRisk) : '—'} sub="renseigné" />
        <InsightMini label="FOMO" value={intelligence.fomoRate.toFixed(0) + '%'} sub="trades" tone={intelligence.fomoRate === 0 ? 'positive' : 'negative'} />
        <InsightMini label="Revenge" value={intelligence.revengeRate.toFixed(0) + '%'} sub="trades" tone={intelligence.revengeRate === 0 ? 'positive' : 'negative'} />
        <InsightMini label="SL" value={intelligence.slRate.toFixed(0) + '%'} sub="usage" tone={intelligence.slRate >= 80 ? 'positive' : 'negative'} />
        <InsightMini label="Récupération" value={intelligence.recoveryFactor >= 99 ? '∞' : intelligence.recoveryFactor.toFixed(2)} sub="P&L / DD" tone={intelligence.recoveryFactor >= 1 ? 'positive' : 'negative'} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
        <InsightBlock title="Meilleure condition" items={[
          intelligence.bestSetup ? 'Setup : ' + intelligence.bestSetup.name : 'Setup : —',
          intelligence.bestSession ? 'Session : ' + intelligence.bestSession.name : 'Session : —',
          intelligence.bestSymbol ? 'Instrument : ' + intelligence.bestSymbol.name : 'Instrument : —',
          intelligence.bestTimeframe ? 'Timeframe : ' + intelligence.bestTimeframe.name : 'Timeframe : —',
        ]} />
        <InsightBlock title="Direction" items={byDirectionSummary(trades)} />
        <InsightBlock title="Rythme" items={[
          intelligence.avgTradesPerDay.toFixed(1) + ' trade/jour',
          intelligence.recent7.length + ' trade(s) sur la fenêtre récente',
          intelligence.bestDay ? 'Meilleur jour : ' + intelligence.bestDay.name : 'Meilleur jour : —',
          intelligence.worstDay ? 'Pire jour : ' + intelligence.worstDay.name : 'Pire jour : —',
        ]} />
        <InsightBlock title="Priorité" items={intelligence.actions.slice(0,4)} emphasis />
      </div>
    </div>
  );

  const intelligenceCompact = (
    <div className="rounded-2xl border border-[#dce7e3] bg-white p-4 shadow-[0_8px_24px_rgba(16,35,58,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#087b59]">Lecture instantanée</span>
        <span className="text-[10px] text-[#71839a]">PF {metrics.profitFactor.toFixed(2)}</span>
        <span className="text-[10px] text-[#71839a]">·</span>
        <span className={intelligence.recentPnl >= 0 ? "text-[10px] font-semibold text-[#008f63]" : "text-[10px] font-semibold text-[#e14d5d]"}>7j {formatCurrency(intelligence.recentPnl)}</span>
        <span className="text-[10px] text-[#71839a]">·</span>
        <span className="text-[10px] text-[#71839a]">Émotion {intelligence.emotionalRate.toFixed(0)}%</span>
        <span className="text-[10px] text-[#71839a]">·</span>
        <span className="text-[10px] text-[#71839a]">DD {metrics.maxDrawdownPercent.toFixed(1)}%</span>
      </div>
      <div className="mt-2 text-xs font-semibold text-[#314861]">{intelligence.actions[0]}</div>
    </div>
  );


  if (mode === 'focus') return <div className="space-y-5">{situation}{modeBar}
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      <div className="xl:col-span-3 p-5 rounded-2xl card-premium"><div className="flex items-center justify-between mb-3"><div><h2 className="text-sm font-bold text-[#10233a]">Focus Trading</h2><p className="text-[10px] text-[#8798a8]">Equity, risque et résultats récents.</p></div><Focus className="w-4 h-4 text-[#08b77a]" /></div><div className="min-h-[280px]">{chart}</div></div>
      <div className="p-5 rounded-2xl card-premium"><div className="flex items-center justify-between mb-4"><div><h2 className="text-sm font-bold text-[#10233a]">À surveiller</h2><p className="text-[10px] text-[#8798a8]">Deux repères avant une décision.</p></div><ShieldAlert className="w-4 h-4 text-[#f59e0b]" /></div><div className="space-y-3">
        <div className="rounded-xl border border-[#e7efec] bg-[#fbfdfc] p-3"><div className="text-[9px] uppercase tracking-wide text-[#71839a]">Profit Factor</div><div className="mt-1 text-2xl font-bold font-mono text-[#10233a]">{metrics.profitFactor.toFixed(2)}</div><div className={"mt-1 text-[9px] "+(metrics.profitFactor>=1?'text-[#008f63]':'text-[#e14d5d]')}>{metrics.profitFactor>=1?'Positif':'À surveiller'}</div></div>
        <div className="rounded-xl border border-[#e7efec] bg-[#fbfdfc] p-3"><div className="text-[9px] uppercase tracking-wide text-[#71839a]">Expectancy</div><div className={"mt-1 text-2xl font-bold font-mono "+(metrics.expectancy>=0?'text-[#008f63]':'text-[#e14d5d]')}>{formatCurrency(metrics.expectancy)}</div><div className="mt-1 text-[9px] text-[#71839a]">Par trade</div></div>
      </div></div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="Win Rate" value={metrics.winRate.toFixed(1)+'%'} sub="Gagnants" tone="positive" /><Metric label="Avg R" value={metrics.avgRR.toFixed(2)} sub="R moyen" /><Metric label="Drawdown" value={'-'+metrics.maxDrawdownPercent.toFixed(1)+'%'} sub="Max observé" tone={metrics.maxDrawdownPercent>5?'negative':'positive'} /><Metric label="Trades" value={String(metrics.totalTrades)} sub="Journal" /></div>
    {intelligenceFocus}{recentTrades(6)}
  </div>;

  if (mode === 'analysis') return <div className="space-y-5">{situation}{modeBar}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Metric label="Trades" value={String(metrics.totalTrades)} sub="Total" /><Metric label="Win Rate" value={metrics.winRate.toFixed(1)+'%'} sub="Gagnants" tone="positive" /><Metric label="Profit Factor" value={metrics.profitFactor.toFixed(2)} sub="Gains / pertes" /><Metric label="Expectancy" value={formatCurrency(metrics.expectancy)} sub="Par trade" tone={metrics.expectancy>=0?'positive':'negative'} /><Metric label="Avg R" value={metrics.avgRR.toFixed(2)} sub="Ratio moyen" /></div>
    <div className="p-5 rounded-2xl card-premium"><div className="flex items-center justify-between mb-2"><div><h2 className="text-sm font-bold text-[#10233a]">Analyse de l'equity</h2><p className="text-[10px] text-[#8798a8]">Évolution du capital et points de retournement.</p></div><TrendingUp className="w-4 h-4 text-[#08b77a]" /></div>{chart}</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="p-5 rounded-2xl card-premium"><div className="flex items-center justify-between mb-4"><div><h2 className="text-sm font-bold text-[#10233a]">Performance par instrument</h2><p className="text-[10px] text-[#8798a8]">Comparaison du P&L cumulé.</p></div><BarChart3 className="w-4 h-4 text-[#08b77a]" /></div><div className="space-y-3">{(() => {const rows=Object.entries(trades.reduce<Record<string,number>>((map,t)=>{map[t.symbol]=(map[t.symbol]||0)+(Number(t.pnl)||0);return map;},{})).sort((a,b)=>b[1]-a[1]).slice(0,5);const max=Math.max(...rows.map(([,v])=>Math.abs(v)),1);return rows.map(([symbol,pnl])=><div key={symbol}><div className="flex justify-between mb-1"><span className="text-[10px] font-semibold text-[#314861]">{symbol}</span><span className={pnl>=0?'text-[#008f63]':'text-[#e14d5d]'}>{formatCurrency(pnl)}</span></div><div className="h-3 rounded-full bg-[#edf2f0]"><div className={"h-full rounded-full "+(pnl>=0?'bg-[#08b77a]':'bg-[#e14d5d]')} style={{width:Math.max(5,Math.abs(pnl)/max*100)+'%'}} /></div></div>);})()}</div></div>
      <div className="p-5 rounded-2xl card-premium"><div className="flex items-center justify-between mb-4"><div><h2 className="text-sm font-bold text-[#10233a]">Sessions</h2><p className="text-[10px] text-[#8798a8]">Répartition des résultats par session.</p></div><Target className="w-4 h-4 text-[#08b77a]" /></div><div className="grid grid-cols-2 gap-3">{['Asia','London','Overlap','New York'].map(session=>{const list=trades.filter(t=>t.session===session);const pnl=list.reduce((s,t)=>s+(Number(t.pnl)||0),0);return <div key={session} className="rounded-xl border border-[#e7efec] bg-[#fbfdfc] p-3"><div className="flex justify-between"><span className="text-[10px] font-semibold text-[#314861]">{session}</span><span className={pnl>=0?'text-[#008f63]':'text-[#e14d5d]'}>{formatCurrency(pnl)}</span></div><div className="mt-2 h-2 rounded-full bg-[#edf2f0]"><div className={"h-full rounded-full "+(pnl>=0?'bg-[#08b77a]':'bg-[#e14d5d]')} style={{width:Math.max(8,Math.min(100,Math.abs(pnl)/Math.max(Math.abs(pnl),1)*100))+'%'}} /></div><div className="mt-1 text-[8px] text-[#94a2ad]">{list.length} trade{list.length>1?'s':''}</div></div>})}</div></div>
    </div>{intelligenceAnalysis}{recentTrades(8)}
  </div>;

  if (mode === 'compact') return <div className="space-y-4">{situation}{modeBar}
    <div className="p-4 rounded-2xl card-premium"><div className="flex items-center justify-between mb-2"><div><h2 className="text-sm font-bold text-[#10233a]">Vue compacte</h2><p className="text-[10px] text-[#8798a8]">L'essentiel du compte, sans surcharge.</p></div><Minimize2 className="w-4 h-4 text-[#08b77a]" /></div><div className="min-h-[240px]">{chart}</div></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><div className="rounded-xl bg-white border border-[#e7efec] px-3 py-2"><div className="text-[8px] uppercase text-[#8798a8]">P&L</div><div className={"text-sm font-bold font-mono "+(metrics.totalPnl>=0?'text-[#008f63]':'text-[#e14d5d]')}>{formatCurrency(metrics.totalPnl)}</div></div><div className="rounded-xl bg-white border border-[#e7efec] px-3 py-2"><div className="text-[8px] uppercase text-[#8798a8]">Win Rate</div><div className="text-sm font-bold font-mono text-[#10233a]">{metrics.winRate.toFixed(1)}%</div></div><div className="rounded-xl bg-white border border-[#e7efec] px-3 py-2"><div className="text-[8px] uppercase text-[#8798a8]">Drawdown</div><div className="text-sm font-bold font-mono text-[#10233a]">-{metrics.maxDrawdownPercent.toFixed(1)}%</div></div><div className="rounded-xl bg-white border border-[#e7efec] px-3 py-2"><div className="text-[8px] uppercase text-[#8798a8]">Trades</div><div className="text-sm font-bold font-mono text-[#10233a]">{metrics.totalTrades}</div></div></div>
    {intelligenceCompact}{recentTrades(5)}
  </div>;

  return <div className="space-y-5">{situation}{modeBar}{intelligenceStandard}<div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
  <div className="p-5 rounded-2xl card-premium">
    <div className="flex items-center justify-between mb-4"><div><h2 className="text-sm font-bold text-[#10233a]">Score psychologique</h2><p className="text-[10px] text-[#8798a8]">Maîtrise émotionnelle et qualité d'exécution.</p></div><ShieldCheck className="w-4 h-4 text-[#08b77a]" /></div>
    <DisciplineGauge value={score.psychologyScore} sufficient={score.isSufficientData} title="Score psychologique" subtitle="Maîtrise émotionnelle et discipline." showHeader={false} />
  </div>
  <div className="p-5 rounded-2xl card-premium">
    <div className="flex items-center justify-between mb-4"><div><h2 className="text-sm font-bold text-[#10233a]">Analyse psycho</h2><p className="text-[10px] text-[#8798a8]">4 dimensions de votre comportement.</p></div><Activity className="w-4 h-4 text-[#08b77a]" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-[#e7efec] bg-[#fbfdfc] p-3">
        <div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-[#71839a] uppercase tracking-wide">Psychologie</span><span className="text-sm font-bold font-mono text-[#10233a]">{score.isSufficientData ? score.psychologyScore : '—'}</span></div>
        <div className="mt-2 h-1.5 rounded-full bg-[#e9efed] overflow-hidden"><div className="h-full rounded-full bg-[#08b77a]" style={{width:`${score.isSufficientData ? score.psychologyScore : 0}%`}} /></div>
        <div className="mt-1 text-[8px] text-[#94a2ad]">{score.isSufficientData ? (score.psychologyScore >= 80 ? 'Excellent' : score.psychologyScore >= 60 ? 'Stable' : 'À travailler') : 'Données insuffisantes'}</div>
      </div><div className="rounded-xl border border-[#e7efec] bg-[#fbfdfc] p-3">
        <div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-[#71839a] uppercase tracking-wide">Discipline</span><span className="text-sm font-bold font-mono text-[#10233a]">{score.isSufficientData ? score.disciplineScore : '—'}</span></div>
        <div className="mt-2 h-1.5 rounded-full bg-[#e9efed] overflow-hidden"><div className="h-full rounded-full bg-[#08b77a]" style={{width:`${score.isSufficientData ? score.disciplineScore : 0}%`}} /></div>
        <div className="mt-1 text-[8px] text-[#94a2ad]">{score.isSufficientData ? (score.disciplineScore >= 80 ? 'Excellent' : score.disciplineScore >= 60 ? 'Stable' : 'À travailler') : 'Données insuffisantes'}</div>
      </div><div className="rounded-xl border border-[#e7efec] bg-[#fbfdfc] p-3">
        <div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-[#71839a] uppercase tracking-wide">Consistance</span><span className="text-sm font-bold font-mono text-[#10233a]">{score.isSufficientData ? score.consistencyScore : '—'}</span></div>
        <div className="mt-2 h-1.5 rounded-full bg-[#e9efed] overflow-hidden"><div className="h-full rounded-full bg-[#08b77a]" style={{width:`${score.isSufficientData ? score.consistencyScore : 0}%`}} /></div>
        <div className="mt-1 text-[8px] text-[#94a2ad]">{score.isSufficientData ? (score.consistencyScore >= 80 ? 'Excellent' : score.consistencyScore >= 60 ? 'Stable' : 'À travailler') : 'Données insuffisantes'}</div>
      </div><div className="rounded-xl border border-[#e7efec] bg-[#fbfdfc] p-3">
        <div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-[#71839a] uppercase tracking-wide">Exécution</span><span className="text-sm font-bold font-mono text-[#10233a]">{score.isSufficientData ? score.executionScore : '—'}</span></div>
        <div className="mt-2 h-1.5 rounded-full bg-[#e9efed] overflow-hidden"><div className="h-full rounded-full bg-[#08b77a]" style={{width:`${score.isSufficientData ? score.executionScore : 0}%`}} /></div>
        <div className="mt-1 text-[8px] text-[#94a2ad]">{score.isSufficientData ? (score.executionScore >= 80 ? 'Excellent' : score.executionScore >= 60 ? 'Stable' : 'À travailler') : 'Données insuffisantes'}</div>
      </div>
    </div>
    <div className="mt-3 flex gap-2">
      <div className="flex-1 rounded-xl bg-[#e7faf3] px-3 py-2"><div className="text-[8px] uppercase tracking-wide text-[#087b59]">Forces</div><div className="text-xs font-bold text-[#314861] mt-0.5">{score.strengths.length}</div></div>
      <div className="flex-1 rounded-xl bg-[#fff5f5] px-3 py-2"><div className="text-[8px] uppercase tracking-wide text-[#c44d5b]">Vigilance</div><div className="text-xs font-bold text-[#314861] mt-0.5">{score.weaknesses.length}</div></div>
    </div>
  </div>
  <div className="p-5 rounded-2xl card-premium">
    <div className="flex items-center justify-between mb-4"><div><h2 className="text-sm font-bold text-[#10233a]">Rentabilité des setups</h2><p className="text-[10px] text-[#8798a8]">Survolez une barre pour voir les détails.</p></div><Target className="w-4 h-4 text-[#08b77a]" /></div>
    <div className="space-y-4">
      {(() => {
        const setupStats = Object.entries(trades.reduce<Record<string,{count:number;wins:number;pnl:number;r:number}>>((map,t)=>{const key=t.setup?.trim()||'Non renseigné';const item=map[key]||{count:0,wins:0,pnl:0,r:0};item.count++;if(t.result==='WIN')item.wins++;item.pnl+=Number(t.pnl)||0;item.r+=Number(t.rMultiple)||0;map[key]=item;return map;},{})).sort((a,b)=>b[1].pnl-a[1].pnl).slice(0,5);
        const maxPnl=Math.max(...setupStats.map(([,s])=>Math.abs(s.pnl)),1);
        return setupStats.map(([setup,s],index)=>{const width=Math.max(8,Math.min(100,(Math.abs(s.pnl)/maxPnl)*100));const winRate=(s.wins/s.count)*100;const avgR=s.r/s.count;return <div key={setup} className="group relative">
          <div className="flex items-center justify-between mb-1.5"><div className="flex items-center gap-2 min-w-0"><span className="text-[9px] font-mono text-[#9aa8b5]">0{index+1}</span><span className="text-xs font-bold text-[#10233a] truncate">{setup}</span></div><span className={`text-sm font-bold font-mono ${s.pnl>=0?'text-[#008f63]':'text-[#e14d5d]'}`}>{formatCurrency(s.pnl)}</span></div>
          <div className="relative h-8 rounded-lg bg-[#edf2f0] overflow-visible cursor-default">
            <div className={`h-full rounded-lg transition-all duration-300 ${s.pnl>=0?'bg-[#08b77a] group-hover:bg-[#06a970]':'bg-[#e14d5d]'}`} style={{width:`${width}%`}} />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#10233a] px-3 py-2 text-[9px] text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">{s.count} trade{s.count>1?'s':''}<span className="mx-1.5 text-white/40">•</span>{winRate.toFixed(0)}% win<span className="mx-1.5 text-white/40">•</span>{avgR.toFixed(2)}R moyen</div>
          </div>
        </div>});
      })()}
      {!trades.length && <div className="text-[11px] text-[#8798a8]">Aucun setup à analyser.</div>}
    </div>
  </div>
</div>{recentTrades(6)}</div>;
}


function byDirectionSummary(trades: Trade[]): string[] {
  const map: Record<string, {pnl:number;count:number}> = {};
  trades.filter(t=>t.result!=='OPEN').forEach(t => {
    const k=t.direction;
    const item=map[k]||{pnl:0,count:0};
    item.pnl += Number(t.pnl)||0;
    item.count++;
    map[k]=item;
  });
  return Object.entries(map).sort((a,b)=>b[1].pnl-a[1].pnl).map(([name,v])=>name + ' · ' + formatCurrency(v.pnl) + ' · ' + v.count + ' trade' + (v.count>1?'s':'')).slice(0,3);
}

function InsightMini({label,value,sub,tone='neutral'}:{label:string;value:string;sub?:string;tone?:'neutral'|'positive'|'negative'}) {
  return <div className="rounded-xl border border-[#e7efec] bg-[#fbfdfc] p-2.5 min-w-0">
    <div className="text-[8px] uppercase tracking-wider font-bold text-[#8798a8] truncate">{label}</div>
    <div className={'mt-1 text-sm font-bold font-mono truncate ' + (tone==='positive'?'text-[#008f63]':tone==='negative'?'text-[#e14d5d]':'text-[#10233a]')}>{value}</div>
    {sub && <div className="mt-0.5 text-[8px] text-[#94a2ad] truncate">{sub}</div>}
  </div>;
}

function InsightBlock({title,items,emphasis=false}:{title:string;items:string[];emphasis?:boolean}) {
  return <div className={'rounded-xl border p-3 ' + (emphasis?'border-[#c9eee1] bg-[#f2fbf7]':'border-[#e7efec] bg-[#fbfdfc]')}>
    <div className={'text-[9px] uppercase tracking-wider font-bold ' + (emphasis?'text-[#087b59]':'text-[#71839a]')}>{title}</div>
    <div className="mt-2 space-y-1.5">{items.map((item,i)=><div key={i} className="text-[9px] leading-4 text-[#314861]">{item}</div>)}</div>
  </div>;
}

function DisciplineGauge({ value, sufficient, title = 'Score de discipline', subtitle = 'Indice global de discipline.', showHeader = true }: { value: number; sufficient: boolean; title?: string; subtitle?: string; showHeader?: boolean }) {
  const score = Math.max(0, Math.min(100, value));
  const segments = 50;
  const activeSegments = Math.round((score / 100) * segments);
  const centerX = 120;
  const centerY = 116;
  const innerRadius = 72;
  const outerRadius = 91;
  const startAngle = -180;
  const angleStep = 180 / segments;

  const point = (radius: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return { x: centerX + radius * Math.cos(radians), y: centerY + radius * Math.sin(radians) };
  };

  const segmentColor = (index: number) => {
    const pct = ((index + 0.5) / segments) * 100;
    if (pct <= 30) return '#ff3b30';
    if (pct <= 80) return '#ff9500';
    return '#34a853';
  };

  const label = !sufficient ? '—' : score >= 80 ? 'Excellent' : score >= 30 ? 'Bon' : 'À travailler';

  return (
    <div className={showHeader ? "h-full rounded-2xl bg-white p-5" : "w-full"}>
      {showHeader && <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-bold text-[#10233a]">{title}</h2><p className="text-[10px] text-[#8798a8] mt-0.5">{subtitle}</p></div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#dfe5ea] text-[#71839a]" title="Score calculé à partir de vos performances">
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>}
      <div className={showHeader ? "mt-2 flex justify-center" : "flex justify-center"}>
        <svg viewBox="0 0 240 155" className="h-auto w-full max-w-[330px]" role="img" aria-label={`${title} : ${sufficient ? `${Math.round(score)}%` : 'indisponible'}`}>
          <defs>
            <radialGradient id="scoreGaugeGlow" cx="50%" cy="72%" r="55%">
              <stop offset="0%" stopColor="#e8f7df" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M 28 116 A 92 92 0 0 1 212 116 L 198 116 A 78 78 0 0 0 42 116 Z" fill="url(#scoreGaugeGlow)" />
          {Array.from({ length: segments }).map((_, index) => {
            const gap = 0.75;
            const angle = startAngle + (index + 0.5) * angleStep;
            const p0 = point(innerRadius, angle - gap);
            const p1 = point(outerRadius, angle + gap);
            const active = sufficient && index < activeSegments;
            return (
              <line
                key={index}
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke={active ? segmentColor(index) : '#9aa7b8'}
                strokeWidth="3"
                strokeLinecap="butt"
              />
            );
          })}
          <text x="120" y="108" textAnchor="middle" className="fill-[#263238] text-[20px] font-bold">{sufficient ? `${Math.round(score)}%` : '—'}</text>
          <text x="120" y="123" textAnchor="middle" className="fill-[#34a853] text-[9px] font-semibold">{label}</text>
          <text x="22" y="146" className="fill-[#94a3b8] text-[8px] font-semibold">0%</text>
          <text x="72" y="25" textAnchor="middle" className="fill-[#94a3b8] text-[8px] font-semibold">30%</text>
          <text x="120" y="13" textAnchor="middle" className="fill-[#94a3b8] text-[8px] font-semibold">50%</text>
          <text x="168" y="25" textAnchor="middle" className="fill-[#94a3b8] text-[8px] font-semibold">80%</text>
          <text x="198" y="146" textAnchor="middle" className="fill-[#94a3b8] text-[8px] font-semibold">100%</text>
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
