import React, { useMemo, useState } from 'react';
import { UserProfile, SubscriptionPlan, TradingAccount, Trade } from '../types';
import { PlanBadge } from '../components/common/Badge';
import {
  User, Shield, CreditCard, Sliders, Lock, Mail, Check, ArrowRight,
  Activity, CalendarDays, Clock3, WalletCards, Sparkles, ChevronRight
} from 'lucide-react';
import { resetUserPassword } from '../services/auth';
import { useToast } from '../components/common/Toast';
import { TradingJournalSettings } from '../components/settings/TradingJournalSettings';
import { formatCurrency } from '../utils/calculations';

interface SettingsViewProps {
  userProfile: UserProfile | null;
  accounts: TradingAccount[];
  trades: Trade[];
  selectedAccountId: string;
  onRequestPlan: (plan: 'pro' | 'community') => void;
}

const starterLimit = 50;

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function daysBetween(from?: string, to?: string) {
  if (!from || !to) return null;
  return Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
}

export function SettingsView({ userProfile, accounts, trades, selectedAccountId, onRequestPlan }: SettingsViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'security' | 'preferences' | 'journal'>('subscription');
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [defaultCurrency, setDefaultCurrency] = useState(userProfile?.settings?.defaultCurrency || 'USD');
  const [theme, setTheme] = useState<'light'>('light');
  const [dashboardMode, setDashboardMode] = useState<'standard' | 'focus' | 'analysis' | 'compact'>(() => (localStorage.getItem('iamtrader-dashboard-mode') as any) || 'standard');

  const currentAccount = useMemo(() => {
    if (selectedAccountId && selectedAccountId !== 'all') return accounts.find(a => a.id === selectedAccountId) || accounts[0];
    return accounts[0];
  }, [accounts, selectedAccountId]);

  const monthlyTrades = useMemo(() => {
    const now = new Date();
    return trades.filter(t => {
      const d = new Date(t.entryDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [trades]);

  const activationDate = userProfile?.subscriptionStartAt || userProfile?.createdAt;
  const daysRemaining = daysBetween(new Date().toISOString(), userProfile?.subscriptionExpiresAt);
  const isStarter = userProfile?.plan === 'free';
  const pendingUpgrade = userProfile?.pendingPlan;

  const changeDashboardMode = (mode: 'standard' | 'focus' | 'analysis' | 'compact') => {
    setDashboardMode(mode);
    localStorage.setItem('iamtrader-dashboard-mode', mode);
  };

  const handlePasswordReset = async () => {
    if (!userProfile?.email) return;
    try {
      await resetUserPassword(userProfile.email);
      showToast('E-mail de réinitialisation envoyé avec succès', 'success');
    } catch (err: any) {
      showToast(`Erreur: ${err.message}`, 'error');
    }
  };

  const tabs = [
    ['profile', 'Profil Trader', User],
    ['subscription', 'Compte & Abonnement', CreditCard],
    ['security', 'Sécurité & Accès', Lock],
    ['preferences', 'Préférences Interface', Sliders],
    ['journal', 'Journal & Calculs', Activity],
  ] as const;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="pb-3 border-b border-slate-200/80">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#168c73] bg-[#e5faf5] border border-[#ccefe5] px-2 py-0.5 rounded font-semibold">Configuration Station</span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">Paramètres & Compte</h1>
        <p className="text-xs text-slate-500 mt-0.5">Votre espace de compte, abonnement, sécurité et configuration de trading.</p>
      </div>

      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto text-xs font-medium">
        {tabs.map(([value, label, Icon]) => (
          <button key={value} onClick={() => setActiveTab(value)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap cursor-pointer transition-all ${activeTab === value ? 'bg-[#e5faf5] text-[#007f60] font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {activeTab === 'subscription' && (
        <div className="space-y-5">
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Abonnement</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#edf9f5] text-[#14866f] text-[10px] font-semibold">Actif</span>
                </div>
                <div className="flex items-end gap-3">
                  <h2 className="text-xl font-bold text-slate-900">{isStarter ? 'Starter' : userProfile?.plan === 'pro' ? 'Plus' : 'Community'}</h2>
                  <span className="text-xs text-slate-400 mb-1">Votre plan actuel</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 max-w-xl">Les informations essentielles de votre accès sont regroupées ici, sans éléments inutiles.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 min-w-[280px]">
                <div className="rounded-xl bg-[#f7fafb] border border-slate-200 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Activé le</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{formatDate(activationDate)}</div>
                </div>
                <div className="rounded-xl bg-[#f7fafb] border border-slate-200 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">État</div>
                  <div className="text-sm font-semibold text-[#14866f] mt-1">Actif</div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5">
            <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div><h3 className="text-sm font-bold text-slate-900">Votre période d’accès</h3><p className="text-xs text-slate-500 mt-1">Une lecture simple de votre abonnement.</p></div>
                <Clock3 className="w-4 h-4 text-slate-400" />
              </div>
              {isStarter ? (
                <div className="mt-6 flex items-center gap-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#55bda5] ring-4 ring-[#edf9f5]" />
                  <div><div className="text-xs font-semibold text-slate-800">Accès Starter actif</div><div className="text-xs text-slate-500 mt-1">Sans date d’expiration. Vos limites Starter s’appliquent.</div></div>
                </div>
              ) : (
                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs mb-2"><span className="text-slate-500">{formatDate(activationDate)}</span><span className="text-slate-500">{formatDate(userProfile?.subscriptionExpiresAt)}</span></div>
                  <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-[#6e9fe8]" style={{width: `${Math.max(4, Math.min(100, ((daysRemaining || 0) / 30) * 100))}%`}} /></div>
                  <div className="flex items-center justify-between mt-3"><span className="text-xs text-slate-500">Temps restant</span><span className="text-sm font-bold text-slate-900">{daysRemaining ?? 0} jours</span></div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div><h3 className="text-sm font-bold text-slate-900">Compte actif</h3><p className="text-xs text-slate-500 mt-1">Le compte utilisé actuellement.</p></div>
                <WalletCards className="w-4 h-4 text-slate-400" />
              </div>
              {currentAccount ? (
                <div className="mt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><h4 className="text-base font-bold text-slate-900">{currentAccount.name}</h4><p className="text-xs text-slate-500 mt-1">{currentAccount.broker} · {currentAccount.currency}</p></div>
                    <span className="text-[10px] font-semibold text-[#14866f] bg-[#edf9f5] px-2 py-1 rounded-full">{currentAccount.type}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[#f8fafb] p-3"><div className="text-[10px] text-slate-400">Solde</div><div className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(currentAccount.currentBalance, currentAccount.currency)}</div></div>
                    <div className="rounded-xl bg-[#f8fafb] p-3"><div className="text-[10px] text-slate-400">Capital initial</div><div className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(currentAccount.initialBalance, currentAccount.currency)}</div></div>
                  </div>
                </div>
              ) : <div className="mt-5 text-xs text-slate-500">Aucun compte de trading sélectionné.</div>}
            </div>
          </section>

          {isStarter && (
            <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Starter</div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">Votre utilisation</h3>
                  <p className="text-xs text-slate-500 mt-1">Vous disposez de {Math.max(0, starterLimit - monthlyTrades)} trades restants ce mois-ci.</p>
                </div>
                <div className="w-full md:w-72">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-2"><span>{monthlyTrades} utilisés</span><span>{starterLimit} au total</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#9dbeb5]" style={{width: `${Math.min(100, monthlyTrades / starterLimit * 100)}%`}} /></div>
                </div>
              </div>
            </section>
          )}

          <section className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Upgrade</div>
              <h3 className="text-base font-bold text-slate-900 mt-1">Plus</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">Pour trader sans la limite Starter et accéder aux analyses avancées.</p>
              <div className="flex items-center justify-between mt-5"><span className="text-sm font-bold text-slate-900">$9.99 <span className="text-[10px] font-normal text-slate-400">/ mois</span></span><button onClick={() => onRequestPlan('pro')} disabled={pendingUpgrade === 'pro'} className="px-3.5 py-2 rounded-lg bg-[#173b59] text-white text-xs font-semibold hover:bg-[#123149] disabled:opacity-50 cursor-pointer">{pendingUpgrade === 'pro' ? 'Demande envoyée' : 'Passer à Plus'} <ArrowRight className="inline w-3.5 h-3.5 ml-1" /></button></div>
            </div>
            <div className="rounded-2xl bg-[#f7fafb] border border-slate-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Programme</div>
              <h3 className="text-base font-bold text-slate-900 mt-1">Community · 6 mois</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">Outils, formations, cours et accompagnement pendant 6 mois.</p>
              <div className="flex items-center justify-between mt-5"><span className="text-sm font-bold text-slate-900">$89.99 <span className="text-[10px] font-normal text-slate-400">/ 6 mois</span></span><button onClick={() => onRequestPlan('community')} disabled={pendingUpgrade === 'community'} className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">{pendingUpgrade === 'community' ? 'Demande envoyée' : 'Découvrir Community'} <ChevronRight className="inline w-3.5 h-3.5 ml-1" /></button></div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#e5faf5] border border-[#ccefe5] flex items-center justify-center text-lg font-black text-[#007f60]">{userProfile?.displayName?.charAt(0).toUpperCase() || 'T'}</div>
            <div><div className="font-bold text-slate-900">{userProfile?.displayName || 'Trader'}</div><div className="text-xs text-slate-500 mt-1">{userProfile?.email}</div><div className="mt-2"><PlanBadge plan={userProfile?.plan || 'free'} /></div></div>
          </div>
          <div className="max-w-md pt-4 border-t border-slate-200 space-y-4">
            <div><label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Nom d'affichage</label><input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#00a982]" /></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Adresse e-mail</label><input disabled value={userProfile?.email || ''} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono" /></div>
            <button onClick={() => showToast('Profil mis à jour avec succès', 'success')} className="px-4 py-2 rounded-lg bg-[#0a192f] text-white text-xs font-semibold cursor-pointer">Enregistrer les modifications</button>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-5">
          <div><h3 className="font-bold text-slate-900">Sécurité du compte</h3><p className="text-xs text-slate-500 mt-1">Gérez votre accès et votre mot de passe.</p></div>
          <div className="p-4 rounded-xl bg-[#f8fbfd] border border-slate-200 max-w-lg"><div className="flex items-center gap-3"><Mail className="w-4 h-4 text-[#2f6bff]" /><div><span className="font-semibold text-slate-900 text-xs block">Réinitialisation du mot de passe</span><span className="text-[11px] text-slate-500">Un lien sécurisé sera transmis à {userProfile?.email}</span></div></div><button onClick={handlePasswordReset} className="mt-4 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold cursor-pointer">Envoyer l'e-mail</button></div>
          <div className="p-4 rounded-xl bg-[#f8fbfd] border border-slate-200 max-w-lg flex gap-3"><Shield className="w-4 h-4 text-[#00a982] mt-0.5" /><div><span className="font-semibold text-slate-900 text-xs block">Données privées</span><span className="text-[11px] text-slate-500">Vos données de trading restent isolées dans votre espace Firestore.</span></div></div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-6">
          <div><h3 className="font-bold text-slate-900">Préférences d'affichage</h3><p className="text-xs text-slate-500 mt-1">Personnalisez votre station IAMTRADER.</p></div>
          <div className="max-w-2xl space-y-5">
            <div><label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Devise principale</label><select value={defaultCurrency} onChange={e => setDefaultCurrency(e.target.value as any)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option></select></div>
            <div><label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Affichage du Dashboard</label><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{([['standard','Standard','Vue complète'],['focus','Focus Trading','Décisions rapides'],['analysis','Analyse','Lecture détaillée'],['compact','Compacte','Densité maximale']] as const).map(([value,label,desc]) => <button type="button" key={value} onClick={() => changeDashboardMode(value)} className={`p-3 rounded-xl border text-left ${dashboardMode === value ? 'border-[#00C796] bg-[#DFFBF3] text-[#007F60]' : 'border-[#DCE5EC] bg-white text-[#60758D]'}`}><span className="block text-xs font-bold">{label}</span><span className="block text-[10px] mt-1 opacity-75">{desc}</span></button>)}</div></div>
            <button onClick={() => showToast('Préférences enregistrées avec succès', 'success')} className="px-4 py-2 rounded-lg bg-[#0a192f] text-white text-xs font-semibold cursor-pointer">Sauvegarder les préférences</button>
          </div>
        </div>
      )}

      {activeTab === 'journal' && <TradingJournalSettings userProfile={userProfile} />}
    </div>
  );
}
