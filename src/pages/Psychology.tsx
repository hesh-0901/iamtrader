import React, { useMemo } from 'react';
import { Trade, EmotionalState } from '../types';
import { formatCurrency } from '../utils/calculations';
import { EmptyState } from '../components/common/EmptyState';
import {
  BrainCircuit, ShieldCheck, Info, TrendingUp, Compass, Activity, Target, HeartPulse
} from 'lucide-react';

interface PsychologyProps {
  trades: Trade[];
}

const EMOTIONS: EmotionalState[] = [
  'Disciplined', 'Calm', 'Focused', 'FOMO', 'Fear', 'Revenge', 'Overconfidence', 'Hesitation'
];

const EMOTION_LABELS: Record<EmotionalState, string> = {
  Disciplined: 'Discipline',
  Calm: 'Sérénité',
  Focused: 'Concentration',
  FOMO: 'FOMO',
  Fear: 'Peur',
  Revenge: 'Revenge trading',
  Overconfidence: 'Excès de confiance',
  Hesitation: 'Hésitation'
};

const POSITIVE_EMOTIONS: EmotionalState[] = ['Disciplined', 'Calm', 'Focused'];

export function Psychology({ trades }: PsychologyProps) {
  const emotionStats = useMemo(() => {
    const map: Record<EmotionalState, { count: number; pnl: number; wins: number; totalRisk: number; avgR: number; rCount: number }> = {
      Disciplined: { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      Calm: { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      Focused: { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      FOMO: { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      Fear: { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      Revenge: { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      Overconfidence: { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      Hesitation: { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 }
    };
    trades.forEach(t => {
      if (map[t.emotion]) {
        map[t.emotion].count++;
        map[t.emotion].pnl += Number(t.pnl) || 0;
        if (t.result === 'WIN') map[t.emotion].wins++;
        if (t.riskAmount) map[t.emotion].totalRisk += Number(t.riskAmount);
        if (t.rMultiple !== undefined) {
          map[t.emotion].avgR += Number(t.rMultiple);
          map[t.emotion].rCount++;
        }
      }
    });
    return map;
  }, [trades]);

  const macroSplit = useMemo(() => {
    let rationalCount = 0, rationalPnl = 0, rationalWins = 0;
    let emotionalCount = 0, emotionalPnl = 0, emotionalWins = 0;
    trades.forEach(t => {
      const isRational = POSITIVE_EMOTIONS.includes(t.emotion);
      const pnl = Number(t.pnl) || 0;
      if (isRational) {
        rationalCount++;
        rationalPnl += pnl;
        if (t.result === 'WIN') rationalWins++;
      } else {
        emotionalCount++;
        emotionalPnl += pnl;
        if (t.result === 'WIN') emotionalWins++;
      }
    });
    return {
      rational: { count: rationalCount, pnl: rationalPnl, wr: rationalCount ? rationalWins / rationalCount * 100 : 0 },
      emotional: { count: emotionalCount, pnl: emotionalPnl, wr: emotionalCount ? emotionalWins / emotionalCount * 100 : 0 }
    };
  }, [trades]);

  const totalTrades = trades.length;
  const rationalRatio = totalTrades ? macroSplit.rational.count / totalTrades * 100 : 0;
  const hasEnoughData = totalTrades >= 6;
  const rankedEmotions = useMemo(() => [...EMOTIONS].filter(e => emotionStats[e].count > 0).sort((a, b) => emotionStats[b].count - emotionStats[a].count), [emotionStats]);
  const emotionTaggedTrades = rankedEmotions.reduce((sum, emotion) => sum + emotionStats[emotion].count, 0);
  const strongestEmotion = useMemo(() => [...EMOTIONS].filter(e => POSITIVE_EMOTIONS.includes(e) && emotionStats[e].count > 0).sort((a, b) => (emotionStats[b].pnl / Math.max(1, emotionStats[b].count)) - (emotionStats[a].pnl / Math.max(1, emotionStats[a].count)))[0], [emotionStats]);
  const mainChallenge = useMemo(() => [...EMOTIONS].filter(e => !POSITIVE_EMOTIONS.includes(e) && emotionStats[e].count > 0).sort((a, b) => emotionStats[b].count - emotionStats[a].count)[0], [emotionStats]);

  if (trades.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-5 px-3 pb-8 sm:px-5 xl:px-7">
        <header className="border-b border-slate-200 pb-5">
          <div className="mb-1.5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> IAMTRADER · Performance mentale</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Psychologie du trader</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Comprends comment ton état mental influence tes décisions et tes résultats.</p>
        </header>
        <section className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-[0_18px_55px_rgba(12,95,66,.06)] sm:p-8">
          <EmptyState icon={BrainCircuit} title="Ta matrice psychologique commence ici" description="Renseigne ton état émotionnel dans le journal. Tes trades alimenteront progressivement l’analyse de la discipline, de la sérénité, du FOMO, de la peur et des autres comportements." accentColor="sky" />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 px-3 pb-8 sm:px-5 xl:px-7">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> IAMTRADER · Performance mentale</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Psychologie du trader</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Observe les états qui accompagnent tes trades et leur lien avec tes résultats.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-semibold text-slate-600 sm:self-auto"><BrainCircuit className="h-4 w-4 text-emerald-600" /> {totalTrades} trades analysés</div>
      </header>

      {!hasEnoughData && <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900"><Info className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>Échantillon encore limité.</strong><p className="mt-1 text-xs leading-relaxed text-amber-800">Au moins 6 trades sont nécessaires pour commencer à interpréter les tendances. Les résultats actuels sont descriptifs et ne constituent pas encore des corrélations fiables.</p></div></div>}

      <section className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50 shadow-[0_18px_55px_rgba(12,95,66,.08)]">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-emerald-200/50" />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800"><HeartPulse className="h-3.5 w-3.5" /> Matrice psychologique</span>
            <h2 className="mt-4 max-w-2xl text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">Ton état mental fait partie de ta stratégie.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Compare la part de tes opérations prises dans un état calme et discipliné à celles associées à une réaction émotionnelle.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-white/90 p-3.5"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trades sereins</div><div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{macroSplit.rational.count}</div><div className="mt-1 text-xs text-slate-500">{macroSplit.rational.wr.toFixed(1)}% gagnants</div></div>
              <div className="rounded-xl border border-rose-100 bg-white/90 p-3.5"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trades réactifs</div><div className="mt-1 text-2xl font-bold tabular-nums text-rose-700">{macroSplit.emotional.count}</div><div className="mt-1 text-xs text-slate-500">{macroSplit.emotional.wr.toFixed(1)}% gagnants</div></div>
              <div className="rounded-xl border border-slate-200 bg-white/90 p-3.5"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">P&L total journalisé</div><div className={`mt-1 text-xl font-bold tabular-nums ${trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0))}</div><div className="mt-1 text-xs text-slate-500">Toutes émotions confondues</div></div>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-900">Équilibre opérationnel</h3><p className="mt-1 text-xs text-slate-500">Part des trades sereins et disciplinés</p></div><Compass className="h-5 w-5 text-emerald-600" /></div>
            <div className="mt-5 flex items-end justify-between"><span className="text-4xl font-bold tracking-tight text-emerald-700 tabular-nums">{rationalRatio.toFixed(0)}%</span><span className="pb-1 text-xs text-slate-500">{macroSplit.rational.count}/{totalTrades} trades</span></div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-l-full transition-[width] duration-700" style={{ width: `${rationalRatio}%`, backgroundColor: '#08B77A' }} /><div className="h-full rounded-r-full transition-[width] duration-700" style={{ width: `${100 - rationalRatio}%`, backgroundColor: '#E11D48' }} /></div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Sérénité & discipline</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Réactivité émotionnelle</span></div>
          </div>
        </div>
        <div className="relative grid grid-cols-3 border-t border-emerald-100 bg-emerald-50/70">
          <div className="px-3 py-3.5 text-center sm:px-5"><div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">États suivis</div><div className="mt-1 text-lg font-bold text-slate-900">08</div></div>
          <div className="border-x border-emerald-100 px-3 py-3.5 text-center sm:px-5"><div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">États renseignés</div><div className="mt-1 text-lg font-bold text-slate-900">{rankedEmotions.length}</div></div>
          <div className="px-3 py-3.5 text-center sm:px-5"><div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">Trades documentés</div><div className="mt-1 text-lg font-bold text-slate-900">{totalTrades}</div></div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_24px_rgba(12,95,66,.035)] sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-base font-bold tracking-tight text-slate-900">Performance par état émotionnel</h3><p className="mt-1 text-xs text-slate-500">Volume de trades et P&L observé pour chaque état renseigné.</p></div><Activity className="h-5 w-5 text-emerald-600" /></div>
          {rankedEmotions.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucun état émotionnel n’est renseigné dans les trades actuels.</p> : <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white p-4">
              <div className="relative h-44 w-44">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label="Diagramme en anneau de la répartition des trades par état émotionnel">
                  <circle cx="60" cy="60" r="43" fill="none" stroke="#E8EEF2" strokeWidth="15" />
                  {rankedEmotions.map((emotion, index) => {
                    const circumference = 2 * Math.PI * 43;
                    const previousCount = rankedEmotions.slice(0, index).reduce((sum, item) => sum + emotionStats[item].count, 0);
                    const segmentLength = emotionStats[emotion].count / Math.max(1, emotionTaggedTrades) * circumference;
                    const color = POSITIVE_EMOTIONS.includes(emotion) ? '#08B77A' : emotion === 'Fear' || emotion === 'Hesitation' ? '#D97706' : '#E11D48';
                    return <circle key={emotion} cx="60" cy="60" r="43" fill="none" stroke={color} strokeWidth="15" strokeLinecap="butt" strokeDasharray={`${Math.max(0, segmentLength - 1.5)} ${circumference}`} strokeDashoffset={-previousCount / Math.max(1, emotionTaggedTrades) * circumference} />;
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums">{emotionTaggedTrades}</span><span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Trades</span><span className="mt-1 text-[10px] text-emerald-700">avec émotion</span></div>
              </div>
              <div className="mt-2 text-center"><div className="text-xs font-semibold text-slate-800">Répartition émotionnelle</div><div className="mt-1 text-[10px] text-slate-500">Chaque part représente le volume de trades.</div></div>
            </div>
            <div className="min-w-0 space-y-2">
              {rankedEmotions.map(emotion => {
                const stats = emotionStats[emotion];
                const winRate = stats.count ? stats.wins / stats.count * 100 : 0;
                const avgPnl = stats.count ? stats.pnl / stats.count : 0;
                const color = POSITIVE_EMOTIONS.includes(emotion) ? '#08B77A' : emotion === 'Fear' || emotion === 'Hesitation' ? '#D97706' : '#E11D48';
                return <div key={emotion} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-slate-900">{EMOTION_LABELS[emotion]}</div><div className="mt-0.5 text-[10px] text-slate-500">{stats.count} trade{stats.count === 1 ? '' : 's'} · {winRate.toFixed(0)}% gagnants</div></div>
                  <div className="text-right"><div className={`text-xs font-bold tabular-nums ${stats.pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{stats.pnl > 0 ? '+' : ''}{formatCurrency(stats.pnl)}</div><div className="mt-0.5 text-[10px] text-slate-500">{formatCurrency(avgPnl)} / trade</div></div>
                </div>;
              })}
              <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />États positifs</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-600" />Peur / hésitation</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-600" />États réactifs</span></div>
            </div>
          </div>}
          {!hasEnoughData && <p className="mt-3 text-[11px] text-amber-700">Données descriptives uniquement : accumule davantage de trades avant d’interpréter ces écarts.</p>}
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_6px_24px_rgba(12,95,66,.035)] sm:p-5">
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><TrendingUp className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">État le plus performant</h3><p className="text-[11px] text-slate-500">Selon le P&L moyen par trade</p></div></div>
            {strongestEmotion ? <div className="mt-4 rounded-xl bg-emerald-50/80 p-3.5"><div className="text-sm font-bold text-slate-900">{EMOTION_LABELS[strongestEmotion]}</div><div className={`mt-1 text-2xl font-bold tabular-nums ${emotionStats[strongestEmotion].pnl / emotionStats[strongestEmotion].count >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(emotionStats[strongestEmotion].pnl / emotionStats[strongestEmotion].count)}<span className="ml-1 text-xs font-medium">/ trade</span></div><p className="mt-1.5 text-xs text-slate-600">{emotionStats[strongestEmotion].count} trades enregistrés dans cet état.</p></div> : <p className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-500">Renseigne un état calme, concentré ou discipliné pour faire émerger ce repère.</p>}
          </section>
          <section className="rounded-2xl border border-rose-100 bg-white p-4 shadow-[0_6px_24px_rgba(12,95,66,.035)] sm:p-5">
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700"><Target className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">Défi le plus fréquent</h3><p className="text-[11px] text-slate-500">État réactif le plus souvent déclaré</p></div></div>
            {mainChallenge ? <div className="mt-4 rounded-xl bg-rose-50/80 p-3.5"><div className="text-sm font-bold text-slate-900">{EMOTION_LABELS[mainChallenge]}</div><div className="mt-1 text-2xl font-bold tabular-nums text-rose-700">{emotionStats[mainChallenge].count}<span className="ml-1 text-xs font-medium">trade{emotionStats[mainChallenge].count === 1 ? '' : 's'}</span></div><p className="mt-1.5 text-xs text-slate-600">Repère les situations qui déclenchent cet état avant ta prochaine session.</p></div> : <p className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-500">Aucun état réactif n’a encore été déclaré.</p>}
          </section>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_24px_rgba(12,95,66,.035)] sm:p-5">
        <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span><div><h3 className="text-base font-bold text-slate-900">Rituel de maîtrise</h3><p className="mt-1 text-xs text-slate-500">Une consigne simple pour préparer tes prochaines exécutions.</p></div></div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"><div className="text-xs font-bold text-slate-900">Avant le trade</div><p className="mt-1.5 text-xs leading-relaxed text-slate-600">Évalue ton état mental et ta confiance dans le setup avant de cliquer.</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"><div className="text-xs font-bold text-slate-900">Pendant la session</div><p className="mt-1.5 text-xs leading-relaxed text-slate-600">Après une perte, évite la revanche immédiate. Attends une nouvelle confirmation de ton plan.</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"><div className="text-xs font-bold text-slate-900">Après le trade</div><p className="mt-1.5 text-xs leading-relaxed text-slate-600">Note ton émotion, le respect du plan et le résultat sans confondre qualité de décision et P&L.</p></div>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500"><Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><p>Cette page décrit les données psychologiques renseignées dans le journal. Les liens observés ne prouvent pas à eux seuls une causalité. Avec moins de 6 trades, les résultats doivent rester considérés comme provisoires.</p></div>
    </div>
  );
}
