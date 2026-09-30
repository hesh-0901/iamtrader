import React, { useMemo } from 'react';
import { Trade, EmotionalState } from '../types';
import { formatCurrency } from '../utils/calculations';
import { EmptyState } from '../components/common/EmptyState';
import { 
  BrainCircuit, 
  AlertTriangle, 
  ShieldCheck, 
  Info,
  TrendingUp,
  Compass,
  Lightbulb,
  Shield,
  Activity
} from 'lucide-react';

interface PsychologyProps {
  trades: Trade[];
}

export function Psychology({ trades }: PsychologyProps) {
  // Aggregate trades by emotional state
  const emotionStats = useMemo(() => {
    const map: Record<EmotionalState, { count: number; pnl: number; wins: number; totalRisk: number; avgR: number; rCount: number }> = {
      'Disciplined': { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      'Calm': { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      'Focused': { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      'FOMO': { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      'Fear': { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      'Revenge': { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      'Overconfidence': { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
      'Hesitation': { count: 0, pnl: 0, wins: 0, totalRisk: 0, avgR: 0, rCount: 0 },
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

  // Rational vs Emotional trades aggregate
  const macroSplit = useMemo(() => {
    let rationalCount = 0;
    let rationalPnl = 0;
    let rationalWins = 0;

    let emotionalCount = 0;
    let emotionalPnl = 0;
    let emotionalWins = 0;

    trades.forEach(t => {
      const isRational = t.emotion === 'Disciplined' || t.emotion === 'Calm' || t.emotion === 'Focused';
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
      rational: { count: rationalCount, pnl: rationalPnl, wr: rationalCount > 0 ? (rationalWins / rationalCount) * 100 : 0 },
      emotional: { count: emotionalCount, pnl: emotionalPnl, wr: emotionalCount > 0 ? (emotionalWins / emotionalCount) * 100 : 0 }
    };
  }, [trades]);

  const hasEnoughData = trades.length >= 6;
  const totalTrades = trades.length;
  const rationalRatio = totalTrades > 0 ? (macroSplit.rational.count / totalTrades) * 100 : 100;

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <div className="pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
              Performance Mentale
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Matrice Psychologique & Biais Comportementaux
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Identifiez avec clarté la relation directe entre votre état d'esprit lors du clic et votre résultat net.
          </p>
        </div>

        <div className="rounded-xl card-premium overflow-hidden p-6 border-slate-200">
          <EmptyState
            icon={BrainCircuit}
            title="Votre psychologie de trading se construit ici"
            description="Chaque transaction que vous journalisez avec son état émotionnel (Calme, FOMO, Discipline, etc.) viendra nourrir cette analyse pour éliminer vos biais."
            accentColor="sky"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
            Performance Mentale
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-[11px] text-slate-500 font-mono">Corrélations Comportementales</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Matrice Psychologique & Biais Comportementaux
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Prenez conscience des schémas psychologiques qui influencent vos prises de décision. Les traders rentables maîtrisent avant tout leurs émotions.
        </p>
      </div>

      {/* Warning or Insufficient Data Alert if < 6 trades */}
      {!hasEnoughData && (
        <div className="p-4 rounded-lg bg-white border border-slate-200 text-xs text-slate-400 flex items-start gap-3">
          <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-slate-900">Échantillon en cours d'accumulation :</strong>{' '}
            Un minimum de 6 transactions avec étiquettes psychologiques permet de dégager des corrélations statistiques représentatives.
          </div>
        </div>
      )}

      {/* Macro Ratio Bar: Discipline vs Reactivity */}
      <div className="p-5 rounded-xl card-premium space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900">Équilibre Opérationnel Global</span>
              <p className="text-[10px] text-slate-500 font-mono">Ratio de discipline sur exécutions</p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20">
            {rationalRatio.toFixed(0)}% Sérénité
          </span>
        </div>

        <div className="w-full h-2 rounded bg-white overflow-hidden flex">
          <div 
            style={{ width: `${rationalRatio}%` }} 
            className="bg-blue-500 transition-all duration-700 rounded-l"
            title={`${rationalRatio.toFixed(0)}% Rationnel / Calme`}
          />
          <div 
            style={{ width: `${100 - rationalRatio}%` }} 
            className="bg-rose-500 transition-all duration-700 rounded-r"
            title={`${(100 - rationalRatio).toFixed(0)}% Réactif / FOMO`}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono pt-0.5">
          <span className="flex items-center gap-1.5 text-blue-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Discipline & Sérénité ({macroSplit.rational.count} trades)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Réactivité & Émotions ({macroSplit.emotional.count} trades)
          </span>
        </div>
      </div>

      {/* Comparison: Disciplined Mindset vs Emotional Impulses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Disciplined / Rational Box */}
        <div className="p-5 rounded-xl card-premium border-blue-500/30 space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-xs block">Zone de Clarté & Discipline</span>
                <p className="text-[10px] text-slate-500 font-mono">Calme · Concentré · Discipliné</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
              {macroSplit.rational.count} trades
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">P&L Net Généré</span>
              <span className={`text-lg font-bold tabular-nums ${macroSplit.rational.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(macroSplit.rational.pnl)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Win Rate</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {macroSplit.rational.wr.toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
            Opérations alignées avec votre plan de trading, caractérisées par le respect des règles et du stop loss.
          </p>
        </div>

        {/* Reactive / Emotional Box */}
        <div className="p-5 rounded-xl card-premium border-rose-500/30 space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-xs block">Zone Réactive & Impulsive</span>
                <p className="text-[10px] text-slate-500 font-mono">FOMO · Revenge · Hésitation</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
              {macroSplit.emotional.count} trades
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Impact P&L</span>
              <span className={`text-lg font-bold tabular-nums ${macroSplit.emotional.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(macroSplit.emotional.pnl)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Win Rate</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {macroSplit.emotional.wr.toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
            Transactions précipitées ou prises sous l'impulsion. Principale source de drawdown évitable.
          </p>
        </div>
      </div>

      {/* Structured Guidance Box */}
      <div className="p-4 rounded-xl card-premium border-slate-200 flex items-start gap-3">
        <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
          <Shield className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-slate-900">Discipline de Gestion Institutionnelle</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Respectez systématiquement votre perte maximale autorisée par position. Si vous subissez une perte, évitez d'intervenir à nouveau immédiatement et attendez la confirmation technique de votre setup.
          </p>
        </div>
      </div>
    </div>
  );
}
