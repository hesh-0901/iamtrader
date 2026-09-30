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
          <section className="relative overflow-hidden rounded-3xl bg-[#0a192f] text-white p-6 sm:p-8 shadow-[0_18px_50px_rgba(10,25,47,0.12)]">
            <div className="absolute -right-24 -top-28 w-72 h-72 rounded-full bg-[#00c796]/15 blur-3xl" />
            <div className="relative grid lg:grid-cols-[1.4fr_0.8fr] gap-7 items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#5ce0c1] font-black">Votre compte</span>
                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px] font-semibold">{isStarter ? 'Starter' : userProfile?.plan?.toUpperCase()}</span>
                  {pendingUpgrade && <span className="px-2 py-1 rounded-full bg-amber-400/15 text-amber-200 text-[10px] font-semibold">Upgrade en attente</span>}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-3">{isStarter ? 'Vous êtes sur Starter' : `Plan ${userProfile?.plan}`}</h2>
                <p className="text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
                  {isStarter ? 'Commencez sans abonnement, avec les outils essentiels et une limite d’utilisation. Passez à Plus lorsque votre volume de trading augmente.' : 'Votre accès premium est actif. Retrouvez ici son statut, sa période et votre progression.'}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="rounded-xl bg-white/8 border border-white/10 px-4 py-3">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Activé le</div>
                    <div className="text-sm font-bold mt-1">{formatDate(activationDate)}</div>
                  </div>
                  <div className="rounded-xl bg-white/8 border border-white/10 px-4 py-3">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Statut</div>
                    <div className="text-sm font-bold mt-1 text-[#5ce0c1]">{userProfile?.subscriptionStatus === 'expired' ? 'Expiré' : 'Actif'}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white/8 border border-white/10 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Utilisation ce mois</span>
                  <span className="text-sm font-black">{monthlyTrades}/{isStarter ? starterLimit : '∞'} trades</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-[#5ce0c1] transition-all" style={{ width: `${isStarter ? Math.min(100, (monthlyTrades / starterLimit) * 100) : 18}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-3">{isStarter ? `${Math.max(0, starterLimit - monthlyTrades)} trade(s) restant(s) ce mois-ci` : 'Trades illimités avec votre plan.'}</p>
              </div>
            </div>
          </section>

          <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
            <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <div><h3 className="font-bold text-slate-900">Votre accès</h3><p className="text-xs text-slate-500 mt-1">Une vue claire de votre période d’activation.</p></div>
                <CalendarDays className="w-5 h-5 text-[#00a982]" />
              </div>
              <div className="space-y-5">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center"><span className="w-3 h-3 rounded-full bg-[#00c796] ring-4 ring-[#e5faf5]" /><span className="w-px h-12 bg-slate-200" /></div>
                  <div><div className="text-xs font-bold text-slate-900">Activation du compte</div><div className="text-xs text-slate-500 mt-1">{formatDate(activationDate)}</div><div className="text-[11px] text-slate-400 mt-1">Votre accès IAMTRADER a commencé.</div></div>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center"><span className="w-3 h-3 rounded-full bg-[#2f6bff] ring-4 ring-[#edf3ff]" />{!isStarter && <span className="w-px h-12 bg-slate-200" />}</div>
                  <div><div className="text-xs font-bold text-slate-900">{isStarter ? 'Accès Starter' : 'Fin de la période actuelle'}</div><div className="text-xs text-slate-500 mt-1">{isStarter ? 'Sans échéance' : formatDate(userProfile?.subscriptionExpiresAt)}</div><div className="text-[11px] text-slate-400 mt-1">{isStarter ? 'Votre plan reste actif tant que vous respectez ses limites.' : `${daysRemaining ?? 0} jour(s) restant(s)`}</div></div>
                </div>
                {!isStarter && (
                  <div className="rounded-xl bg-[#f6f9fc] border border-slate-200 p-4 flex items-center justify-between">
                    <div><div className="text-[10px] uppercase tracking-wider text-slate-500">Temps restant</div><div className="text-2xl font-black text-slate-900 mt-1">{daysRemaining ?? 0} <span className="text-xs font-semibold text-slate-500">jours</span></div></div>
                    <Clock3 className="w-7 h-7 text-[#2f6bff]" />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
              <div className="flex items-center gap-2"><WalletCards className="w-5 h-5 text-[#00a982]" /><h3 className="font-bold text-slate-900">Compte de trading actif</h3></div>
              {currentAccount ? (
                <div className="mt-5 rounded-2xl border border-[#dce7e3] bg-[#f8fbfd] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><span className="text-[10px] uppercase tracking-wider font-bold text-[#168c73]">{currentAccount.type}</span><h4 className="text-lg font-black mt-1">{currentAccount.name}</h4><p className="text-xs text-slate-500 mt-1">{currentAccount.broker} · {currentAccount.currency}</p></div>
                    <span className="px-2 py-1 rounded-full bg-[#e5faf5] text-[#168c73] text-[10px] font-bold">{currentAccount.status}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white border border-slate-200 p-3"><div className="text-[10px] text-slate-500">Solde actuel</div><div className="text-base font-black mt-1">{formatCurrency(currentAccount.currentBalance, currentAccount.currency)}</div></div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3"><div className="text-[10px] text-slate-500">Capital initial</div><div className="text-base font-black mt-1">{formatCurrency(currentAccount.initialBalance, currentAccount.currency)}</div></div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs"><span className="text-slate-500">Compte sélectionné dans la station</span><Activity className="w-4 h-4 text-[#00a982]" /></div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center"><WalletCards className="w-7 h-7 text-slate-400 mx-auto" /><p className="text-sm font-semibold mt-3">Aucun compte de trading</p><p className="text-xs text-slate-500 mt-1">Créez votre premier compte pour commencer à journaliser.</p></div>
              )}
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#00a982]" /><h3 className="font-bold">Passez à Plus</h3></div>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">Débloquez les trades illimités et les analyses avancées pour ne plus être freiné par la limite Starter.</p>
              <div className="mt-4 flex items-center justify-between"><div><span className="text-2xl font-black">$9.99</span><span className="text-xs text-slate-500"> / mois</span></div><button onClick={() => onRequestPlan('pro')} disabled={pendingUpgrade === 'pro'} className="px-4 py-2.5 rounded-xl bg-[#00a982] text-white text-xs font-bold hover:bg-[#008f70] disabled:opacity-60 cursor-pointer">{pendingUpgrade === 'pro' ? 'Demande envoyée' : 'Demander Plus'} <ArrowRight className="inline w-3.5 h-3.5 ml-1" /></button></div>
            </div>
            <div className="rounded-2xl bg-[#0a192f] text-white p-5">
              <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#5ce0c1]" /><h3 className="font-bold">Community — 6 mois</h3></div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">Outils IAMTRADER, formations vidéo, cours PDF, communauté d’analystes et accompagnement pendant 6 mois.</p>
              <div className="mt-4 flex items-center justify-between"><div><span className="text-2xl font-black">$89.99</span><span className="text-xs text-slate-400"> / 6 mois</span></div><button onClick={() => onRequestPlan('community')} disabled={pendingUpgrade === 'community'} className="px-4 py-2.5 rounded-xl bg-white text-[#0a192f] text-xs font-bold hover:bg-slate-100 disabled:opacity-60 cursor-pointer">{pendingUpgrade === 'community' ? 'Demande envoyée' : 'Rejoindre Community'} <ChevronRight className="inline w-3.5 h-3.5 ml-1" /></button></div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ccefe5] bg-[#eafbf6] p-5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#00a982] mt-0.5" />
            <div><div className="text-sm font-bold text-[#0a192f]">Pourquoi upgrader ?</div><p className="text-xs text-[#60758d] mt-1 leading-relaxed">Starter vous permet de découvrir IAMTRADER. Plus retire la limite de volume. Community ajoute une dimension d’apprentissage et d’accompagnement.</p></div>
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
