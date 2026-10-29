import React, { useMemo } from 'react';
import { Trade } from '../types';
import { calculateTraderScore, calculatePerformance } from '../utils/calculations';
import {
  ShieldCheck, Compass, Activity, Zap, Brain, BarChart3,
  Target, TrendingUp, AlertTriangle,
  CheckCircle2, Info, Gauge, Crosshair
} from 'lucide-react';

interface TraderScoreViewProps {
  trades: Trade[];
}

const dimensions = [
  { key: 'riskManagementScore' as const, name: 'Gestion du risque', short: 'Risque', description: 'Stop loss et contrôle du drawdown.', icon: ShieldCheck },
  { key: 'disciplineScore' as const, name: 'Discipline opérationnelle', short: 'Discipline', description: 'FOMO et revenge trading déclarés.', icon: Compass },
  { key: 'consistencyScore' as const, name: 'Consistance', short: 'Consistance', description: 'Win rate et profit factor.', icon: Activity },
  { key: 'executionScore' as const, name: 'Qualité d’exécution', short: 'Exécution', description: 'Ratio rendement/risque moyen.', icon: Zap },
  { key: 'psychologyScore' as const, name: 'Maîtrise psychologique', short: 'Psychologie', description: 'État émotionnel renseigné au journal.', icon: Brain },
  { key: 'profitabilityScore' as const, name: 'Rentabilité nette', short: 'Rentabilité', description: 'P&L cumulé et profit factor.', icon: BarChart3 },
];

function scoreTone(score: number) {
  if (score >= 80) return { text: 'text-emerald-700', barColor: '#08B77A', label: 'Fort' };
  if (score >= 60) return { text: 'text-amber-700', barColor: '#D97706', label: 'À optimiser' };
  return { text: 'text-rose-700', barColor: '#E11D48', label: 'Prioritaire' };
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center sm:h-48 sm:w-48">
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" aria-label={`Score ${score} sur 100`} role="img">
        <circle cx="66" cy="66" r={radius} fill="none" stroke="#E2EEE8" strokeWidth="9" />
        <circle cx="66" cy="66" r={radius} fill="none" stroke="#08B77A" strokeWidth="9" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-5xl font-bold tracking-[-0.06em] text-slate-950 tabular-nums sm:text-6xl">{score}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">sur 100</span>
      </div>
    </div>
  );
}

