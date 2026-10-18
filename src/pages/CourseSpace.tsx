import React, { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, Clock3, GraduationCap, LockKeyhole, PlayCircle, Target } from 'lucide-react';

type CourseModule = {
  number: number;
  title: string;
  lessons: string[];
  outcome: string;
};

type CourseClass = {
  id: 'IAM_1' | 'IAM_2' | 'IAM_3';
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
    id: 'IAM_1',
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
    id: 'IAM_2',
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
    id: 'IAM_3',
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
  const [selectedClass, setSelectedClass] = useState<CourseClass['id']>('IAM_1');
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
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-8">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">
          <GraduationCap className="h-4 w-4 text-emerald-600" />
          <span>IAMTRADER ACADEMY</span>
          <span className="text-slate-300">/</span>
          <span>Parcours pédagogique</span>
        </div>
        <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-[-.045em] text-[#0A192F] sm:text-4xl">Devenir un trader structuré.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Un parcours progressif en trois classes, de la compréhension des marchés à l’évaluation rigoureuse de votre propre méthode.</p>
          </div>
          <div className="flex shrink-0 items-center gap-5 pb-1">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-[#0A192F]">06<span className="ml-1 text-sm font-medium text-slate-400">mois</span></p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Parcours complet</p>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <p className="text-2xl font-semibold tracking-tight text-[#0A192F]">15</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Modules</p>
            </div>
          </div>
        </div>
      </header>

      <section aria-label="Sélection de la classe" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">Votre parcours <span className="mx-1 text-slate-300">/</span> <span className="text-[#0A192F]">{activeClass.id}</span></p>
          <span className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">Sélectionner une classe</span>
        </div>
        <div className="grid grid-cols-1 gap-1 border-y border-slate-200 py-1 sm:grid-cols-3">
          {courseClasses.map((course, index) => {
            const courseStyles = accentStyles[course.accent];
            const isSelected = selectedClass === course.id;
            return (
              <button key={course.id} type="button" onClick={() => chooseClass(course.id)} aria-pressed={isSelected}
                className={'group relative flex min-h-[94px] items-start gap-3 rounded-lg px-3 py-4 text-left transition-colors sm:px-4 ' + (isSelected ? 'bg-[#F1F7F5]' : 'hover:bg-slate-50')}>
                <span className={'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ' + (isSelected ? courseStyles.soft + ' ' + courseStyles.text : 'bg-slate-100 text-slate-500')}>{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={'text-[10px] font-bold uppercase tracking-[.12em] ' + (isSelected ? courseStyles.text : 'text-slate-400')}>{course.id}</span>
                    <span className="text-[10px] text-slate-400">{course.period}</span>
                  </span>
                  <span className="mt-1 block text-sm font-semibold tracking-tight text-[#0A192F]">{course.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{course.subtitle}</span>
                </span>
                {isSelected && <span className={'absolute bottom-0 left-3 right-3 h-0.5 rounded-full sm:left-4 sm:right-4 ' + courseStyles.bar} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="grid gap-5 border-b border-slate-200 pb-6 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
          <div>
            <div className={'mb-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] ' + styles.text}>
              <span className={'h-1.5 w-1.5 rounded-full ' + styles.bar} />
              Classe sélectionnée · {activeClass.period}
            </div>
            <h2 className="text-2xl font-semibold tracking-[-.035em] text-[#0A192F] sm:text-3xl">{activeClass.name}</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">{activeClass.subtitle}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{activeClass.description}</p>
          </div>
          <div className="flex items-center gap-3 md:justify-end">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><BookOpen className="h-5 w-5" /></div>
            <div>
              <p className="text-xl font-semibold tracking-tight text-[#0A192F]">{activeClass.modules.length}<span className="ml-1 text-xs font-medium text-slate-400">modules</span></p>
              <p className="mt-1 text-[10px] uppercase tracking-[.12em] text-slate-400">Programme de la classe</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-8">
          <aside className="space-y-2 sm:pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Objectif pédagogique</p>
            <div className={'h-0.5 w-10 ' + styles.bar} />
          </aside>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">{activeClass.outcome}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-sm font-semibold text-[#0A192F]">Programme détaillé</h3>
            <span className="text-[10px] font-medium text-slate-400">{activeClass.modules.length} modules · {activeClass.modules.reduce((total, module) => total + module.lessons.length, 0)} leçons prévues</span>
          </div>
          <div>
            {activeClass.modules.map(module => {
              const isExpanded = expandedModules.includes(module.number);
              return (
                <article key={module.number} className="border-b border-slate-100 py-1 last:border-b-0">
                  <button type="button" onClick={() => toggleModule(module.number)} aria-expanded={isExpanded}
                    className={'group relative flex w-full items-center gap-4 rounded-xl px-3 py-4 text-left transition-all sm:gap-5 sm:px-4 sm:py-5 ' + (isExpanded ? 'mb-2 bg-[#F3F8F6] shadow-[inset_3px_0_0_0_currentColor] ' + styles.text : 'hover:bg-slate-50')}>
                    <span className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-colors ' + (isExpanded ? styles.soft + ' ' + styles.border + ' ' + styles.text : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-800')}>{String(module.number).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className={'block text-[14px] font-semibold leading-5 tracking-[-.01em] sm:text-[15px] ' + (isExpanded ? 'text-[#0A192F]' : 'text-slate-700 group-hover:text-[#0A192F]')}>{module.title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className={'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ' + (isExpanded ? styles.soft + ' ' + styles.text : 'bg-slate-100 text-slate-500')}>{module.lessons.length} leçons</span>
                        {isExpanded && <span className="text-[10px] font-medium uppercase tracking-[.1em] text-slate-400">Module ouvert</span>}
                      </span>
                    </span>
                    <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all ' + (isExpanded ? styles.bar + ' text-white shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200')}><ChevronDown className={'h-4 w-4 transition-transform ' + (isExpanded ? 'rotate-180' : '')} /></span>
                  </button>
                  {isExpanded && (
                    <div className="grid gap-6 pb-6 pl-3 pr-2 sm:grid-cols-[minmax(0,1fr)_220px] sm:pl-[4.75rem]">
                      <div>
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Contenu du module</p>
                        <ol className="space-y-3">
                          {module.lessons.map((lesson, index) => (
                            <li key={lesson} className="flex items-start gap-3 text-sm leading-5 text-slate-600">
                              <span className="mt-0.5 w-5 shrink-0 font-mono text-[10px] text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                              <span>{lesson}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="self-start border-l-2 border-slate-200 pl-4">
                        <p className={'text-[10px] font-bold uppercase tracking-[.14em] ' + styles.text}>Compétence visée</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{module.outcome}</p>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-slate-400"><PlayCircle className="h-3.5 w-3.5" /> Leçons à développer</div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="flex items-start gap-3 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p>Le programme pédagogique est structuré. Les supports, vidéos, exercices et validations seront ajoutés au fur et à mesure de leur préparation.</p>
      </footer>
    </div>
  );
}
