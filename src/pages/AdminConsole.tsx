import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BellRing, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, Edit3, History, Mail, RefreshCw, Search, Send, ShieldCheck, Trash2, UserCheck, UserX, Users, X, XCircle } from 'lucide-react';
import { AdminLog, PaymentRecord, SubscriptionPlan, UserProfile, UserStatus, TradingAccount, Trade } from '../types';
import { getAdminLogs, getAllAccounts, getAllTrades, getAllUsers, subscribeAllPayments, subscribeAllUsers, subscribeContactMessages } from '../services/firestore';
import { adminAddLog, adminDeleteContact, adminUpdateContact, adminUpdateUser } from '../services/adminConsole';
import { useToast } from '../components/common/Toast';
import { auth } from '../firebase/config';

type Filter = 'all' | 'active' | 'suspended' | 'expiring' | 'expired' | 'pending';
const DAY = 86400000;

const planLabel = (p: SubscriptionPlan) => p === 'community' ? 'Community' : p === 'pro' ? 'Plus' : 'Starter';
const planClass = (p: SubscriptionPlan) => p === 'community' ? 'bg-violet-50 text-violet-700 border-violet-100' : p === 'pro' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-600 border-slate-200';

function expiryOf(u: UserProfile) {
  if (!u.subscriptionExpiresAt) return null;
  const d = new Date(u.subscriptionExpiresAt);
  return Number.isNaN(d.getTime()) ? null : d;
}
function remaining(u: UserProfile) {
  const d = expiryOf(u);
  return d ? Math.ceil((d.getTime() - Date.now()) / DAY) : null;
}
function fmt(v?: string) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function inputDate(v?: string) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
function isoDate(v: string) { return v ? new Date(v + 'T23:59:59').toISOString() : undefined; }

