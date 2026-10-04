import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BellRing, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, Edit3, History, Mail, RefreshCw, Search, Send, ShieldCheck, Trash2, UserCheck, UserX, Users, X, XCircle } from 'lucide-react';
import { AdminLog, PaymentRecord, SubscriptionPlan, UserProfile, UserStatus, TradingAccount, Trade } from '../types';
import { addAdminLog, deleteContactMessage, getAdminLogs, getAllAccounts, getAllTrades, getAllUsers, subscribeAllPayments, subscribeAllUsers, subscribeContactMessages, updateContactMessage, updateUserRoleAndPlan } from '../services/firestore';
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

    return (
    <div className="min-h-full bg-[#f6f8fb] -m-4 lg:-m-6 p-3 sm:p-4 lg:p-6">
      <div className="mx-auto flex max-w-[1560px] gap-4 lg:gap-6">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <div className="sticky top-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,.05)]">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b1f35] text-white"><ShieldCheck className="h-5 w-5" /></div>
                <div><div className="text-[11px] font-black tracking-wide text-slate-950">IAMTRADER</div><div className="mt-0.5 text-[9px] font-medium text-slate-400">Administration</div></div>
              </div>
            </div>
            <div className="p-2.5">
              <div className="px-3 pb-2 pt-1 text-[8px] font-black uppercase tracking-[.18em] text-slate-400">Workspace</div>
              {([
                ['overview','Vue d’ensemble',Activity],
                ['users','Utilisateurs',Users],
                ['subscriptions','Abonnements',Clock3],
                ['payments','Paiements',CreditCard],
                ['support','Support',Mail],
                ['analytics','Analytics',Activity],
                ['audit','Journal d’audit',History]
              ] as const).map(([key,label,Icon]) => (
                <button key={key} onClick={() => setAdminTab(key)} className={'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[10px] font-bold transition ' + (adminTab === key ? 'bg-[#0b1f35] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}>
                  <Icon className="h-4 w-4 shrink-0" /><span>{label}</span>
                  {key === 'support' && contactMessages.filter(m => m.status === 'new').length > 0 && <span className="ml-auto rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] font-black text-blue-700">{contactMessages.filter(m => m.status === 'new').length}</span>}
                </button>
              ))}
            </div>
            <div className="m-2.5 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Temps réel actif</div>
              <div className="mt-1 text-[8px] leading-4 text-slate-400">Utilisateurs, paiements et support synchronisés.</div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="sticky top-2 z-30 mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur lg:top-4">
            <div className="min-w-0">
              <div className="truncate text-[9px] font-black uppercase tracking-[.16em] text-slate-400">Admin Console / {adminTab === 'overview' ? 'Vue d’ensemble' : adminTab === 'users' ? 'Utilisateurs' : adminTab === 'subscriptions' ? 'Abonnements' : adminTab === 'payments' ? 'Paiements' : adminTab === 'support' ? 'Support' : adminTab === 'analytics' ? 'Analytics' : 'Journal d’audit'}</div>
              <div className="mt-0.5 truncate text-sm font-black text-slate-950">Centre de contrôle IAMTRADER</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1.5 text-[9px] font-black text-emerald-700 sm:inline-flex">● LIVE</span>
              <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} />Actualiser</button>
            </div>
          </div>

          <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 lg:hidden">
            {([
              ['overview','Vue d’ensemble'],['users','Utilisateurs'],['subscriptions','Abonnements'],['payments','Paiements'],['support','Support'],['analytics','Analytics'],['audit','Audit']
            ] as const).map(([key,label]) => <button key={key} onClick={() => setAdminTab(key)} className={'whitespace-nowrap rounded-xl px-3 py-2 text-[9px] font-bold ' + (adminTab === key ? 'bg-[#0b1f35] text-white' : 'text-slate-500 hover:bg-slate-50')}>{label}</button>)}
          </div>

          {adminTab === 'overview' && <>
            <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                ['Utilisateurs',stats.total,Users,'bg-blue-50 text-blue-600'],
                ['Actifs',stats.active,UserCheck,'bg-emerald-50 text-emerald-600'],
                ['Paiements confirmés',stats.paid,CreditCard,'bg-violet-50 text-violet-600'],
                ['Échéances proches',stats.expiring,AlertTriangle,'bg-amber-50 text-amber-600']
              ].map(([label,value,Icon,cls]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">{String(label)}</span><span className={'flex h-8 w-8 items-center justify-center rounded-lg ' + String(cls)}><Icon className="h-4 w-4" /></span></div><div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{String(value)}</div><div className="mt-1 text-[9px] text-slate-400">Données synchronisées en temps réel</div></div>)}
            </section>
            <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-xs font-black text-slate-950">Activité récente</h2><p className="mt-1 text-[9px] text-slate-400">Dernières transactions enregistrées</p></div><button onClick={() => setAdminTab('payments')} className="text-[9px] font-black text-blue-600">Voir tout</button></div>
                <div className="divide-y divide-slate-100">
                  {payments.slice(0,6).length ? payments.slice(0,6).map(p => <div key={p.id} className="flex items-center gap-3 px-5 py-3.5"><div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' + (p.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : p.status === 'processing' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}><CreditCard className="h-4 w-4" /></div><div className="min-w-0 flex-1"><b className="block truncate text-[10px] text-slate-800">{p.displayName || p.email}</b><span className="block truncate text-[9px] text-slate-400">{p.planName} · {p.reference}</span></div><div className="text-right"><b className="block text-[10px] font-black text-slate-900">{Number(p.amount).toFixed(2)} {p.currency}</b><span className="text-[8px] text-slate-400">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</span></div></div>) : <div className="p-10 text-center text-[10px] text-slate-400">Aucune activité de paiement.</div>}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle className="h-4 w-4" /></div><div><h2 className="text-xs font-black text-slate-950">À surveiller</h2><p className="text-[9px] text-slate-400">Actions prioritaires</p></div></div>
                <div className="mt-5 space-y-2.5">
                  <button onClick={() => { setAdminTab('subscriptions'); setFilter('pending'); }} className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100"><span><b className="block text-[10px] text-slate-800">Changements en attente</b><span className="text-[8px] text-slate-400">Validation nécessaire</span></span><strong className="text-sm text-slate-950">{stats.pending}</strong></button>
                  <button onClick={() => { setAdminTab('users'); setFilter('expiring'); }} className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100"><span><b className="block text-[10px] text-slate-800">Abonnements proches</b><span className="text-[8px] text-slate-400">5 jours ou moins</span></span><strong className="text-sm text-amber-600">{stats.expiring}</strong></button>
                  <button onClick={() => setAdminTab('support')} className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100"><span><b className="block text-[10px] text-slate-800">Tickets nouveaux</b><span className="text-[8px] text-slate-400">Support client</span></span><strong className="text-sm text-blue-600">{contactMessages.filter(m => m.status === 'new').length}</strong></button>
                </div>
              </section>
            </div>
          </>}

          {(adminTab === 'users' || adminTab === 'subscriptions') && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div><div className="text-[9px] font-black uppercase tracking-[.15em] text-blue-600">{adminTab === 'users' ? 'Directory' : 'Subscription management'}</div><h2 className="mt-1 text-lg font-black text-slate-950">{adminTab === 'users' ? 'Utilisateurs' : 'Gestion des abonnements'}</h2><p className="mt-1 text-[10px] text-slate-400">Recherche, filtrage et gestion opérationnelle des comptes.</p></div>
                <div className="relative w-full xl:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un utilisateur..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[10px] font-medium outline-none focus:border-blue-300 focus:bg-white" /></div>
              </div>
              <div className="mt-4 flex gap-1.5 overflow-x-auto">
                {([
                  ['all','Tous',stats.total],['active','Actifs',stats.active],['suspended','Suspendus',users.filter(u=>u.status==='suspended').length],['pending','En attente',stats.pending],['expiring','≤ 5 jours',stats.expiring],['expired','Expirés',stats.expired]
                ] as const).map(([key,label,count]) => <button key={key} onClick={() => setFilter(key)} className={'whitespace-nowrap rounded-lg px-2.5 py-2 text-[9px] font-bold ' + (filter===key ? 'bg-[#0b1f35] text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}>{label} <span className={filter===key ? 'text-white/60' : 'text-slate-400'}>{count}</span></button>)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Utilisateur','Plan','Statut','Paiement','Échéance','Activité',''].map(h=><th key={h} className="px-5 py-3 text-[8px] font-black uppercase tracking-[.12em] text-slate-400">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map(u => { const d=remaining(u); const m=userMetrics[u.uid]; return <tr key={u.uid} className="group hover:bg-slate-50/60"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b1f35] text-[10px] font-black text-white">{(u.displayName||u.email).slice(0,1).toUpperCase()}</div><div className="min-w-0"><b className="block max-w-[220px] truncate text-[10px] text-slate-900">{u.displayName||'Sans nom'}</b><span className="block max-w-[220px] truncate text-[9px] text-slate-400">{u.email}</span></div></div></td><td className="px-5 py-3.5"><span className={'rounded-full border px-2 py-1 text-[8px] font-black ' + planClass(u.plan)}>{planLabel(u.plan)}</span></td><td className="px-5 py-3.5"><span className={'inline-flex items-center gap-1.5 text-[9px] font-bold ' + (u.status==='active'?'text-emerald-600':'text-rose-600')}><span className={'h-1.5 w-1.5 rounded-full ' + (u.status==='active'?'bg-emerald-500':'bg-rose-500')} />{u.status==='active'?'Actif':'Suspendu'}</span></td><td className="px-5 py-3.5 text-[9px] font-bold text-slate-600">{u.paymentStatus==='paid'?'Confirmé':u.paymentStatus==='refunded'?'Remboursé':'Non payé'}</td><td className="px-5 py-3.5"><span className={'text-[9px] font-bold ' + (d!==null&&d<6?'text-amber-600':'text-slate-600')}>{d===null?'Illimité':d<0?'Expiré':d+' j'}</span><span className="block text-[8px] text-slate-400">{fmt(u.subscriptionExpiresAt)}</span></td><td className="px-5 py-3.5"><span className="text-[9px] text-slate-500">{m?.tradeCount||0} trades</span>{m?.pnlPercent!==null&&m?.pnlPercent!==undefined&&<span className={'ml-2 text-[9px] font-bold ' + (m.pnlPercent>=0?'text-emerald-600':'text-rose-600')}>{m.pnlPercent>=0?'+':''}{m.pnlPercent.toFixed(1)}%</span>}</td><td className="px-5 py-3.5 text-right"><button onClick={()=>openManage(u)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[8px] font-black text-slate-600 opacity-80 hover:border-slate-300 hover:bg-slate-50 group-hover:opacity-100">Gérer</button></td></tr> })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3"><span className="text-[9px] text-slate-400">{filtered.length} résultat(s)</span><div className="flex items-center gap-1.5"><button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5"/></button><span className="text-[9px] font-bold text-slate-500">{page} / {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5"/></button></div></div>
          </section>}

          {(adminTab === 'payments') && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.15em] text-emerald-600">Billing</div><h2 className="mt-1 text-lg font-black text-slate-950">Paiements</h2><p className="mt-1 text-[10px] text-slate-400">Registre des transactions en temps réel.</p></div><div className="flex gap-1.5">{(['all','paid','processing','failed'] as const).map(s=><button key={s} onClick={()=>setPaymentFilter(s)} className={'rounded-lg px-3 py-2 text-[9px] font-bold '+(paymentFilter===s?'bg-[#0b1f35] text-white':'bg-slate-50 text-slate-500')}>{s==='all'?'Tous':s==='paid'?'Confirmés':s==='processing'?'En cours':'Échoués'}</button>)}</div></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Client','Plan','Référence','Montant','Statut','Date'].map(h=><th key={h} className="px-5 py-3 text-[8px] font-black uppercase tracking-[.12em] text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{payments.filter(p=>paymentFilter==='all'||p.status===paymentFilter).map(p=><tr key={p.id} className="hover:bg-slate-50/60"><td className="px-5 py-3.5"><b className="block text-[10px] text-slate-800">{p.displayName||p.email}</b><span className="text-[9px] text-slate-400">{p.email}</span></td><td className="px-5 py-3.5 text-[9px] font-bold text-slate-600">{p.planName}</td><td className="px-5 py-3.5 font-mono text-[8px] text-slate-500">{p.reference}</td><td className="px-5 py-3.5 text-[10px] font-black text-slate-900">{Number(p.amount).toFixed(2)} {p.currency}</td><td className="px-5 py-3.5"><span className={'rounded-full px-2 py-1 text-[8px] font-black '+(p.status==='paid'?'bg-emerald-50 text-emerald-700':p.status==='processing'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700')}>{p.status==='paid'?'PAYÉ':p.status==='processing'?'EN COURS':'ÉCHEC'}</span></td><td className="px-5 py-3.5 text-[9px] text-slate-500">{new Date(p.createdAt).toLocaleString('fr-FR')}</td></tr>)}</tbody></table></div>
          </section>}

          {adminTab === 'support' && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.15em] text-blue-600">Customer care</div><h2 className="mt-1 text-lg font-black text-slate-950">Support</h2><p className="mt-1 text-[10px] text-slate-400">{contactMessages.filter(m=>m.status==='new').length} nouveau(x) · {contactMessages.length} message(s)</p></div><div className="flex gap-1.5">{(['all','new','in_progress','resolved'] as const).map(s=><button key={s} onClick={()=>setContactFilter(s)} className={'rounded-lg px-3 py-2 text-[9px] font-bold '+(contactFilter===s?'bg-[#0b1f35] text-white':'bg-slate-50 text-slate-500')}>{s==='all'?'Tous':s==='new'?'Nouveaux':s==='in_progress'?'En cours':'Traités'}</button>)}</div></div></div><div className="divide-y divide-slate-100">{contactMessages.filter(m=>contactFilter==='all'||m.status===contactFilter).map(m=><button key={m.id} onClick={()=>{setSelectedMessage(m);setContactNote(m.adminNote||'');setReplyText('')}} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"><div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl '+(m.status==='new'?'bg-blue-50 text-blue-600':m.status==='in_progress'?'bg-amber-50 text-amber-600':'bg-emerald-50 text-emerald-600')}>{m.status==='new'?<Mail className="h-4 w-4"/>:m.status==='in_progress'?<Clock3 className="h-4 w-4"/>:<CheckCircle2 className="h-4 w-4"/>}</div><div className="min-w-0 flex-1"><b className="block truncate text-[10px] text-slate-900">{m.subject}</b><span className="block truncate text-[9px] text-slate-400">{m.name} · {m.email}</span></div><span className="text-[8px] text-slate-400">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span></button>)}</div></section>}

          {adminTab === 'analytics' && <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">Croissance</span><div className="mt-2 text-3xl font-black text-slate-950">{newUsers.length}</div><p className="mt-1 text-[10px] text-slate-400">nouveaux utilisateurs sur 7 jours</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">Conversion</span><div className="mt-2 text-3xl font-black text-slate-950">{stats.total?Math.round(stats.paid/stats.total*100):0}%</div><p className="mt-1 text-[10px] text-slate-400">utilisateurs avec paiement confirmé</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">Trading</span><div className="mt-2 text-3xl font-black text-slate-950">{trades.length}</div><p className="mt-1 text-[10px] text-slate-400">{accounts.length} compte(s) · trades enregistrés</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-3"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600"/><div><h2 className="text-xs font-black text-slate-950">État de la plateforme</h2><p className="mt-1 text-[9px] text-slate-400">Indicateurs opérationnels en temps réel.</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Transactions',payments.length,'text-slate-900'],['Tickets',contactMessages.filter(m=>m.status==='new').length,'text-blue-600'],['En attente',stats.pending,'text-violet-600'],['Expirations',stats.expiring,'text-amber-600']].map(([l,v,cl])=><div key={String(l)} className="rounded-xl bg-slate-50 p-4"><b className={'text-xl font-black '+String(cl)}>{String(v)}</b><span className="mt-1 block text-[9px] text-slate-400">{String(l)}</span></div>)}</div></div></section>}

          {adminTab === 'audit' && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><div className="text-[9px] font-black uppercase tracking-[.15em] text-slate-500">Compliance</div><h2 className="mt-1 text-lg font-black text-slate-950">Journal d’audit</h2><p className="mt-1 text-[10px] text-slate-400">Traçabilité des actions administratives.</p></div><div className="divide-y divide-slate-100">{logs.length?logs.slice(0,40).map(l=><div key={l.id} className="flex gap-3 px-5 py-4"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><History className="h-3.5 w-3.5"/></div><div className="min-w-0"><b className="block text-[10px] text-slate-800">{l.action} · {l.userName}</b><p className="mt-1 text-[9px] text-slate-400">{l.details}</p><span className="mt-1 block text-[8px] text-slate-300">{new Date(l.createdAt).toLocaleString('fr-FR')}</span></div></div>):<div className="p-10 text-center text-[10px] text-slate-400">Aucune action enregistrée.</div>}</div></section>}
        </main>
      </div>
      {selectedMessage && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={() => setSelectedMessage(null)}>
        <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white bg-[#f7f9fc] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-slate-100 bg-white px-5 py-5 sm:px-7"><div><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" /><span className="text-[9px] font-black uppercase tracking-wider text-blue-600">Message de contact</span></div><h2 className="mt-2 text-lg font-black text-slate-900">{selectedMessage.subject}</h2><p className="mt-1 text-[11px] text-slate-400">{selectedMessage.name} · {selectedMessage.email}</p></div><button onClick={() => setSelectedMessage(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <div className="space-y-4 p-5 sm:p-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedMessage.message}</p><p className="mt-4 text-[9px] text-slate-400">{new Date(selectedMessage.createdAt).toLocaleString('fr-FR')}</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['new','in_progress','resolved'] as const).map(s => <button key={s} disabled={contactBusy} onClick={async () => { setContactBusy(true); try { const adminUid = auth.currentUser?.uid; await updateContactMessage(selectedMessage.id, { status: s, handledBy: adminUid, handledAt: new Date().toISOString(), adminNote: contactNote }); const next = { ...selectedMessage, status: s, handledBy: adminUid, handledAt: new Date().toISOString(), adminNote: contactNote, updatedAt: new Date().toISOString() }; setSelectedMessage(next); showToast(s === 'new' ? 'Message marqué comme nouveau.' : s === 'in_progress' ? 'Message placé en cours.' : 'Message marqué comme traité.', 'success'); } catch (e: any) { showToast(e?.message || 'Impossible de mettre à jour le message.', 'error'); } finally { setContactBusy(false); } }} className={'rounded-xl px-3 py-2.5 text-[10px] font-bold ' + (selectedMessage.status === s ? (s === 'new' ? 'bg-blue-600 text-white' : s === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{s === 'new' ? 'Nouveau' : s === 'in_progress' ? 'En cours' : 'Traité'}</button>)}
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
                     await updateContactMessage(selectedMessage.id, { status: 'resolved', handledBy: currentUser.uid, handledAt: now, lastReply: replyText.trim(), repliedAt: now, repliedBy: currentUser.uid });
                     setSelectedMessage(prev => prev ? { ...prev, status: 'resolved', handledBy: currentUser.uid, handledAt: now, lastReply: replyText.trim(), repliedAt: now, repliedBy: currentUser.uid, updatedAt: now } : prev);
                     setReplyText('');
                     showToast('Réponse envoyée au client.', 'success');
                   } catch (e: any) {
                     showToast(e?.message || 'Impossible d’envoyer la réponse.', 'error');
                   } finally {
                     setReplyBusy(false);
                   }
                 }} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f35] px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{replyBusy ? 'Envoi...' : 'Envoyer la réponse'}</button>
                 <button disabled={contactBusy || replyBusy} onClick={async () => { if (!window.confirm('Supprimer définitivement ce message ?')) return; setContactBusy(true); try { await deleteContactMessage(selectedMessage.id); setSelectedMessage(null); showToast('Message supprimé.', 'success'); } catch (e: any) { showToast(e?.message || 'Suppression refusée.', 'error'); } finally { setContactBusy(false); } }} className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="h-4 w-4" />Supprimer</button>
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
