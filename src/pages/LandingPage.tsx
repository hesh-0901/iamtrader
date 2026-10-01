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
  Send,
  Sparkles,
  X,
  CheckCircle2,
} from 'lucide-react';
import { addContactMessage } from '../services/firestore';

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
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'assistant' | 'user'; text: string }>>([
    {
      role: 'assistant',
      text: 'Bonjour. Je suis l’assistant IAMTRADER. Je peux vous aider à comprendre la plateforme, ses fonctionnalités, le Trader Score et les différents plans.',
    },
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  const aiSuggestions = [
    'Comment fonctionne IAMTRADER ?',
    'Qu’est-ce que le Trader Score ?',
    'Quels sont les plans disponibles ?',
  ];

  const handleAiSubmit = (event: React.FormEvent<HTMLFormElement>, preset?: string) => {
    event.preventDefault();
    const text = (preset ?? aiInput).trim();
    if (!text || isAiTyping) return;

    setAiMessages((messages) => [...messages, { role: 'user', text }]);
    setAiInput('');
    setIsAiTyping(true);

    // Le moteur IA sera branché ici. Le frontend est volontairement prêt à recevoir
    // la réponse du backend sans modifier l’architecture de la page.
    window.setTimeout(() => {
      setAiMessages((messages) => [
        ...messages,
        {
          role: 'assistant',
          text: 'Je suis prêt à répondre à cette question dès que le moteur IA IAMTRADER sera connecté.',
        },
      ]);
      setIsAiTyping(false);
    }, 450);
  };
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [modalContactForm, setModalContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [isModalContactSending, setIsModalContactSending] = useState(false);
  const [modalContactStatus, setModalContactStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalContactConfirmed, setIsModalContactConfirmed] = useState(false);

  const openContactModal = () => {
    setModalContactForm({ name: '', email: '', subject: '', message: '' });
    setModalContactStatus(null);
    setIsModalContactConfirmed(false);
    setIsContactModalOpen(true);
  };

  const closeContactModal = () => {
    if (!isModalContactConfirmed) return;
    setIsContactModalOpen(false);
    setModalContactStatus(null);
    setIsModalContactConfirmed(false);
    setModalContactForm({ name: '', email: '', subject: '', message: '' });
  };

  const handleModalContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setModalContactStatus(null);

    if (!modalContactForm.name.trim() || !modalContactForm.email.trim() || !modalContactForm.subject.trim() || !modalContactForm.message.trim()) {
      setModalContactStatus({ type: 'error', text: 'Veuillez remplir tous les champs.' });
      return;
    }

    setIsModalContactSending(true);
    try {
      await addContactMessage({
        name: modalContactForm.name.trim(),
        email: modalContactForm.email.trim(),
        subject: modalContactForm.subject.trim(),
        message: modalContactForm.message.trim(),
      });
      setIsModalContactConfirmed(true);
      setModalContactStatus({ type: 'success', text: 'Votre message a bien été envoyé. Nous avons bien reçu votre demande.' });
    } catch (error) {
      console.error('Contact modal submission failed:', error);
      setModalContactStatus({ type: 'error', text: 'Impossible d’envoyer le message pour le moment. Réessayez dans quelques instants.' });
    } finally {
      setIsModalContactSending(false);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHookIndex((current) => (current + 1) % hooks.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f8f7] text-[#081827] flex flex-col selection:bg-[#00c796]/20">
      <header className="h-[72px] border-b border-white/70 px-5 sm:px-10 flex items-center justify-between sticky top-0 z-50 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(8,24,39,0.04)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00c796]/15 to-[#00a982]/5 border border-[#00a982]/20 flex items-center justify-center text-[#00a982] shadow-[0_6px_18px_rgba(0,169,130,0.12)]">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-base font-black tracking-[-0.02em]">IAM<span className="text-[#00a982]">TRADER</span></span>
        </div>

        <nav className="hidden md:flex items-center gap-1 rounded-full border border-[#e4ece9] bg-white/70 p-1.5 text-xs font-semibold text-[#60758d] shadow-sm">
          <a href="#features" className="rounded-full px-3 py-2 hover:bg-white hover:text-[#0a192f] transition-all">Plateforme</a>
          <a href="#journal" className="rounded-full px-3 py-2 hover:bg-white hover:text-[#0a192f] transition-all">Fonctionnalités</a>
          <a href="#trader-score" className="rounded-full px-3 py-2 hover:bg-white hover:text-[#0a192f] transition-all">Trader Score</a>
          <a href="#pricing" className="rounded-full px-3 py-2 hover:bg-white hover:text-[#0a192f] transition-all">Tarifs</a>
          <a href="#contact" className="rounded-full px-3 py-2 hover:bg-white hover:text-[#0a192f] transition-all">Contact</a>
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={() => onOpenAuth('login')} className="text-xs font-semibold text-[#60758d] hover:text-[#0a192f] px-3 py-2 transition-colors cursor-pointer">
            Connexion
          </button>
          <button onClick={() => onOpenAuth('register')} className="px-4 py-2.5 text-xs font-bold rounded-xl bg-[#081827] text-white hover:bg-[#10283d] transition-all cursor-pointer shadow-[0_8px_20px_rgba(8,24,39,0.16)]">
            Créer un compte
          </button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 sm:px-12 pt-16 sm:pt-20 pb-24 max-w-7xl mx-auto w-full text-center">
          <div className="absolute inset-x-0 -top-20 h-[520px] bg-[radial-gradient(circle_at_50%_20%,rgba(0,199,150,0.18),transparent_48%),radial-gradient(circle_at_85%_35%,rgba(47,107,255,0.08),transparent_32%)] pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe9e2] bg-white/85 px-4 py-2 text-[11px] font-bold text-[#168c73] shadow-[0_10px_30px_rgba(0,169,130,0.08)] backdrop-blur mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00c796] animate-pulse" />
              La plateforme de performance du trader
            </div>

            <div className="h-10 sm:h-12 flex items-center justify-center mb-3 overflow-hidden">
              <p key={hookIndex} className="text-base sm:text-xl font-semibold tracking-tight text-[#5f7487] animate-[fadeIn_0.45s_ease-out]">
                {hooks[hookIndex]}
              </p>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-[-0.055em] max-w-5xl mx-auto leading-[0.98]">
              Ne tradez plus à l’aveugle.
              <span className="block bg-gradient-to-r from-[#00a982] via-[#00c796] to-[#58d9bf] bg-clip-text text-transparent">Comprenez votre trading.</span>
            </h1>

            <p className="mt-7 text-sm sm:text-base text-[#60758d] max-w-2xl mx-auto leading-7">
              Journalisez vos opérations, maîtrisez votre risque, analysez vos performances et identifiez vos biais pour transformer vos données de trading en décisions plus structurées.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-semibold text-[#71839a]">
              <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#00a982]" /> Données structurées</span>
              <span className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-[#00a982]" /> Gestion du risque</span>
              <span className="flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-[#00a982]" /> Analyse en temps réel</span>
            </div>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => onOpenAuth('register')} className="px-6 py-3.5 text-sm font-bold rounded-2xl bg-[#00a982] text-white hover:bg-[#008f70] transition-all cursor-pointer shadow-[0_14px_30px_rgba(0,169,130,0.22)] hover:-translate-y-0.5 flex items-center gap-2">
                Commencer gratuitement <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#platform" className="px-6 py-3.5 text-sm font-bold rounded-2xl bg-white/90 border border-[#dbe7e3] text-[#0a192f] hover:bg-white hover:-translate-y-0.5 transition-all shadow-[0_10px_25px_rgba(8,24,39,0.06)] flex items-center gap-2">
                <PlayCircle className="w-4 h-4" /> Voir la plateforme
              </a>
            </div>

            <div id="platform" className="mt-14 w-full rounded-[28px] border border-white/80 bg-[#081827] p-3 sm:p-5 shadow-[0_35px_90px_rgba(8,24,39,0.18)] text-left scroll-mt-24 ring-1 ring-black/5">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9d5de]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9d5de]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9d5de]" />
                  <span className="text-[11px] text-slate-400 font-mono ml-2">app.iamtrader / dashboard</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-[#6ee7c9]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c796]" /> Analyse active
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ['P&L', '+$8,420.50', 'text-[#00a982]'],
                  ['Win Rate', '68.4%', 'text-white'],
                  ['Max Drawdown', '-4.2%', 'text-[#e05a78]'],
                  ['Trader Score', '84 / 100', 'text-[#2f6bff]'],
                ].map(([label, value, color]) => (
                  <div key={label} className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm shadow-inner">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 block mb-2">{label}</span>
                    <span className={`text-xl font-black tabular-nums tracking-tight ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
                <div className="h-40 rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex flex-col justify-between">
                  <div className="flex justify-between text-[10px] font-semibold text-slate-400"><span>Equity Curve</span><span>30 derniers jours</span></div>
                  <div className="flex items-end gap-1.5 h-24">
                    {[35,42,38,48,45,56,51,63,58,72,69,82,77,92].map((height, index) => (
                      <span key={index} className="flex-1 rounded-t-md bg-[#00c796]/25" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] font-semibold text-slate-400 mb-3 uppercase tracking-wider">Performance</div>
                  <div className="space-y-3">
                    {[['Risk Management','92%'],['Consistency','81%'],['Psychology','78%']].map(([label, value]) => (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] font-semibold mb-1"><span>{label}</span><span className="text-[#6ee7c9]">{value}</span></div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#00a982] to-[#5ce0c1] rounded-full" style={{width:value}} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 sm:px-12 py-24 bg-white border-y border-[#e1e9ef]">
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
                return <div key={title as string} className="group p-6 rounded-[22px] border border-[#e1ebe8] bg-gradient-to-br from-white to-[#f6fbf9] shadow-[0_12px_30px_rgba(8,24,39,0.045)] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(8,24,39,0.08)] transition-all">
                  <I className="w-5 h-5 text-[#00a982] mb-4" />
                  <h3 className="font-bold text-sm">{title as string}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2">{desc as string}</p>
                </div>;
              })}
            </div>
          </div>
        </section>

        <section id="features" className="px-6 sm:px-12 py-24 max-w-7xl mx-auto w-full scroll-mt-20">
          <div className="text-center max-w-3xl mx-auto mb-14">
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
              return <div key={title as string} className="group p-6 rounded-[24px] border border-[#e0eae7] bg-white shadow-[0_12px_35px_rgba(8,24,39,0.045)] hover:-translate-y-1 hover:border-[#bfe6da] hover:shadow-[0_22px_45px_rgba(8,24,39,0.09)] transition-all">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#e5faf5] to-white border border-[#ccefe5] text-[#00a982] flex items-center justify-center mb-5 shadow-sm group-hover:scale-105 transition-transform"><I className="w-5 h-5" /></div>
                <h3 className="font-bold">{title as string}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mt-2">{desc as string}</p>
              </div>;
            })}
          </div>
        </section>

        <section id="trader-score" className="relative overflow-hidden px-6 sm:px-12 py-24 bg-[#071725] text-white scroll-mt-20">
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
            <div className="rounded-[28px] bg-white/[0.07] border border-white/10 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
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

        <section id="journal" className="px-6 sm:px-12 py-24 bg-white border-y border-[#e1e9ef] scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00a982]">Comment ça fonctionne</span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Simple à utiliser. Riche en données.</h2>
            </div>
            <div className="grid md:grid-cols-4 gap-4 mt-12">
              {[
                ['01','Configurez','Vos comptes, instruments et setups.'],
                ['02','Journalisez','Chaque opération avec son contexte réel.'],
                ['03','Analysez','Vos résultats, votre risque et vos comportements.'],
                ['04','Progressez','À partir de données que vous pouvez réellement relire.'],
              ].map(([num,title,desc]) => <div key={num} className="relative p-6 rounded-[22px] bg-white border border-[#e0eae7] shadow-[0_12px_30px_rgba(8,24,39,0.04)] hover:-translate-y-1 transition-all"><span className="text-xs font-black text-[#00a982]">{num}</span><h3 className="font-bold mt-5">{title}</h3><p className="text-xs text-slate-400 leading-relaxed mt-2">{desc}</p></div>)}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 sm:px-12 py-24 bg-[#f3f8f6] border-b border-[#e1e9ef] scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00a982]">Tarifs</span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Choisissez votre niveau. Construisez votre avantage.</h2>
              <p className="mt-3 text-sm text-[#60758d]">Commencez gratuitement, passez à l’analyse avancée ou rejoignez notre environnement d’apprentissage.</p>
            </div>
            <div className="grid lg:grid-cols-3 gap-6 items-stretch">
              {plans.map((plan) => <div key={plan.name} className={`relative rounded-[28px] p-7 bg-white border ${plan.highlight ? 'border-[#00a982] shadow-[0_22px_60px_rgba(0,169,130,0.16)] ring-1 ring-[#00a982]/10' : 'border-[#dfe8ef]'} flex flex-col`}>
                {plan.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#00a982] text-white text-[10px] font-black tracking-wider shadow-[0_8px_18px_rgba(0,169,130,0.22)]">LE PLUS CHOISI</div>}
                <div className="text-[10px] font-black tracking-[0.18em] text-[#00a982]">{plan.eyebrow}</div>
                <h3 className="text-2xl font-black mt-2">{plan.name}</h3>
                <p className="text-xs text-[#71839a] mt-3 min-h-[40px]">{plan.description}</p>
                <div className="mt-6 flex items-end gap-1"><span className="text-4xl font-black">{plan.price}</span><span className="text-xs text-[#71839a] mb-1">{plan.period}</span></div>
                <button onClick={() => onOpenAuth('register')} className={`mt-7 w-full py-3.5 rounded-2xl text-sm font-bold cursor-pointer transition-all hover:-translate-y-0.5 shadow-sm ${plan.highlight ? 'bg-[#00a982] text-white hover:bg-[#008f70]' : 'bg-[#0a192f] text-white hover:bg-[#142d49]'}`}>{plan.cta}</button>
                <div className="mt-7 pt-6 border-t border-[#e7eef3] space-y-3 flex-1">{plan.features.map((feature) => <div key={feature} className="flex items-start gap-2 text-xs text-[#435970]"><Check className="w-4 h-4 text-[#00a982] shrink-0 mt-0.5" />{feature}</div>)}</div>
              </div>)}
            </div>
            <p className="text-[11px] text-[#71839a] text-center mt-6">Les limites exactes du plan Starter et les modalités de facturation sont affichées dans l’application.</p>
          </div>
        </section>

        <section className="px-6 sm:px-12 py-24 bg-white">
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
                <button
                  type="button"
                  onClick={openContactModal}
                  className="mt-8 inline-flex w-fit items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-[#5ce0c1]" />
                  support@iamtrader.com
                </button>
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-[#dce9e5] bg-white shadow-[0_20px_60px_rgba(8,24,39,0.08)]">
                <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#00c796]/10 blur-3xl pointer-events-none" />
                <div className="relative flex items-center justify-between border-b border-[#e7efec] px-6 py-5 sm:px-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00c796] to-[#00a982] text-white shadow-[0_10px_25px_rgba(0,169,130,0.2)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-[#081827]">Assistant IAMTRADER</h3>
                        <span className="rounded-full bg-[#eafbf6] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#168c73]">IA</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-[#7a8b9b]">Échange instantané</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-[#dcebe5] bg-[#f5fbf8] px-2.5 py-1.5 text-[10px] font-bold text-[#168c73]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00a982] shadow-[0_0_0_4px_rgba(0,169,130,0.08)]" />
                    En ligne
                  </div>
                </div>

                <div className="relative h-[360px] overflow-y-auto px-5 py-5 sm:px-7">
                  <div className="space-y-4">
                    {aiMessages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          message.role === 'user'
                            ? 'rounded-br-md bg-[#081827] text-white'
                            : 'rounded-bl-md border border-[#e2ece8] bg-[#f7fbf9] text-[#43586b]'
                        }`}>
                          {message.text}
                        </div>
                      </div>
                    ))}
                    {isAiTyping && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[#e2ece8] bg-[#f7fbf9] px-4 py-3">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00a982]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00a982] [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00a982] [animation-delay:240ms]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-[#e7efec] bg-[#fbfdfc] px-5 py-4 sm:px-7">
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {aiSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={(event) => handleAiSubmit(event as unknown as React.FormEvent<HTMLFormElement>, suggestion)}
                        disabled={isAiTyping}
                        className="shrink-0 rounded-full border border-[#dce9e5] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#5d7183] transition-all hover:border-[#9edbca] hover:bg-[#f0faf6] hover:text-[#168c73] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAiSubmit} className="flex items-center gap-2 rounded-2xl border border-[#d9e6e1] bg-white p-1.5 shadow-[0_8px_25px_rgba(8,24,39,0.05)] focus-within:border-[#8bd4c0] focus-within:ring-4 focus-within:ring-[#00a982]/5">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(event) => setAiInput(event.target.value)}
                      placeholder="Posez votre question à l’IA..."
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-[#081827] outline-none placeholder:text-[#9aa9b5]"
                      disabled={isAiTyping}
                    />
                    <button
                      type="submit"
                      disabled={!aiInput.trim() || isAiTyping}
                      aria-label="Envoyer à l’assistant IA"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00a982] text-white shadow-[0_8px_18px_rgba(0,169,130,0.2)] transition-all hover:bg-[#008f70] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                  <p className="mt-2 text-center text-[9px] font-medium text-[#9aa9b5]">L’assistant IA sera connecté au moteur IAMTRADER.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 sm:px-12 py-24 bg-gradient-to-br from-[#eafbf6] via-white to-[#eef5ff] border-y border-[#ccefe5]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Ne vous contentez plus de trader. Comprenez votre trading.</h2>
            <p className="mt-4 text-sm text-[#60758d]">Commencez à construire un historique exploitable et transformez vos données en progression.</p>
            <button onClick={() => onOpenAuth('register')} className="mt-7 px-7 py-3 rounded-xl bg-[#0a192f] text-white text-sm font-bold hover:bg-[#142d49] transition-colors cursor-pointer">Commencer gratuitement</button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dfe8ef] px-6 sm:px-12 py-12 bg-[#071725] text-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8 text-xs">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-black text-sm">IAM<span className="text-[#00a982]">TRADER</span></div>
            <p className="mt-3 max-w-md text-slate-400 leading-relaxed">Station de performance pour traders : journal, analyse, risque, psychologie et progression.</p>
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
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-white/10 text-[11px] text-slate-500 flex flex-col sm:flex-row justify-between gap-2"><span>© 2026 IAMTRADER. Tous droits réservés.</span><span>Données hébergées et sécurisées sur Google Cloud Platform.</span></div>
      </footer>

      {isContactModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#06111f]/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-[#dfe8ef] shadow-[0_30px_100px_rgba(6,17,31,0.3)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e7eef3] bg-white/95 px-6 py-5 backdrop-blur-md sm:px-8">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00a982]">Support IAMTRADER</span>
                <h2 id="contact-modal-title" className="mt-1 text-xl font-black text-[#0a192f]">Envoyer un e-mail</h2>
              </div>
              {isModalContactConfirmed && (
                <button type="button" onClick={closeContactModal} aria-label="Fermer" className="rounded-xl p-2 text-[#71839a] hover:bg-[#f1f5f8] hover:text-[#0a192f] transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6 sm:p-8">
              {isModalContactConfirmed ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e5faf5] text-[#00a982]">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-2xl font-black text-[#0a192f]">Message envoyé</h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#60758d]">
                    Votre demande a bien été enregistrée. Notre équipe pourra vous répondre à l’adresse e-mail indiquée.
                  </p>
                  <div className="mt-7 rounded-2xl border border-[#ccefe5] bg-[#eafbf6] px-4 py-3 text-xs font-semibold text-[#168c73]">
                    Confirmation reçue : votre message a été transmis avec succès.
                  </div>
                  <button type="button" onClick={closeContactModal} className="mt-7 inline-flex items-center justify-center rounded-xl bg-[#0a192f] px-6 py-3 text-sm font-bold text-white hover:bg-[#142d49] transition-colors cursor-pointer">
                    Fermer
                  </button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleModalContactSubmit}>
                  <div className="rounded-2xl border border-[#dfe8ef] bg-[#f8fbfd] px-4 py-3 text-xs leading-relaxed text-[#60758d]">
                    Remplissez ce formulaire pour contacter directement l’équipe IAMTRADER.
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input type="text" required value={modalContactForm.name} onChange={(event) => setModalContactForm({ ...modalContactForm, name: event.target.value })} placeholder="Votre nom" className="w-full rounded-xl border border-[#d9e4eb] bg-[#fbfdff] px-4 py-3 text-sm outline-none focus:border-[#00a982] focus:ring-2 focus:ring-[#00a982]/10" />
                    <input type="email" required value={modalContactForm.email} onChange={(event) => setModalContactForm({ ...modalContactForm, email: event.target.value })} placeholder="Votre adresse e-mail" className="w-full rounded-xl border border-[#d9e4eb] bg-[#fbfdff] px-4 py-3 text-sm outline-none focus:border-[#00a982] focus:ring-2 focus:ring-[#00a982]/10" />
                  </div>
                  <input type="text" required value={modalContactForm.subject} onChange={(event) => setModalContactForm({ ...modalContactForm, subject: event.target.value })} placeholder="Sujet" className="w-full rounded-xl border border-[#d9e4eb] bg-[#fbfdff] px-4 py-3 text-sm outline-none focus:border-[#00a982] focus:ring-2 focus:ring-[#00a982]/10" />
                  <textarea required rows={6} value={modalContactForm.message} onChange={(event) => setModalContactForm({ ...modalContactForm, message: event.target.value })} placeholder="Votre message..." className="w-full resize-none rounded-xl border border-[#d9e4eb] bg-[#fbfdff] px-4 py-3 text-sm outline-none focus:border-[#00a982] focus:ring-2 focus:ring-[#00a982]/10" />
                  {modalContactStatus && (
                    <div className={`rounded-xl px-4 py-3 text-xs font-semibold ${modalContactStatus.type === 'success' ? 'bg-[#eafbf6] text-[#168c73] border border-[#ccefe5]' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                      {modalContactStatus.text}
                    </div>
                  )}
                  <button type="submit" disabled={isModalContactSending} className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#00a982] px-6 py-3 text-sm font-bold text-white hover:bg-[#008f70] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                    {isModalContactSending ? 'Envoi en cours...' : 'Envoyer le message'}
                    {!isModalContactSending && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