export function AdminConsole() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [metricsReady, setMetricsReady] = useState(true);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [status, setStatus] = useState<UserStatus>('active');
  const [payment, setPayment] = useState<'unpaid' | 'paid' | 'refunded'>('unpaid');
  const [expiry, setExpiry] = useState('');
  const [days, setDays] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'processing' | 'failed'>('all');
  const [contactMessages, setContactMessages] = useState<import('../services/firestore').ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<import('../services/firestore').ContactMessage | null>(null);
  const [contactFilter, setContactFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');
  const [contactNote, setContactNote] = useState('');
  const [replyText, setReplyText] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'subscriptions' | 'payments' | 'support' | 'analytics' | 'audit'>('overview');
  const perPage = 10;

  async function load() {
    setLoading(true);
    setError('');
    setLogs([]);
    try {
      const userData = await getAllUsers();
      setUsers(userData);
      try {
        const [accountData, tradeData] = await Promise.all([getAllAccounts(), getAllTrades()]);
        setAccounts(accountData);
        setTrades(tradeData);
        setMetricsReady(true);
      } catch (metricsError) {
        console.warn('IAMTRADER Admin performance metrics unavailable:', metricsError);
        setAccounts([]);
        setTrades([]);
        setMetricsReady(false);
      }
    } catch (e: any) {
      console.error('IAMTRADER Admin users load error:', e);
      const code = e?.code || 'unknown';
      const message = e?.message || 'Erreur inconnue';
      setUsers([]);
      setError('Lecture des utilisateurs refusée par Firestore. Code: ' + code + '. ' + message);
      setLoading(false);
      return;
    }

    try {
      const logData = await getAdminLogs(60);
      setLogs(logData);
    } catch (e: any) {
      console.error('IAMTRADER Admin logs load error:', e);
      // L'historique ne doit jamais empêcher l'Admin Console de fonctionner.
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeContacts: (() => void) | undefined;
    let unsubscribePayments: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeUsers?.();
      unsubscribeContacts?.();
      unsubscribePayments?.();
      unsubscribeUsers = undefined;
      unsubscribeContacts = undefined;
      unsubscribePayments = undefined;

      if (!user) return;

      load();
      unsubscribeUsers = subscribeAllUsers((nextUsers, realtimeError) => {
        if (realtimeError) return;
        setUsers(nextUsers);
      });
      unsubscribeContacts = subscribeContactMessages((messages, realtimeError) => {
        if (realtimeError) return;
        setContactMessages(messages);
      });
      unsubscribePayments = subscribeAllPayments((nextPayments, realtimeError) => {
        if (realtimeError) return;
        setPayments(nextPayments);
      });
    });

    return () => {
      unsubscribeUsers?.();
      unsubscribeContacts?.();
      unsubscribePayments?.();
      unsubscribeAuth();
    };
  }, []);

  const userMetrics = useMemo(() => {
    const map: Record<string, { initialCapital: number; totalPnl: number; tradeCount: number; pnlPercent: number | null; currency: string }> = {};
    users.forEach(u => {
      const userAccounts = accounts.filter(a => a.userId === u.uid);
      const userTrades = trades.filter(t => t.userId === u.uid);
      const currencies = Array.from(new Set(userAccounts.map(a => a.currency).filter(Boolean)));
      const initialCapital = userAccounts.reduce((sum, a) => sum + (Number(a.initialBalance) || 0), 0);
      const totalPnl = userTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
      map[u.uid] = {
        initialCapital,
        totalPnl,
        tradeCount: userTrades.length,
        pnlPercent: initialCapital > 0 ? (totalPnl / initialCapital) * 100 : null,
        currency: currencies.length === 1 ? currencies[0] : currencies.length > 1 ? 'MULTI' : 'USD'
      };
    });
    return map;
  }, [users, accounts, trades]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    paid: users.filter(u => u.paymentStatus === 'paid').length,
    pending: users.filter(u => !!u.pendingPlan).length,
    expiring: users.filter(u => { const d = remaining(u); return d !== null && d >= 0 && d <= 5; }).length,
    expired: users.filter(u => { const d = remaining(u); return d !== null && d < 0; }).length
  }), [users]);

  const orderedUsers = useMemo(() => [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [users]);
  const recentCutoff = Date.now() - 7 * DAY;
  const newUsers = orderedUsers.filter(u => new Date(u.createdAt).getTime() >= recentCutoff);
  const pendingPlanUsers = orderedUsers.filter(u => !!u.pendingPlan);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orderedUsers.filter(u => {
      const d = remaining(u);
      const text = !q || u.email.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q);
      const ok = filter === 'all' ||
        (filter === 'active' && u.status === 'active') ||
        (filter === 'suspended' && u.status === 'suspended') ||
        (filter === 'pending' && !!u.pendingPlan) ||
        (filter === 'expiring' && d !== null && d >= 0 && d <= 5) ||
        (filter === 'expired' && d !== null && d < 0);
      return text && ok;
    });
  }, [orderedUsers, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [search, filter]);

  function patch(uid: string, changes: Partial<UserProfile>) {
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...changes } : u));
    setSelected(prev => prev?.uid === uid ? { ...prev, ...changes } : prev);
  }

  async function audit(user: UserProfile, action: string, details: string) {
    const adminUid = auth.currentUser?.uid;
    if (!adminUid) return;
    const item = { adminUid, action, userUid: user.uid, userName: user.displayName || user.email, details, createdAt: new Date().toISOString() };
    try {
      await adminAddLog(item);
      setLogs(prev => [{ id: 'local-' + Date.now(), ...item }, ...prev].slice(0, 60));
    } catch {}
  }

  function openManage(u: UserProfile) {
    setSelected(u); setPlan(u.plan); setStatus(u.status); setPayment(u.paymentStatus || 'unpaid'); setExpiry(inputDate(u.subscriptionExpiresAt)); setDays('');
  }

  async function saveManual() {
    if (!selected) return;
    setBusy(true);
    try {
      const ex = isoDate(expiry);
      const subStatus = ex && new Date(ex).getTime() >= Date.now() ? 'active' : 'expired';
      await adminUpdateUser(selected.uid, { plan, status, paymentStatus: payment, subscriptionExpiresAt: ex, subscriptionStatus: subStatus });
      patch(selected.uid, { plan, status, paymentStatus: payment, subscriptionExpiresAt: ex, subscriptionStatus: subStatus });
      await audit(selected, 'Modification manuelle', 'Plan ' + planLabel(plan) + ', statut ' + status + ', échéance ' + (expiry || 'aucune') + '.');
      showToast('Modifications enregistrées.', 'success');
    } catch (e: any) { showToast(e?.message || 'Modification refusée par Firestore.', 'error'); }
    finally { setBusy(false); }
  }

  async function adjustDays(amount: number) {
    if (!selected) return;
    const current = expiryOf(selected);
    const base = current && current.getTime() > Date.now() ? current : new Date();
    const next = new Date(base.getTime() + amount * DAY);
    const value = next.toISOString();
    setExpiry(inputDate(value)); setBusy(true);
    try {
      await adminUpdateUser(selected.uid, { subscriptionExpiresAt: value, subscriptionStatus: 'active' });
      patch(selected.uid, { subscriptionExpiresAt: value, subscriptionStatus: 'active' });
      await audit(selected, amount >= 0 ? 'Ajout de jours' : 'Retrait de jours', (amount >= 0 ? '+' : '') + amount + ' jour(s). Nouvelle échéance : ' + fmt(value) + '.');
      showToast((amount >= 0 ? '+' : '') + amount + ' jour(s) appliqué(s).', 'success');
    } catch (e: any) { showToast(e?.message || 'Impossible de modifier l’échéance.', 'error'); }
    finally { setBusy(false); }
  }

  async function customDays() {
    const n = Number(days);
    if (!Number.isFinite(n) || n === 0) { showToast('Saisissez un nombre de jours différent de 0.', 'error'); return; }
    await adjustDays(n); setDays('');
  }

  async function toggleStatus() {
    if (!selected) return;
    const next: UserStatus = selected.status === 'active' ? 'suspended' : 'active';
    setBusy(true);
    try {
      await adminUpdateUser(selected.uid, { status: next });
      patch(selected.uid, { status: next });
      await audit(selected, next === 'active' ? 'Réactivation' : 'Suspension', next === 'active' ? 'Compte réactivé.' : 'Compte suspendu.');
      showToast(next === 'active' ? 'Compte réactivé.' : 'Compte suspendu.', 'success');
    } catch (e: any) { showToast(e?.message || 'Action refusée.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full bg-[#f4f7fa] -m-4 lg:-m-6 p-4 lg:p-6">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <nav className="sticky top-0 z-20 flex overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {([
            ['overview','Vue d’ensemble'],
            ['users','Utilisateurs'],
            ['subscriptions','Abonnements'],
            ['payments','Paiements'],
            ['support','Support'],
            ['analytics','Analytics'],
            ['audit','Journal d’audit']
          ] as const).map(([key,label]) => (
            <button key={key} onClick={() => setAdminTab(key)} className={'whitespace-nowrap rounded-xl px-4 py-2.5 text-[10px] font-black transition ' + (adminTab === key ? 'bg-[#0b1f35] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')}>
              {label}
            </button>
          ))}
        </nav>

        <header className="relative overflow-hidden rounded-[28px] bg-[#0b1f35] p-5 sm:p-7 text-white shadow-[0_20px_60px_rgba(11,31,53,.13)]">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300"><ShieldCheck className="w-4 h-4" />Control Center</div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Administration IAMTRADER</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/60">Une console opérationnelle pour gérer les utilisateurs, les plans, les paiements et les échéances.</p>
            </div>
            <button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-bold hover:bg-white/15"><RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />Actualiser</button>
          </div>
          <div className="relative mt-7 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            {[['Utilisateurs', stats.total, Users], ['Actifs', stats.active, UserCheck], ['Paiements', stats.paid, CreditCard], ['À confirmer', stats.pending, Activity], ['≤ 5 jours', stats.expiring, AlertTriangle], ['Expirés', stats.expired, XCircle]].map(([label, value, Icon]) =>
              <div key={String(label)} className="rounded-2xl border border-white/[.08] bg-white/[.07] p-3.5"><div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/50"><span>{String(label)}</span><Icon className="w-3.5 h-3.5" /></div><div className="mt-2 text-2xl font-black">{String(value)}</div></div>
            )}
          </div>
        </header>

        {(adminTab === 'overview' || adminTab === 'payments') && <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CreditCard className="h-4 w-4" /></div>
                <div><h2 className="text-sm font-black text-slate-900">Réception des paiements</h2><p className="mt-1 text-[10px] text-slate-400">Registre transactionnel reçu côté serveur, mis à jour en temps réel.</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all','paid','processing','failed'] as const).map(status => <button key={status} onClick={() => setPaymentFilter(status)} className={'rounded-xl px-3 py-2 text-[10px] font-bold ' + (paymentFilter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>{status === 'all' ? 'Tous' : status === 'paid' ? 'Confirmés' : status === 'processing' ? 'En cours' : 'Échoués'}</button>)}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Transactions</div><b className="mt-1 block text-lg text-slate-900">{payments.length}</b></div>
              <div className="rounded-xl bg-emerald-50 p-3"><div className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Confirmés</div><b className="mt-1 block text-lg text-emerald-700">{payments.filter(p => p.status === 'paid').length}</b></div>
              <div className="rounded-xl bg-amber-50 p-3"><div className="text-[9px] font-bold uppercase tracking-wide text-amber-600">En cours</div><b className="mt-1 block text-lg text-amber-700">{payments.filter(p => p.status === 'processing').length}</b></div>
              <div className="rounded-xl bg-blue-50 p-3"><div className="text-[9px] font-bold uppercase tracking-wide text-blue-600">CA confirmé</div><b className="mt-1 block text-lg text-blue-800">$ {payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)}</b></div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {payments.filter(p => paymentFilter === 'all' || p.status === paymentFilter).slice(0, 12).length === 0 ? <div className="p-10 text-center"><CreditCard className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-500">Aucune transaction</p><p className="mt-1 text-[10px] text-slate-400">Les nouveaux paiements apparaîtront ici après leur création.</p></div> : payments.filter(p => paymentFilter === 'all' || p.status === paymentFilter).slice(0, 12).map(p => (
              <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' + (p.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : p.status === 'processing' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}><CreditCard className="h-4 w-4" /></div>
                  <div className="min-w-0"><b className="block truncate text-xs text-slate-800">{p.displayName || p.email}</b><span className="mt-0.5 block truncate text-[10px] text-slate-400">{p.email} · {p.planName} · {p.reference.slice(0, 12)}…</span></div>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <div className="text-right"><b className="block text-sm font-black text-slate-900">{Number(p.amount).toFixed(2)} {p.currency}</b><span className="mt-0.5 block text-[9px] text-slate-400">{new Date(p.createdAt).toLocaleString('fr-FR')}</span></div>
                  <span className={'inline-flex rounded-full px-2.5 py-1 text-[9px] font-black ' + (p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : p.status === 'processing' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')}>{p.status === 'paid' ? 'PAYÉ' : p.status === 'processing' ? 'EN COURS' : 'ÉCHEC'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>}

        {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-700">{error}</div>}

        {(adminTab === 'overview' || adminTab === 'users' || adminTab === 'subscriptions') && pendingPlanUsers.length > 0 && (
          <button
            onClick={() => setFilter('pending')}
            className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-100"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <BellRing className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <b className="block text-xs font-black text-blue-950">
                  Nouvelle demande de changement de plan
                </b>
                <span className="mt-0.5 block text-[10px] text-blue-700">
                  {pendingPlanUsers.length} demande{pendingPlanUsers.length > 1 ? 's' : ''} en attente de traitement.
                </span>
              </span>
            </span>
            <span className="shrink-0 rounded-xl bg-white px-3 py-2 text-[9px] font-black text-blue-700 ring-1 ring-blue-200 group-hover:bg-blue-50">
              Voir les demandes
            </span>
          </button>
        )}

        {(adminTab === 'users' || adminTab === 'subscriptions' || adminTab === 'analytics') && !metricsReady && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-800"><b>Statistiques de trading indisponibles.</b> Publiez les nouvelles règles Firestore afin que l’administrateur puisse lire les comptes et les trades.</div>}

        {(adminTab === 'overview' || adminTab === 'users' || adminTab === 'subscriptions') && <>
        <section className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div><h2 className="text-sm font-black text-slate-900">Utilisateurs & abonnements</h2><p className="mt-1 text-[11px] text-slate-400">{filtered.length} résultat(s)</p></div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou e-mail..." className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-300" /></div>
                <select value={filter} onChange={e => setFilter(e.target.value as Filter)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 outline-none"><option value="all">Tous</option><option value="active">Actifs</option><option value="suspended">Suspendus</option><option value="pending">À confirmer</option><option value="expiring">Échéance ≤ 5 j</option><option value="expired">Expirés</option></select>
              </div>
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><div><div className="text-[9px] font-bold uppercase tracking-wider text-amber-600">À traiter</div><h2 className="mt-1 text-sm font-black text-slate-900">File opérationnelle</h2></div><Activity className="w-5 h-5 text-emerald-500" /></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => setFilter('pending')} className="rounded-xl bg-blue-50 p-3 text-left hover:bg-blue-100"><b className="text-lg text-blue-700">{stats.pending}</b><span className="block text-[9px] font-semibold text-blue-600">Confirmations</span></button>
              <button onClick={() => setFilter('expiring')} className="rounded-xl bg-amber-50 p-3 text-left hover:bg-amber-100"><b className="text-lg text-amber-700">{stats.expiring}</b><span className="block text-[9px] font-semibold text-amber-600">Échéances</span></button>
              <button onClick={() => setFilter('expired')} className="rounded-xl bg-rose-50 p-3 text-left hover:bg-rose-100"><b className="text-lg text-rose-700">{stats.expired}</b><span className="block text-[9px] font-semibold text-rose-600">Expirés</span></button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          {loading ? <div className="p-16 text-center text-xs text-slate-400">Chargement des utilisateurs...</div> : visible.length === 0 ? <div className="p-16 text-center"><Users className="mx-auto w-9 h-9 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-600">Aucun utilisateur</p></div> :
            <><div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className="border-b border-slate-100 bg-slate-50/80"><tr className="text-left text-[9px] font-bold uppercase tracking-[.14em] text-slate-400"><th className="px-3 py-3 text-center">#</th><th className="px-5 py-3">Utilisateur</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">P&L</th><th className="px-3 py-3">Capital initial</th><th className="px-3 py-3">Trades</th><th className="px-3 py-3">Paiement</th><th className="px-3 py-3">Échéance</th><th className="px-3 py-3">Temps</th><th className="px-3 py-3">Statut</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody>{visible.map((u, index) => {
              const d = remaining(u); const metrics = userMetrics[u.uid] || { initialCapital: 0, totalPnl: 0, tradeCount: 0, pnlPercent: null, currency: 'USD' }; const expired = d !== null && d < 0; const soon = d !== null && d >= 0 && d <= 5;
              return <tr key={u.uid} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-3 py-4 text-center"><span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-[9px] font-black text-slate-500">{(page - 1) * perPage + index + 1}</span></td><td className="px-5 py-4"><button onClick={() => openManage(u)} className="text-left"><b className="text-xs text-slate-800 hover:text-blue-700">{u.displayName || 'Sans nom'}</b><span className="mt-1 block text-[10px] text-slate-400">{u.email}</span></button></td><td className="px-3 py-4"><span className={'inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ' + planClass(u.plan)}>{planLabel(u.plan)}</span>{u.pendingPlan && <span className="mt-1 block text-[9px] text-blue-600">→ {planLabel(u.pendingPlan)}</span>}</td><td className="px-3 py-4"><b className={metrics.pnlPercent !== null ? (metrics.pnlPercent >= 0 ? 'text-[10px] text-emerald-600' : 'text-[10px] text-rose-600') : 'text-[10px] text-slate-400'}>{metrics.pnlPercent !== null ? (metrics.pnlPercent >= 0 ? '+' : '') + metrics.pnlPercent.toFixed(2) + '%' : '—'}</b><span className="mt-1 block text-[9px] text-slate-400">{metrics.totalPnl >= 0 ? '+' : ''}{metrics.totalPnl.toFixed(2)}</span></td><td className="px-3 py-4 text-[10px] font-semibold text-slate-700">{metricsReady && metrics.initialCapital > 0 ? metrics.initialCapital.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ' + metrics.currency : '—'}</td><td className="px-3 py-4"><span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{metricsReady ? metrics.tradeCount : '—'}</span></td><td className="px-3 py-4"><b className="text-[10px] text-slate-700">{u.paymentStatus === 'paid' ? 'Confirmé' : u.paymentStatus === 'refunded' ? 'Remboursé' : 'Non payé'}</b><span className="mt-1 block text-[9px] text-slate-400">{fmt(u.paymentDate)}</span></td><td className={'px-3 py-4 text-[10px] font-semibold ' + (expired ? 'text-rose-600' : soon ? 'text-amber-600' : 'text-slate-600')}>{d === null ? 'Aucune' : fmt(u.subscriptionExpiresAt)}</td><td className="px-3 py-4 text-[10px] font-bold">{d === null ? <span className="text-slate-400">Illimité</span> : <span className={expired ? 'text-rose-600' : soon ? 'text-amber-600' : 'text-emerald-600'}>{expired ? '-' + Math.abs(d) : d} j</span>}</td><td className="px-3 py-4"><span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold ' + (u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}><span className={'h-1.5 w-1.5 rounded-full ' + (u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500')} />{u.status === 'active' ? 'Actif' : 'Suspendu'}</span></td><td className="px-5 py-4 text-right"><button onClick={() => openManage(u)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold text-white hover:bg-slate-800"><Edit3 className="w-3.5 h-3.5" />Gérer</button></td></tr>;
            })}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-3"><span className="text-[10px] text-slate-400">Page {page} / {totalPages}</span><div className="flex gap-1"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button><button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button></div></div></>}
        </section>
        </>}

        {(adminTab === 'overview' || adminTab === 'support') && <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Mail className="h-4 w-4" /></div>
                <div><h2 className="text-sm font-black text-slate-900">Messages de contact</h2><p className="mt-1 text-[10px] text-slate-400">{contactMessages.filter(m => m.status === 'new').length} nouveau(x) · {contactMessages.length} message(s)</p></div>
              </div>
              <div className="flex items-center gap-2">
                {(['all','new','in_progress','resolved'] as const).map(s => <button key={s} onClick={() => setContactFilter(s)} className={'rounded-xl px-3 py-2 text-[10px] font-bold ' + (contactFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>{s === 'all' ? 'Tous' : s === 'new' ? 'Nouveaux' : s === 'in_progress' ? 'En cours' : 'Traités'}</button>)}
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {contactMessages.filter(m => contactFilter === 'all' || m.status === contactFilter).length === 0 ? <div className="p-10 text-center"><Mail className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-500">Aucun message</p></div> : contactMessages.filter(m => contactFilter === 'all' || m.status === contactFilter).slice(0, 20).map(m => (
              <button key={m.id} onClick={() => { setSelectedMessage(m); setContactNote(m.adminNote || ''); setReplyText(''); }} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50">
                <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' + (m.status === 'new' ? 'bg-blue-50 text-blue-600' : m.status === 'in_progress' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>{m.status === 'new' ? <Mail className="h-4 w-4" /> : m.status === 'in_progress' ? <Clock3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className={'truncate text-xs ' + (m.status === 'new' ? 'text-slate-900' : 'text-slate-700')}>{m.subject}</b>{m.status === 'new' && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-black text-blue-700">NOUVEAU</span>}</div><p className="mt-1 truncate text-[10px] text-slate-400">{m.name} · {m.email}</p></div>
                <span className="hidden shrink-0 text-[9px] font-semibold text-slate-400 sm:block">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
              </button>
            ))}
          </div>
        </section>}

        {adminTab === 'audit' && <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <button onClick={() => setHistoryOpen(!historyOpen)} className="flex w-full items-center justify-between p-4 text-left"><span className="flex items-center gap-2"><History className="w-4 h-4 text-blue-600" /><span><b className="block text-sm text-slate-900">Historique administratif</b><small className="block mt-0.5 text-[10px] text-slate-400">Traçabilité des opérations.</small></span></span><span className="text-xs font-bold text-slate-400">{historyOpen ? 'Réduire' : 'Afficher'}</span></button>
          {historyOpen && <div className="divide-y divide-slate-100 border-t border-slate-100">{logs.length ? logs.slice(0, 12).map(l => <div key={l.id} className="flex gap-3 px-5 py-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><History className="w-3.5 h-3.5" /></div><div><b className="text-[11px] text-slate-700">{l.action} · {l.userName}</b><p className="mt-0.5 text-[10px] text-slate-400">{l.details}</p></div></div>) : <div className="p-6 text-xs text-slate-400">Aucune action.</div>}</div>}
        </section>}

        {adminTab === 'analytics' && <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Croissance</div><div className="mt-2 text-3xl font-black text-slate-950">{newUsers.length}</div><div className="mt-1 text-[11px] text-slate-500">nouveaux utilisateurs sur 7 jours</div></div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Conversion paiement</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.total ? Math.round((stats.paid / stats.total) * 100) : 0}%</div><div className="mt-1 text-[11px] text-slate-500">{stats.paid} utilisateur(s) avec paiement confirmé</div></div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Performance trading</div><div className="mt-2 text-3xl font-black text-slate-950">{trades.length}</div><div className="mt-1 text-[11px] text-slate-500">trades enregistrés · {accounts.length} compte(s)</div></div>
          <div className="lg:col-span-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600" /><div><h2 className="text-sm font-black text-slate-900">État temps réel</h2><p className="mt-1 text-[10px] text-slate-400">Les indicateurs sont alimentés par les données déjà synchronisées en temps réel.</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-slate-50 p-4"><b className="text-lg text-slate-900">{payments.length}</b><span className="mt-1 block text-[9px] text-slate-500">transactions</span></div><div className="rounded-2xl bg-emerald-50 p-4"><b className="text-lg text-emerald-700">{contactMessages.filter(m => m.status === 'new').length}</b><span className="mt-1 block text-[9px] text-emerald-600">tickets nouveaux</span></div><div className="rounded-2xl bg-blue-50 p-4"><b className="text-lg text-blue-700">{stats.pending}</b><span className="mt-1 block text-[9px] text-blue-600">changements en attente</span></div><div className="rounded-2xl bg-amber-50 p-4"><b className="text-lg text-amber-700">{stats.expiring}</b><span className="mt-1 block text-[9px] text-amber-600">échéances proches</span></div></div></div>
        </section>}
      </div>

      {selectedMessage && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={() => setSelectedMessage(null)}>
        <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white bg-[#f7f9fc] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-slate-100 bg-white px-5 py-5 sm:px-7"><div><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" /><span className="text-[9px] font-black uppercase tracking-wider text-blue-600">Message de contact</span></div><h2 className="mt-2 text-lg font-black text-slate-900">{selectedMessage.subject}</h2><p className="mt-1 text-[11px] text-slate-400">{selectedMessage.name} · {selectedMessage.email}</p></div><button onClick={() => setSelectedMessage(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <div className="space-y-4 p-5 sm:p-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedMessage.message}</p><p className="mt-4 text-[9px] text-slate-400">{new Date(selectedMessage.createdAt).toLocaleString('fr-FR')}</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['new','in_progress','resolved'] as const).map(s => <button key={s} disabled={contactBusy} onClick={async () => { setContactBusy(true); try { const adminUid = auth.currentUser?.uid; await adminUpdateContact(selectedMessage.id, { status: s, handledBy: adminUid, handledAt: new Date().toISOString(), adminNote: contactNote }); const next = { ...selectedMessage, status: s, handledBy: adminUid, handledAt: new Date().toISOString(), adminNote: contactNote, updatedAt: new Date().toISOString() }; setSelectedMessage(next); showToast(s === 'new' ? 'Message marqué comme nouveau.' : s === 'in_progress' ? 'Message placé en cours.' : 'Message marqué comme traité.', 'success'); } catch (e: any) { showToast(e?.message || 'Impossible de mettre à jour le message.', 'error'); } finally { setContactBusy(false); } }} className={'rounded-xl px-3 py-2.5 text-[10px] font-bold ' + (selectedMessage.status === s ? (s === 'new' ? 'bg-blue-600 text-white' : s === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{s === 'new' ? 'Nouveau' : s === 'in_progress' ? 'En cours' : 'Traité'}</button>)}
            </div>
            <label className="block text-[10px] font-bold text-slate-500">Note interne<textarea value={contactNote} onChange={e => setContactNote(e.target.value)} rows={3} placeholder="Note visible uniquement par l'administration..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-300" /></label>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
               <div className="mb-2 flex items-center justify-between">
                 <div><h3 className="text-xs font-black text-slate-900">Répondre au client</h3><p className="mt-1 text-[10px] text-slate-400">La réponse sera envoyée directement depuis IAMTRADER.</p></div>
                 <Send className="h-4 w-4 text-blue-600" />
               </div>
               <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={6} placeholder="Écrivez votre réponse..." className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-blue-300" />
               <div className="mt-3 flex flex-wrap gap-2">
                 <button disabled={replyBusy || !replyText.trim()} onClick={async () => {
                   if (!selectedMessage || !replyText.trim()) return;
                   const currentUser = auth.currentUser;
                   if (!currentUser) { showToast('Session administrateur introuvable.', 'error'); return; }
                   setReplyBusy(true);
                   try {
                     const idToken = await currentUser.getIdToken();
                     const response = await fetch('/api/contact-reply', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
                       body: JSON.stringify({ to: selectedMessage.email, subject: selectedMessage.subject, reply: replyText.trim(), originalMessage: selectedMessage.message, name: selectedMessage.name })
                     });
                     const payload = await response.json().catch(() => ({}));
                     if (!response.ok) throw new Error(payload?.error || 'L’envoi de l’e-mail a échoué.');
                     const now = new Date().toISOString();
                     await adminUpdateContact(selectedMessage.id, { status: 'resolved', handledBy: currentUser.uid, handledAt: now, lastReply: replyText.trim(), repliedAt: now, repliedBy: currentUser.uid });
                     setSelectedMessage(prev => prev ? { ...prev, status: 'resolved', handledBy: currentUser.uid, handledAt: now, lastReply: replyText.trim(), repliedAt: now, repliedBy: currentUser.uid, updatedAt: now } : prev);
                     setReplyText('');
                     showToast('Réponse envoyée au client.', 'success');
                   } catch (e: any) {
                     showToast(e?.message || 'Impossible d’envoyer la réponse.', 'error');
                   } finally {
                     setReplyBusy(false);
                   }
                 }} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f35] px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{replyBusy ? 'Envoi...' : 'Envoyer la réponse'}</button>
                 <button disabled={contactBusy || replyBusy} onClick={async () => { if (!window.confirm('Supprimer définitivement ce message ?')) return; setContactBusy(true); try { await adminDeleteContact(selectedMessage.id); setSelectedMessage(null); showToast('Message supprimé.', 'success'); } catch (e: any) { showToast(e?.message || 'Suppression refusée.', 'error'); } finally { setContactBusy(false); } }} className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="h-4 w-4" />Supprimer</button>
               </div>
             </div>
          </div>
        </div>
      </div>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
        <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white bg-[#f7f9fc] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-5 py-5 backdrop-blur sm:px-7"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0b1f35] font-black text-white">{(selected.displayName || selected.email).slice(0, 1).toUpperCase()}</div><div><b className="block text-base text-slate-900">{selected.displayName || 'Sans nom'}</b><span className="text-[11px] text-slate-400">{selected.email}</span></div></div><button onClick={() => setSelected(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button></div>
          <div className="space-y-5 p-5 sm:p-7">
            {(() => {
              const metrics = userMetrics[selected.uid] || { initialCapital: 0, totalPnl: 0, tradeCount: 0, pnlPercent: null, currency: 'USD' };
              return (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-[9px] font-bold uppercase text-slate-400">P&L %</small><b className={'mt-2 block text-lg ' + (metrics.pnlPercent === null ? 'text-slate-400' : metrics.pnlPercent >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{metrics.pnlPercent === null ? '—' : (metrics.pnlPercent >= 0 ? '+' : '') + metrics.pnlPercent.toFixed(2) + '%'}</b></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-[9px] font-bold uppercase text-slate-400">Capital initial</small><b className="mt-2 block text-sm text-slate-800">{metrics.initialCapital > 0 ? metrics.initialCapital.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ' + metrics.currency : '—'}</b></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-[9px] font-bold uppercase text-slate-400">Trades enregistrés</small><b className="mt-2 block text-lg text-slate-800">{metrics.tradeCount}</b></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-[9px] font-bold uppercase text-slate-400">P&L total</small><b className={'mt-2 block text-sm ' + (metrics.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{metrics.totalPnl >= 0 ? '+' : ''}{metrics.totalPnl.toFixed(2)} {metrics.currency}</b></div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-[9px] font-bold uppercase text-slate-400">Plan</small><b className="mt-2 block text-sm text-slate-800">{planLabel(selected.plan)}</b></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-[9px] font-bold uppercase text-slate-400">Temps</small><b className="mt-2 block text-sm text-emerald-600">{remaining(selected) === null ? 'Illimité' : remaining(selected) + ' j'}</b></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-[9px] font-bold uppercase text-slate-400">Paiement</small><b className="mt-2 block text-sm text-slate-800">{selected.paymentStatus === 'paid' ? 'Confirmé' : selected.paymentStatus === 'refunded' ? 'Remboursé' : 'Non payé'}</b></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-[9px] font-bold uppercase text-slate-400">Échéance</small><b className="mt-2 block text-sm text-slate-800">{fmt(selected.subscriptionExpiresAt)}</b></div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-900">Modifier manuellement</h3><p className="mt-1 text-[10px] text-slate-400">L’administrateur contrôle directement les paramètres d’abonnement.</p></div><Edit3 className="w-4 h-4 text-blue-600" /></div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-[10px] font-bold text-slate-500">Plan<select value={plan} onChange={e => setPlan(e.target.value as SubscriptionPlan)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold"><option value="free">Starter</option><option value="pro">Plus</option><option value="community">Community</option></select></label>
                <label className="text-[10px] font-bold text-slate-500">Statut<select value={status} onChange={e => setStatus(e.target.value as UserStatus)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold"><option value="active">Actif</option><option value="suspended">Suspendu</option></select></label>
                <label className="text-[10px] font-bold text-slate-500">Paiement<select value={payment} onChange={e => setPayment(e.target.value as any)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold"><option value="unpaid">Non payé</option><option value="paid">Payé</option><option value="refunded">Remboursé</option></select></label>
              </div>
              <label className="mt-3 block text-[10px] font-bold text-slate-500">Date d’échéance exacte<input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold" /></label>
              <button disabled={busy} onClick={saveManual} className="mt-4 w-full rounded-xl bg-[#0b1f35] py-3 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between"><div><h3 className="text-sm font-black text-slate-900">Accès au compte</h3><p className="mt-1 text-[10px] text-slate-400">Suspendre ou réactiver immédiatement l’utilisateur.</p></div><UserCheck className="w-4 h-4 text-emerald-600" /></div>
              <button disabled={busy} onClick={toggleStatus} className={'mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ' + (selected.status === 'active' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{selected.status === 'active' ? <><UserX className="w-4 h-4" />Suspendre</> : <><UserCheck className="w-4 h-4" />Réactiver</>}</button>
            </section>
          </div>
        </div>
      </div>}
    </div>
  );
}
