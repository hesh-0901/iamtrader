import React, { useMemo, useState } from 'react';
import { UserProfile, SubscriptionPlan, TradingAccount, Trade } from '../types';
import { PlanBadge } from '../components/common/Badge';
import {
  User, Shield, CreditCard, Sliders, Lock, Mail, Check, ArrowRight,
  Activity, CalendarDays, Clock3, WalletCards, Sparkles, ChevronRight, Phone, X
} from 'lucide-react';
import { resetUserPassword } from '../services/auth';
import { useToast } from '../components/common/Toast';
import { TradingJournalSettings } from '../components/settings/TradingJournalSettings';
import { formatCurrency } from '../utils/calculations';
import { createPayment, getPaymentStatus, PaidPlan } from '../services/payments';

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
  const [paymentPlan, setPaymentPlan] = useState<PaidPlan | null>(null);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'paid' | 'failed'>('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

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

  const startPayment = (plan: PaidPlan) => { setPaymentPlan(plan); setPaymentPhone(''); setPaymentId(null); setPaymentStatus('idle'); setPaymentMessage(''); };

  const submitPayment = async () => {
    if (!paymentPlan) return;
    setIsPaymentLoading(true); setPaymentMessage('');
    try { const payment = await createPayment(paymentPlan, paymentPhone); setPaymentId(payment.id); setPaymentStatus('processing'); setPaymentMessage(payment.message || 'Validez la demande sur votre téléphone.'); }
    catch (error: any) { setPaymentStatus('failed'); setPaymentMessage(error?.message || 'Impossible d’initier le paiement.'); }
    finally { setIsPaymentLoading(false); }
  };

  React.useEffect(() => {
    if (!paymentId || paymentStatus !== 'processing') return;
    let cancelled = false; let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const payment = await getPaymentStatus(paymentId);
        if (cancelled) return;
        if (payment.status === 'paid') { setPaymentStatus('paid'); setPaymentMessage('Paiement confirmé. Votre formule va être activée.'); window.clearInterval(timer); window.setTimeout(() => window.location.reload(), 1200); }
        else if (payment.status === 'failed') { setPaymentStatus('failed'); setPaymentMessage('Le paiement a été refusé ou annulé.'); window.clearInterval(timer); }
        else if (attempts >= 40) { setPaymentMessage('Le paiement est toujours en cours. Revenez vérifier votre abonnement plus tard.'); window.clearInterval(timer); }
      } catch { if (attempts >= 40) window.clearInterval(timer); }
    }, 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [paymentId, paymentStatus]);

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
    <div className="w-full max-w-6xl min-w-0 space-y-6 overflow-x-hidden">
      <div className="pb-3 border-b border-slate-200/80">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#168c73] bg-[#e5faf5] border border-[#ccefe5] px-2 py-0.5 rounded font-semibold">Configuration Station</span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">Paramètres & Compte</h1>
        <p className="text-xs text-slate-500 mt-0.5">Votre espace de compte, abonnement, sécurité et configuration de trading.</p>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 text-xs font-medium">
        {tabs.map(([value, label, Icon]) => (
          <button key={value} onClick={() => setActiveTab(value)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap cursor-pointer transition-all ${activeTab === value ? 'bg-[#e5faf5] text-[#007f60] font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {activeTab === 'subscription' && (
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_55px_rgba(15,23,42,0.07)]">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_85%_10%,rgba(124,92,252,.12),transparent_30%),radial-gradient(circle_at_10%_100%,rgba(8,183,122,.09),transparent_32%)]" />
            <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white">Compte & abonnement</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Compte actif</span>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <h2 className="text-[32px] font-black tracking-tight text-slate-950">{isStarter ? 'Starter' : userProfile?.plan === 'pro' ? 'Plus' : 'Community'}</h2>
                  <span className="mb-1 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Plan actuel</span>
                </div>
                <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">Gérez votre formule, votre accès et votre utilisation depuis un seul espace.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-[140px] rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-indigo-600"><CalendarDays className="h-3 w-3" /> Activation</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{formatDate(activationDate)}</div>
                </div>
                <div className="min-w-[140px] rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700"><Clock3 className="h-3 w-3" /> Accès</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{isStarter ? 'Sans expiration' : (daysRemaining ?? 0) + ' jours'}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-500">Formule actuelle</span>
                  <h3 className="mt-1 text-lg font-black text-slate-950">Ce que votre plan vous donne</h3>
                  <p className="mt-1 text-xs text-slate-500">Une lecture simple de votre accès actuel.</p>
                </div>
                <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600"><Sparkles className="h-4 w-4" /></div>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-base font-black text-slate-950">{isStarter ? 'Starter' : userProfile?.plan === 'pro' ? 'Plus' : 'Community'}</div><div className="mt-1 text-[11px] text-slate-500">{isStarter ? 'Accès découverte avec quota mensuel.' : userProfile?.plan === 'pro' ? 'Accès avancé aux outils IAMTRADER.' : 'Accès communauté et accompagnement.'}</div></div>
                  <PlanBadge plan={userProfile?.plan || 'free'} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Trades</div><div className="mt-1 text-sm font-black text-slate-900">{isStarter ? monthlyTrades + ' / 5' : 'Sans limite'}</div></div>
                  <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Comptes</div><div className="mt-1 text-sm font-black text-slate-900">{isStarter ? Math.min(accounts.length, 1) + ' / 1' : accounts.length + ' actifs'}</div></div>
                  <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Statut</div><div className="mt-1 text-sm font-black text-emerald-600">Actif</div></div>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-600">Compte de trading</span><h3 className="mt-1 text-lg font-black text-slate-950">Compte sélectionné</h3><p className="mt-1 text-xs text-slate-500">Le compte utilisé actuellement dans la station.</p></div>
                <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-600"><WalletCards className="h-4 w-4" /></div>
              </div>
              {currentAccount ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                  <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-5 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="text-[9px] font-semibold uppercase tracking-wider text-white/65">Compte actif</div><div className="mt-1 truncate text-lg font-black">{currentAccount.name}</div><div className="mt-1 text-[11px] text-white/70">{currentAccount.broker || 'Broker non renseigné'} · {currentAccount.currency}</div></div>
                      <span className="shrink-0 rounded-full border border-white/20 bg-white/95 px-2.5 py-1 text-[9px] font-black uppercase text-indigo-950">{currentAccount.type}</span>
                    </div>
                    <div className="mt-6 text-2xl font-black">{formatCurrency(currentAccount.currentBalance, currentAccount.currency)}</div>
                    <div className="mt-1 text-[10px] text-white/65">Solde actuel</div>
                  </div>
                  <div className="grid grid-cols-2 divide-x border-t border-slate-200 bg-slate-50">
                    <div className="p-3.5"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Capital initial</div><div className="mt-1 text-sm font-black text-slate-950">{formatCurrency(currentAccount.initialBalance, currentAccount.currency)}</div></div>
                    <div className="p-3.5"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Devise</div><div className="mt-1 text-sm font-black text-slate-950">{currentAccount.currency}</div></div>
                  </div>
                </div>
              ) : <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">Aucun compte de trading sélectionné.</div>}
            </div>
          </section>

          {isStarter && (
            <section className="rounded-[26px] border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-emerald-50 p-6 shadow-[0_12px_45px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div><div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200"><Activity className="h-3 w-3" /> Utilisation Starter</div><h3 className="mt-2 text-lg font-black text-slate-950">Quota de trading mensuel</h3><p className="mt-1 text-xs text-slate-500">Votre utilisation actuelle et le nombre de trades encore disponibles.</p></div>
                <div className="w-full md:w-[360px]"><div className="flex items-end justify-between"><div><span className="text-2xl font-black text-slate-950">{monthlyTrades}</span><span className="text-xs font-semibold text-slate-400"> / 5 trades</span></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">{Math.max(0, 5 - monthlyTrades)} restant{Math.max(0, 5 - monthlyTrades) > 1 ? 's' : ''}</span></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400" style={{width: Math.min(100, monthlyTrades / starterLimit * 100) + '%'}} /></div></div>
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-500">Changer de formule</span><h3 className="mt-1 text-lg font-black text-slate-950">Choisissez votre niveau d’accès</h3><p className="mt-1 text-xs text-slate-500">Les options de paiement en ligne seront reliées ici.</p></div>
              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:inline-flex">Paiement sécurisé</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-[24px] border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-[0_10px_35px_rgba(79,70,229,0.07)]">
                <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[9px] font-bold text-indigo-700">PLUS</span><span className="text-lg font-black text-slate-950">$9.99<span className="text-[10px] font-semibold text-slate-500">/mois</span></span></div>
                <div className="mt-4 space-y-2 text-[11px] text-slate-600"><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-indigo-500" /> Trades sans quota mensuel</div><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-indigo-500" /> Analyses avancées</div><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-indigo-500" /> Plusieurs comptes de trading</div></div>
                <button onClick={() => startPayment('pro')} disabled={pendingUpgrade === 'pro'} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-300 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 cursor-pointer">{pendingUpgrade === 'pro' ? 'Demande envoyée' : 'Choisir Plus'}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></button>
              </div>
              <div className="relative overflow-hidden rounded-[24px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-5 shadow-[0_10px_35px_rgba(20,184,166,0.06)]">
                <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[9px] font-bold text-cyan-700">COMMUNITY · 6 MOIS</span><span className="text-lg font-black text-slate-950">$89.99</span></div>
                <div className="mt-4 space-y-2 text-[11px] text-slate-600"><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-cyan-600" /> Outils et formations</div><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-cyan-600" /> Cours et ressources</div><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-cyan-600" /> Accompagnement pendant 6 mois</div></div>
                <button onClick={() => startPayment('community')} disabled={pendingUpgrade === 'community'} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-cyan-50 px-4 py-2.5 text-xs font-bold text-cyan-900 ring-1 ring-cyan-300 hover:bg-cyan-100 disabled:opacity-50 cursor-pointer">{pendingUpgrade === 'community' ? 'Demande envoyée' : 'Choisir Community'}<ChevronRight className="ml-1.5 h-3.5 w-3.5 text-cyan-600" /></button>
              </div>
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

      {paymentPlan && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,.25)]">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5">
              <div><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-500">Paiement sécurisé</div><h3 className="mt-1 text-lg font-black text-slate-950">{paymentPlan === 'pro' ? 'Passer à Plus' : 'Activer Community'}</h3><p className="mt-1 text-[11px] text-slate-500">Paiement Mobile Money via Labyrinthe.</p></div>
              <button onClick={() => setPaymentPlan(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-slate-900" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              {paymentStatus === 'idle' && (<>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-600">Formule</span><span className="text-base font-black text-slate-950">{paymentPlan === 'pro' ? '$9.99 / mois' : '$89.99 / 6 mois'}</span></div><div className="mt-2 text-[11px] text-slate-500">L’activation est automatique après confirmation du paiement.</div></div>
                <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Numéro Mobile Money</label><div className="relative"><Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} placeholder="0812345678" inputMode="tel" autoComplete="tel" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold text-slate-950 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" /></div><p className="mt-1.5 text-[10px] text-slate-400">Numéro qui recevra la demande de validation.</p></div>
                <button onClick={submitPayment} disabled={isPaymentLoading || !paymentPhone.trim()} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{isPaymentLoading ? 'Initialisation du paiement…' : 'Continuer vers le paiement'}</button>
              </>)}
              {paymentStatus === 'processing' && (<div className="py-5 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" /></div><h4 className="mt-4 text-base font-black text-slate-950">Paiement en attente</h4><p className="mt-2 text-xs leading-5 text-slate-500">{paymentMessage || 'Validez la demande sur votre téléphone. Nous vérifions automatiquement la confirmation.'}</p><div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700">Validez la demande Mobile Money avant de fermer.</div></div>)}
              {paymentStatus === 'paid' && (<div className="py-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-7 w-7" /></div><h4 className="mt-4 text-base font-black text-slate-950">Paiement confirmé</h4><p className="mt-2 text-xs text-slate-500">{paymentMessage}</p></div>)}
              {paymentStatus === 'failed' && (<div className="space-y-4 py-3 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">!</div><h4 className="text-base font-black text-slate-950">Paiement non finalisé</h4><p className="text-xs leading-5 text-slate-500">{paymentMessage}</p><button onClick={() => setPaymentStatus('idle')} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white">Réessayer</button></div>)}
            </div>
          </div>
        </div>
      )}
  );
}
