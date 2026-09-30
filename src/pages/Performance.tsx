import React, { useMemo } from 'react';
import { Trade, TradingAccount } from '../types';
import { calculatePerformance, formatCurrency, formatPercent } from '../utils/calculations';
import { Tooltip } from '../components/common/Tooltip';
import { EmptyState } from '../components/common/EmptyState';
import { 
  TrendingUp, 
  ShieldCheck, 
  Clock, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  Award, 
  Zap, 
  BarChart3, 
  Activity, 
  LineChart
} from 'lucide-react';

interface PerformanceProps {
  trades: Trade[];
  accounts: TradingAccount[];
}

export function Performance({ trades, accounts }: PerformanceProps) {
  const metrics = useMemo(() => {
    return calculatePerformance(trades);
  }, [trades]);

  // Breakdown by Direction
  const directionStats = useMemo(() => {
    let longPnl = 0, shortPnl = 0;
    let longTrades = 0, shortTrades = 0;
    let longWins = 0, shortWins = 0;

    trades.forEach(t => {
      const pnl = Number(t.pnl) || 0;
      if (t.direction === 'BUY') {
        longTrades++;
        longPnl += pnl;
        if (t.result === 'WIN') longWins++;
      } else {
        shortTrades++;
        shortPnl += pnl;
        if (t.result === 'WIN') shortWins++;
      }
    });

    return {
      long: { count: longTrades, pnl: longPnl, wr: longTrades > 0 ? (longWins / longTrades) * 100 : 0 },
      short: { count: shortTrades, pnl: shortPnl, wr: shortTrades > 0 ? (shortWins / shortTrades) * 100 : 0 }
    };
  }, [trades]);

  // Breakdown by Setup
  const setupStats = useMemo(() => {
    const map: Record<string, { count: number; pnl: number; wins: number }> = {};
    trades.forEach(t => {
      const s = t.setup || 'Autre';
      if (!map[s]) map[s] = { count: 0, pnl: 0, wins: 0 };
      map[s].count++;
      map[s].pnl += Number(t.pnl) || 0;
      if (t.result === 'WIN') map[s].wins++;
    });
    return Object.entries(map).sort((a, b) => b[1].pnl - a[1].pnl);
  }, [trades]);

  // Breakdown by Timeframe
  const timeframeStats = useMemo(() => {
    const map: Record<string, { count: number; pnl: number; wins: number }> = {};
    trades.forEach(t => {
      const tf = t.timeframe || 'Autre';
      if (!map[tf]) map[tf] = { count: 0, pnl: 0, wins: 0 };
      map[tf].count++;
      map[tf].pnl += Number(t.pnl) || 0;
      if (t.result === 'WIN') map[tf].wins++;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <div className="pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
              Statistiques Avancées
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Performance & Edge Statistique
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprenez d'où proviennent exactement vos gains et où se situent vos fuites de capital.
          </p>
        </div>

        <div className="rounded-xl card-premium overflow-hidden p-6 border-slate-200">
          <EmptyState
            icon={LineChart}
            title="Aucune donnée de performance enregistrée"
            description="Dès vos premières opérations journalisées, ce module décomposera vos ratios de gain, votre espérance mathématique et vos meilleurs setups."
            accentColor="sky"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
            Modèle d'Attribution FinTech
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-[11px] text-slate-500 font-mono">Edge Statistique</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Performance & Edge Statistique
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Comprenez d'où proviennent exactement vos gains, vos ratios d'asymétrie et vos plus gros avantages concurrentiels sur les marchés.
        </p>
      </div>

      {/* Grid 1: Rentabilité & Risque Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pillar 1: Rentabilité */}
        <div className="p-5 rounded-xl card-premium space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-900">Métriques de Rentabilité</span>
                <span className="text-[10px] text-slate-500 font-mono">Espérance & Ratios</span>
              </div>
            </div>
            <span className="text-xs font-mono text-blue-400 font-semibold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
              {metrics.totalTrades} opérations
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">P&L Total</span>
              <span className={`text-lg font-bold tabular-nums ${metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(metrics.totalPnl)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Profit Factor</span>
                <Tooltip content="Ratio Gains / Pertes. Supérieur à 1.5 recommandé par les gestionnaires de fonds." />
              </div>
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {metrics.profitFactor.toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Gain Moyen</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">
                +${metrics.avgWin.toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Perte Moyenne</span>
              <span className="text-base font-bold text-rose-400 tabular-nums">
                -${metrics.avgLoss.toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80 col-span-2 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Espérance Mathématique (Expectancy)
                  </span>
                  <Tooltip content="Ce que votre edge vous rapporte en moyenne à chaque clic de souris." />
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Gain moyen attendu par transaction</span>
              </div>
              <span className={`text-base font-bold tabular-nums ${metrics.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(metrics.expectancy)}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 2: Risque & Robustesse */}
        <div className="p-5 rounded-xl card-premium space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <div className="w-7 h-7 rounded bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-900">Gestion du Risque & Robustesse</span>
                <span className="text-[10px] text-slate-500 font-mono">Drawdowns & Extrêmes</span>
              </div>
            </div>
            <span className="text-xs font-mono text-rose-400 font-semibold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
              Contrôle strict
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Max Drawdown (%)</span>
              <span className="text-lg font-bold text-rose-400 tabular-nums">
                -{metrics.maxDrawdownPercent.toFixed(1)}%
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Max Drawdown ($)</span>
              <span className="text-lg font-bold text-rose-400 tabular-nums">
                -${metrics.maxDrawdownAmount.toFixed(0)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Meilleur Trade</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">
                +${metrics.bestTrade.toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Pire Trade</span>
              <span className="text-base font-bold text-rose-400 tabular-nums">
                {metrics.worstTrade < 0 ? `-$${Math.abs(metrics.worstTrade).toFixed(2)}` : '$0.00'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80 col-span-2 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Ratio Gain / Perte (Payoff)
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Taille relative d'un gain vs une perte</span>
              </div>
              <span className="text-base font-bold text-slate-900 tabular-nums">
                {metrics.avgLoss > 0 ? (metrics.avgWin / metrics.avgLoss).toFixed(2) : '—'} : 1
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid 2: Directional Edge (Long vs Short) */}
      <div className="p-5 rounded-xl card-premium space-y-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Attribution Directionnelle (Longs vs Shorts)</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Performance comparée à l'achat et à la vente à découvert</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5 font-sans">
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                ACHATS (LONGS)
              </span>
              <span className="text-slate-500 font-medium">{directionStats.long.count} trades</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-sans">P&L Net :</span>
              <span className={`font-bold tabular-nums text-sm ${directionStats.long.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(directionStats.long.pnl)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-sans">Taux de réussite :</span>
              <span className="text-slate-900 font-bold">{directionStats.long.wr.toFixed(1)}%</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-rose-400 font-bold text-xs flex items-center gap-1.5 font-sans">
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                VENTES (SHORTS)
              </span>
              <span className="text-slate-500 font-medium">{directionStats.short.count} trades</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-sans">P&L Net :</span>
              <span className={`font-bold tabular-nums text-sm ${directionStats.short.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(directionStats.short.pnl)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-sans">Taux de réussite :</span>
              <span className="text-slate-900 font-bold">{directionStats.short.wr.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid 3: Setups & Timeframes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Setups */}
        <div className="p-5 rounded-xl card-premium space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Rentabilité par Setup de Trading</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Stratégies générant la plus haute espérance mathématique</p>
          </div>

          <div className="space-y-2 text-xs">
            {setupStats.map(([setupName, data]) => {
              const wr = (data.wins / data.count) * 100;
              return (
                <div key={setupName} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-700 transition-colors">
                  <div>
                    <span className="font-semibold text-slate-900">{setupName}</span>
                    <span className="text-slate-500 ml-2 font-mono text-[10px]">({data.count} trades)</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-500 text-[11px]">{wr.toFixed(0)}% WR</span>
                    <span className={`font-bold tabular-nums text-xs min-w-[70px] text-right ${
                      data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {formatCurrency(data.pnl)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeframes */}
        <div className="p-5 rounded-xl card-premium space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Distribution par Unité de Temps (Timeframe)</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Répartition des opérations court terme et swing</p>
          </div>

          <div className="space-y-2 text-xs">
            {timeframeStats.map(([tf, data]) => {
              const wr = (data.wins / data.count) * 100;
              return (
                <div key={tf} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-700 transition-colors">
                  <div>
                    <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-1.5 py-0.5 rounded border border-slate-700">
                      {tf}
                    </span>
                    <span className="text-slate-500 ml-2 font-mono text-[10px]">({data.count} trades)</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-500 text-[11px]">{wr.toFixed(0)}% WR</span>
                    <span className={`font-bold tabular-nums text-xs min-w-[70px] text-right ${
                      data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {formatCurrency(data.pnl)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
