import React, { useState } from 'react';
import { UserProfile, SubscriptionPlan } from '../types';
import { PlanBadge } from '../components/common/Badge';
import { 
  User, 
  Shield, 
  CreditCard, 
  Sliders, 
  Lock, 
  Mail, 
  Check, 
  Zap,
  Globe,
  Bell
} from 'lucide-react';
import { resetUserPassword } from '../services/auth';
import { useToast } from '../components/common/Toast';

interface SettingsViewProps {
  userProfile: UserProfile | null;
  onUpdatePlan: (plan: SubscriptionPlan) => void;
}

export function SettingsView({ userProfile, onUpdatePlan }: SettingsViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'security' | 'preferences'>('profile');
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [theme, setTheme] = useState<'light'>('light');
  const [dashboardMode, setDashboardMode] = useState<'standard' | 'focus' | 'analysis' | 'compact'>(() => (localStorage.getItem('iamtrader-dashboard-mode') as any) || 'standard');
  const changeDashboardMode = (mode: 'standard' | 'focus' | 'analysis' | 'compact') => { setDashboardMode(mode); localStorage.setItem('iamtrader-dashboard-mode', mode); };

  const handlePasswordReset = async () => {
    if (!userProfile?.email) return;
    try {
      await resetUserPassword(userProfile.email);
      showToast('E-mail de réinitialisation de mot de passe envoyé avec succès', 'success');
    } catch (err: any) {
      showToast(`Erreur: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
            Configuration Station
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Paramètres & Compte
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Gérez votre profil trader, vos préférences de risque et votre abonnement IAMTRADER Pro.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'profile' 
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profil Trader</span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'subscription' 
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Abonnement & Formules</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'security' 
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Sécurité & Accès</span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'preferences' 
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Préférences Interface</span>
        </button>
      </div>

      {/* Tab: Profile */}
      {activeTab === 'profile' && (
        <div className="p-5 rounded-xl card-premium space-y-5 text-xs text-slate-400">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Informations Personnelles</h3>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-lg font-bold text-blue-400">
              {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'H'}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm tracking-tight">{userProfile?.displayName || 'Hénoch'}</div>
              <div className="text-slate-500 font-mono text-xs mt-0.5">{userProfile?.email}</div>
              <div className="mt-1 flex items-center gap-2">
                <PlanBadge plan={userProfile?.plan || 'pro'} />
                <span className="text-[10px] text-slate-500 font-mono">ID: {userProfile?.uid?.slice(0, 10)}...</span>
              </div>
            </div>
          </div>

          <div className="space-y-3.5 pt-3.5 border-t border-slate-200 max-w-md">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Nom d'affichage
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre nom"
                className="w-full bg-white border border-slate-200 hover:border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Adresse e-mail
              </label>
              <input
                type="email"
                disabled
                value={userProfile?.email || ''}
                className="w-full bg-white/60 border border-slate-200/80 rounded-lg px-3 py-2 text-xs text-slate-500 cursor-not-allowed font-mono"
              />
            </div>

            <button
              onClick={() => showToast('Profil mis à jour avec succès', 'success')}
              className="btn-primary px-4 py-2 rounded-lg text-xs cursor-pointer font-semibold"
            >
              Enregistrer les modifications
            </button>
          </div>
        </div>
      )}

      {/* Tab: Subscription */}
      {activeTab === 'subscription' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free Plan */}
            <div className={`p-5 rounded-xl card-premium flex flex-col justify-between space-y-4 ${
              userProfile?.plan === 'free' ? 'border-blue-500 ring-1 ring-blue-500/30' : ''
            }`}>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Starter
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-2">Free</h4>
                <div className="text-2xl font-bold text-slate-900 mt-1.5 font-mono">
                  0€ <span className="text-xs text-slate-500 font-sans font-normal">/ mois</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Pour tester le journal avec les fonctionnalités de base.
                </p>

                <ul className="mt-4 space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Jusqu'à 50 trades / mois</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>1 compte de trading</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500">
                    <span>Trader Score basique</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onUpdatePlan('free')}
                disabled={userProfile?.plan === 'free'}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  userProfile?.plan === 'free' 
                    ? 'bg-slate-100 text-slate-500 cursor-default' 
                    : 'btn-secondary'
                }`}
              >
                {userProfile?.plan === 'free' ? 'Formule Actuelle' : 'Choisir Free'}
              </button>
            </div>

            {/* Pro Plan */}
            <div className={`p-5 rounded-xl card-premium flex flex-col justify-between space-y-4 relative border-blue-500/50 bg-blue-600/[0.04] ${
              userProfile?.plan === 'pro' ? 'ring-1 ring-blue-500' : ''
            }`}>
              <div className="absolute top-3 right-3">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded">
                  Recommandé
                </span>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                  Standard Prop
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-2">IAMTRADER Pro</h4>
                <div className="text-2xl font-bold text-blue-400 mt-1.5 font-mono">
                  29€ <span className="text-xs text-slate-500 font-sans font-normal">/ mois</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  L'arsenal complet pour réussir vos challenges Prop Firm.
                </p>

                <ul className="mt-4 space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Trades illimités</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Multi-comptes Prop Firm illimités</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Trader Score 6 Piliers Live</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Matrice Psychologique & Biais</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onUpdatePlan('pro')}
                disabled={userProfile?.plan === 'pro'}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  userProfile?.plan === 'pro'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 cursor-default'
                    : 'btn-primary'
                }`}
              >
                {userProfile?.plan === 'pro' ? 'Formule Actuelle' : 'Passer à Pro'}
              </button>
            </div>

            {/* Community Plan */}
            <div className={`p-5 rounded-xl card-premium flex flex-col justify-between space-y-4 ${
              userProfile?.plan === 'community' ? 'border-blue-500 ring-1 ring-blue-500/30' : ''
            }`}>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Desk & Mentors
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-2">Community & Desk</h4>
                <div className="text-2xl font-bold text-slate-900 mt-1.5 font-mono">
                  79€ <span className="text-xs text-slate-500 font-sans font-normal">/ mois</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Pour les desks de trading, formateurs et équipes.
                </p>

                <ul className="mt-4 space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Tout ce qui est inclus dans Pro</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Partage certifié de journal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Audit de risque et support dédié</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onUpdatePlan('community')}
                disabled={userProfile?.plan === 'community'}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  userProfile?.plan === 'community'
                    ? 'bg-slate-100 text-slate-500 cursor-default'
                    : 'btn-secondary'
                }`}
              >
                {userProfile?.plan === 'community' ? 'Formule Actuelle' : 'Choisir Community'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <div className="p-5 rounded-xl card-premium space-y-5 text-xs text-slate-400">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Sécurité du Compte & Mot de Passe</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Gestion de vos identifiants Firebase Authentication et sessions
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-3 max-w-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-blue-400" />
              <div>
                <span className="font-semibold text-slate-900 text-xs block">Réinitialisation du mot de passe</span>
                <span className="text-[11px] text-slate-500">Un lien sécurisé sera transmis à {userProfile?.email}</span>
              </div>
            </div>
            <button
              onClick={handlePasswordReset}
              className="btn-secondary px-3.5 py-1.5 rounded-lg text-xs cursor-pointer font-medium"
            >
              Envoyer l'e-mail de réinitialisation
            </button>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-1.5 max-w-lg">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="font-semibold text-slate-900 text-xs block">Chiffrement & Sécurité des Données</span>
                <span className="text-[11px] text-slate-500">Vos transactions financières sont isolées dans votre partition Firestore privée.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Preferences */}
      {activeTab === 'preferences' && (
        <div className="p-5 rounded-xl card-premium space-y-5 text-xs text-slate-400">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Préférences d'Affichage</h3>
            <p className="text-slate-500 text-xs mt-0.5">Personnalisez votre affichage sur la station</p>
          </div>

          <div className="space-y-3.5 max-w-md">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Devise Principale
              </label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full bg-white border border-slate-200 hover:border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none cursor-pointer transition-colors"
              >
                <option value="USD">USD ($) — Dollar Américain</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — Livre Sterling</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Thème Visuel
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full bg-white border border-slate-200 hover:border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none cursor-pointer transition-colors"
              >
                <option value="light">IAMTRADER Light Cockpit</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Affichage du Dashboard</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([['standard','Standard','Vue complète'],['focus','Focus Trading','Décisions rapides'],['analysis','Analyse','Lecture détaillée'],['compact','Compacte','Densité maximale']] as const).map(([value,label,desc]) => (
                  <button type="button" key={value} onClick={() => changeDashboardMode(value)} className={`p-3 rounded-xl border text-left transition-all ${dashboardMode === value ? 'border-[#00C796] bg-[#DFFBF3] text-[#007F60]' : 'border-[#DCE5EC] bg-white text-[#60758D] hover:border-[#BFD3FF]'}`}>
                    <span className="block text-xs font-bold">{label}</span><span className="block text-[10px] mt-1 opacity-75">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => showToast('Préférences enregistrées avec succès', 'success')}
              className="btn-primary px-4 py-2 rounded-lg text-xs cursor-pointer font-semibold"
            >
              Sauvegarder les préférences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
