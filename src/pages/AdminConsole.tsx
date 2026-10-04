import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BellRing, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, Edit3, History, Mail, RefreshCw, Search, Send, ShieldCheck, Trash2, UserCheck, UserX, Users, X, XCircle } from 'lucide-react';
import { AdminLog, PaymentRecord, SubscriptionPlan, UserProfile, UserStatus, TradingAccount, Trade } from '../types';
import { getAdminLogs, getAllAccounts, getAllTrades, getAllUsers, subscribeAllUsers, subscribeContactMessages } from '../services/firestore';
import { adminAddLog, adminDeleteContact, adminGetPayments, adminUpdateContact, adminUpdateUser } from '../services/adminConsole';
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
  const [analyticsTab, setAnalyticsTab] = useState<'profiles' | 'engagement' | 'trading' | 'subscriptions'>('profiles');
  const perPage = 10;

  async function refreshPayments() {
    try {
      const paymentData = await adminGetPayments<{ success: boolean; payments: PaymentRecord[] }>();
      setPayments(paymentData.payments || []);
    } catch (e) {
      console.warn('IAMTRADER Admin payment refresh unavailable:', e);
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    setLogs([]);
    try {
      const userData = await getAllUsers();
      try {
        const paymentData = await adminGetPayments<{ success: boolean; payments: PaymentRecord[] }>();
        setPayments(paymentData.payments || []);
      } catch (paymentError) {
        console.warn('IAMTRADER Admin secure payment ledger unavailable:', paymentError);
      }
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
    let paymentTimer: number | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeUsers?.();
      unsubscribeContacts?.();
      unsubscribeUsers = undefined;
      unsubscribeContacts = undefined;

      if (!user) return;

      load();
      paymentTimer = window.setInterval(refreshPayments, 15000);
      unsubscribeUsers = subscribeAllUsers((nextUsers, realtimeError) => {
        if (realtimeError) return;
        setUsers(nextUsers);
      });
      unsubscribeContacts = subscribeContactMessages((messages, realtimeError) => {
        if (realtimeError) return;
        setContactMessages(messages);
      });
    });

    return () => {
      if (paymentTimer) window.clearInterval(paymentTimer);
      unsubscribeUsers?.();
      unsubscribeContacts?.();
      unsubscribeAuth();
    };
  }, []);

  const overviewPaidUsers = users.filter(u => u.plan !== 'free');
  const overviewPendingPayments = payments.filter(p => p.status === 'processing' || p.status === 'initiated');
  const overviewConfirmedPayments = payments.filter(p => p.status === 'paid');
  const overviewOpenTickets = contactMessages.filter(m => m.status !== 'resolved');
  const overviewExpiringUsers = users.filter(u => {
    const d = remaining(u);
    return d !== null && d >= 0 && d <= 5;
  });
  const overviewRevenue = overviewConfirmedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const overviewActiveTraders = users.filter(u => accounts.some(a => a.userId === u.uid) || trades.some(t => t.userId === u.uid)).length;
  const overviewRecentUsers = [...users]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-full bg-[#f5f8fb] -m-4 lg:-m-6">
      <div className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6">
        <nav className="sticky top-2 z-30 mb-5 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_8px_30px_rgba(11,31,53,.07)] backdrop-blur">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="mr-2 hidden items-center gap-2 border-r border-slate-200 pr-4 md:flex"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b1f35] text-white"><ShieldCheck className="h-4 w-4"/></div><div><b className="block text-[11px] text-[#0b1f35]">IAMTRADER</b><span className="text-[8px] font-semibold text-slate-400">Administration</span></div></div>
            {([
              ['overview','Dashboard admin',Activity],['users','Utilisateurs',Users],['subscriptions','Abonnements',Clock3],['payments','Paiements',CreditCard],['support','Support',Mail],['analytics','Analytics',Activity],['audit','Audit',History]
            ] as const).map(([key,label,Icon])=><button key={key} onClick={()=>setAdminTab(key)} className={'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-[9px] font-black transition '+(adminTab===key?'bg-[#0b1f35] text-white shadow-sm':'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}><Icon className="h-3.5 w-3.5"/>{label}{key==='support'&&contactMessages.filter(m=>m.status==='new').length>0&&<span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] text-blue-700">{contactMessages.filter(m=>m.status==='new').length}</span>}</button>)}
            <div className="ml-auto hidden items-center gap-2 pl-2 md:flex"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[8px] font-black text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>LIVE</span><button onClick={load} disabled={loading} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><RefreshCw className={'h-3.5 w-3.5 '+(loading?'animate-spin':'')}/></button></div>
          </div>
        </nav>

        <main className="space-y-4">
          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><div className="text-[8px] font-black uppercase tracking-[.18em] text-emerald-600">Administration / {adminTab}</div><h1 className="mt-1 text-2xl font-black tracking-tight text-[#0b1f35]">{adminTab==='overview'?'Dashboard admin':adminTab==='users'?'Utilisateurs':adminTab==='subscriptions'?'Abonnements':adminTab==='payments'?'Paiements':adminTab==='support'?'Support':adminTab==='analytics'?'Analytics':'Journal d’audit'}</h1><p className="mt-1 text-[11px] text-slate-400">{adminTab==='subscriptions'?'Suivi commercial des abonnements, répartition des plans et paiements à confirmer.':adminTab==='analytics'?'Lecture comportementale et performance des utilisateurs.':'Pilotage opérationnel de la plateforme IAMTRADER.'}</p></div>
              <button onClick={load} disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50"><RefreshCw className={'h-3.5 w-3.5 '+(loading?'animate-spin':'')}/>Actualiser</button>
            </div>
          </header>

          {adminTab==='overview' && <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  ['Utilisateurs actifs', users.filter(u => u.status === 'active').length, 'bg-emerald-50 text-emerald-700', '↗'],
                  ['Revenu confirmé', '$ ' + overviewRevenue.toFixed(2), 'bg-blue-50 text-blue-700', '$'],
                  ['Abonnements actifs', overviewPaidUsers.length, 'bg-violet-50 text-violet-700', '●'],
                  ['Paiements à confirmer', overviewPendingPayments.length, 'bg-amber-50 text-amber-700', '!'],
                  ['Tickets ouverts', overviewOpenTickets.length, 'bg-sky-50 text-sky-700', '?'],
                  ['Échéances ≤ 5 jours', overviewExpiringUsers.length, 'bg-rose-50 text-rose-700', '◷']
                ].map(([label, value, tone, icon]) => (
                  <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">{String(label)}</span>
                      <span className={'flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black ' + String(tone)}>{String(icon)}</span>
                    </div>
                    <b className="mt-3 block text-2xl font-black tracking-tight text-[#0b1f35]">{String(value)}</b>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.55fr_.8fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-black text-[#0b1f35]">Revenus & activité commerciale</h2>
                      <p className="mt-1 text-[10px] text-slate-400">Lecture rapide des paiements et de la croissance des abonnements.</p>
                    </div>
                    <button onClick={() => setAdminTab('payments')} className="rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-bold text-slate-600 hover:bg-slate-100">Voir les paiements</button>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <span className="text-[8px] font-black uppercase text-slate-400">CA confirmé</span>
                      <b className="mt-2 block text-xl font-black text-[#0b1f35]">$ {revenue.toFixed(2)}</b>
                      <span className="mt-1 block text-[9px] text-slate-400">{overviewConfirmedPayments.length} transaction(s)</span>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-4">
                      <span className="text-[8px] font-black uppercase text-emerald-700">Conversion payante</span>
                      <b className="mt-2 block text-xl font-black text-emerald-700">{users.length ? Math.round((paidUsers.length / users.length) * 100) : 0}%</b>
                      <span className="mt-1 block text-[9px] text-emerald-700">{paidUsers.length} utilisateurs payants</span>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-4">
                      <span className="text-[8px] font-black uppercase text-amber-700">En attente</span>
                      <b className="mt-2 block text-xl font-black text-amber-800">{pendingPayments.length}</b>
                      <span className="mt-1 block text-[9px] text-amber-700">à vérifier</span>
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl border border-slate-100 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Répartition des abonnements</span>
                      <span className="text-[9px] font-bold text-slate-400">{paidUsers.length} actifs</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="bg-blue-600" style={{ width: paidUsers.length ? ((users.filter(u => u.plan === 'pro').length / paidUsers.length) * 100) + '%' : '0%' }} />
                      <div className="bg-violet-500" style={{ width: paidUsers.length ? ((users.filter(u => u.plan === 'community').length / paidUsers.length) * 100) + '%' : '0%' }} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-[9px] font-semibold text-slate-500">
                      <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />Plus · {users.filter(u => u.plan === 'pro').length}</span>
                      <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-500" />Community · {users.filter(u => u.plan === 'community').length}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-[#0b1f35] p-5 text-white shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[8px] font-black uppercase tracking-[.18em] text-emerald-300">Centre opérationnel</div>
                      <h2 className="mt-2 text-lg font-black">À traiter maintenant</h2>
                      <p className="mt-1 text-[10px] text-slate-300">Les éléments qui nécessitent une intervention.</p>
                    </div>
                    <Activity className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div className="mt-5 space-y-2">
                    {[
                      ['Paiements à confirmer', pendingPayments.length, 'payments', 'amber'],
                      ['Demandes de plan', users.filter(u => u.planRequest).length, 'subscriptions', 'blue'],
                      ['Support non traité', openTickets.length, 'support', 'violet'],
                      ['Échéances proches', expiringUsers.length, 'subscriptions', 'rose']
                    ].map(([label, value, target, tone]) => (
                      <button key={String(label)} onClick={() => setAdminTab(target as typeof adminTab)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10">
                        <span className="text-[10px] font-bold">{String(label)}</span>
                        <span className={'rounded-full px-2 py-1 text-[9px] font-black ' + (tone === 'amber' ? 'bg-amber-100 text-amber-800' : tone === 'rose' ? 'bg-rose-100 text-rose-800' : tone === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800')}>{String(value)} →</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div><h2 className="text-sm font-black text-[#0b1f35]">Activité récente</h2><p className="mt-1 text-[10px] text-slate-400">Derniers profils créés.</p></div>
                    <Users className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 divide-y divide-slate-100">
                    {overviewRecentUsers.map(u => <div key={u.uid} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0"><b className="block truncate text-[10px] text-slate-800">{u.displayName || u.email}</b><span className="text-[8px] text-slate-400">{fmt(u.createdAt)}</span></div>
                      <span className={'shrink-0 rounded-full px-2 py-1 text-[8px] font-black ' + (u.plan === 'free' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700')}>{planLabel(u.plan)}</span>
                    </div>)}
                    {!recentUsers.length && <div className="py-8 text-center text-[10px] text-slate-400">Aucune activité récente.</div>}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between"><div><h2 className="text-sm font-black text-[#0b1f35]">Santé du trading</h2><p className="mt-1 text-[10px] text-slate-400">Engagement réel des traders.</p></div><Activity className="h-4 w-4 text-emerald-600" /></div>
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center justify-between py-2"><span className="text-[10px] text-slate-500">Comptes créés</span><b className="text-sm">{accounts.length}</b></div>
                    <div className="flex items-center justify-between border-t border-slate-100 py-2"><span className="text-[10px] text-slate-500">Trades enregistrés</span><b className="text-sm">{trades.length}</b></div>
                    <div className="flex items-center justify-between border-t border-slate-100 py-2"><span className="text-[10px] text-slate-500">Traders actifs</span><b className="text-sm text-emerald-700">{overviewActiveTraders}</b></div>
                  </div>
                  <button onClick={() => setAdminTab('analytics')} className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50">Explorer Analytics</button>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between"><div><h2 className="text-sm font-black text-[#0b1f35]">État de la plateforme</h2><p className="mt-1 text-[10px] text-slate-400">Indicateurs de surveillance.</p></div><ShieldCheck className="h-4 w-4 text-emerald-600" /></div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-3"><span className="text-[9px] font-bold text-emerald-800">Services</span><b className="text-[9px] text-emerald-700">OPÉRATIONNELS</b></div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"><span className="text-[9px] font-bold text-slate-600">Utilisateurs actifs</span><b className="text-[10px]">{users.filter(u => u.status === 'active').length}</b></div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"><span className="text-[9px] font-bold text-slate-600">Expirés</span><b className="text-[10px]">{users.filter(u => remaining(u) !== null && (remaining(u) as number) < 0).length}</b></div>
                  </div>
                </section>
              </div>
            </section>;
          })()}

          {adminTab==='users' && <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un utilisateur..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-xs outline-none"/></div><select value={filter} onChange={e=>setFilter(e.target.value as Filter)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold"><option value="all">Tous les profils</option><option value="active">Actifs</option><option value="suspended">Suspendus</option><option value="pending">Demandes de plan</option><option value="expiring">Échéance ≤ 5 j</option><option value="expired">Expirés</option></select></div>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className="bg-slate-50"><tr className="text-left text-[8px] font-black uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Utilisateur</th><th>Plan</th><th>P&L</th><th>Trades</th><th>Paiement</th><th>Échéance</th><th>Statut</th><th className="pr-4 text-right">Action</th></tr></thead><tbody>{visible.map(u=>{const m=userMetrics[u.uid]||{initialCapital:0,totalPnl:0,tradeCount:0,pnlPercent:null,currency:'USD'};const d=remaining(u);return <tr key={u.uid} className="border-t border-slate-100 hover:bg-slate-50/60"><td className="px-4 py-3.5"><button onClick={()=>openManage(u)} className="text-left"><b className="block text-xs text-slate-800">{u.displayName||'Sans nom'}</b><span className="text-[9px] text-slate-400">{u.email}</span></button></td><td><span className={'rounded-lg border px-2 py-1 text-[9px] font-bold '+planClass(u.plan)}>{planLabel(u.plan)}</span></td><td><b className={'text-[10px] '+(m.pnlPercent===null?'text-slate-400':m.pnlPercent>=0?'text-emerald-600':'text-rose-600')}>{m.pnlPercent===null?'—':(m.pnlPercent>=0?'+':'')+m.pnlPercent.toFixed(2)+'%'}</b></td><td><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold">{m.tradeCount}</span></td><td className="text-[10px] font-semibold">{u.paymentStatus==='paid'?'Confirmé':'Non payé'}</td><td className="text-[10px] font-semibold">{d===null?'—':fmt(u.subscriptionExpiresAt)}</td><td><span className={'rounded-full px-2 py-1 text-[8px] font-bold '+(u.status==='active'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700')}>{u.status==='active'?'Actif':'Suspendu'}</span></td><td className="pr-4 text-right"><button onClick={()=>openManage(u)} className="rounded-xl bg-[#0b1f35] px-3 py-2 text-[9px] font-bold text-white">Gérer</button></td></tr>})}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[9px] text-slate-400">Page {page} / {totalPages}<span className="flex gap-1"><button disabled={page===1} onClick={()=>setPage(page-1)} className="rounded-lg border p-1.5 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5"/></button><button disabled={page===totalPages} onClick={()=>setPage(page+1)} className="rounded-lg border p-1.5 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5"/></button></span></div></section>
          </section>}

          {adminTab==='subscriptions' && <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-[8px] font-black uppercase text-slate-400">Plus</span><b className="mt-2 block text-2xl font-black text-blue-700">{users.filter(u=>u.plan==='pro').length}</b><span className="text-[9px] text-slate-400">abonnés actifs</span></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-[8px] font-black uppercase text-slate-400">Community</span><b className="mt-2 block text-2xl font-black text-violet-700">{users.filter(u=>u.plan==='community').length}</b><span className="text-[9px] text-slate-400">abonnés actifs</span></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><span className="text-[8px] font-black uppercase text-amber-700">Paiements à confirmer</span><b className="mt-2 block text-2xl font-black text-amber-800">{payments.filter(p=>p.status==='processing').length}</b><span className="text-[9px] text-amber-700">transactions en cours</span></div></div>
            <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black text-[#0b1f35]">Abonnements récents</h2><div className="mt-4 divide-y divide-slate-100">{payments.filter(p=>p.status==='paid').slice(0,10).map(p=><div key={p.id} className="flex items-center justify-between py-3"><div><b className="block text-xs text-slate-800">{p.displayName||p.email}</b><span className="text-[9px] text-slate-400">{p.planName} · {new Date(p.paidAt||p.createdAt||'').toLocaleDateString('fr-FR')}</span></div><b className="text-xs text-emerald-700">{Number(p.amount).toFixed(2)} {p.currency}</b></div>)}</div></section><section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black text-[#0b1f35]">Paiements en attente de confirmation</h2><div className="mt-4 divide-y divide-slate-100">{payments.filter(p=>p.status==='processing'||p.status==='initiated').slice(0,10).map(p=><div key={p.id} className="flex items-center justify-between py-3"><div><b className="block text-xs text-slate-800">{p.displayName||p.email}</b><span className="text-[9px] text-slate-400">{p.planName} · {p.reference}</span></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black text-amber-700">EN ATTENTE</span></div>)}{payments.filter(p=>p.status==='processing'||p.status==='initiated').length===0&&<div className="py-10 text-center text-[10px] text-slate-400">Aucun paiement en attente.</div>}</div></section></div>
          </section>}

          {adminTab==='payments' && <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-[8px] font-black uppercase text-slate-400">Transactions</span><b className="mt-2 block text-2xl font-black">{payments.length}</b></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><span className="text-[8px] font-black uppercase text-emerald-700">Confirmés</span><b className="mt-2 block text-2xl font-black text-emerald-700">{payments.filter(p=>p.status==='paid').length}</b></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><span className="text-[8px] font-black uppercase text-amber-700">En cours</span><b className="mt-2 block text-2xl font-black text-amber-700">{payments.filter(p=>p.status==='processing'||p.status==='initiated').length}</b></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-[8px] font-black uppercase text-slate-400">CA confirmé</span><b className="mt-2 block text-2xl font-black">$ {payments.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount||0),0).toFixed(2)}</b></div></div>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><div className="flex flex-wrap gap-2">{(['all','paid','processing','failed'] as const).map(s=><button key={s} onClick={()=>setPaymentFilter(s)} className={'rounded-xl px-3 py-2 text-[9px] font-bold '+(paymentFilter===s?'bg-[#0b1f35] text-white':'bg-slate-100 text-slate-500')}>{s==='all'?'Tous':s==='paid'?'Confirmés':s==='processing'?'En cours':'Échoués'}</button>)}</div></div><div className="divide-y divide-slate-100">{payments.filter(p=>paymentFilter==='all'||p.status===paymentFilter).map(p=><div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="block text-xs text-slate-800">{p.displayName||p.email}</b><span className="text-[9px] text-slate-400">{p.email} · {p.planName} · {p.reference}</span></div><div className="flex items-center gap-4"><div className="text-right"><b className="block text-sm">{Number(p.amount).toFixed(2)} {p.currency}</b><span className="text-[9px] text-slate-400">{new Date(p.createdAt||'').toLocaleString('fr-FR')}</span></div><span className={'rounded-full px-2.5 py-1 text-[8px] font-black '+(p.status==='paid'?'bg-emerald-50 text-emerald-700':p.status==='processing'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700')}>{p.status==='paid'?'PAYÉ':p.status==='processing'?'EN COURS':'ÉCHEC'}</span></div></div>)}</div></section>
          </section>}

          {adminTab==='support' && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid min-h-[620px] lg:grid-cols-[330px_1fr]">
              <aside className="border-b border-slate-100 bg-slate-50/70 lg:border-b-0 lg:border-r">
                <div className="border-b border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div><h2 className="text-sm font-black text-[#0b1f35]">Inbox</h2><p className="text-[9px] text-slate-400">{contactMessages.filter(m=>m.status==='new').length} nouveaux messages</p></div>
                    <Mail className="h-4 w-4 text-blue-600"/>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(['all','new','in_progress','resolved'] as const).map(s => (
                      <button key={s} onClick={() => setContactFilter(s)} className={'rounded-lg px-2 py-1.5 text-[8px] font-bold ' + (contactFilter===s ? 'bg-[#0b1f35] text-white' : 'bg-white text-slate-500 border')}>
                        {s==='all'?'Tous':s==='new'?'Nouveaux':s==='in_progress'?'En cours':'Traités'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {contactMessages.filter(m=>contactFilter==='all'||m.status===contactFilter).map(m => (
                    <button key={m.id} onClick={() => { setSelectedMessage(m); setContactNote(m.adminNote||''); setReplyText(''); }} className={'w-full p-4 text-left hover:bg-white ' + (selectedMessage?.id===m.id ? 'bg-white' : '')}>
                      <div className="flex items-center gap-2">
                        <div className={'flex h-8 w-8 items-center justify-center rounded-xl ' + (m.status==='new'?'bg-blue-50 text-blue-600':m.status==='in_progress'?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600')}><Mail className="h-3.5 w-3.5"/></div>
                        <div className="min-w-0 flex-1"><b className="block truncate text-[10px] text-slate-800">{m.subject}</b><span className="block truncate text-[8px] text-slate-400">{m.name} · {m.email}</span></div>
                        {m.status==='new' && <span className="h-2 w-2 rounded-full bg-blue-500"/>}
                      </div>
                    </button>
                  ))}
                </div>
              </aside>
              <div className="flex min-w-0 items-center justify-center bg-white">
                {selectedMessage ? (
                  <div className="w-full max-w-2xl p-6 sm:p-8">
                    <div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0b1f35] text-white"><Mail className="h-5 w-5"/></div><div><h2 className="text-lg font-black text-[#0b1f35]">{selectedMessage.subject}</h2><p className="text-[10px] text-slate-400">{selectedMessage.name} · {selectedMessage.email}</p></div></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedMessage.message}</p></div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={7} placeholder="Écrire une réponse..." className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs outline-none focus:border-blue-300"/>
                      <div className="mt-3 flex justify-end">
                        <button disabled={replyBusy||!replyText.trim()} onClick={async()=>{if(!selectedMessage||!replyText.trim())return;const currentUser=auth.currentUser;if(!currentUser)return;setReplyBusy(true);try{const idToken=await currentUser.getIdToken();const response=await fetch('/api/contact-reply',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+idToken},body:JSON.stringify({to:selectedMessage.email,subject:selectedMessage.subject,reply:replyText.trim(),originalMessage:selectedMessage.message,name:selectedMessage.name})});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.error||'Envoi impossible');const now=new Date().toISOString();await adminUpdateContact(selectedMessage.id,{status:'resolved',handledBy:currentUser.uid,handledAt:now,lastReply:replyText.trim(),repliedAt:now,repliedBy:currentUser.uid});setSelectedMessage(prev=>prev?{...prev,status:'resolved',lastReply:replyText.trim(),repliedAt:now,repliedBy:currentUser.uid}:prev);setReplyText('');showToast('Réponse envoyée.','success')}catch(e:any){showToast(e?.message||'Envoi impossible.','error')}finally{setReplyBusy(false)}}} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f35] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Send className="h-4 w-4"/>{replyBusy?'Envoi...':'Envoyer'}</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-300"><Mail className="mx-auto h-10 w-10"/><p className="mt-2 text-xs">Sélectionnez une conversation</p></div>
                )}
              </div>
            </div>
          </section>}

          {adminTab==='analytics' && <section className="space-y-4">
            <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">{([['profiles','Profils'],['engagement','Engagement'],['trading','Trading'],['subscriptions','Abonnements']] as const).map(([key,label])=><button key={key} onClick={()=>setAnalyticsTab(key)} className={'rounded-xl px-4 py-2.5 text-[9px] font-black '+(analyticsTab===key?'bg-[#0b1f35] text-white':'text-slate-500')}>{label}</button>)}</div>
            {analyticsTab==='profiles'&&<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><span className="text-[8px] font-black uppercase text-slate-400">Profils</span><b className="mt-2 block text-3xl font-black">{users.length}</b><p className="mt-1 text-[10px] text-slate-400">{users.filter(u=>u.status==='active').length} actifs · {users.filter(u=>u.status==='suspended').length} suspendus</p></div><div className="rounded-2xl border bg-white p-5"><span className="text-[8px] font-black uppercase text-slate-400">Plans</span><b className="mt-2 block text-3xl font-black">{users.filter(u=>u.plan!=='free').length}</b><p className="mt-1 text-[10px] text-slate-400">utilisateurs payants</p></div><div className="rounded-2xl border bg-white p-5"><span className="text-[8px] font-black uppercase text-slate-400">Nouveaux 7 j</span><b className="mt-2 block text-3xl font-black">{newUsers.length}</b><p className="mt-1 text-[10px] text-slate-400">créations récentes</p></div><div className="md:col-span-3 rounded-2xl border bg-white p-5"><h3 className="text-sm font-black">Répartition des profils</h3><div className="mt-4 grid gap-2 sm:grid-cols-3">{[['Starter',users.filter(u=>u.plan==='free').length,'bg-slate-100'],['Plus',users.filter(u=>u.plan==='pro').length,'bg-blue-50'],['Community',users.filter(u=>u.plan==='community').length,'bg-violet-50']].map(([l,v,b])=><div className={'rounded-xl p-4 '+String(b)}><b className="text-xl">{String(v)}</b><span className="ml-2 text-[10px] font-bold text-slate-500">{String(l)}</span></div>)}</div></div></div>}
            {analyticsTab==='engagement'&&<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{accounts.length}</b><p className="mt-1 text-[10px] text-slate-400">comptes de trading créés</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{trades.length}</b><p className="mt-1 text-[10px] text-slate-400">trades enregistrés</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{users.filter(u=>userMetrics[u.uid]?.tradeCount>0).length}</b><p className="mt-1 text-[10px] text-slate-400">traders réellement actifs</p></div><div className="md:col-span-3 rounded-2xl border bg-white p-5"><h3 className="text-sm font-black">Groupes comportementaux</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><b className="text-emerald-700">{users.filter(u=>userMetrics[u.uid]?.tradeCount>=20).length}</b><p className="mt-1 text-[9px] text-emerald-700">Traders engagés · 20+ trades</p></div><div className="rounded-xl bg-blue-50 p-4"><b className="text-blue-700">{users.filter(u=>userMetrics[u.uid]?.tradeCount>0&&userMetrics[u.uid]?.tradeCount<20).length}</b><p className="mt-1 text-[9px] text-blue-700">Traders occasionnels</p></div><div className="rounded-xl bg-slate-50 p-4"><b className="text-slate-700">{users.filter(u=>userMetrics[u.uid]?.tradeCount===0).length}</b><p className="mt-1 text-[9px] text-slate-500">Profils sans activité trading</p></div></div></div></div>}
            {analyticsTab==='trading'&&<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{trades.length}</b><p className="text-[10px] text-slate-400">trades</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{accounts.length}</b><p className="text-[10px] text-slate-400">comptes</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{users.filter(u=>(userMetrics[u.uid]?.pnlPercent||0)>0).length}</b><p className="text-[10px] text-slate-400">profils actuellement positifs</p></div><div className="md:col-span-3 rounded-2xl border bg-white p-5"><h3 className="text-sm font-black">Groupes de performance</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><b>{users.filter(u=>(userMetrics[u.uid]?.pnlPercent||0)>=5).length}</b><p className="text-[9px] text-emerald-700">≥ +5%</p></div><div className="rounded-xl bg-slate-50 p-4"><b>{users.filter(u=>{const x=userMetrics[u.uid]?.pnlPercent;return x!==null&&x>-5&&x<5}).length}</b><p className="text-[9px] text-slate-500">Entre -5% et +5%</p></div><div className="rounded-xl bg-rose-50 p-4"><b>{users.filter(u=>(userMetrics[u.uid]?.pnlPercent||0)<=-5).length}</b><p className="text-[9px] text-rose-700">≤ -5%</p></div></div></div></div>}
            {analyticsTab==='subscriptions'&&<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{users.filter(u=>u.plan==='pro').length}</b><p className="text-[10px] text-slate-400">Plus</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{users.filter(u=>u.plan==='community').length}</b><p className="text-[10px] text-slate-400">Community</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{payments.filter(p=>p.status==='paid').length}</b><p className="text-[10px] text-slate-400">paiements confirmés</p></div><div className="md:col-span-3 rounded-2xl border bg-white p-5"><h3 className="text-sm font-black">Conversion et rétention</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-blue-50 p-4"><b>{stats.total?Math.round(stats.paid/stats.total*100):0}%</b><p className="text-[9px] text-blue-700">utilisateurs avec paiement</p></div><div className="rounded-xl bg-amber-50 p-4"><b>{stats.expiring}</b><p className="text-[9px] text-amber-700">abonnements proches de l’échéance</p></div><div className="rounded-xl bg-rose-50 p-4"><b>{stats.expired}</b><p className="text-[9px] text-rose-700">abonnements expirés</p></div></div></div></div>}
          </section>}

          {adminTab==='audit' && <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-sm font-black">Journal d’audit</h2><p className="mt-1 text-[10px] text-slate-400">Traçabilité des actions administratives.</p></div><div className="divide-y divide-slate-100">{logs.slice(0,50).map(l=><div key={l.id} className="flex gap-3 p-4"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100"><History className="h-3.5 w-3.5 text-slate-500"/></div><div><b className="text-[10px] text-slate-800">{l.action} · {l.userName}</b><p className="mt-1 text-[9px] text-slate-400">{l.details}</p></div></div>)}{!logs.length&&<div className="p-10 text-center text-xs text-slate-400">Aucune action enregistrée.</div>}</div></section>}

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        </main>
    </div>
  );
}