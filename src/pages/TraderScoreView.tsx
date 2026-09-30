import React, { useMemo } from 'react';
import { Trade } from '../types';
import { calculateTraderScore } from '../utils/calculations';
import { EmptyState } from '../components/common/EmptyState';
import { 
  Target, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Award, 
  Zap, 
  Compass, 
  Activity, 
  BarChart2, 
  Brain,
  ChevronRight,
  TrendingUp,
  Shield
} from 'lucide-react';

interface TraderScoreViewProps {
  trades: Trade[];
}

export function TraderScoreView({ trades }: TraderScoreViewProps) {
  const scoreReport = useMemo(() => {
    return calculateTraderScore(trades);
  }, [trades]);

  const scoreDimensions = [
    { 
      name: 'Gestion du Risque', 
      score: scoreReport.riskManagementScore, 
      weight: '25%', 
      desc: 'Adhérence stricte au stop loss, contrôle rigoureux du drawdown maximum',
      icon: ShieldCheck,
      color: 'blue'
    },
    { 
      name: 'Discipline Opérationnelle', 
      score: scoreReport.disciplineScore, 
      weight: '20%', 
      desc: 'Absence d\'entrées impulsives FOMO ou Revenge trading suite à une perte',
      icon: Compass,
      color: 'blue'
    },
    { 
      name: 'Consistance / Régularité', 
      score: scoreReport.consistencyScore, 
      weight: '15%', 
      desc: 'Stabilité de l\'edge statistique et équilibre du taux de réussite dans le temps',
      icon: Activity,
      color: 'blue'
    },
    { 
      name: 'Qualité d\'Exécution', 
      score: scoreReport.executionScore, 
      weight: '15%', 
      desc: 'Ratio Multiple R moyen, respect des paliers de prise de bénéfices (TP)',
      icon: Zap,
      color: 'blue'
    },
    { 
      name: 'Maîtrise Psychologique', 
      score: scoreReport.psychologyScore, 
      weight: '15%', 
      desc: 'Proportion de trades pris avec un mental calme, concentré et sans anxiété',
      icon: Brain,
      color: 'blue'
    },
    { 
      name: 'Rentabilité Nette', 
      score: scoreReport.profitabilityScore, 
      weight: '10%', 
      desc: 'Profit Factor supérieur à 1.5 et espérance de gain mathématique positive',
      icon: BarChart2,
      color: 'emerald'
    },
  ];

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <div className="pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
              Algorithme Quantitatif
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Trader Score Institutionnel
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Mesure objective de maturité calculée sur votre comportement d'exécution réel.
          </p>
        </div>

        <div className="rounded-xl card-premium overflow-hidden p-6 border-slate-200">
          <EmptyState
            icon={ShieldCheck}
            title="Activez votre Trader Score"
            description="Le Trader Score évalue votre profil selon les critères institutionnels et de prop firm : gestion du risque, discipline, stabilité et régularité."
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
            Évaluation Algorithmique IAMTRADER
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-[11px] text-slate-500 font-mono">Standard Prop Firm</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Trader Score Institutionnel
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Mesure objective et dynamique de votre maturité financière. Calibré pour évaluer votre préparation aux comptes financés de 50 000$ à 200 000$.
        </p>
      </div>

      {/* If Insufficient Data (< 5 trades) */}
      {!scoreReport.isSufficientData ? (
        <div className="p-8 rounded-xl card-premium text-center space-y-4 max-w-xl mx-auto my-6 border-slate-200">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Calibrage en cours de votre profil
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-md mx-auto">
              Pour assurer une validité statistique et éviter tout score artificiel, notre algorithme requiert un minimum de <strong>5 transactions clôturées</strong>.
            </p>
          </div>

          {/* Progress to 5 trades */}
          <div className="space-y-2 max-w-xs mx-auto pt-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Progression :</span>
              <span className="text-blue-400 font-bold">{scoreReport.tradesAnalyzed} / 5 trades</span>
            </div>
            <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
              <div 
                style={{ width: `${(scoreReport.tradesAnalyzed / 5) * 100}%` }} 
                className="bg-blue-500 h-full rounded transition-all duration-500"
              />
            </div>
            <span className="text-[11px] text-slate-500 block font-mono">
              Encore {5 - scoreReport.tradesAnalyzed} trade{5 - scoreReport.tradesAnalyzed > 1 ? 's' : ''} pour débloquer votre score global.
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Main Score Hero Card */}
          <div className="p-6 rounded-xl card-premium flex flex-col md:flex-row items-center justify-between gap-6 border-slate-200">
            <div className="space-y-3 text-center md:text-left max-w-xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Indice Global de Maturité FinTech</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {scoreReport.overallScore >= 80 
                  ? 'Profil Élite · Éligible Allocation Prop Firm' 
                  : scoreReport.overallScore >= 60 
                  ? 'Profil Solide · En Phase d\'Optimisation' 
                  : 'Profil Vulnérable · Risques Prioritaires à Corriger'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                Ce score synthétise 6 piliers quantitatifs. Il est recalculé en direct à chaque nouveau trade journalisé pour vous orienter vers la rentabilité pérenne.
              </p>
            </div>

            {/* Circular Gauge Display */}
            <div className="flex flex-col items-center justify-center p-5 rounded-lg bg-white border border-slate-200 min-w-[200px] shrink-0 text-center">
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
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - scoreReport.overallScore / 100)}`}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                    {scoreReport.overallScore}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">sur 100</span>
                </div>
              </div>
              <div className="text-[11px] font-semibold text-blue-400 mt-2 font-mono">
                {scoreReport.tradesAnalyzed} trades analysés
              </div>
            </div>
          </div>

          {/* 6 Sub-scores Progress Bars */}
          <div className="p-5 rounded-xl card-premium space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Décomposition par Pilier de Performance</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Les 6 dimensions examinées par les gestionnaires de risque</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {scoreDimensions.map(dim => {
                const Icon = dim.icon;
                return (
                  <div key={dim.name} className="p-3.5 rounded-lg bg-white border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 text-xs block">{dim.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">(Poids {dim.weight})</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-blue-400 tabular-nums">
                        {dim.score} / 100
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded bg-slate-100 overflow-hidden">
                      <div 
                        style={{ width: `${dim.score}%` }} 
                        className="bg-blue-500 h-full rounded transition-all duration-700" 
                      />
                    </div>

                    <p className="text-[11px] text-slate-500 leading-snug">
                      {dim.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
