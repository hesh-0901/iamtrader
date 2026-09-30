import React from 'react';
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
  Award
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onEnterGuestDemo: () => void;
}

export function LandingPage({ onOpenAuth, onEnterGuestDemo }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-500/20 selection:text-blue-300">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-50 bg-white/90 backdrop-blur-md">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            IAM<span className="text-blue-500">TRADER</span>
          </span>
        </div>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-500">
          <a href="#features" className="hover:text-slate-900 transition-colors">Plateforme</a>
          <a href="#journal" className="hover:text-slate-900 transition-colors">Journal & Analytics</a>
          <a href="#trader-score" className="hover:text-slate-900 transition-colors">Trader Score</a>
          <a href="#pricing" className="hover:text-slate-900 transition-colors">Tarifs</a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenAuth('login')}
            className="text-xs font-semibold text-slate-400 hover:text-slate-900 px-3 py-1.5 transition-colors cursor-pointer"
          >
            Connexion
          </button>
          <button
            onClick={() => onOpenAuth('register')}
            className="btn-primary px-4 py-2 text-xs font-bold rounded-lg cursor-pointer"
          >
            Créer un compte
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 sm:px-12 pt-16 pb-20 max-w-5xl mx-auto w-full text-center flex flex-col items-center">
        {/* Subtle Tag */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-5">
          <span className="text-blue-400 font-mono font-semibold">Standard FTMO & Prop Firms</span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span>Analytique Financière & Journal de Trading</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-[1.18]">
          Centralisez vos comptes, auditez chaque position, validez vos challenges.
        </h1>

        <p className="mt-5 text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
          IAMTRADER est la station de commande analytique conçue pour les traders sérieux et les candidats aux allocations de capitaux. Suivez votre P&L réel, calculez votre Trader Score et identifiez vos biais opérationnels.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onOpenAuth('register')}
            className="btn-primary px-6 py-2.5 text-xs sm:text-sm font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <span>Démarrer l'essai gratuit</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onEnterGuestDemo}
            className="btn-secondary px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-lg cursor-pointer"
          >
            Explorer la démo interactive
          </button>
        </div>

        {/* Hero Interactive Terminal Mock Preview */}
        <div className="mt-12 w-full rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xl text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
              <span className="text-xs text-slate-500 font-mono ml-2">station.iamtrader.app / live</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Synchronisation Active
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase block mb-1">Portefeuille Global</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">$108,420.50</span>
            </div>
            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase block mb-1">P&L Réalisé</span>
              <span className="text-lg font-bold text-emerald-400 tabular-nums">+$8,420.50</span>
            </div>
            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase block mb-1">Win Rate</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">68.4%</span>
            </div>
            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase block mb-1">Trader Score</span>
              <span className="text-lg font-bold text-blue-400 tabular-nums">84 / 100</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars Section */}
      <section id="features" className="px-6 sm:px-12 py-16 border-t border-slate-200/80 max-w-5xl mx-auto w-full">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-xs font-mono uppercase text-blue-400 font-semibold tracking-wider">Architecture Complète</span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Conçu selon les standards Prop Firm</h2>
          <p className="text-xs text-slate-500 mt-1">Des outils conçus pour protéger votre capital et valider vos objectifs de profit.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl card-premium border-slate-200 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Journal Haute Précision</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Enregistrez vos entrées, sorties, setups, R:R et captures d'écran. Filtrez par session, instrument et timeframe.
            </p>
          </div>

          <div className="p-5 rounded-xl card-premium border-slate-200 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Trader Score Quantitatif</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Évaluation dynamique calculée sur 6 piliers : gestion du risque, discipline, consistance, exécution et maîtrise mentale.
            </p>
          </div>

          <div className="p-5 rounded-xl card-premium border-slate-200 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Matrice Psychologique</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Identifiez l'impact direct du FOMO, du revenge trading et de l'hésitation sur votre rentabilité nette.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 px-6 sm:px-12 py-8 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">IAMTRADER</span>
            <span>·</span>
            <span>Station de performance pour traders professionnels</span>
          </div>
          <div>
            <span>Données hébergées et sécurisées sur Google Cloud Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
