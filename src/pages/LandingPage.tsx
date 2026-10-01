import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Brain,
  BarChart3,
  Calendar,
  Target,
  ArrowRight,
  Check,
  Lock,
  Layers,
  Activity,
  Wallet,
  Award,
  ChevronDown,
  Users,
  PlayCircle,
  Mail,
  MessageSquare,
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const hooks = [
  'Vous tradez. Mais savez-vous pourquoi vous gagnez ?',
  'Pourquoi vous perdez ?',
  'Combien vous risquez réellement ?',
  'Quels comportements vous coûtent de l’argent ?',
  'Et si chaque trade pouvait vous apprendre quelque chose ?',
];

const plans = [
  {
    name: 'Starter',
    eyebrow: 'FREE',
    price: '$0',
    period: 'pour commencer',
    description: 'Construisez votre historique de trading sans abonnement.',
    cta: 'Commencer gratuitement',
    highlight: false,
    features: [
      'Journal de trading',
      'Analyse des performances',
      'P&L, R, drawdown et win rate',
      'Trader Score',
      'Analyse psychologique',
      'Dashboard et statistiques',
      'Toutes les fonctionnalités de la plateforme',
      'Limite de trades enregistrés',
    ],
  },
  {
    name: 'Plus',
    eyebrow: 'PLUS',
    price: '$9.99',
    period: '/ mois',
    description: 'Passez du simple suivi à l’analyse complète de votre trading.',
    cta: 'Passer à Plus',
    highlight: true,
    features: [
      'Tout ce qui est inclus dans Starter',
      'Trades illimités',
      'Historique complet',
      'Analyses avancées',
      'Analyse par instrument, session et setup',
      'Statistiques avancées',
      'Suivi multi-comptes',
      'Toutes les fonctionnalités premium',
    ],
  },
  {
    name: 'Community',
    eyebrow: 'COMMUNITY',
    price: '$89.99',
    period: '/ 6 mois',
    description: 'Un environnement complet pour apprendre, analyser et progresser accompagné.',
    cta: 'Rejoindre Community',
    highlight: false,
    features: [
      'Tout ce qui est inclus dans Plus',
      'Formations vidéo',
      'Cours PDF',
      'Communauté d’analystes',
      'Contenus pédagogiques exclusifs',
      'Échanges et partage d’analyses',
      'Accompagnement pendant 6 mois',
      'Accès à tous les outils IAMTRADER',
    ],
  },
];

