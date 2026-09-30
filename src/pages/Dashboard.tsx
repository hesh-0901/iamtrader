import React, { useMemo } from 'react';
import { Trade, TradingAccount, UserProfile } from '../types';
import { calculatePerformance, calculateTraderScore, formatCurrency, formatPercent } from '../utils/calculations';
import { ResultBadge, DirectionBadge } from '../components/common/Badge';
import { Tooltip } from '../components/common/Tooltip';
import { EmptyState } from '../components/common/EmptyState';
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Target, 
  ShieldCheck, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronRight,
  Plus,
  Compass,
  Award,
  Clock,
  Zap,
  CheckCircle2,
  Wallet,
  Activity,
  Layers,
  ArrowRight,
  Shield
} from 'lucide-react';

interface DashboardProps {
  trades: Trade[];
  accounts: TradingAccount[];
  selectedAccountId: string;
  userProfile?: UserProfile | null;
  onOpenNewTrade: () => void;
  onSelectTrade: (trade: Trade) => void;
  onNavigateToJournal: () => void;
  onSeedData: () => void;
}

export function Dashboard({
  trades,
  accounts,
  selectedAccountId,
  userProfile,
  onOpenNewTrade,
  onSelectTrade,
  onNavigateToJournal,
  onSeedData
}: DashboardProps) {
  const currentAccount = accounts.find(a => a.id === selectedAccountId);

  const initialCapital = useMemo(() => {
    if (currentAccount) return currentAccount.initialBalance;
    if (accounts.length > 0) return accounts.reduce((acc, a) => acc + a.initialBalance, 0);
    return 50000;
  }, [currentAccount, accounts]);

  const metrics = useMemo(() => {
    return calculatePerformance(trades, initialCapital);
  }, [trades, initialCapital]);

  const traderScore = useMemo(() => {
    return calculateTraderScore(trades);
  }, [trades]);

  const currentEquity = initialCapital + metrics.totalPnl;
  const currentBalance = currentEquity;
  const roiPercent = initialCapital > 0 ? (metrics.totalPnl / initialCapital) * 100 : 0;

  // Breakdown by instrument
  const instrumentBreakdown = useMemo(() => {
    const map: Record<string, { count: number; pnl: number; wins: number }> = {};
    trades.forEach(t => {
      if (!map[t.symbol]) map[t.symbol] = { count: 0, pnl: 0, wins: 0 };
      map[t.symbol].count++;
      map[t.symbol].pnl += Number(t.pnl) || 0;
      if (t.result === 'WIN') map[t.symbol].wins++;
    });
    return Object.entries(map).sort((a, b) => b[1].pnl - a[1].pnl);
  }, [trades]);

  // Breakdown by session
  const sessionBreakdown = useMemo(() => {
    const map: Record<string, { count: number; pnl: number; wins: number }> = {
      'London': { count: 0, pnl: 0, wins: 0 },
      'New York': { count: 0, pnl: 0, wins: 0 },
      'Asia': { count: 0, pnl: 0, wins: 0 },
      'Overlap': { count: 0, pnl: 0, wins: 0 }
    };
    trades.forEach(t => {
      if (map[t.session]) {
        map[t.session].count++;
        map[t.session].pnl += Number(t.pnl) || 0;
        if (t.result === 'WIN') map[t.session].wins++;
      }
    });
    return map;
  }, [trades]);

  // Equity Curve SVG calculation
  const svgWidth = 800;
  const svgHeight = 220;
  const padding = 25;

  const points = useMemo(() => {
    if (metrics.equityCurve.length <= 1) return '';
    const balances = metrics.equityCurve.map(pt => pt.balance);
    const minVal = Math.min(...balances) * 0.995;
    const maxVal = Math.max(...balances) * 1.005;
    const range = maxVal - minVal || 1;

    return metrics.equityCurve.map((pt, i) => {
      const x = padding + (i / (metrics.equityCurve.length - 1)) * (svgWidth - padding * 2);
      const y = svgHeight - padding - ((pt.balance - minVal) / range) * (svgHeight - padding * 2);
      return `${x},${y}`;
    }).join(' ');
  }, [metrics.equityCurve, svgWidth, svgHeight, padding]);

  // Mini sparkline for KPI
  const miniSparklinePoints = useMemo(() => {
    if (metrics.equityCurve.length <= 1) return '0,15 30,15 60,15';
    const balances = metrics.equityCurve.map(pt => pt.balance);
    const minVal = Math.min(...balances);
    const maxVal = Math.max(...balances);
    const range = maxVal - minVal || 1;

    return metrics.equityCurve.slice(-8).map((pt, i, arr) => {
      const x = (i / (arr.length - 1 || 1)) * 64;
      const y = 20 - ((pt.balance - minVal) / range) * 16;
      return `${x},${y}`;
    }).join(' ');
  }, [metrics.equityCurve]);

  const userName = userProfile?.displayName || 'Hénoch';

  return (
    <div className="space-y-7">
      {/* 1. Header with Trader Situation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
              Prop Station Live
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-[11px] text-slate-500 font-mono">
              Compte : {currentAccount ? currentAccount.name : 'Portefeuille Global'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bonjour {userName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Votre capital sous gestion est stable avec une exposition au risque sous contrôle strict.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {trades.length === 0 && (
            <button
              onClick={onSeedData}
              className="btn-secondary px-3 py-2 rounded-lg text-xs cursor-pointer"
            >
              Charger démo
            </button>
          )}
          <button
            onClick={onOpenNewTrade}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nouveau Trade</span>
          </button>
        </div>
      </div>

      {/* Empty State Banner if no trades */}
      {trades.length === 0 && (
        <div className="rounded-xl card-premium overflow-hidden p-6 border-slate-200">
          <EmptyState
            icon={Compass}
            title="Aucune transaction dans votre journal"
            description="Enregistrez vos premières opérations pour activer la courbe d'equity continue, les ratios de rentabilité et le Trader Score institutionnel."
            actionLabel="+ Enregistrer un premier trade"
            onAction={onOpenNewTrade}
            secondaryLabel="Explorer avec des trades exemples"
            onSecondaryAction={onSeedData}
            accentColor="emerald"
          />
        </div>
      )}

      {/* 2. Structured Primary KPIs Grid (Balance, Equity, P&L, Win Rate, Drawdown, Profit Factor) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Balance */}
        <div className="p-5 rounded-2xl card-premium flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Balance</span>
            <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums tracking-tight">
              ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono mt-1 text-slate-500">
              <span className="text-slate-500">Init: ${initialCapital.toLocaleString()}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>Variation :</span>
            <span className={metrics.totalPnl >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {metrics.totalPnl >= 0 ? `+${metrics.totalPnl.toFixed(0)}$` : `${metrics.totalPnl.toFixed(0)}$`}
            </span>
          </div>
        </div>

        {/* Card 2: Equity */}
        <div className="p-5 rounded-2xl card-premium flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Equity</span>
            <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums tracking-tight">
              ${currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono mt-1 text-slate-500">
              <span className="text-slate-500">Temps réel</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono">Tendance</span>
            <svg width="60" height="18" className="overflow-visible">
              <polyline
                fill="none"
                stroke={metrics.totalPnl >= 0 ? '#10b981' : '#f43f5e'}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={miniSparklinePoints}
              />
            </svg>
          </div>
        </div>

        {/* Card 3: P&L Net */}
        <div className="p-5 rounded-2xl card-premium flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">P&L Net</span>
              <Tooltip content="Profit ou perte nette réalisée sur les positions clôturées." />
            </div>
            <div className={`w-6 h-6 rounded flex items-center justify-center border ${
              metrics.totalPnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {metrics.totalPnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
            </div>
          </div>
          <div className="my-2.5">
            <div className={`text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-tight ${
              metrics.totalPnl > 0 ? 'text-emerald-400' : metrics.totalPnl < 0 ? 'text-rose-400' : 'text-slate-600'
            }`}>
              {formatCurrency(metrics.totalPnl)}
            </div>
            <div className={`flex items-center gap-1 text-[11px] font-mono mt-1 font-semibold ${
              roiPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              <span>{formatPercent(roiPercent)} ROI</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>Moy/trade :</span>
            <span className="text-slate-400 font-semibold tabular-nums">
              {metrics.totalTrades > 0 ? formatCurrency(metrics.totalPnl / metrics.totalTrades) : '$0'}
            </span>
          </div>
        </div>

        {/* Card 4: Win Rate */}
        <div className="p-5 rounded-2xl card-premium flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Win Rate</span>
              <Tooltip content="Pourcentage de trades clôturés avec un profit positif." />
            </div>
            <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums tracking-tight">
              {metrics.winRate.toFixed(1)}%
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono mt-1">
              <span className="text-emerald-400 font-semibold">{metrics.winningTrades}W</span>
              <span className="text-slate-400">/</span>
              <span className="text-rose-400 font-semibold">{metrics.losingTrades}L</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-500">{metrics.breakevenTrades}BE</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/80">
            <div className="w-full h-1.5 rounded bg-slate-100 overflow-hidden flex">
              <div style={{ width: `${metrics.winRate}%` }} className="bg-emerald-500 rounded-l" />
              <div style={{ width: `${100 - metrics.winRate}%` }} className="bg-rose-500/70 rounded-r" />
            </div>
          </div>
        </div>

        {/* Card 5: Drawdown */}
        <div className="p-5 rounded-2xl card-premium flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Drawdown</span>
              <Tooltip content="Perte maximale en pourcentage par rapport au sommet historique du compte." />
            </div>
            <div className="w-6 h-6 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 tabular-nums tracking-tight">
              -{metrics.maxDrawdownPercent.toFixed(1)}%
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono mt-1 text-slate-500">
              <span>Montant : </span>
              <span className="text-rose-400 font-semibold tabular-nums">-${metrics.maxDrawdownAmount.toFixed(0)}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>Règle max 5% :</span>
            <span className={metrics.maxDrawdownPercent <= 5 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {metrics.maxDrawdownPercent <= 5 ? 'Conforme' : 'Alerte'}
            </span>
          </div>
        </div>

        {/* Card 6: Profit Factor */}
        <div className="p-5 rounded-2xl card-premium flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Profit Factor</span>
              <Tooltip content="Gains bruts divisés par pertes brutes. Un PF supérieur à 1.5 indique une stratégie robuste." />
            </div>
            <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums tracking-tight">
              {metrics.profitFactor > 0 ? metrics.profitFactor.toFixed(2) : '0.00'}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono mt-1 text-slate-500">
              <span>Gain : </span>
              <span className="text-emerald-400 font-semibold tabular-nums">+${metrics.avgWin.toFixed(0)}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>Perte :</span>
            <span className="text-rose-400 font-semibold tabular-nums">-${metrics.avgLoss.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* 3. Equity Curve Chart & Trader Score */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Equity Curve (2 columns) */}
        <div className="xl:col-span-2 p-6 rounded-2xl card-premium flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Courbe d'Equity</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                  Performance Réalisée
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Évolution du solde sur chaque position clôturée</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-white border border-slate-200">
                <span className="w-2 h-0.5 rounded bg-blue-500"></span>
                <span className="text-slate-400 text-[11px]">Capital</span>
              </div>
            </div>
          </div>

          {/* SVG Chart with discreet grid lines */}
          <div className="w-full overflow-hidden bg-white rounded-lg border border-slate-200/80 p-3">
            {metrics.equityCurve.length > 1 && points ? (
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44 sm:h-52 overflow-visible">
                <defs>
                  <linearGradient id="fintechEquityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
                  </linearGradient>
                </defs>
                {/* Horizontal guide lines */}
                <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <line x1={padding} y1={svgHeight / 2} x2={svgWidth - padding} y2={svgHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

                {/* Fill Area */}
                <polygon
                  points={`${padding},${svgHeight - padding} ${points} ${svgWidth - padding},${svgHeight - padding}`}
                  fill="url(#fintechEquityGrad)"
                />
                {/* Line */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
              </svg>
            ) : (
              <div className="h-44 sm:h-52 flex flex-col items-center justify-center text-xs text-slate-500 font-mono space-y-1">
                <span>Enregistrez au moins 2 trades pour afficher la courbe d'equity.</span>
              </div>
            )}
          </div>
        </div>

        {/* Trader Score Widget */}
        <div className="p-6 rounded-2xl card-premium flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Trader Score</h3>
            </div>
            <span className="text-[10px] font-mono uppercase text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 font-semibold">
              Indice Prop
            </span>
          </div>

          {/* Radial score */}
          <div className="my-4 flex flex-col items-center text-center">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="7"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#2563eb"
                  strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - (traderScore.isSufficientData ? traderScore.overallScore / 100 : 0))}`}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                  {traderScore.isSufficientData ? traderScore.overallScore : '—'}
                </span>
                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">sur 100</span>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-600 mt-2 font-mono">
              {traderScore.isSufficientData ? (
                traderScore.overallScore >= 80 ? 'Profil Élite' : 'Profil Solide'
              ) : 'Min 5 trades requis'}
            </div>
          </div>

          {/* 2 subscores */}
          <div className="space-y-2 pt-3 border-t border-slate-200/80 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Gestion du Risque</span>
              <span className="font-mono font-semibold text-slate-600">
                {traderScore.isSufficientData ? `${traderScore.riskManagementScore}/100` : '—'}
              </span>
            </div>
            <div className="w-full h-1 rounded bg-slate-100 overflow-hidden">
              <div style={{ width: `${traderScore.riskManagementScore}%` }} className="bg-blue-500 h-full rounded" />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-500">Discipline Opérationnelle</span>
              <span className="font-mono font-semibold text-slate-600">
                {traderScore.isSufficientData ? `${traderScore.disciplineScore}/100` : '—'}
              </span>
            </div>
            <div className="w-full h-1 rounded bg-slate-100 overflow-hidden">
              <div style={{ width: `${traderScore.disciplineScore}%` }} className="bg-emerald-500 h-full rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Trades Table (Clean FinTech Layout) */}
      <div className="p-6 rounded-2xl card-premium space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Dernières Opérations</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Historique récent synchronisé en direct</p>
          </div>
          <button
            onClick={onNavigateToJournal}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors cursor-pointer"
          >
            <span>Voir tout le journal</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Entrée</th>
                  <th className="py-2.5 px-3">Sortie</th>
                  <th className="py-2.5 px-3">Lot</th>
                  <th className="py-2.5 px-3">Risque</th>
                  <th className="py-2.5 px-3 text-right">P&L ($)</th>
                  <th className="py-2.5 px-3 text-right">R:R</th>
                  <th className="py-2.5 px-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {trades.slice(0, 6).map(trade => (
                  <tr
                    key={trade.id}
                    onClick={() => onSelectTrade(trade)}
                    className="hover:bg-slate-100/30 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(trade.entryDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-xs">
                      {trade.symbol}
                    </td>
                    <td className="py-2.5 px-3">
                      <DirectionBadge direction={trade.direction} />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums text-[11px]">
                      {trade.entryPrice ? trade.entryPrice.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums text-[11px]">
                      {trade.exitPrice ? trade.exitPrice.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums text-[11px]">
                      {trade.positionSize || '1'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums text-[11px]">
                      {trade.riskAmount ? `$${trade.riskAmount}` : '—'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums text-xs ${
                      trade.pnl > 0 ? 'text-emerald-400' : trade.pnl < 0 ? 'text-rose-400' : 'text-slate-500'
                    }`}>
                      {formatCurrency(trade.pnl)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400 tabular-nums text-[11px]">
                      {trade.rMultiple !== undefined ? `${trade.rMultiple > 0 ? `+${trade.rMultiple}R` : `${trade.rMultiple}R`}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <ResultBadge result={trade.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500 font-mono">
            Aucun trade récent à afficher.
          </div>
        )}
      </div>
    </div>
  );
}
