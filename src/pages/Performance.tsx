import React, { useMemo } from 'react';
import { Trade, TradingAccount } from '../types';
import { calculatePerformance, formatCurrency } from '../utils/calculations';
import { EmptyState } from '../components/common/EmptyState';
import { TrendingUp, ShieldCheck, ArrowUpRight, ArrowDownRight, LineChart, Activity, BarChart3, Target, CalendarDays, Layers3, Crosshair, Zap, Waves, Brain, Compass, Sparkles, Gauge, Wallet, Trophy, CircleX, Scale } from 'lucide-react';

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
  return <div className="min-w-0 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_2px_12px_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4">
    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">{label}</span>{hint && <span className="text-[10px] text-slate-400">{hint}</span>}</div>
    <div className={`break-words text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${toneClass}`}>{value}</div>
  </div>;
}
function Panel({ title, subtitle, icon: Icon, children, className = '' }: { title: string; subtitle?: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.035)] sm:p-5 ${className}`}>
    <div className="mb-5 flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Icon className="h-4 w-4" /></div><div className="min-w-0"><h2 className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">{title}</h2>{subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>}</div></div>
    {children}
  </section>;
}

function SetupMotifIcon({ name }: { name: string }) {
  const motif = name.toLowerCase();
  const Icon = /fvg|imbalance|ifvg|gap/.test(motif) ? Waves
    : /order block|breaker|ob\b|block/.test(motif) ? Layers3
    : /sweep|liquid|smt|stop hunt/.test(motif) ? Compass
    : /unicorn|ict|mss|structure/.test(motif) ? Crosshair
    : /breakout|momentum|scalp/.test(motif) ? Zap
    : /psych|mind|discipline/.test(motif) ? Brain
    : /target|sniper|entry/.test(motif) ? Target
    : Sparkles;
  return <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
}

function EquityChart({ points }: { points: { date: string; balance: number; pnl: number; tradeIndex: number }[] }) {
  const chart = useMemo(() => {
    const width = 820, height = 300, left = 76, right = 20, top = 22, bottom = 42;
    const values = points.map(p => p.balance);
    const minValue = Math.min(0, ...values), maxValue = Math.max(0, ...values);
    const span = maxValue - minValue || 1;
    const pad = span * 0.08;
    const min = minValue - pad, max = maxValue + pad, range = max - min || 1;
    const x = (i: number) => left + (points.length <= 1 ? 0 : i / (points.length - 1) * (width - left - right));
    const y = (v: number) => top + (max - v) / range * (height - top - bottom);
    const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(2)} ${y(p.balance).toFixed(2)}`).join(' ');
    const zeroY = y(0);
    const area = points.length ? `${line} L ${x(points.length - 1)} ${zeroY} L ${x(0)} ${zeroY} Z` : '';
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const value = max - i / 4 * range;
      return { y: y(value), value };
    });
    const positive = (points.at(-1)?.balance ?? 0) >= 0;
    return { width, height, left, right, top, bottom, line, area, zeroY, positive, ticks, x, y };
  }, [points]);
  if (points.length < 2) return <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">Ajoute au moins deux trades clôturés pour afficher la courbe.</div>;
  const color = chart.positive ? '#059669' : '#be123c';
  return <div className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> P&L cumulé</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-300" /> Point de départ (0)</span><span className="ml-auto font-semibold text-slate-700">{points.length - 1} opérations clôturées</span></div>
    <div className="w-full overflow-hidden rounded-xl bg-slate-950/[0.02] p-1 sm:p-2"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Courbe du profit et de la perte cumulés avec échelles horizontale et verticale" className="h-auto max-h-[380px] w-full">
      <defs><linearGradient id="equityPremiumFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".13" /><stop offset="100%" stopColor={color} stopOpacity=".015" /></linearGradient></defs>
      {chart.ticks.map((g, i) => <g key={i}><line x1={chart.left} x2={chart.width - chart.right} y1={g.y} y2={g.y} stroke="#cbd5e1" strokeOpacity=".75" strokeDasharray="3 6" /><text x={chart.left - 12} y={g.y + 4} fill="#64748b" fontSize="11" textAnchor="end">{Math.round(g.value).toLocaleString('fr-FR')}</text></g>)}
      <line x1={chart.left} x2={chart.width - chart.right} y1={chart.height - chart.bottom} y2={chart.height - chart.bottom} stroke="#94a3b8" strokeOpacity=".8" />
      <line x1={chart.left} x2={chart.width - chart.right} y1={chart.zeroY} y2={chart.zeroY} stroke="#64748b" strokeWidth="1.4" strokeDasharray="5 4" />
      <path d={chart.area} fill="url(#equityPremiumFill)" /><path d={chart.line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <g key={p.tradeIndex}><circle cx={chart.x(i)} cy={chart.y(p.balance)} r={i === points.length - 1 ? 4 : 2.2} fill={i === points.length - 1 ? color : "white"} stroke={color} strokeWidth={i === points.length - 1 ? 2 : 1.3} /></g>)}
      <text x={chart.left} y={chart.height - 12} fill="#64748b" fontSize="11" textAnchor="start">{shortDate(points[0].date.slice(0, 10))}</text><text x={chart.width - chart.right} y={chart.height - 12} fill="#64748b" fontSize="11" textAnchor="end">{shortDate(points[points.length - 1].date.slice(0, 10))}</text>
      <text x={chart.left + (chart.width - chart.left - chart.right) / 2} y={chart.height - 1} fill="#94a3b8" fontSize="10" textAnchor="middle">Chronologie des trades →</text>
    </svg></div>
    <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-400"><span>Axe vertical : P&L cumulé ($)</span><span>Axe horizontal : progression des opérations</span></div>
  </div>;
}

