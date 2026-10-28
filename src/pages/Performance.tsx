import React, { useMemo } from 'react';
import { Trade, TradingAccount } from '../types';
import { calculatePerformance, formatCurrency } from '../utils/calculations';
import { EmptyState } from '../components/common/EmptyState';
import { TrendingUp, ShieldCheck, ArrowUpRight, ArrowDownRight, LineChart, Activity, BarChart3, Target, CalendarDays, Layers3 } from 'lucide-react';

interface PerformanceProps { trades: Trade[]; accounts: TradingAccount[]; }
const money = (value: number) => formatCurrency(value);
const dateKey = (trade: Trade) => {
  const value = trade.exitDate || trade.entryDate;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
};
const shortDate = (value: string) => {
  const date = new Date(value + (value.length === 10 ? 'T12:00:00' : ''));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

function StatCard({ label, value, tone = 'neutral', hint }: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral'; hint?: string }) {
  const toneClass = tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-rose-600' : 'text-slate-900';
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4">
    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">{label}</span>{hint && <span className="text-[10px] text-slate-400">{hint}</span>}</div>
    <div className={`break-words text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${toneClass}`}>{value}</div>
  </div>;
}
function Panel({ title, subtitle, icon: Icon, children, className = '' }: { title: string; subtitle?: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
    <div className="mb-4 flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Icon className="h-4 w-4" /></div><div className="min-w-0"><h2 className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">{title}</h2>{subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>}</div></div>
    {children}
  </section>;
}

function EquityChart({ points }: { points: { date: string; balance: number; pnl: number; tradeIndex: number }[] }) {
  const chart = useMemo(() => {
    const width = 760, height = 230, padX = 12, padY = 18;
    const values = points.map(p => p.balance), min = Math.min(0, ...values), max = Math.max(0, ...values), range = max - min || 1;
    const x = (i: number) => padX + (points.length <= 1 ? 0 : i / (points.length - 1) * (width - padX * 2));
    const y = (v: number) => height - padY - ((v - min) / range) * (height - padY * 2);
    const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(2)} ${y(p.balance).toFixed(2)}`).join(' ');
    const zeroY = y(0), area = points.length ? `${line} L ${x(points.length - 1)} ${zeroY} L ${x(0)} ${zeroY} Z` : '';
    return { width, height, line, area, zeroY, positive: (points.at(-1)?.balance ?? 0) >= 0, grid: [0, 1, 2, 3].map(i => ({ y: padY + i / 3 * (height - padY * 2), value: max - i / 3 * range })) };
  }, [points]);
  if (points.length < 2) return <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">Ajoute au moins deux trades clôturés pour afficher la courbe.</div>;
  return <div className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> P&L cumulé</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-300" /> Ligne zéro</span><span className="ml-auto font-semibold text-slate-700">{points.length - 1} opérations clôturées</span></div>
    <div className="w-full overflow-hidden"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Courbe du profit et de la perte cumulés" className="h-auto max-h-[280px] w-full">
      <defs><linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={chart.positive ? '#10b981' : '#f43f5e'} stopOpacity=".24" /><stop offset="100%" stopColor={chart.positive ? '#10b981' : '#f43f5e'} stopOpacity=".015" /></linearGradient></defs>
      {chart.grid.map((g, i) => <g key={i}><line x1="8" x2={chart.width - 8} y1={g.y} y2={g.y} stroke="#e2e8f0" strokeDasharray="4 5" /><text x="12" y={g.y - 4} fill="#94a3b8" fontSize="10">{Math.round(g.value).toLocaleString('fr-FR')}</text></g>)}
      <line x1="8" x2={chart.width - 8} y1={chart.zeroY} y2={chart.zeroY} stroke="#94a3b8" strokeWidth="1.2" /><path d={chart.area} fill="url(#equityFill)" /><path d={chart.line} fill="none" stroke={chart.positive ? '#059669' : '#e11d48'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg></div>
    <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Début de période</span><span>Dernier trade clôturé</span></div>
  </div>;
}

function DailyBars({ trades }: { trades: Trade[] }) {
  const days = useMemo(() => {
    const map = new Map<string, number>();
    trades.filter(t => t.result !== 'OPEN').forEach(t => map.set(dateKey(t), (map.get(dateKey(t)) || 0) + (Number(t.pnl) || 0)));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-18);
  }, [trades]);
  const maxAbs = Math.max(1, ...days.map(([, value]) => Math.abs(value)));
  if (!days.length) return <div className="flex h-36 items-center justify-center text-sm text-slate-500">Aucune performance journalière à afficher.</div>;
  return <div className="min-w-0">
    <div className="mb-3 flex items-center gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Jour positif</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-rose-500" /> Jour négatif</span></div>
    <div className="flex h-44 items-stretch gap-1 border-b border-slate-200 sm:gap-2">
      {days.map(([date, value]) => { const height = Math.max(3, Math.abs(value) / maxAbs * 100); return <div key={date} className="group relative flex min-w-0 flex-1 flex-col items-center justify-center" title={`${shortDate(date)} : ${money(value)}`}>
        <div className="flex h-full w-full flex-col items-center justify-center">{value >= 0 ? <><div className="flex h-1/2 w-full items-end justify-center"><div className="w-[72%] rounded-t-sm bg-emerald-500 transition-colors group-hover:bg-emerald-600" style={{ height: `${height}%` }} /></div><div className="h-px w-full bg-slate-300" /><div className="h-1/2 w-full" /></> : <><div className="h-1/2 w-full" /><div className="h-px w-full bg-slate-300" /><div className="flex h-1/2 w-full items-start justify-center"><div className="w-[72%] rounded-b-sm bg-rose-500 transition-colors group-hover:bg-rose-600" style={{ height: `${height}%` }} /></div></>}</div>
        <span className="absolute -bottom-5 whitespace-nowrap text-[9px] text-slate-400">{shortDate(date)}</span><div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block">{money(value)}</div>
      </div>; })}
    </div>
    <div className="mt-7 flex items-center justify-between text-xs text-slate-500"><span>{days.length} jours de trading</span><span className="font-semibold text-slate-700">P&L par jour de clôture</span></div>
  </div>;
}

export function Performance({ trades }: PerformanceProps) {
  const metrics = useMemo(() => calculatePerformance(trades), [trades]);
  const closedTrades = useMemo(() => trades.filter(t => t.result !== 'OPEN'), [trades]);
  const directionStats = useMemo(() => {
    const stats = { long: { count: 0, pnl: 0, wins: 0 }, short: { count: 0, pnl: 0, wins: 0 } };
    closedTrades.forEach(t => { const side = t.direction === 'BUY' ? stats.long : stats.short; side.count++; side.pnl += Number(t.pnl) || 0; if (t.result === 'WIN') side.wins++; });
    return { long: { ...stats.long, wr: stats.long.count ? stats.long.wins / stats.long.count * 100 : 0 }, short: { ...stats.short, wr: stats.short.count ? stats.short.wins / stats.short.count * 100 : 0 } };
  }, [closedTrades]);
  const setupStats = useMemo(() => {
    const map: Record<string, { count: number; pnl: number; wins: number }> = {};
    closedTrades.forEach(t => { const key = t.setup || 'Autre'; if (!map[key]) map[key] = { count: 0, pnl: 0, wins: 0 }; map[key].count++; map[key].pnl += Number(t.pnl) || 0; if (t.result === 'WIN') map[key].wins++; });
    return Object.entries(map).sort((a, b) => b[1].pnl - a[1].pnl);
  }, [closedTrades]);
  const timeframeStats = useMemo(() => {
    const map: Record<string, { count: number; pnl: number; wins: number }> = {};
    closedTrades.forEach(t => { const key = t.timeframe || 'Autre'; if (!map[key]) map[key] = { count: 0, pnl: 0, wins: 0 }; map[key].count++; map[key].pnl += Number(t.pnl) || 0; if (t.result === 'WIN') map[key].wins++; });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [closedTrades]);
  const bestSetup = setupStats.find(([, s]) => s.pnl > 0), weakestSetup = [...setupStats].reverse().find(([, s]) => s.pnl < 0);

  if (!closedTrades.length) return <div className="space-y-5">
    <header className="border-b border-slate-200 pb-4"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-600">Analytique & Performance</span><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Analyses & Edge</h1><p className="mt-1 text-sm text-slate-500">Ton état de performance, en un regard.</p></header>
    <div className="rounded-2xl border border-slate-200 bg-white p-6"><EmptyState icon={LineChart} title="Aucune performance à analyser" description="Dès que tu clôtures tes premières opérations, tes résultats, ta courbe de capital et tes setups apparaîtront ici." accentColor="sky" /></div>
  </div>;

  return <div className="space-y-5 pb-6">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-600">Analytique & Performance</span><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Analyses & Edge</h1><p className="mt-1 text-sm text-slate-500">Ton état de performance, en un regard.</p></div><div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 sm:self-auto"><CalendarDays className="h-4 w-4 text-slate-400" /> {metrics.totalTrades} trades clôturés</div></header>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><StatCard label="P&L total" value={money(metrics.totalPnl)} tone={metrics.totalPnl >= 0 ? 'positive' : 'negative'} hint="Net" /><StatCard label="Profit Factor" value={metrics.profitFactor.toFixed(2)} tone={metrics.profitFactor >= 1 ? 'positive' : 'negative'} hint="Gains / pertes" /><StatCard label="Gain moyen" value={money(metrics.avgWin)} tone="positive" /><StatCard label="Perte moyenne" value={`-${money(metrics.avgLoss).replace(/^[+-]/, '')}`} tone="negative" /></div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
      <Panel title="Évolution du P&L" subtitle="La courbe monte quand tes résultats cumulés progressent." icon={Activity}>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Résultat cumulé</span><div className={`mt-1 text-lg font-bold ${metrics.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(metrics.totalPnl)}</div></div><div className="rounded-lg bg-slate-50 p-3"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Espérance / trade</span><div className={`mt-1 text-lg font-bold ${metrics.expectancy >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(metrics.expectancy)}</div></div><div className="col-span-2 rounded-lg bg-slate-50 p-3 sm:col-span-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Win rate</span><div className="mt-1 text-lg font-bold text-slate-900">{metrics.winRate.toFixed(1)}%</div></div></div>
        <EquityChart points={metrics.equityCurve} />
      </Panel>
      <Panel title="Risque & robustesse" subtitle="Les pertes maximales et les extrêmes à surveiller." icon={ShieldCheck}>
        <div className="grid grid-cols-2 gap-3"><StatCard label="Max drawdown" value={`-${metrics.maxDrawdownPercent.toFixed(1)}%`} tone="negative" /><StatCard label="Drawdown ($)" value={`-${money(metrics.maxDrawdownAmount).replace(/^[+-]/, '')}`} tone="negative" /><StatCard label="Meilleur trade" value={money(metrics.bestTrade)} tone="positive" /><StatCard label="Pire trade" value={money(metrics.worstTrade)} tone="negative" /></div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5"><div><div className="text-xs font-bold text-slate-700">Ratio gain / perte (Payoff)</div><div className="mt-1 text-[11px] text-slate-500">Gain moyen comparé à une perte moyenne</div></div><div className="whitespace-nowrap text-xl font-bold text-slate-950">{metrics.avgLoss > 0 ? (metrics.avgWin / metrics.avgLoss).toFixed(2) : '—'} : 1</div></div>
      </Panel>
    </div>
    <Panel title="Performance journalière" subtitle="Repère les journées qui contribuent le plus à tes résultats." icon={BarChart3}><DailyBars trades={closedTrades} /></Panel>
    <Panel title="Longs vs Shorts" subtitle="Identifie le sens de marché qui contribue le plus à tes résultats." icon={Target}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{([{ key: 'long', label: 'Achats (Longs)', data: directionStats.long, positive: true }, { key: 'short', label: 'Ventes (Shorts)', data: directionStats.short, positive: false }] as const).map(({ key, label, data, positive }) => <div key={key} className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between gap-2"><span className={`flex items-center gap-1.5 text-sm font-bold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>{positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{label}</span><span className="text-xs text-slate-500">{data.count} trades</span></div><div className={`text-2xl font-bold tracking-tight ${data.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(data.pnl)}</div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Taux de réussite</span><strong className="text-slate-800">{data.wr.toFixed(1)}%</strong></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(0, Math.min(100, data.wr))}%` }} /></div></div>)}</div>
    </Panel>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="Rentabilité par setup" subtitle="Classement par P&L : repère tes configurations les plus rentables." icon={Layers3}>
        <div className="space-y-3">{setupStats.map(([name, data]) => { const wr = data.count ? data.wins / data.count * 100 : 0, max = Math.max(1, ...setupStats.map(([, item]) => Math.abs(item.pnl))); return <div key={name} className="rounded-xl border border-slate-100 p-3 transition-colors hover:border-slate-200"><div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-800">{name}</div><div className="mt-0.5 text-[11px] text-slate-500">{data.count} trades · {wr.toFixed(0)}% gagnants</div></div><div className={`whitespace-nowrap text-sm font-bold ${data.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(data.pnl)}</div></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${data.pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(3, Math.abs(data.pnl) / max * 100)}%` }} /></div></div>; })}</div>
        {(bestSetup || weakestSetup) && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{bestSetup && <div className="rounded-lg bg-emerald-50 p-3 text-xs"><div className="font-bold text-emerald-800">Setup le plus rentable</div><div className="mt-1 text-emerald-700">{bestSetup[0]} · {money(bestSetup[1].pnl)}</div></div>}{weakestSetup && <div className="rounded-lg bg-rose-50 p-3 text-xs"><div className="font-bold text-rose-800">Setup à réexaminer</div><div className="mt-1 text-rose-700">{weakestSetup[0]} · {money(weakestSetup[1].pnl)}</div></div>}</div>}
      </Panel>
      <Panel title="Distribution par timeframe" subtitle="Compare la contribution de chaque unité de temps." icon={BarChart3}>
        <div className="space-y-3">{timeframeStats.map(([name, data]) => { const wr = data.count ? data.wins / data.count * 100 : 0, max = Math.max(1, ...timeframeStats.map(([, item]) => Math.abs(item.pnl))); return <div key={name} className="rounded-xl border border-slate-100 p-3"><div className="mb-2 flex items-center justify-between gap-3"><div><span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">{name}</span><div className="mt-1.5 text-[11px] text-slate-500">{data.count} trades · {wr.toFixed(0)}% gagnants</div></div><div className={`text-sm font-bold ${data.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(data.pnl)}</div></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${data.pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(3, Math.abs(data.pnl) / max * 100)}%` }} /></div></div>; })}</div>
      </Panel>
    </div>
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>Les graphiques et les ventilations utilisent les opérations clôturées. Les résultats dépendent des données enregistrées dans le journal de trading.</span></div>
  </div>;
}