export function LandingPage({ onOpenAuth }: LandingPageProps) {
  const [hookIndex, setHookIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHookIndex((current) => (current + 1) % hooks.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-[#0a192f] flex flex-col selection:bg-[#00c796]/20">
      <header className="h-16 border-b border-[#dfe8ef] px-6 sm:px-10 flex items-center justify-between sticky top-0 z-50 bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00c796]/10 border border-[#00c796]/25 flex items-center justify-center text-[#00a982]">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-base font-bold tracking-tight">IAM<span className="text-[#00a982]">TRADER</span></span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#60758d]">
          <a href="#features" className="hover:text-[#0a192f] transition-colors">Plateforme</a>
          <a href="#journal" className="hover:text-[#0a192f] transition-colors">Fonctionnalités</a>
          <a href="#trader-score" className="hover:text-[#0a192f] transition-colors">Trader Score</a>
          <a href="#pricing" className="hover:text-[#0a192f] transition-colors">Tarifs</a>
          <a href="#contact" className="hover:text-[#0a192f] transition-colors">Contact</a>
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={() => onOpenAuth('login')} className="text-xs font-semibold text-[#60758d] hover:text-[#0a192f] px-3 py-2 transition-colors cursor-pointer">
            Connexion
          </button>
          <button onClick={() => onOpenAuth('register')} className="px-4 py-2 text-xs font-bold rounded-lg bg-[#0a192f] text-white hover:bg-[#142d49] transition-colors cursor-pointer shadow-sm">
            Créer un compte
          </button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 sm:px-12 pt-14 pb-20 max-w-6xl mx-auto w-full text-center">
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_center,rgba(0,199,150,0.10),transparent_65%)] pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe9e2] bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#168c73] shadow-sm mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00c796] animate-pulse" />
              La plateforme de performance du trader
            </div>

            <div className="h-10 sm:h-12 flex items-center justify-center mb-3 overflow-hidden">
              <p key={hookIndex} className="text-lg sm:text-2xl font-semibold tracking-tight text-[#60758d] animate-[fadeIn_0.45s_ease-out]">
                {hooks[hookIndex]}
              </p>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-[-0.04em] max-w-4xl mx-auto leading-[1.04]">
              Ne tradez plus à l’aveugle.
              <span className="block text-[#00a982]">Comprenez votre trading.</span>
            </h1>

            <p className="mt-6 text-sm sm:text-base text-[#60758d] max-w-2xl mx-auto leading-relaxed">
              Journalisez vos opérations, maîtrisez votre risque, analysez vos performances et identifiez vos biais pour transformer vos données de trading en décisions plus structurées.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => onOpenAuth('register')} className="px-6 py-3 text-sm font-bold rounded-xl bg-[#00a982] text-white hover:bg-[#008f70] transition-all cursor-pointer shadow-lg shadow-[#00c796]/15 flex items-center gap-2">
                Commencer gratuitement <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#platform" className="px-6 py-3 text-sm font-bold rounded-xl bg-white border border-[#d9e4eb] text-[#0a192f] hover:bg-[#f8fbfd] transition-colors flex items-center gap-2">
                <PlayCircle className="w-4 h-4" /> Voir la plateforme
              </a>
            </div>

            <div id="platform" className="mt-12 w-full rounded-2xl border border-[#d8e4ec] bg-white p-4 sm:p-6 shadow-[0_20px_60px_rgba(16,35,58,0.09)] text-left scroll-mt-24">
              <div className="flex items-center justify-between pb-4 border-b border-[#e4ebf0] mb-5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9d5de]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9d5de]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9d5de]" />
                  <span className="text-xs text-[#71839a] font-mono ml-2">app.iamtrader / dashboard</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-[#168c73]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c796]" /> Analyse active
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ['P&L', '+$8,420.50', 'text-[#00a982]'],
                  ['Win Rate', '68.4%', 'text-[#0a192f]'],
                  ['Max Drawdown', '-4.2%', 'text-[#e05a78]'],
                  ['Trader Score', '84 / 100', 'text-[#2f6bff]'],
                ].map(([label, value, color]) => (
                  <div key={label} className="p-4 rounded-xl bg-[#f8fbfd] border border-[#e2ebf1]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#71839a] block mb-2">{label}</span>
                    <span className={`text-xl font-black tabular-nums ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
                <div className="h-40 rounded-xl border border-[#e2ebf1] bg-[#fbfdff] p-4 flex flex-col justify-between">
                  <div className="flex justify-between text-[10px] font-semibold text-[#71839a]"><span>Equity Curve</span><span>30 derniers jours</span></div>
                  <div className="flex items-end gap-1.5 h-24">
                    {[35,42,38,48,45,56,51,63,58,72,69,82,77,92].map((height, index) => (
                      <span key={index} className="flex-1 rounded-t-md bg-[#00c796]/25" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-[#e2ebf1] bg-[#fbfdff] p-4">
                  <div className="text-[10px] font-semibold text-[#71839a] mb-3">Performance</div>
                  <div className="space-y-3">
                    {[['Risk Management','92%'],['Consistency','81%'],['Psychology','78%']].map(([label, value]) => (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] font-semibold mb-1"><span>{label}</span><span className="text-[#168c73]">{value}</span></div>
                        <div className="h-1.5 bg-[#e9f0f4] rounded-full overflow-hidden"><div className="h-full bg-[#00c796] rounded-full" style={{width:value}} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 sm:px-12 py-20 bg-white border-y border-[#e1e9ef]">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.3fr] gap-12 items-center">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00a982]">Le problème</span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Vous avez déjà les données. Mais les exploitez-vous vraiment ?</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#60758d]">
                Une suite de trades ne suffit pas à comprendre une méthode. IAMTRADER transforme votre historique en informations lisibles sur votre risque, votre exécution, vos résultats et vos habitudes.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ['Risque', 'Voyez combien vous engagez réellement sur chaque position.', ShieldCheck],
                ['Performance', 'Mesurez votre P&L, votre equity, votre drawdown et vos statistiques.', TrendingUp],
                ['Psychologie', 'Reliez vos états émotionnels à vos résultats pour repérer vos biais.', Brain],
                ['Progression', 'Suivez votre Trader Score et les axes qui structurent votre progression.', Award],
              ].map(([title, desc, Icon]) => {
                const I = Icon as React.ElementType;
                return <div key={title as string} className="p-5 rounded-2xl border border-[#e0e9ef] bg-[#f8fbfd]">
                  <I className="w-5 h-5 text-[#00a982] mb-4" />
                  <h3 className="font-bold text-sm">{title as string}</h3>
                  <p className="text-xs text-[#71839a] leading-relaxed mt-2">{desc as string}</p>
                </div>;
              })}
            </div>
          </div>
        </section>

        <section id="features" className="px-6 sm:px-12 py-20 max-w-6xl mx-auto w-full scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00a982]">Une plateforme, plusieurs leviers</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Tout ce qu’il faut pour comprendre votre trading.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              ['Journal haute précision','Enregistrez entrées, sorties, risque, setup, psychologie et contexte.',BarChart3],
              ['Gestion du risque','Calculez et suivez risque initial, P&L, Multiple R et drawdown.',ShieldCheck],
              ['Trader Score','Une lecture structurée de votre risque, discipline, consistance et psychologie.',Award],
              ['Matrice psychologique','Analysez FOMO, revenge trading, hésitation et autres états associés à vos résultats.',Brain],
              ['Performance & Equity','Visualisez P&L, win rate, profit factor, expectancy et évolution de l’equity.',TrendingUp],
              ['Multi-comptes & calendrier','Centralisez vos comptes et visualisez votre activité dans le temps.',Layers],
            ].map(([title, desc, Icon]) => {
              const I = Icon as React.ElementType;
              return <div key={title as string} className="p-6 rounded-2xl border border-[#dfe8ef] bg-white shadow-[0_8px_28px_rgba(16,35,58,0.035)]">
                <div className="w-10 h-10 rounded-xl bg-[#e5faf5] text-[#00a982] flex items-center justify-center mb-5"><I className="w-5 h-5" /></div>
                <h3 className="font-bold">{title as string}</h3>
                <p className="text-sm text-[#71839a] leading-relaxed mt-2">{desc as string}</p>
              </div>;
            })}
          </div>
        </section>

        <section id="trader-score" className="px-6 sm:px-12 py-20 bg-[#0a192f] text-white scroll-mt-20">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_0.8fr] gap-12 items-center">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5ce0c1]">Trader Score</span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Ne mesurez pas seulement ce que vous gagnez. Mesurez comment vous tradez.</h2>
              <p className="mt-5 text-sm text-slate-300 leading-relaxed max-w-xl">
                Une lecture synthétique de vos comportements de trading pour suivre votre discipline, votre gestion du risque, votre consistance et votre maîtrise psychologique.
              </p>
              <div className="mt-7 grid sm:grid-cols-2 gap-3 text-sm">
                {['Gestion du risque','Discipline','Consistance','Exécution','Psychologie','Stabilité'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-slate-200"><Check className="w-4 h-4 text-[#5ce0c1]" />{item}</div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl bg-white/8 border border-white/10 p-7 text-center shadow-2xl">
              <div className="text-xs text-slate-400 uppercase tracking-widest">Exemple de score</div>
              <div className="mt-3 text-7xl font-black text-[#5ce0c1]">84</div>
              <div className="text-sm text-slate-300">Trader Score / 100</div>
              <div className="mt-7 space-y-3 text-left">
                {[['Risque','92%'],['Discipline','86%'],['Consistance','81%'],['Psychologie','78%']].map(([label, value]) => (
                  <div key={label}><div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{value}</span></div><div className="h-1.5 bg-white/10 rounded-full"><div className="h-full bg-[#5ce0c1] rounded-full" style={{width:value}} /></div></div>
                ))}
              </div>
              <p className="mt-5 text-[10px] text-slate-400">Données de démonstration.</p>
            </div>
          </div>
        </section>

        <section id="journal" className="px-6 sm:px-12 py-20 bg-white border-y border-[#e1e9ef] scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00a982]">Comment ça fonctionne</span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Simple à utiliser. Riche en données.</h2>
            </div>
            <div className="grid md:grid-cols-4 gap-4 mt-10">
              {[
                ['01','Configurez','Vos comptes, instruments et setups.'],
                ['02','Journalisez','Chaque opération avec son contexte réel.'],
                ['03','Analysez','Vos résultats, votre risque et vos comportements.'],
                ['04','Progressez','À partir de données que vous pouvez réellement relire.'],
              ].map(([num,title,desc]) => <div key={num} className="relative p-5 rounded-2xl bg-[#f8fbfd] border border-[#e0e9ef]"><span className="text-xs font-black text-[#00a982]">{num}</span><h3 className="font-bold mt-5">{title}</h3><p className="text-xs text-[#71839a] leading-relaxed mt-2">{desc}</p></div>)}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 sm:px-12 py-20 bg-[#f6f9fc] border-b border-[#e1e9ef] scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00a982]">Tarifs</span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Choisissez votre niveau. Construisez votre avantage.</h2>
              <p className="mt-3 text-sm text-[#60758d]">Commencez gratuitement, passez à l’analyse avancée ou rejoignez notre environnement d’apprentissage.</p>
            </div>
            <div className="grid lg:grid-cols-3 gap-5 items-stretch">
              {plans.map((plan) => <div key={plan.name} className={`relative rounded-3xl p-6 bg-white border ${plan.highlight ? 'border-[#00a982] shadow-[0_18px_50px_rgba(0,169,130,0.13)]' : 'border-[#dfe8ef]'} flex flex-col`}>
                {plan.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#00a982] text-white text-[10px] font-black tracking-wider">LE PLUS CHOISI</div>}
                <div className="text-[10px] font-black tracking-[0.18em] text-[#00a982]">{plan.eyebrow}</div>
                <h3 className="text-2xl font-black mt-2">{plan.name}</h3>
                <p className="text-xs text-[#71839a] mt-3 min-h-[40px]">{plan.description}</p>
                <div className="mt-6 flex items-end gap-1"><span className="text-4xl font-black">{plan.price}</span><span className="text-xs text-[#71839a] mb-1">{plan.period}</span></div>
                <button onClick={() => onOpenAuth('register')} className={`mt-6 w-full py-3 rounded-xl text-sm font-bold cursor-pointer transition-colors ${plan.highlight ? 'bg-[#00a982] text-white hover:bg-[#008f70]' : 'bg-[#0a192f] text-white hover:bg-[#142d49]'}`}>{plan.cta}</button>
                <div className="mt-7 pt-6 border-t border-[#e7eef3] space-y-3 flex-1">{plan.features.map((feature) => <div key={feature} className="flex items-start gap-2 text-xs text-[#435970]"><Check className="w-4 h-4 text-[#00a982] shrink-0 mt-0.5" />{feature}</div>)}</div>
              </div>)}
            </div>
            <p className="text-[11px] text-[#71839a] text-center mt-6">Les limites exactes du plan Starter et les modalités de facturation sont affichées dans l’application.</p>
          </div>
        </section>

        <section className="px-6 sm:px-12 py-20 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00a982]">FAQ</span>
              <h2 className="text-3xl font-black tracking-tight mt-3">Questions fréquentes</h2>
            </div>
            <div className="border-t border-[#e0e9ef]">
              {[
                ['Puis-je commencer gratuitement ?', 'Oui. Le plan Starter permet de commencer sans abonnement et d’utiliser la plateforme dans la limite de trades enregistrés définie pour cette offre.'],
                ['Que comprend Plus ?', 'Plus reprend les services du plan gratuit et ajoute les trades illimités ainsi que les fonctions d’analyse avancée.'],
                ['Que comprend Community ?', 'Community inclut les outils IAMTRADER ainsi que les formations vidéo, les cours PDF, l’accès à la communauté d’analystes et un accompagnement pendant 6 mois.'],
                ['IAMTRADER est-il une prop firm ?', 'Non. IAMTRADER est une plateforme de journalisation, d’analyse et de progression destinée aux traders.'],
              ].map(([question, answer], index) => <div key={question} className="border-b border-[#e0e9ef]">
                <button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="w-full py-5 flex items-center justify-between text-left font-bold text-sm cursor-pointer">
                  <span>{question}</span><ChevronDown className={`w-4 h-4 text-[#71839a] transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && <p className="pb-5 pr-8 text-sm text-[#60758d] leading-relaxed">{answer}</p>}
              </div>)}
            </div>
          </div>
        </section>

        <section id="contact" className="px-6 sm:px-12 py-20 bg-[#f6f9fc] border-y border-[#dfe8ef] scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 items-stretch">
              <div className="rounded-3xl bg-[#0a192f] text-white p-8 sm:p-10 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5ce0c1]">Contact</span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Besoin d’aide ou d’une information ?</h2>
                  <p className="mt-5 text-sm text-slate-300 leading-relaxed">
                    Notre équipe est disponible pour répondre à vos questions concernant IAMTRADER, votre compte, la plateforme ou nos offres.
                  </p>
                </div>
                <a
                  href="mailto:support@iamtrader.com"
                  className="mt-8 inline-flex w-fit items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <Mail className="w-4 h-4 text-[#5ce0c1]" />
                  support@iamtrader.com
                </a>
              </div>

              <div className="rounded-3xl bg-white border border-[#dfe8ef] p-8 sm:p-10 shadow-[0_12px_40px_rgba(16,35,58,0.05)]">
                <div className="w-11 h-11 rounded-xl bg-[#e5faf5] text-[#00a982] flex items-center justify-center mb-5">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black">Parlons de votre besoin</h3>
                <p className="mt-2 text-sm text-[#71839a] leading-relaxed">
                  Pour nous contacter, utilisez directement notre adresse support. Votre logiciel de messagerie s’ouvrira automatiquement.
                </p>
                <a
                  href="mailto:support@iamtrader.com?subject=Contact%20IAMTRADER"
                  className="mt-7 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00a982] text-white text-sm font-bold hover:bg-[#008f70] transition-colors"
                >
                  Écrire à IAMTRADER <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 sm:px-12 py-20 bg-[#eafbf6] border-y border-[#ccefe5]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Ne vous contentez plus de trader. Comprenez votre trading.</h2>
            <p className="mt-4 text-sm text-[#60758d]">Commencez à construire un historique exploitable et transformez vos données en progression.</p>
            <button onClick={() => onOpenAuth('register')} className="mt-7 px-7 py-3 rounded-xl bg-[#0a192f] text-white text-sm font-bold hover:bg-[#142d49] transition-colors cursor-pointer">Commencer gratuitement</button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dfe8ef] px-6 sm:px-12 py-10 bg-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8 text-xs">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-black text-sm">IAM<span className="text-[#00a982]">TRADER</span></div>
            <p className="mt-3 max-w-md text-[#71839a] leading-relaxed">Station de performance pour traders : journal, analyse, risque, psychologie et progression.</p>
          </div>
          <div>
            <div className="font-bold mb-3">Plateforme</div>
            <div className="space-y-2 text-[#71839a]"><a href="#features" className="block hover:text-[#0a192f]">Fonctionnalités</a><a href="#trader-score" className="block hover:text-[#0a192f]">Trader Score</a><a href="#pricing" className="block hover:text-[#0a192f]">Tarifs</a><a href="#contact" className="block hover:text-[#0a192f]">Contact</a></div>
          </div>
          <div>
            <div className="font-bold mb-3">Accès</div>
            <div className="space-y-2 text-[#71839a]"><button onClick={() => onOpenAuth('login')} className="block cursor-pointer hover:text-[#0a192f]">Connexion</button><button onClick={() => onOpenAuth('register')} className="block cursor-pointer hover:text-[#0a192f]">Créer un compte</button></div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-[#e7eef3] text-[11px] text-[#8a9aac] flex flex-col sm:flex-row justify-between gap-2"><span>© 2026 IAMTRADER. Tous droits réservés.</span><span>Données hébergées et sécurisées sur Google Cloud Platform.</span></div>
      </footer>
    </div>
  );
}
