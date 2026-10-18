import React, { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, Clock3, GraduationCap, LockKeyhole, PlayCircle, Target, LayoutDashboard, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const activeClassIndex = courseClasses.findIndex(course => course.id === selectedClass);
  const moveClass = (direction: -1 | 1) => {
    const nextIndex = (activeClassIndex + direction + courseClasses.length) % courseClasses.length;
    chooseClass(courseClasses[nextIndex].id);
  };

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
        <style>{`@keyframes class-slide-in { from { opacity: 0.65; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }`}</style>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">MON APPRENTISSAGE <span className="mx-1 text-slate-300">/</span> <span className="text-[#0A192F]">{activeClass.id}</span></p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">Classe {activeClassIndex + 1} sur {courseClasses.length}</span>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => moveClass(-1)} aria-label="Classe précédente" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => moveClass(1)} aria-label="Classe suivante" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl">
          <div key={activeClass.id} className="animate-[class-slide-in_320ms_ease-out]">
            <button type="button" onClick={() => chooseClass(activeClass.id)} aria-pressed="true"
              className="group relative flex min-h-[250px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_10px_30px_rgba(15,23,42,0.09)] transition hover:shadow-[0_16px_40px_rgba(15,23,42,0.14)] sm:min-h-[460px] sm:flex-row">
              <span className="absolute inset-x-0 top-0 z-10 h-1"><span className={'block h-full w-full ' + accentStyles[activeClass.accent].bar} /></span>
              <span className="relative block h-[320px] w-full shrink-0 overflow-hidden sm:h-[440px] lg:h-[500px]">
                <img
                  src={activeClass.id === 'IAM_1' ? 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=85' : activeClass.id === 'IAM_2' ? 'https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&q=85' : 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=85'}
                  alt={'Image illustrative de la classe ' + activeClass.name}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
                <span className="absolute inset-0 bg-gradient-to-tr from-[#07172D]/85 via-[#07172D]/25 to-transparent" />
                <span className="absolute left-5 top-5 rounded-full border border-white/25 bg-black/20 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.2em] text-white backdrop-blur-sm">IAMTRADER ACADEMY</span>
                <span className="absolute bottom-5 left-5 right-5">
                  <span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-white/70">Parcours de trading · {activeClass.period}</span>
                  <span className="mt-1 block text-5xl font-black tracking-[-.05em] text-white drop-shadow-lg sm:text-6xl lg:text-7xl">{activeClass.id}</span>
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center p-6 sm:p-9 lg:p-10">
                <span className={'inline-flex w-fit items-center rounded-md px-2.5 py-1 text-[10px] font-bold tracking-[.08em] ' + accentStyles[activeClass.accent].soft + ' ' + accentStyles[activeClass.accent].text}>{activeClass.period}</span>
                <span className="mt-4 block text-5xl font-black uppercase leading-[0.9] tracking-[-.06em] text-[#0A192F] sm:text-6xl lg:text-7xl">{activeClass.name}</span>
                <span className="mt-1 block text-sm font-medium text-slate-500">{activeClass.subtitle}</span>
                <span className="mt-3 block max-w-xl text-sm leading-6 text-slate-600">{activeClass.description}</span>
                <span className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="text-xs font-medium text-slate-500">{activeClass.modules.length} modules au programme</span>
                  <span className={'flex h-9 w-9 items-center justify-center rounded-full ' + accentStyles[activeClass.accent].soft + ' ' + accentStyles[activeClass.accent].text}><ChevronRight className="h-4 w-4" /></span>
                </span>
              </span>
            </button>
          </div>
        </div>
        <div className="flex justify-center gap-2 pt-1" aria-label="Position dans les classes">
          {courseClasses.map((course, index) => (
            <button key={course.id} type="button" onClick={() => chooseClass(course.id)} aria-label={'Afficher la classe ' + course.name} aria-current={selectedClass === course.id ? 'true' : undefined}
              className={'h-1.5 rounded-full transition-all duration-300 ' + (selectedClass === course.id ? 'w-8 ' + accentStyles[course.accent].bar : 'w-2 bg-slate-300 hover:bg-slate-400')} />
          ))}
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
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Votre programme</p>
              <h3 className="text-lg font-semibold tracking-tight text-[#0A192F]">Modules de {activeClass.id}</h3>
            </div>
            <span className="text-xs font-medium text-slate-500">{activeClass.modules.length} modules <span className="mx-1 text-slate-300">·</span> {activeClass.modules.reduce((total, module) => total + module.lessons.length, 0)} leçons</span>
          </div>
          <div className="space-y-2">
            {activeClass.modules.map(module => {
              const isExpanded = expandedModules.includes(module.number);
              return (
                <article key={module.number} className={'overflow-hidden rounded-xl border transition-colors ' + (isExpanded ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <button type="button" onClick={() => toggleModule(module.number)} aria-expanded={isExpanded}
                    className={'group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors sm:gap-5 sm:px-5 ' + (isExpanded ? 'bg-[#F3F8F6]' : 'hover:bg-slate-50')}>
                    <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-semibold ' + (isExpanded ? styles.soft + ' ' + styles.border + ' ' + styles.text : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300')}>{String(module.number).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5 tracking-tight text-[#0A192F] sm:text-[15px]">{module.title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className={'inline-flex rounded-md px-2 py-1 text-[10px] font-semibold ' + (isExpanded ? styles.soft + ' ' + styles.text : 'bg-slate-100 text-slate-500')}>{module.lessons.length} leçons</span>
                        <span className="text-[10px] text-slate-400">{isExpanded ? 'Contenu affiché' : 'Explorer le module'}</span>
                      </span>
                    </span>
                    <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all ' + (isExpanded ? styles.bar + ' text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200')}><ChevronDown className={'h-4 w-4 transition-transform ' + (isExpanded ? 'rotate-180' : '')} /></span>
                  </button>
                  {isExpanded && (
                    <div className="grid gap-6 border-t border-slate-100 bg-slate-50/70 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:px-6">
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