export function TraderScoreView({ trades }: TraderScoreViewProps) {
  const scoreReport = useMemo(() => calculateTraderScore(trades), [trades]);
  const performance = useMemo(() => calculatePerformance(trades), [trades]);
  const scoreLabel = scoreReport.overallScore >= 90
    ? 'Excellent niveau de maîtrise'
    : scoreReport.overallScore >= 80
      ? 'Profil solide'
      : scoreReport.overallScore >= 65
        ? 'Progression en cours'
        : 'Axes prioritaires à travailler';
  const strongest = scoreReport.isSufficientData
    ? [...dimensions].sort((a, b) => scoreReport[b.key] - scoreReport[a.key])[0]
    : null;
  const weakest = scoreReport.isSufficientData
    ? [...dimensions].sort((a, b) => scoreReport[a.key] - scoreReport[b.key])[0]
    : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 px-3 pb-8 sm:px-5 xl:px-7">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            IAMTRADER · Analyse comportementale
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Trader Score</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Comprends ce qui soutient tes performances et ce qui doit être amélioré.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 sm:self-auto">
          <Crosshair className="h-4 w-4 text-emerald-600" />
          {scoreReport.tradesAnalyzed} trades clôturés analysés
        </div>
      </header>

      {!scoreReport.isSufficientData ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(11,31,53,.045)]">
          <div className="grid gap-6 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                <Info className="h-3.5 w-3.5" /> Échantillon en cours
              </span>
              <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Construisons une base fiable</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">Le score se débloque à partir de 5 trades clôturés. Les opérations ouvertes ne sont pas comptées. Continue à renseigner tes résultats et tes émotions dans le journal pour améliorer la qualité de l’analyse.</p>
              <div className="mt-5 max-w-lg">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Progression du minimum requis</span>
                  <span className="font-bold tabular-nums text-slate-900">{scoreReport.tradesAnalyzed}/5</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${Math.min(100, scoreReport.tradesAnalyzed / 5 * 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-400">{Math.max(0, 5 - scoreReport.tradesAnalyzed)} trade{5 - scoreReport.tradesAnalyzed === 1 ? '' : 's'} clôturé{5 - scoreReport.tradesAnalyzed === 1 ? '' : 's'} restant{5 - scoreReport.tradesAnalyzed === 1 ? '' : 's'} avant le calcul du score.</p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-[10px] border-slate-100 bg-slate-50 text-center">
                <Gauge className="mb-2 h-7 w-7 text-emerald-600" />
                <span className="text-3xl font-bold tracking-tight text-slate-900">{scoreReport.tradesAnalyzed}<span className="text-base text-slate-400">/5</span></span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trades clôturés</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 border-t border-slate-100 bg-slate-50/70 sm:grid-cols-3">
            {[
              ['Gestion du risque', 'Stop loss et drawdown'],
              ['Discipline', 'FOMO et revenge trading déclarés'],
              ['Résultats', 'P&L, régularité et ratio R'],
            ].map(([title, subtitle], index) => (
              <div key={title} className={`flex items-center gap-3 px-5 py-4 ${index > 0 ? 'border-t border-slate-200 sm:border-l sm:border-t-0' : ''}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm"><CheckCircle2 className="h-4 w-4" /></span>
                <div><div className="text-xs font-semibold text-slate-800">{title}</div><div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div></div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50 text-slate-900 shadow-[0_18px_55px_rgba(12,95,66,.08)]">
            <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-emerald-200/50" />
            <div className="pointer-events-none absolute -right-4 -top-12 h-48 w-48 rounded-full border border-emerald-300/40" />
            <div className="relative grid gap-5 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" /> Indice personnel de trading
                </div>
                <h2 className="mt-4 max-w-xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{scoreLabel}</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">Une lecture synthétique de six dimensions calculées à partir de tes trades clôturés et des informations renseignées dans ton journal.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-xl border border-emerald-100 bg-white/85 px-3 py-2.5 text-xs text-slate-600 shadow-sm"><span className="font-bold text-slate-900">{performance.winRate.toFixed(1)}%</span> taux de réussite</span>
                  <span className="rounded-xl border border-emerald-100 bg-white/85 px-3 py-2.5 text-xs text-slate-600 shadow-sm"><span className="font-bold text-slate-900">{performance.profitFactor.toFixed(2)}</span> profit factor</span>
                  <span className="rounded-xl border border-emerald-100 bg-white/85 px-3 py-2.5 text-xs text-slate-600 shadow-sm"><span className={performance.totalPnl >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>{performance.totalPnl > 0 ? '+' : ''}{performance.totalPnl.toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })}</span> P&L net</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 md:flex-col">
                <ScoreGauge score={scoreReport.overallScore} />
                <div className="min-w-0 md:text-center">
                  <div className="text-sm font-bold text-slate-900">{scoreLabel}</div>
                  <div className="mt-1 text-xs text-slate-500">{scoreReport.tradesAnalyzed} trades utilisés</div>
                </div>
              </div>
            </div>
            <div className="relative grid grid-cols-3 border-t border-emerald-100 bg-emerald-50/70">
              <div className="px-3 py-3.5 text-center sm:px-5"><div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">Piliers évalués</div><div className="mt-1 text-lg font-bold text-slate-900">06</div></div>
              <div className="border-x border-emerald-100 px-3 py-3.5 text-center sm:px-5"><div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">Score maximum</div><div className="mt-1 text-lg font-bold text-slate-900">100</div></div>
              <div className="px-3 py-3.5 text-center sm:px-5"><div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">Échantillon</div><div className="mt-1 text-lg font-bold text-slate-900">{scoreReport.tradesAnalyzed}</div></div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_24px_rgba(11,31,53,.035)] sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><h3 className="text-base font-bold tracking-tight text-slate-900">Décomposition du score</h3><p className="mt-1 text-xs text-slate-500">Les six piliers, classés selon leur score actuel.</p></div>
                <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500">Sur 100</span>
              </div>
              <div className="space-y-4">
                {[...dimensions].sort((a, b) => scoreReport[b.key] - scoreReport[a.key]).map((dim, index) => {
                  const Icon = dim.icon;
                  const score = scoreReport[dim.key];
                  const tone = scoreTone(score);
                  return <div key={dim.key} className="group rounded-xl border border-slate-100 p-3.5 transition-colors hover:border-slate-200 hover:bg-slate-50/60">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600"><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-sm font-semibold text-slate-800">{dim.name}</span>{index === 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">Meilleur pilier</span>}</div><p className="mt-0.5 text-[11px] text-slate-500">{dim.description}</p></div>
                      <div className="shrink-0 text-right"><div className={`text-lg font-bold tabular-nums ${tone.text}`}>{score}</div><div className="text-[9px] text-slate-400">/100</div></div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${score}%`, backgroundColor: tone.barColor }} /></div>
                  </div>;
                })}
              </div>
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_24px_rgba(11,31,53,.035)] sm:p-5">
                <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><TrendingUp className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">Point fort</h3><p className="text-[11px] text-slate-500">Ton meilleur pilier actuel</p></div></div>
                {strongest && <div className="mt-4 rounded-xl bg-emerald-50/70 p-3.5"><div className="text-sm font-bold text-slate-900">{strongest.name}</div><div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-bold tabular-nums text-emerald-700">{scoreReport[strongest.key]}</span><span className="text-xs text-emerald-700">/100</span></div><p className="mt-1.5 text-xs leading-relaxed text-slate-600">{strongest.description}</p></div>}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_24px_rgba(11,31,53,.035)] sm:p-5">
                <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700"><Target className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">Axe à travailler</h3><p className="text-[11px] text-slate-500">Le pilier le plus faible</p></div></div>
                {weakest && <div className="mt-4 rounded-xl bg-rose-50/70 p-3.5"><div className="text-sm font-bold text-slate-900">{weakest.name}</div><div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-bold tabular-nums text-rose-700">{scoreReport[weakest.key]}</span><span className="text-xs text-rose-700">/100</span></div><p className="mt-1.5 text-xs leading-relaxed text-slate-600">{weakest.description}</p></div>}
              </section>
            </div>
          </section>

          {(scoreReport.strengths.length > 0 || scoreReport.weaknesses.length > 0) && <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_6px_24px_rgba(11,31,53,.03)] sm:p-5">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Signaux positifs</h3><span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{scoreReport.strengths.length}</span></div>
              {scoreReport.strengths.length ? <ul className="mt-3 space-y-2">{scoreReport.strengths.map(item => <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{item}</li>)}</ul> : <p className="mt-3 text-xs text-slate-500">Aucun signal positif supplémentaire identifié sur cet échantillon.</p>}
            </div>
            <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-[0_6px_24px_rgba(11,31,53,.03)] sm:p-5">
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /><h3 className="text-sm font-bold text-slate-900">Points de vigilance</h3><span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">{scoreReport.weaknesses.length}</span></div>
              {scoreReport.weaknesses.length ? <ul className="mt-3 space-y-2">{scoreReport.weaknesses.map(item => <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />{item}</li>)}</ul> : <p className="mt-3 text-xs text-slate-500">Aucun point de vigilance supplémentaire identifié par les règles actuelles.</p>}
            </div>
          </section>}
        </>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p>Le Trader Score est un indicateur interne basé sur les données enregistrées. Il ne garantit ni la rentabilité future ni l’obtention d’un compte financé. Les scores peuvent être limités par les informations manquantes dans le journal.</p>
      </div>
    </div>
  );
}
