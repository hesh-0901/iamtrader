import React, { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, Clock3, GraduationCap, LockKeyhole, PlayCircle, Target } from 'lucide-react';

type CourseModule = {
  number: number;
  title: string;
  lessons: string[];
  outcome: string;
};

type CourseClass = {
  id: 'TRC-1' | 'TRC-2' | 'TRC-3';
  name: string;
  subtitle: string;
  period: string;
  description: string;
  outcome: string;
  accent: 'blue' | 'green' | 'violet';
  modules: CourseModule[];
};

const courseClasses: CourseClass[] = [
  {
    id: 'TRC-1',
    name: 'INITIATE',
    subtitle: 'Les fondations du trader',
    period: 'Mois 1–2',
    description: 'Comprendre le trading, découvrir son profil, prendre en main les outils et acquérir les bases de la lecture graphique.',
    outcome: 'À la fin de cette classe, vous savez utiliser les outils essentiels, lire un graphique, reconnaître les premiers concepts et préparer une session de trading en démo.',
    accent: 'blue',
    modules: [
      { number: 1, title: 'Personnalité et psychologie du trader', lessons: ['Motivations, objectifs et attentes', 'Profils comportementaux : forces, faiblesses et habitudes', 'Rapport à l’argent, peur, avidité et impatience', 'Biais cognitifs et erreurs comportementales', 'Discipline, patience et maîtrise de soi', 'Évaluation initiale du profil de trader'], outcome: 'Identifier ses tendances comportementales et ses axes de progression.' },
      { number: 2, title: 'Fondamentaux du trading', lessons: ['Fonctionnement des marchés financiers', 'Forex, indices, matières premières et autres actifs', 'Trading retail et institutionnel', 'Paires de devises, pip, lot, spread, commission et swap', 'Levier, marge, volatilité et liquidité', 'Sessions et horaires de marché'], outcome: 'Comprendre ce que l’on trade et les coûts ou risques associés.' },
      { number: 3, title: 'Les outils du trader', lessons: ['TradingView : interface, graphiques, unités de temps et tracés', 'MT5 : cotations, types d’ordres et gestion des positions', 'Calendrier économique : impact, consensus et résultats', 'FX Replay : découverte du replay historique', 'Organisation du poste de travail et préparation de session'], outcome: 'Utiliser les outils essentiels dans un environnement de démonstration.' },
      { number: 4, title: 'Lecture graphique et concepts fondamentaux', lessons: ['Bougies japonaises et unités de temps', 'Tendances, ranges, impulsions et retracements', 'Sommets, creux, supports et résistances', 'Structure élémentaire du marché', 'Introduction au BOS et au MSS', 'Premiers concepts ICT : liquidité, BSL/SSL, PDH/PDL, Order Blocks, FVG, Premium et Discount', 'Analyse multi-timeframe : Weekly, Daily, H1 et M5'], outcome: 'Décrire objectivement un graphique et reconnaître les concepts de base.' },
      { number: 5, title: 'Premières règles de trading', lessons: ['Calcul élémentaire du risque et de la taille de position', 'Stop Loss, Take Profit et ratio risque/rendement', 'Construction d’une checklist avant session', 'Rédaction d’un premier plan de trading', 'Initiation au journal de trading', 'Premières analyses en replay et en compte démo'], outcome: 'Préparer une session et documenter ses décisions sans risquer de capital réel.' },
    ],
  },
  {
    id: 'TRC-2',
    name: 'STRATEGIST',
    subtitle: 'La maîtrise du marché',
    period: 'Mois 3–4',
    description: 'Approfondir la structure du marché, relier les concepts ICT et construire des scénarios et configurations cohérents.',
    outcome: 'À la fin de cette classe, vous savez argumenter un scénario, définir ses invalidations et appliquer des règles d’entrée, de sortie et de risque.',
    accent: 'green',
    modules: [
      { number: 6, title: 'Structure avancée du marché', lessons: ['Structure interne et structure externe', 'BOS, MSS et CHoCH : interprétation et distinctions', 'Impulsion, retracement et continuation', 'Cassures, fausses cassures et réintégrations', 'Biais directionnel et scénarios alternatifs', 'Conditions d’invalidation d’une analyse'], outcome: 'Construire une lecture structurée avec un scénario principal et une invalidation claire.' },
      { number: 7, title: 'Concepts ICT et Smart Money Concepts', lessons: ['Liquidité interne et externe', 'Buy-Side Liquidity et Sell-Side Liquidity', 'Order Blocks, Breaker Blocks et Mitigation Blocks', 'FVG, IFVG et déséquilibres', 'Premium, Discount et Equilibrium', 'SMT Divergence et modèle Unicorn', 'Confluences et hiérarchisation des zones'], outcome: 'Identifier et combiner les concepts selon des critères définis, sans les traiter comme des certitudes.' },
      { number: 8, title: 'Analyse multi-timeframe et contexte de marché', lessons: ['Analyse Weekly, Daily, H4 et H1', 'Construction du biais et identification des objectifs', 'PDH, PDL, PWH, PWL et niveaux d’ouverture', 'Asia High/Low, Killzones et sessions de Londres et New York', 'Notions fondamentales : inflation, emploi, taux et banques centrales', 'Intégrer le calendrier économique à la préparation de session', 'Scénarios haussiers et baissiers'], outcome: 'Relier le contexte, les niveaux clés et les événements économiques.' },
      { number: 9, title: 'Stratégies et modèles d’entrée', lessons: ['Différence entre concept, configuration et stratégie', 'Conditions d’entrée et confirmations', 'Choix du Stop Loss et définition des objectifs', 'Entrées anticipées et entrées confirmées', 'Gestion des sorties et prises de profit', 'Conditions de non-intervention', 'Rédaction d’une fiche de stratégie reproductible'], outcome: 'Décrire une configuration de trading avec des règles compréhensibles et répétables.' },
      { number: 10, title: 'Gestion du risque appliquée', lessons: ['Calcul précis de la taille de position', 'Risque par transaction et risque cumulé', 'Ratio risque/rendement et résultats en R', 'Drawdown et séries de pertes', 'Limites de perte journalière', 'Corrélation entre positions', 'Discipline d’exécution et prévention du revenge trading'], outcome: 'Appliquer un cadre de risque cohérent avant et pendant chaque transaction.' },
    ],
  },
  {
    id: 'TRC-3',
    name: 'PRO TRADER',
    subtitle: 'Performance et discipline',
    period: 'Mois 5–6',
    description: 'Formaliser un système personnel, le tester sur historique et apprendre à interpréter ses résultats et sa discipline.',
    outcome: 'À la fin de cette classe, vous disposez d’un système documenté, d’un échantillon de tests et d’un plan concret d’amélioration.',
    accent: 'violet',
    modules: [
      { number: 11, title: 'Construction du système de trading', lessons: ['Choisir son marché, ses horaires et ses unités de temps', 'Définir les conditions de marché recherchées', 'Formaliser le biais et les configurations autorisées', 'Règles d’entrée, d’invalidation et de sortie', 'Gestion du risque et conditions d’arrêt', 'Checklist opérationnelle', 'Rédaction du plan de trading complet'], outcome: 'Transformer une méthode en règles écrites, claires et vérifiables.' },
      { number: 12, title: 'Backtesting et FX Replay', lessons: ['Méthode de test sur données historiques', 'Rejouer sans connaître les bougies suivantes', 'Identifier et documenter les configurations', 'Enregistrer les entrées, sorties et résultats', 'Comparer plusieurs configurations', 'Limites du backtesting et erreurs d’interprétation'], outcome: 'Tester une méthode de façon disciplinée sans confondre observation et preuve.' },
      { number: 13, title: 'Statistiques et performance', lessons: ['Taux de réussite', 'Gain moyen et perte moyenne', 'Espérance mathématique', 'Profit factor et résultats en R', 'Drawdown et régularité', 'Analyser les résultats par actif, session et configuration', 'Interpréter les résultats et les limites d’un échantillon'], outcome: 'Évaluer une méthode à partir de données, et non d’une impression.' },
      { number: 14, title: 'Discipline et journal de trading', lessons: ['Journalisation complète des transactions', 'Captures du graphique avant et après', 'Évaluer la conformité au plan', 'Analyser les erreurs d’exécution et les biais', 'Gérer les séries de gains et de pertes', 'Revues hebdomadaires et mensuelles', 'Utiliser le journal et les indicateurs IAMTRADER'], outcome: 'Distinguer la qualité d’une décision du résultat ponctuel de la transaction.' },
      { number: 15, title: 'Évaluation finale et plan de progression', lessons: ['Présenter son profil de trader', 'Présenter son plan de trading et sa checklist', 'Démontrer une stratégie formalisée', 'Présenter un échantillon de transactions simulées', 'Analyser les statistiques obtenues', 'Identifier ses points forts et ses faiblesses', 'Élaborer un plan d’amélioration individuel'], outcome: 'Présenter un processus de trading documenté et une démarche de progression réaliste.' },
    ],
  },
];