function RadarProfile({ metrics }: { metrics: ReturnType<typeof calculatePerformance> }) {
  const dimensions = [
    { label: 'Win rate', value: Math.max(0, Math.min(100, metrics.winRate)) },
    { label: 'Profit factor', value: Math.max(0, Math.min(100, metrics.profitFactor / 2 * 100)) },
    { label: 'Payoff', value: Math.max(0, Math.min(100, (metrics.avgLoss > 0 ? metrics.avgWin / metrics.avgLoss : 0) / 2 * 100)) },
    { label: 'Espérance', value: Math.max(0, Math.min(100, metrics.avgWin > 0 ? (metrics.expectancy / metrics.avgWin) * 100 : 0)) },
    { label: 'Maîtrise du DD', value: Math.max(0, 100 - Math.min(100, metrics.maxDrawdownPercent * 5)) },
  ];
  const cx = 230, cy = 160, radius = 108;
  const point = (index: number, value: number, extra = 0) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / dimensions.length);
    const r = radius * value / 100 + extra;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };
  const polygon = (factor: number) => dimensions.map((_, i) => { const p = point(i, factor); return p.x + ',' + p.y; }).join(' ');
  const values = dimensions.map((d, i) => { const p = point(i, d.value); return p.x + ',' + p.y; }).join(' ');
  return <div className="flex min-w-0 flex-col items-center">
    <svg viewBox="0 0 460 330" role="img" aria-label="Radar agrandi du profil de performance avec le score affiché sous chaque axe" className="mx-auto w-full max-w-[540px] overflow-visible">
      <defs><linearGradient id="radarPremiumFill" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".32" /><stop offset="100%" stopColor="#059669" stopOpacity=".10" /></linearGradient></defs>
      {[20, 40, 60, 80, 100].map(v => <polygon key={v} points={polygon(v)} fill="none" stroke="#cbd5e1" strokeOpacity=".8" strokeDasharray={v === 100 ? '0' : '3 4'} />)}
      {dimensions.map((d, i) => { const p = point(i, 100); return <line key={d.label} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#cbd5e1" />; })}
      <polygon points={values} fill="url(#radarPremiumFill)" stroke="#059669" strokeWidth="4" strokeLinejoin="round" />
      {dimensions.map((d, i) => { const p = point(i, d.value); return <circle key={d.label} cx={p.x} cy={p.y} r="5" fill="#059669" stroke="white" strokeWidth="2" />; })}
      {dimensions.map((d, i) => {
        const angle = -Math.PI / 2 + i * (Math.PI * 2 / dimensions.length);
        const p = point(i, 100, 30);
        const anchor = Math.cos(angle) > 0.35 ? 'start' : Math.cos(angle) < -0.35 ? 'end' : 'middle';
        const labelY = p.y + (Math.sin(angle) > 0.55 ? 0 : Math.sin(angle) < -0.55 ? -2 : 0);
        return <text key={d.label} x={p.x} y={labelY} fill="#334155" fontSize="12" fontWeight="600" textAnchor={anchor}>
          <tspan x={p.x} dy="0">{d.label}</tspan>
          <tspan x={p.x} dy="16" fill="#059669" fontSize="12" fontWeight="700">{Math.round(d.value)}/100</tspan>
        </text>;
      })}
    </svg>
  </div>;
}
function SetupDonutChart({ stats, totalTrades }: { stats: [string, { count: number; pnl: number; wins: number }][]; totalTrades: number }) {
  const palette = ['#1264d8', '#35aee2', '#4bdce3', '#9be8eb', '#1d8ecb', '#73c8ee', '#64748b', '#a5b4fc'];
  const total = Math.max(1, stats.reduce((sum, [, data]) => sum + data.count, 0));
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = stats.map(([name, data], index) => {
    const share = data.count / total;
    const segment = { name, ...data, share, color: palette[index % palette.length], dash: share * circumference, offset };
    offset += share * circumference;
    return segment;
  });
  return <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(140px,0.8fr)_minmax(0,1.2fr)]">
    <div className="relative mx-auto aspect-square w-full max-w-[210px]">
      <svg viewBox="0 0 120 120" role="img" aria-label="Diagramme en anneau montrant la répartition des trades par setup" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e8eef4" strokeWidth="16" />
        {segments.map(segment => <circle key={segment.name} cx="60" cy="60" r={radius} fill="none" stroke={segment.color} strokeWidth="16" strokeDasharray={segment.dash + ' ' + (circumference - segment.dash)} strokeDashoffset={-segment.offset} />)}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-2xl font-bold tracking-tight text-slate-900">{totalTrades}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trades</span></div>
    </div>
    <div className="min-w-0 space-y-3">
      {segments.map(segment => <div key={segment.name} className="flex items-center gap-2.5">
        <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: segment.color }} />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-700">{segment.name}</div><div className="text-[11px] text-slate-500">{segment.count} trades · {segment.wins} gagnants</div></div>
        <div className="shrink-0 text-right"><div className="text-sm font-bold tabular-nums text-slate-800">{Math.round(segment.share * 100)}%</div><div className={"text-[10px] font-semibold tabular-nums " + (segment.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{money(segment.pnl)}</div></div>
      </div>)}
    </div>
  </div>;
}

function DailyBars({ trades }: { trades: Trade[] }) {
  const tradedDays = useMemo(() => {
    const map = new Map<string, number>();
    trades.filter(t => t.result !== 'OPEN').forEach(t => {
      const key = dateKey(t);
      map.set(key, (map.get(key) || 0) + (Number(t.pnl) || 0));
    });
    // Keep the 30 most recent days that actually contain closed trades.
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, value]) => ({ date, value }));
  }, [trades]);
  const maxAbs = Math.max(1, ...tradedDays.map(day => Math.abs(day.value)));
  const labelEvery = Math.max(1, Math.ceil(tradedDays.length / 7));
  const slotWidth = 12; // fixed 8px bar + 4px gap
  const contentMinWidth = Math.max(1, tradedDays.length) * slotWidth;
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Jour positif</span><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#800020' }} /> Jour négatif</span><span className="ml-auto text-slate-400">Survoler une barre pour le P&amp;L exact</span></div>
    {tradedDays.length === 0 ? <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">Aucun trade clôturé à afficher.</div> : <div className="relative min-h-[280px] flex-1 overflow-x-auto">
      <div className="flex min-h-[280px] min-w-full flex-col" style={{ minWidth: contentMinWidth + 'px' }}>
        <div className="relative min-h-[250px] flex-1">
          <div className="absolute inset-x-0 top-1/2 border-t border-slate-300" />
          <div className="absolute inset-0 flex items-stretch gap-1">
            {tradedDays.map(({ date, value }) => {
              const barHeight = value === 0 ? 0 : Math.max(1.5, Math.abs(value) / maxAbs * 48);
              return <div key={date} className="group relative h-full w-2 shrink-0" title={shortDate(date) + ' : ' + money(value)}>
                {value > 0 && <div className="absolute bottom-1/2 left-0 w-full rounded-t-[2px] bg-emerald-500 transition-colors group-hover:bg-emerald-600" style={{ height: barHeight + '%' }} />}
                {value < 0 && <div className="absolute left-0 top-1/2 w-full rounded-b-[2px] transition-colors" style={{ height: barHeight + '%', backgroundColor: '#800020' }} />}
                {value !== 0 && <div className="pointer-events-none absolute bottom-[calc(100%+2px)] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">{money(value)}</div>}
              </div>;
            })}
          </div>
        </div>
        <div className="flex h-7 shrink-0 items-end gap-1 border-b border-slate-200 text-center text-[8px] text-slate-400 sm:text-[9px]">
          {tradedDays.map(({ date }, index) => <div key={date} className="relative w-2 shrink-0">
            {(index % labelEvery === 0 || index === tradedDays.length - 1) && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap">{shortDate(date)}</span>}
          </div>)}
        </div>
      </div>
    </div>}
    <div className="mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500"><span>{tradedDays.length}/30 jours avec trades clôturés</span><span className="font-semibold text-slate-700">P&amp;L par jour de clôture</span></div>
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

  return <div className="mx-auto w-full max-w-[1440px] space-y-5 px-3 pb-8 sm:px-5 xl:px-7">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-600">Analytique & Performance</span><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Analyses & Edge</h1><p className="mt-1 text-sm text-slate-500">Ton état de performance, en un regard.</p></div><div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 sm:self-auto"><CalendarDays className="h-4 w-4 text-slate-400" /> {metrics.totalTrades} trades clôturés</div></header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="P&L total" value={money(metrics.totalPnl)} tone={metrics.totalPnl >= 0 ? 'positive' : 'negative'} hint="Net" /><StatCard label="Profit Factor" value={metrics.profitFactor.toFixed(2)} tone={metrics.profitFactor >= 1 ? 'positive' : 'negative'} hint="Gains / pertes" /><StatCard label="Gain moyen" value={money(metrics.avgWin)} tone="positive" /><StatCard label="Perte moyenne" value={`-${money(metrics.avgLoss).replace(/^[+-]/, '')}`} tone="negative" /></div>
    <div className="grid grid-cols-1 items-stretch gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
      <Panel title="Évolution du P&L" subtitle="La courbe monte quand tes résultats cumulés progressent." icon={Activity} className="flex h-full flex-col">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Résultat cumulé</span><div className={`mt-1 text-lg font-bold ${metrics.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(metrics.totalPnl)}</div></div><div className="rounded-lg bg-slate-50 p-3"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Espérance / trade</span><div className={`mt-1 text-lg font-bold ${metrics.expectancy >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(metrics.expectancy)}</div></div><div className="col-span-2 rounded-lg bg-slate-50 p-3 sm:col-span-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Win rate</span><div className="mt-1 text-lg font-bold text-slate-900">{metrics.winRate.toFixed(1)}%</div></div></div>
        <div className="min-h-0 flex-1"><EquityChart points={metrics.equityCurve} /></div>
      </Panel>
      <Panel title="Risque & robustesse" subtitle="Les pertes maximales et les extrêmes à surveiller." icon={ShieldCheck} className="flex h-full flex-col">
        <div className="grid flex-1 grid-cols-2 auto-rows-fr gap-3">
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Gauge className="h-3.5 w-3.5 text-rose-700" /> Max drawdown</div>
            <div className="mt-2 text-xl font-bold tracking-tight text-rose-600">-{metrics.maxDrawdownPercent.toFixed(1)}%</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rose-50"><div className="h-full rounded-full bg-rose-700" style={{ width: `${Math.max(0, Math.min(100, metrics.maxDrawdownPercent))}%` }} /></div>
            <div className="mt-1 text-[10px] text-slate-400">Amplitude du recul</div>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Wallet className="h-3.5 w-3.5 text-rose-700" /> Drawdown ($)</div>
            <div className="mt-2 text-xl font-bold tracking-tight text-rose-600">-{money(metrics.maxDrawdownAmount).replace(/^[+-]/, '')}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rose-50"><div className="h-full w-full rounded-full bg-rose-700" /></div>
            <div className="mt-1 text-[10px] text-slate-400">Perte cumulée maximale</div>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Trophy className="h-3.5 w-3.5 text-emerald-600" /> Meilleur trade</div>
            <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600">{money(metrics.bestTrade)}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(0, Math.min(100, Math.abs(metrics.bestTrade) / Math.max(1, Math.abs(metrics.bestTrade), Math.abs(metrics.worstTrade)) * 100))}%` }} /></div>
            <div className="mt-1 text-[10px] text-slate-400">Gain maximal enregistré</div>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><CircleX className="h-3.5 w-3.5 text-rose-700" /> Pire trade</div>
            <div className="mt-2 text-xl font-bold tracking-tight text-rose-600">-{money(Math.abs(metrics.worstTrade))}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rose-50"><div className="h-full rounded-full bg-rose-700" style={{ width: `${Math.max(0, Math.min(100, Math.abs(metrics.worstTrade) / Math.max(1, Math.abs(metrics.bestTrade), Math.abs(metrics.worstTrade)) * 100))}%` }} /></div>
            <div className="mt-1 text-[10px] text-slate-400">Perte maximale enregistrée</div>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Scale className="h-4 w-4" /></span><div><div className="text-xs font-bold text-slate-700">Ratio gain / perte (Payoff)</div><div className="mt-1 text-[11px] text-slate-500">Gain moyen comparé à une perte moyenne</div></div></div>
            <div className="whitespace-nowrap text-xl font-bold text-slate-950">{metrics.avgLoss > 0 ? (metrics.avgWin / metrics.avgLoss).toFixed(2) : '—'} : 1</div>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-l-full bg-emerald-500" style={{ width: `${metrics.avgWin + metrics.avgLoss > 0 ? metrics.avgWin / (metrics.avgWin + metrics.avgLoss) * 100 : 0}%` }} /><div className="h-full rounded-r-full bg-rose-700" style={{ width: `${metrics.avgWin + metrics.avgLoss > 0 ? metrics.avgLoss / (metrics.avgWin + metrics.avgLoss) * 100 : 0}%` }} /></div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-400"><span>Gain moyen {money(metrics.avgWin)}</span><span>Perte moyenne -{money(metrics.avgLoss)}</span></div>
        </div>
      </Panel>
    </div>
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2"><Panel title="Performance journalière" subtitle="Les 30 derniers jours calendaires, avec une échelle de barres stable." icon={BarChart3} className="h-full flex flex-col"><DailyBars trades={closedTrades} /></Panel><Panel title="Profil de performance" subtitle="Radar synthétique des cinq axes de ton trading." icon={Activity} className="h-full flex flex-col"><RadarProfile metrics={metrics} /></Panel></div>
    <Panel title="Longs vs Shorts" subtitle="Identifie le sens de marché qui contribue le plus à tes résultats." icon={Target}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{([{ key: 'long', label: 'Achats (Longs)', data: directionStats.long, positive: true }, { key: 'short', label: 'Ventes (Shorts)', data: directionStats.short, positive: false }] as const).map(({ key, label, data, positive }) => <div key={key} className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between gap-2"><span className={`flex items-center gap-1.5 text-sm font-bold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>{positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{label}</span><span className="text-xs text-slate-500">{data.count} trades</span></div><div className={`text-2xl font-bold tracking-tight ${data.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(data.pnl)}</div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Taux de réussite</span><strong className="text-slate-800">{data.wr.toFixed(1)}%</strong></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(0, Math.min(100, data.wr))}%` }} /></div></div>)}</div>
    </Panel>
    <div className="grid grid-cols-1 items-stretch gap-4 2xl:grid-cols-2">
      <Panel title="Répartition des setups" subtitle="Part de chaque configuration dans tes trades clôturés." icon={Layers3} className="h-full">
        <SetupDonutChart stats={setupStats} totalTrades={closedTrades.length} />
        {(bestSetup || weakestSetup) && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{bestSetup && <div className="rounded-lg bg-emerald-50 p-3 text-xs"><div className="font-bold text-emerald-800">Setup le plus rentable</div><div className="mt-1 text-emerald-700">{bestSetup[0]} · {money(bestSetup[1].pnl)}</div></div>}{weakestSetup && <div className="rounded-lg bg-rose-50 p-3 text-xs"><div className="font-bold text-rose-800">Setup à réexaminer</div><div className="mt-1 text-rose-700">{weakestSetup[0]} · {money(weakestSetup[1].pnl)}</div></div>}</div>}
      </Panel>
      <Panel title="Distribution par timeframe" subtitle="Compare la contribution de chaque unité de temps." icon={BarChart3} className="h-full">
        <div className="space-y-3">{timeframeStats.map(([name, data]) => { const wr = data.count ? data.wins / data.count * 100 : 0, max = Math.max(1, ...timeframeStats.map(([, item]) => Math.abs(item.pnl))); return <div key={name} className="rounded-xl border border-slate-100 p-3"><div className="mb-2 flex items-center justify-between gap-3"><div><span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">{name}</span><div className="mt-1.5 text-[11px] text-slate-500">{data.count} trades · {wr.toFixed(0)}% gagnants</div></div><div className={`text-sm font-bold ${data.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(data.pnl)}</div></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${data.pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(3, Math.abs(data.pnl) / max * 100)}%` }} /></div></div>; })}</div>
      </Panel>
    </div>
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>Les graphiques et les ventilations utilisent les opérations clôturées. Les résultats dépendent des données enregistrées dans le journal de trading.</span></div>
  </div>;
}
