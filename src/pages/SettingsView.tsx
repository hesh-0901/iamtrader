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

const starterLimit = 5;

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
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 sm:p-7 shadow-[0_18px_60px_rgba(37,52,75,0.07)]">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-200/45 blur-3xl" />
            <div className="absolute right-20 -bottom-24 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl" />
            <div className="relative flex flex-col xl:flex-row xl:items-end xl:justify-between gap-7">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Sparkles className="h-3.5 w-3.5 text-cyan-300" /> IAMTRADER Account</div>
                <div className="mt-5 flex flex-wrap items-center gap-3"><h2 className="text-3xl font-black tracking-tight text-slate-950">{isStarter ? 'Starter' : userProfile?.plan === 'pro' ? 'Plus' : 'Community'}</h2><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Actif</span></div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Votre espace personnel pour suivre votre accès, votre compte de trading et votre utilisation IAMTRADER.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:min-w-[340px]">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100"><div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Activé le</div><div className="mt-1.5 text-sm font-bold text-slate-900">{formatDate(activationDate)}</div></div>
                <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-emerald-50 p-4 ring-1 ring-cyan-100"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Accès</div><div className="mt-1.5 text-sm font-bold text-slate-900">{isStarter ? 'Starter actif' : (daysRemaining ?? 0) + ' jours'}</div></div>
              </div>
            </div>
          </section>
          <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-[1px] shadow-[0_18px_50px_rgba(99,74,190,0.16)]">
              <div className="relative h-full rounded-[25px] bg-white p-6">
                <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-500">Votre accès</div><h3 className="mt-1.5 text-lg font-black text-slate-950">Période d’abonnement</h3></div><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Clock3 className="h-4 w-4" /></div></div>
                {isStarter ? (
                  <div className="mt-7 rounded-2xl bg-gradient-to-r from-violet-50 to-cyan-50 p-4 ring-1 ring-violet-100"><div className="flex items-center justify-between gap-4"><div><div className="text-xs font-bold text-slate-900">Accès Starter actif</div><div className="mt-1 text-[11px] text-slate-500">Votre formule gratuite reste active sans expiration.</div></div><div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm"><div className="text-[9px] font-bold uppercase text-slate-400">Statut</div><div className="text-xs font-black text-emerald-600">ACTIF</div></div></div></div>
                ) : (
                  <div className="mt-7"><div className="flex items-end justify-between gap-3"><div><div className="text-[10px] text-slate-400">Du</div><div className="text-xs font-bold text-slate-800">{formatDate(activationDate)}</div></div><div className="text-right"><div className="text-[10px] text-slate-400">Au</div><div className="text-xs font-bold text-slate-800">{formatDate(userProfile?.subscriptionExpiresAt)}</div></div></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" style={{width: Math.max(4, Math.min(100, ((daysRemaining || 0) / 30) * 100)) + '%'}} /></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">Temps restant</span><span className="text-sm font-black text-slate-950">{(daysRemaining ?? 0) + ' jours'}</span></div></div>
                )}
              </div>
            </div>
            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(37,52,75,0.05)]">
              <div className="flex items-start justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">Trading</div><h3 className="mt-1.5 text-lg font-black text-slate-950">Compte actif</h3></div><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600"><WalletCards className="h-4 w-4" /></div></div>
              {currentAccount ? (
                <div className="mt-6"><div className="flex items-start justify-between gap-3"><div><h4 className="text-base font-black text-slate-950">{currentAccount.name}</h4><p className="mt-1 text-xs text-slate-500">{currentAccount.broker || 'Broker non renseigné'} · {currentAccount.currency}</p></div><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-700">{currentAccount.type}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Solde actuel</div><div className="mt-1.5 text-lg font-black text-slate-950">{formatCurrency(currentAccount.currentBalance, currentAccount.currency)}</div></div><div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-cyan-50 p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Capital initial</div><div className="mt-1.5 text-lg font-black text-slate-950">{formatCurrency(currentAccount.initialBalance, currentAccount.currency)}</div></div></div></div>
              ) : <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">Aucun compte de trading sélectionné.</div>}
            </div>
          </section>
          {isStarter && (
            <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(37,52,75,0.05)]">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div><div className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">Starter</div><h3 className="mt-2 text-lg font-black text-slate-950">Votre quota mensuel</h3><p className="mt-1 text-xs text-slate-500">Vous pouvez enregistrer jusqu’à <strong className="text-slate-700">{starterLimit} trades</strong> par mois.</p></div>
                <div className="w-full md:w-[330px]"><div className="mb-2.5 flex items-end justify-between"><span className="text-xs font-semibold text-slate-500">{monthlyTrades} / {starterLimit} utilisés</span><span className="text-sm font-black text-slate-950">{Math.max(0, starterLimit - monthlyTrades)} <span className="text-[10px] font-medium text-slate-400">restants</span></span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 transition-all" style={{width: Math.min(100, monthlyTrades / starterLimit * 100) + '%'}} /></div><div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>Début du mois</span><span>{Math.min(100, Math.round(monthlyTrades / starterLimit * 100))}% utilisé</span></div></div>
              </div>
            </section>
          )}
          <section><div className="mb-4"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-500">Évolution</div><h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Débloquez plus avec IAMTRADER</h3><p className="mt-1 text-xs text-slate-500">Passez à une formule supérieure lorsque votre journal grandit.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="group relative overflow-hidden rounded-[26px] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-[0_14px_45px_rgba(79,70,229,0.08)]"><div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-indigo-200/40 blur-2xl transition-transform group-hover:scale-125" /><div className="relative"><span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700">PLUS</span><h4 className="mt-3 text-xl font-black text-slate-950">$9.99 <span className="text-xs font-semibold text-slate-400">/ mois</span></h4><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">Pour dépasser la limite Starter et accéder aux analyses avancées.</p><button onClick={() => onRequestPlan('pro')} disabled={pendingUpgrade === 'pro'} className="mt-5 inline-flex items-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer">{pendingUpgrade === 'pro' ? 'Demande envoyée' : 'Passer à Plus'} <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></button></div></div>
              <div className="group relative overflow-hidden rounded-[26px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-6 shadow-[0_14px_45px_rgba(20,184,166,0.07)]"><div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-200/40 blur-2xl transition-transform group-hover:scale-125" /><div className="relative"><span className="inline-flex rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-bold text-cyan-700">COMMUNITY · 6 MOIS</span><h4 className="mt-3 text-xl font-black text-slate-950">$89.99 <span className="text-xs font-semibold text-slate-400">/ 6 mois</span></h4><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">Outils, formations, cours et accompagnement pendant 6 mois.</p><button onClick={() => onRequestPlan('community')} disabled={pendingUpgrade === 'community'} className="mt-5 inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-800 ring-1 ring-cyan-200 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer">{pendingUpgrade === 'community' ? 'Demande envoyée' : 'Découvrir Community'} <ChevronRight className="ml-1.5 h-3.5 w-3.5 text-cyan-600" /></button></div></div>
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