const accentStyles = {
  blue: { soft: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-blue-600', selected: 'border-blue-500 ring-2 ring-blue-100' },
  green: { soft: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-600', selected: 'border-emerald-500 ring-2 ring-emerald-100' },
  violet: { soft: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', bar: 'bg-violet-600', selected: 'border-violet-500 ring-2 ring-violet-100' },
};

export function CourseSpace() {
  const [selectedClass, setSelectedClass] = useState<CourseClass['id']>('TRC-1');
  const [expandedModules, setExpandedModules] = useState<number[]>([1]);
  const activeClass = courseClasses.find(course => course.id === selectedClass) ?? courseClasses[0];
  const styles = accentStyles[activeClass.accent];

  const chooseClass = (id: CourseClass['id']) => {
    setSelectedClass(id);
    const next = courseClasses.find(course => course.id === id);
    setExpandedModules(next ? [next.modules[0].number] : []);
  };

  const toggleModule = (number: number) => {
    setExpandedModules(current => current.includes(number) ? current.filter(item => item !== number) : [...current, number]);
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#0A192F] p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[32px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-24 right-28 h-48 w-48 rounded-full bg-emerald-400/10 blur-2xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-200">
            <GraduationCap className="h-3.5 w-3.5" /> IAMTRADER ACADEMY
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Votre parcours de formation</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Six mois pour construire vos fondations, structurer votre analyse et apprendre à évaluer votre méthode de trading.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Clock3 className="h-4 w-4 text-emerald-300" /> 6 mois</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><BookOpen className="h-4 w-4 text-emerald-300" /> 3 classes</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Target className="h-4 w-4 text-emerald-300" /> 15 modules</span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Classes de formation">
        {courseClasses.map(course => {
          const courseStyles = accentStyles[course.accent];
          const isSelected = selectedClass === course.id;
          return (
            <button key={course.id} type="button" onClick={() => chooseClass(course.id)} aria-pressed={isSelected}
              className={'rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ' + (isSelected ? courseStyles.selected : 'border-slate-200')}>
              <div className="flex items-center justify-between gap-2">
                <span className={'rounded-lg px-2.5 py-1.5 text-xs font-black ' + courseStyles.soft + ' ' + courseStyles.text}>{course.id}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{course.period}</span>
              </div>
              <h3 className="mt-4 text-lg font-black text-[#0b1f35]">{course.name}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">{course.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{course.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="font-semibold text-slate-500">{course.modules.length} modules</span>
                <span className={'font-bold ' + courseStyles.text}>{isSelected ? 'Classe sélectionnée' : 'Voir le programme'}</span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className={'inline-flex rounded-lg px-3 py-1.5 text-xs font-black ' + styles.soft + ' ' + styles.text}>{activeClass.id} · {activeClass.period}</div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-[#0b1f35]">{activeClass.name}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{activeClass.subtitle}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{activeClass.description}</p>
          </div>
          <div className={'flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ' + styles.border + ' ' + styles.soft + ' ' + styles.text}>
            <BookOpen className="h-4 w-4" /> {activeClass.modules.length} modules
          </div>
        </div>

        <div className={'mt-5 rounded-2xl border p-4 ' + styles.border + ' ' + styles.soft}>
          <div className="flex items-start gap-3">
            <Target className={'mt-0.5 h-5 w-5 shrink-0 ' + styles.text} />
            <div>
              <p className={'text-[10px] font-black uppercase tracking-wider ' + styles.text}>Objectif de la classe</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{activeClass.outcome}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {activeClass.modules.map(module => {
            const isExpanded = expandedModules.includes(module.number);
            return (
              <article key={module.number} className="overflow-hidden rounded-2xl border border-slate-200">
                <button type="button" onClick={() => toggleModule(module.number)} aria-expanded={isExpanded}
                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 sm:p-5">
                  <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black ' + styles.soft + ' ' + styles.text}>{String(module.number).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-[#0b1f35] sm:text-base">{module.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">{module.lessons.length} leçons prévues</span>
                  </span>
                  <ChevronDown className={'h-5 w-5 shrink-0 text-slate-400 transition-transform ' + (isExpanded ? 'rotate-180' : '')} />
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Plan du module</p>
                    <ol className="space-y-2.5">
                      {module.lessons.map((lesson, index) => (
                        <li key={lesson} className="flex items-start gap-2.5 text-sm leading-5 text-slate-600">
                          <span className={'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ' + styles.soft + ' ' + styles.text}><CheckCircle2 className="h-3.5 w-3.5" /></span>
                          <span>{lesson}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-5 rounded-xl bg-slate-50 p-3.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Compétence visée</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{module.outcome}</p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <PlayCircle className="h-4 w-4" /> Plan pédagogique · Les leçons seront développées progressivement
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <p>Le programme est organisé en trois classes progressives. Les modules affichent ici leur plan pédagogique ; les vidéos, supports de cours, exercices notés et le suivi de progression pourront être ajoutés à mesure qu’ils seront préparés.</p>
      </div>
    </div>
  );
}
