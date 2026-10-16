import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BellRing, Check, CheckCircle2, ChevronLeft, Eye, ChevronRight, Clock3, CreditCard, Edit3, History, Mail, ReceiptText, RefreshCw, Search, Send, ShieldCheck, Trash2, UserCheck, UserX, Users, X, XCircle, Copy, Paperclip, Smile, MoreVertical, Info, Plus, Filter, PenLine } from 'lucide-react';
import { AdminLog, PaymentRecord, SubscriptionPlan, UserProfile, UserStatus, TradingAccount, Trade } from '../types';
import { getAdminLogs, getAllAccounts, getAllTrades, getAllUsers, subscribeAllUsers, subscribeContactMessages } from '../services/firestore';
import { adminAddLog, adminDeleteContact, adminGetPayments, adminUpdateContact, adminUpdatePayment, adminUpdateUser } from '../services/adminConsole';
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
function decodeMimeSubject(value?: string) {
  if (!value) return '';
  return value.replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_, charset, encoding, encoded) => {
    try {
      if (String(encoding).toLowerCase() === 'b') {
        const bytes = Uint8Array.from(atob(String(encoded).replace(/\s+/g, '')), c => c.charCodeAt(0));
        return new TextDecoder(String(charset || 'utf-8')).decode(bytes);
      }
      const q = String(encoded).replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const bytes = Uint8Array.from([...q].map(char => char.charCodeAt(0)));
      return new TextDecoder(String(charset || 'utf-8')).decode(bytes);
    } catch {
      return String(encoded);
    }
  });
}

function emailParts(value?: string) {
  const email = String(value || '').trim().toLowerCase();
  const at = email.indexOf('@');
  return at > 0 ? { local: email.slice(0, at), domain: email.slice(at) } : { local: email, domain: '' };
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
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [paymentActionBusy, setPaymentActionBusy] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'processing' | 'failed'>('all');
  const [contactMessages, setContactMessages] = useState<import('../services/firestore').ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<import('../services/firestore').ContactMessage | null>(null);
  const [contactFilter, setContactFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');
  const [supportSearch, setSupportSearch] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [replyText, setReplyText] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'subscriptions' | 'payments' | 'support' | 'analytics' | 'audit'>('overview');
  const [analyticsTab, setAnalyticsTab] = useState<'profiles' | 'engagement' | 'trading' | 'subscriptions'>('profiles');
  const perPage = 10;

  function openManage(user: UserProfile) {
    setSelected(user);
    setPlan(user.plan || 'free');
    setStatus(user.status || 'active');
    setPayment(user.paymentStatus || 'unpaid');
    setExpiry(inputDate(user.subscriptionExpiresAt));
    setDays('');
    setHistoryOpen(false);
  }

  async function saveManagedUser() {
    if (!selected || busy) return;
    setBusy(true);
    const subscriptionExpiresAt = isoDate(expiry) || '';
    const update: Pick<UserProfile, 'plan' | 'status' | 'paymentStatus' | 'subscriptionExpiresAt' | 'subscriptionStatus'> = {
      plan,
      status,
      paymentStatus: payment,
      subscriptionExpiresAt,
      subscriptionStatus: plan === 'free' ? 'expired' : subscriptionExpiresAt ? 'active' : 'pending'
    };
    try {
      await adminUpdateUser(selected.uid, update);
      setUsers(current => current.map(user => user.uid === selected.uid ? { ...user, ...update } : user));
      await adminAddLog({
        action: 'user-subscription-updated',
        userUid: selected.uid,
        userName: selected.displayName || selected.email,
        details: `Plan=${plan}; statut=${status}; paiement=${payment}; échéance=${subscriptionExpiresAt || 'aucune'}`
      }).catch(error => console.warn('IAMTRADER Admin audit log unavailable:', error));
      setSelected(null);
      showToast('Profil utilisateur mis à jour.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Mise à jour impossible.', 'error');
    } finally {
      setBusy(false);
    }
  }

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
    if (!selectedMessage) return;
    const liveMessage = contactMessages.find(message => message.id === selectedMessage.id);
    if (liveMessage) setSelectedMessage(liveMessage);
  }, [contactMessages, selectedMessage?.id]);

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

  const userMetrics = useMemo(() => {
    const result: Record<string, { initialCapital: number; totalPnl: number; tradeCount: number; pnlPercent: number | null; currency: string }> = {};
    users.forEach(u => {
      const userAccounts = accounts.filter(a => a.userId === u.uid);
      const userTrades = trades.filter(t => t.userId === u.uid);
      const initialCapital = userAccounts.reduce((sum, a) => sum + Number((a as any).initialBalance ?? (a as any).initialCapital ?? (a as any).balance ?? 0), 0);
      const totalPnl = userTrades.reduce((sum, t) => sum + Number((t as any).pnl ?? (t as any).profitLoss ?? (t as any).profit ?? (t as any).result ?? 0), 0);
      result[u.uid] = {
        initialCapital,
        totalPnl,
        tradeCount: userTrades.length,
        pnlPercent: initialCapital > 0 ? (totalPnl / initialCapital) * 100 : null,
        currency: 'USD'
      };
    });
    return result;
  }, [users, accounts, trades]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter(u => {
      const matchesSearch = !query || [u.displayName, u.email].filter(Boolean).some(v => String(v).toLowerCase().includes(query));
      const d = remaining(u);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && u.status === 'active') ||
        (filter === 'suspended' && u.status === 'suspended') ||
        (filter === 'pending' && Boolean(u.planRequest)) ||
        (filter === 'expiring' && d !== null && d >= 0 && d <= 5) ||
        (filter === 'expired' && d !== null && d < 0);
      return matchesSearch && matchesFilter;
    });
  }, [users, search, filter]);

  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const pagedUsers = visible.slice((page - 1) * perPage, page * perPage);
  const newUsers = users.filter(u => {
    const created = new Date(u.createdAt || '').getTime();
    return Number.isFinite(created) && Date.now() - created <= 7 * DAY;
  });
  const stats = {
    total: users.length,
    paid: users.filter(u => u.plan !== 'free').length,
    expiring: overviewExpiringUsers.length,
    expired: users.filter(u => {
      const d = remaining(u);
      return d !== null && d < 0;
    }).length
  };

  async function sendSupportReply() {
    if (!selectedMessage || !replyText.trim() || replyBusy) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setReplyBusy(true);
    try {
      const idToken = await currentUser.getIdToken();
      const thread = Array.isArray(selectedMessage.conversation) ? selectedMessage.conversation : [];
      const customerEmail = String(selectedMessage.email || '').trim().toLowerCase();
      const lastInbound = [...thread].reverse().find(item => {
        const from = String(item.from || '').trim().toLowerCase();
        return from === customerEmail || (item.direction === 'inbound' && from !== 'hello@iamtrader.trade');
      });
      const response = await fetch('/api/contact-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({
          to: selectedMessage.email,
          subject: decodeMimeSubject(selectedMessage.subject),
          reply: replyText.trim(),
          name: selectedMessage.name,
          inReplyTo: lastInbound?.messageId || '',
          references: thread.map(item => item.messageId).filter(Boolean).slice(-20).join(' '),
          conversationId: selectedMessage.id
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; messageId?: string; id?: string };
      if (!response.ok) throw new Error(payload?.error || 'Envoi impossible');

      const now = new Date().toISOString();
      const outbound = {
        id: 'outbound-' + Date.now(),
        direction: 'outbound' as const,
        body: replyText.trim(),
        at: now,
        from: 'hello@iamtrader.trade',
        to: selectedMessage.email,
        messageId: payload?.messageId || payload?.id || undefined
      };
      const normalizeConversation = (items: import('../services/firestore').ContactConversationMessage[]) => items.map(item => {
        const from = String(item.from || '').trim().toLowerCase();
        const to = String(item.to || '').trim().toLowerCase();
        let direction = item.direction;
        if (from === customerEmail) direction = 'inbound';
        else if (from === 'hello@iamtrader.trade' || to === customerEmail) direction = 'outbound';
        else if (!from && !to && String(item.body || '') === String(selectedMessage.message || '')) direction = 'inbound';
        return { ...item, direction };
      });

      const existingConversation = Array.isArray(selectedMessage.conversation) && selectedMessage.conversation.length
        ? normalizeConversation(selectedMessage.conversation)
        : normalizeConversation([
            { id:'legacy-inbound', direction:'inbound' as const, body:selectedMessage.message, at:selectedMessage.createdAt || now, from:selectedMessage.email, to:'hello@iamtrader.trade' }
          ]);
      const conversation = [...existingConversation, outbound];

      await adminUpdateContact(selectedMessage.id, {
        status:'resolved',
        handledBy:currentUser.uid,
        handledAt:now,
        lastReply:replyText.trim(),
        repliedAt:now,
        repliedBy:currentUser.uid,
        conversation
      });
      setSelectedMessage(prev => prev ? { ...prev, status:'resolved', lastReply:replyText.trim(), repliedAt:now, repliedBy:currentUser.uid, conversation } : prev);
      setReplyText('');
      showToast('Message envoyé.', 'success');
    } catch (e:any) {
      showToast(e?.message || 'Envoi impossible.', 'error');
    } finally {
      setReplyBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f4f7fb] -m-4 lg:-m-6">
      <div className="mx-auto min-h-screen w-full max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <nav aria-label="Navigation de la console administrateur" className="mb-5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">
          <div className="flex w-max min-w-full gap-1">
            {([
              ['overview','Vue d’ensemble',Activity],['users','Utilisateurs',Users],['subscriptions','Abonnements',Clock3],['payments','Paiements',CreditCard],['support','Support',Mail],['analytics','Analytics',Activity],['audit','Journal d’audit',History]
            ] as const).map(([key,label,Icon])=><button key={key} onClick={()=>setAdminTab(key)} aria-current={adminTab===key?'page':undefined} className={'relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition-colors '+(adminTab===key?'bg-[#e5faf5] text-[#008f76]':'text-slate-600 hover:bg-slate-50 hover:text-[#10243b]')}><Icon className={'h-4 w-4 shrink-0 '+(adminTab===key?'text-[#00a98f]':'text-slate-400')}/><span>{label}</span>{key==='support'&&contactMessages.filter(m=>m.status==='new').length>0&&<span className={'ml-1 rounded-full px-2 py-0.5 text-xs font-bold '+(adminTab===key?'bg-[#22c7c7] text-[#10243b]':'bg-teal-50 text-teal-700')}>{contactMessages.filter(m=>m.status==='new').length}</span>}</button>)}
          </div>
        </nav>        <main className="space-y-5">
          <header className="border-b border-slate-200 pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><div className="mb-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Console administrateur</div><h1 className="text-2xl font-bold tracking-tight text-[#0b1f35]">{adminTab==='overview'?'Dashboard admin':adminTab==='users'?'Utilisateurs':adminTab==='subscriptions'?'Abonnements':adminTab==='payments'?'Paiements':adminTab==='support'?'Support':adminTab==='analytics'?'Analytics':'Journal d’audit'}</h1><p className="mt-1 text-sm text-slate-400">{adminTab==='subscriptions'?'Suivi commercial des abonnements, répartition des plans et paiements à confirmer.':adminTab==='analytics'?'Lecture comportementale et performance des utilisateurs.':'Pilotage opérationnel de la plateforme IAMTRADER.'}</p></div>
              <button onClick={load} disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"><RefreshCw className={'h-3.5 w-3.5 '+(loading?'animate-spin':'')}/>Actualiser</button>
            </div>
          </header>

          {adminTab==='overview' && <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ['Utilisateurs actifs', users.filter(u => u.status === 'active').length, 'bg-[#dff8f5] text-[#087f78]', '↗', 'border-[#c7eee8] bg-gradient-to-br from-white to-[#effcf9]'],
                ['Revenu confirmé', '$ ' + overviewRevenue.toFixed(2), 'bg-[#e6efff] text-[#2858b8]', '$', 'border-[#d8e5fb] bg-gradient-to-br from-white to-[#f1f6ff]'],
                ['Abonnements actifs', overviewPaidUsers.length, 'bg-[#eee8ff] text-[#6541b8]', '●', 'border-[#e4dafc] bg-gradient-to-br from-white to-[#f8f5ff]'],
                ['Paiements à confirmer', overviewPendingPayments.length, 'bg-[#fff1d6] text-[#a45b00]', '!', 'border-[#f6dfb4] bg-gradient-to-br from-white to-[#fff9ec]'],
                ['Tickets ouverts', overviewOpenTickets.length, 'bg-[#e1f3ff] text-[#176a9a]', '?', 'border-[#d0eaf9] bg-gradient-to-br from-white to-[#f1f9ff]'],
                ['Échéances ≤ 5 jours', overviewExpiringUsers.length, 'bg-[#ffe8ed] text-[#b4234d]', '◷', 'border-[#f8d5df] bg-gradient-to-br from-white to-[#fff5f7]']
              ].map(([label, value, tone, icon, cardTone]) => (
                <div key={String(label)} className={'rounded-lg border p-3 ' + String(cardTone)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{String(label)}</span>
                    <span className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black ' + String(tone)}>{String(icon)}</span>
                  </div>
                  <b className="mt-2.5 block text-2xl font-black tracking-tight text-[#0b1f35]">{String(value)}</b>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.55fr_.8fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-[#0b1f35]">Revenus & activité commerciale</h2>
                    <p className="mt-1 text-sm text-slate-400">Lecture rapide des paiements et de la croissance des abonnements.</p>
                  </div>
                  <button onClick={() => setAdminTab('payments')} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Voir les paiements</button>
                </div>
                <div className="mt-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><span className="text-xs font-bold text-emerald-800">Conversion payante</span><p className="mt-1 text-xs text-emerald-700">Part des utilisateurs avec un forfait payant</p></div>
                    <b className="text-2xl font-black text-emerald-700">{users.length ? Math.round((overviewPaidUsers.length / users.length) * 100) : 0}%</b>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-3 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Répartition des abonnements</span><span className="text-xs font-bold text-slate-400">{overviewPaidUsers.length} actifs</span></div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-blue-600" style={{width: overviewPaidUsers.length ? ((users.filter(u => u.plan === 'pro').length / overviewPaidUsers.length) * 100) + '%' : '0%'}} />
                    <div className="bg-violet-500" style={{width: overviewPaidUsers.length ? ((users.filter(u => u.plan === 'community').length / overviewPaidUsers.length) * 100) + '%' : '0%'}} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />Plus · {users.filter(u => u.plan === 'pro').length}</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-500" />Community · {users.filter(u => u.plan === 'community').length}</span></div>
                </div>
              </section>

              <section className="rounded-xl bg-[#0b1f35] p-4 text-white">
                <div className="flex items-start justify-between"><div><div className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Centre opérationnel</div><h2 className="mt-2 text-lg font-black">À traiter maintenant</h2><p className="mt-1 text-sm text-slate-300">Les éléments qui nécessitent une intervention.</p></div><Activity className="h-5 w-5 text-emerald-300" /></div>
                <div className="mt-5 space-y-2">
                  {[
                    ['Paiements à confirmer', overviewPendingPayments.length, 'payments', 'amber'],
                    ['Demandes de plan', users.filter(u => u.planRequest).length, 'subscriptions', 'blue'],
                    ['Support non traité', overviewOpenTickets.length, 'support', 'violet'],
                    ['Échéances proches', overviewExpiringUsers.length, 'subscriptions', 'rose']
                  ].map(([label, value, target, tone]) => (
                    <button key={String(label)} onClick={() => setAdminTab(target as typeof adminTab)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10">
                      <span className="text-sm font-bold">{String(label)}</span>
                      <span className={'rounded-full px-2 py-1 text-xs font-black ' + (tone === 'amber' ? 'bg-amber-100 text-amber-800' : tone === 'rose' ? 'bg-rose-100 text-rose-800' : tone === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800')}>{String(value)} →</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><div><h2 className="text-sm font-black text-[#0b1f35]">Activité récente</h2><p className="mt-1 text-sm text-slate-400">Derniers profils créés.</p></div><Users className="h-4 w-4 text-slate-400" /></div>
                <div className="mt-3 divide-y divide-slate-100">
                  {overviewRecentUsers.map(u => <div key={u.uid} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><b className="block truncate text-sm text-slate-800">{u.displayName || u.email}</b><span className="text-xs text-slate-400">{fmt(u.createdAt)}</span></div><span className={'shrink-0 rounded-full px-2 py-1 text-xs font-black ' + (u.plan === 'free' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700')}>{planLabel(u.plan)}</span></div>)}
                  {!overviewRecentUsers.length && <div className="py-8 text-center text-sm text-slate-400">Aucune activité récente.</div>}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><div><h2 className="text-sm font-black text-[#0b1f35]">Santé du trading</h2><p className="mt-1 text-sm text-slate-400">Engagement réel des traders.</p></div><Activity className="h-4 w-4 text-emerald-600" /></div>
                <div className="mt-4 space-y-1"><div className="flex items-center justify-between py-2"><span className="text-sm text-slate-500">Comptes créés</span><b className="text-sm">{accounts.length}</b></div><div className="flex items-center justify-between border-t border-slate-100 py-2"><span className="text-sm text-slate-500">Trades enregistrés</span><b className="text-sm">{trades.length}</b></div><div className="flex items-center justify-between border-t border-slate-100 py-2"><span className="text-sm text-slate-500">Traders actifs</span><b className="text-sm text-emerald-700">{overviewActiveTraders}</b></div></div>
                <button onClick={() => setAdminTab('analytics')} className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Explorer Analytics</button>
              </section>


            </div>
          </section>}

          {adminTab==='users' && <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un utilisateur..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-xs outline-none"/></div><select value={filter} onChange={e=>setFilter(e.target.value as Filter)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold"><option value="all">Tous les profils</option><option value="active">Actifs</option><option value="suspended">Suspendus</option><option value="pending">Demandes de plan</option><option value="expiring">Échéance ≤ 5 j</option><option value="expired">Expirés</option></select></div>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className="bg-slate-50"><tr className="text-left text-xs font-black uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Utilisateur</th><th>Plan</th><th>P&L</th><th>Trades</th><th>Paiement</th><th>Échéance</th><th>Statut</th><th className="pr-4 text-right">Action</th></tr></thead><tbody>{pagedUsers.map(u=>{const m=userMetrics[u.uid]||{initialCapital:0,totalPnl:0,tradeCount:0,pnlPercent:null,currency:'USD'};const d=remaining(u);return <tr key={u.uid} className="border-t border-slate-100 hover:bg-slate-50/60"><td className="px-4 py-3.5"><button onClick={()=>openManage(u)} className="text-left"><b className="block text-xs text-slate-800">{u.displayName||'Sans nom'}</b><span className="text-xs text-slate-400">{u.email}</span></button></td><td><span className={'rounded-lg border px-2 py-1 text-xs font-bold '+planClass(u.plan)}>{planLabel(u.plan)}</span></td><td><b className={'text-sm '+(m.pnlPercent===null?'text-slate-400':m.pnlPercent>=0?'text-emerald-600':'text-rose-600')}>{m.pnlPercent===null?'—':(m.pnlPercent>=0?'+':'')+m.pnlPercent.toFixed(2)+'%'}</b></td><td><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{m.tradeCount}</span></td><td className="text-sm font-semibold">{u.paymentStatus==='paid'?'Confirmé':'Non payé'}</td><td className="text-sm font-semibold">{d===null?'—':fmt(u.subscriptionExpiresAt)}</td><td><span className={'rounded-full px-2 py-1 text-xs font-bold '+(u.status==='active'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700')}>{u.status==='active'?'Actif':'Suspendu'}</span></td><td className="pr-4 text-right"><button onClick={()=>openManage(u)} className="rounded-xl bg-[#0b1f35] px-3 py-2 text-xs font-bold text-white">Gérer</button></td></tr>})}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">Page {page} / {totalPages}<span className="flex gap-1"><button disabled={page===1} onClick={()=>setPage(page-1)} className="rounded-lg border p-1.5 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5"/></button><button disabled={page===totalPages} onClick={()=>setPage(page+1)} className="rounded-lg border p-1.5 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5"/></button></span></div></section>
          </section>}

          {adminTab==='subscriptions' && <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-xs font-black uppercase text-slate-400">Plus</span><b className="mt-2 block text-2xl font-black text-blue-700">{users.filter(u=>u.plan==='pro').length}</b><span className="text-xs text-slate-400">abonnés actifs</span></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-xs font-black uppercase text-slate-400">Community</span><b className="mt-2 block text-2xl font-black text-violet-700">{users.filter(u=>u.plan==='community').length}</b><span className="text-xs text-slate-400">abonnés actifs</span></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><span className="text-xs font-black uppercase text-amber-700">Paiements à confirmer</span><b className="mt-2 block text-2xl font-black text-amber-800">{payments.filter(p=>p.status==='processing').length}</b><span className="text-xs text-amber-700">transactions en cours</span></div></div>
            <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black text-[#0b1f35]">Abonnements récents</h2><div className="mt-4 divide-y divide-slate-100">{payments.filter(p=>p.status==='paid').slice(0,10).map(p=><div key={p.id} className="flex items-center justify-between py-3"><div><b className="block text-xs text-slate-800">{p.displayName||p.email}</b><span className="text-xs text-slate-400">{p.planName} · {new Date(p.paidAt||p.createdAt||'').toLocaleDateString('fr-FR')}</span></div><b className="text-xs text-emerald-700">{Number(p.amount).toFixed(2)} {p.currency}</b></div>)}</div></section><section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black text-[#0b1f35]">Paiements en attente de confirmation</h2><div className="mt-4 divide-y divide-slate-100">{payments.filter(p=>p.status==='processing'||p.status==='initiated').slice(0,10).map(p=><div key={p.id} className="flex items-center justify-between py-3"><div><b className="block text-xs text-slate-800">{p.displayName||p.email}</b><span className="text-xs text-slate-400">{p.planName} · {p.reference}</span></div><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">EN ATTENTE</span></div>)}{payments.filter(p=>p.status==='processing'||p.status==='initiated').length===0&&<div className="py-10 text-center text-sm text-slate-400">Aucun paiement en attente.</div>}</div></section></div>
          </section>}

          {adminTab==='payments' && <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-xs font-black uppercase text-slate-400">Transactions</span><b className="mt-2 block text-2xl font-black">{payments.length}</b></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><span className="text-xs font-black uppercase text-emerald-700">Confirmés</span><b className="mt-2 block text-2xl font-black text-emerald-700">{payments.filter(p=>p.status==='paid').length}</b></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><span className="text-xs font-black uppercase text-amber-700">En cours</span><b className="mt-2 block text-2xl font-black text-amber-700">{payments.filter(p=>p.status==='processing'||p.status==='initiated').length}</b></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-xs font-black uppercase text-slate-400">CA confirmé</span><b className="mt-2 block text-2xl font-black">$ {payments.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount||0),0).toFixed(2)}</b></div></div>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="text-xs font-black text-[#0b1f35]">Transactions</h3><p className="mt-1 text-xs text-slate-400">Registre des paiements et actions administratives.</p></div>
                  <div className="flex flex-wrap gap-2">{(['all','paid','processing','failed'] as const).map(s=><button key={s} onClick={()=>setPaymentFilter(s)} className={'rounded-xl px-3 py-2 text-xs font-bold '+(paymentFilter===s?'bg-[#0b1f35] text-white':'bg-slate-100 text-slate-500 hover:bg-slate-200')}>{s==='all'?'Tous':s==='paid'?'Confirmés':s==='processing'?'En cours':'Échoués'}</button>)}</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left">
                  <thead className="bg-slate-50/80">
                    <tr className="border-b border-slate-200">
                      {['#','Date','ID client','Nom complet','Email','Plan','Montant','Statut','Actions'].map(h=><th key={h} className="px-4 py-3 text-xs font-black uppercase tracking-[.12em] text-slate-400">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.filter(p=>paymentFilter==='all'||p.status===paymentFilter).map(p=>{
                      const rowName=(p as any).fullName || p.payerName || p.displayName || '—';
                      const rowStatus=p.status==='paid'?'PAYÉ':p.status==='processing'||p.status==='initiated'?'EN ATTENTE':p.status==='cancelled'?'ANNULÉ':p.status==='invalidated'?'INVALIDÉ':'ÉCHEC';
                      const rowTone=p.status==='paid'?'bg-emerald-50 text-emerald-700':p.status==='processing'||p.status==='initiated'?'bg-amber-50 text-amber-700':p.status==='cancelled'?'bg-slate-100 text-slate-600':'bg-rose-50 text-rose-700';
                      return <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-3"><span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-100 px-2 text-xs font-black text-slate-500">{payments.filter(x=>paymentFilter==='all'||x.status===paymentFilter).indexOf(p)+1}</span></td><td className="whitespace-nowrap px-4 py-3"><div className="text-sm font-semibold text-slate-700">{new Date(p.createdAt||'').toLocaleDateString('fr-FR')}</div><div className="text-xs text-slate-400">{new Date(p.createdAt||'').toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div></td>
                        <td className="max-w-[180px] px-4 py-3"><span className="block truncate font-mono text-xs font-black text-[#0b1f35]" title={p.reference}>{p.reference || p.id}</span><span className="mt-1 block truncate text-xs text-slate-400" title={(p as any).invoiceNumber}>Facture {(p as any).invoiceNumber || ("INV-" + String(p.id || "").slice(-8).toUpperCase())}</span></td>
                        <td className="whitespace-nowrap px-4 py-3"><div className="text-sm font-black text-[#0b1f35]">{rowName}</div><div className="text-xs text-slate-400">{p.displayName || '—'}</div></td>
                        <td className="max-w-[180px] px-4 py-3"><span className="block truncate text-xs text-slate-500">{p.email}</span></td>
                        <td className="whitespace-nowrap px-4 py-3"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{p.planName || (p.plan==='pro'?'Plus':'Community')}</span></td>
                        <td className="whitespace-nowrap px-4 py-3"><div className="text-sm font-black text-[#0b1f35]">{Number(p.amount||0).toFixed(2)} {p.currency}</div><div className="text-xs text-slate-400">frais {Number(p.paymentFee||0).toFixed(2)}</div></td>
                        <td className="whitespace-nowrap px-4 py-3"><span className={'rounded-full px-2.5 py-1 text-xs font-black '+rowTone}>{rowStatus}</span></td>
                        <td className="px-4 py-3"><div className="flex items-center gap-1.5">
                          <button onClick={()=>setSelectedPayment(p)} title="Voir les détails" className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"><Eye className="h-3 w-3"/>Détails</button>
                          <button disabled={paymentActionBusy||p.status==='paid'} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'paid',paidAt:new Date().toISOString(),confirmedAt:new Date().toISOString()});await refreshPayments();showToast('Paiement validé.');}catch(e:any){showToast(e?.message||'Validation impossible.');}finally{setPaymentActionBusy(false);}}} title="Valider" className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-30"><Check className="h-3 w-3"/></button>
                          <button disabled={paymentActionBusy} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'invalidated',invalidatedAt:new Date().toISOString()});await refreshPayments();showToast('Paiement invalidé.');}catch(e:any){showToast(e?.message||'Invalidation impossible.');}finally{setPaymentActionBusy(false);}}} title="Invalider" className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-black text-rose-700 disabled:opacity-50"><XCircle className="h-3 w-3"/></button>
                          <button disabled={paymentActionBusy} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'cancelled',cancelledAt:new Date().toISOString()});await refreshPayments();showToast('Paiement annulé.');}catch(e:any){showToast(e?.message||'Annulation impossible.');}finally{setPaymentActionBusy(false);}}} title="Annuler" className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"><X className="h-3 w-3"/></button>
                        </div></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
              {payments.filter(p=>paymentFilter==='all'||p.status===paymentFilter).length===0&&<div className="py-12 text-center text-sm text-slate-400">Aucune transaction dans cette vue.</div>}
            </section>
          </section>}

          {selectedPayment && (() => {
            const p = selectedPayment as PaymentRecord & Record<string, any>;
            const invoice = p.invoiceNumber || ('INV-' + String(p.id || '').slice(-8).toUpperCase());
            const fullName = p.fullName || p.payerName || p.displayName || '—';
            const actionLabel = p.subscriptionAction === 'renewal' ? 'Renouvellement' : p.subscriptionAction === 'upgrade' ? 'Upgrade programmé' : 'Nouvelle souscription';
            const statusLabel = p.status === 'paid' ? 'Paiement confirmé' : p.status === 'processing' || p.status === 'initiated' ? 'En traitement' : p.status === 'cancelled' ? 'Paiement annulé' : p.status === 'invalidated' ? 'Paiement invalidé' : 'Paiement échoué';
            const statusTone = p.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.status === 'processing' || p.status === 'initiated' ? 'bg-amber-50 text-amber-700 border-amber-100' : p.status === 'cancelled' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-rose-50 text-rose-700 border-rose-100';
            const dateTime = (value?: string) => value ? new Date(value).toLocaleString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }) : '—';
            const dateOnly = (value?: string) => value ? new Date(value).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
            const money = (value: any) => new Intl.NumberFormat('fr-FR', { style:'currency', currency:p.currency || 'USD', minimumFractionDigits:2 }).format(Number(value || 0));
            const baseAmount = p.baseAmount ?? Number(p.amount || 0) - Number(p.paymentFee || 0);
            return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#071a2d]/55 p-4 backdrop-blur-[2px]" onClick={()=>setSelectedPayment(null)}>
              <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(7,26,45,.22)]" onClick={e=>e.stopPropagation()}>
                <div className="h-1.5 w-full bg-[#00a982]" />
                <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-5 border-b border-slate-200 pb-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#071a2d] text-white"><ReceiptText className="h-5 w-5"/></div>
                        <div><div className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Détails de la transaction</div><h2 className="mt-1 truncate text-xl font-black tracking-tight text-[#071a2d]">{invoice}</h2></div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className={'rounded-full border px-2.5 py-1 text-xs font-black ' + statusTone}>{statusLabel}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">Réf. {p.reference || p.id}</span>
                      </div>
                    </div>
                    <button onClick={()=>setSelectedPayment(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700"><X className="h-4 w-4"/></button>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Référence</span><b className="mt-1.5 block break-all text-sm font-black text-[#071a2d]">{p.reference || p.id || '—'}</b></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Facture</span><b className="mt-1.5 block text-sm font-black text-[#071a2d]">{invoice}</b></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Émise le</span><b className="mt-1.5 block text-sm font-black text-[#071a2d]">{dateTime(p.createdAt)}</b></div>
                  </div>

                  <div className="mt-6 grid gap-6 md:grid-cols-[1.15fr_.85fr]">
                    <section>
                      <div className="mb-3 text-xs font-black uppercase tracking-[.16em] text-slate-400">Facturé à</div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="text-lg font-black tracking-tight text-[#071a2d]">{fullName}</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-500">
                          <div><b className="text-slate-700">Nom affiché :</b> {p.displayName || '—'}</div>
                          <div><b className="text-slate-700">Email :</b> {p.email || '—'}</div>
                          <div><b className="text-slate-700">Mobile Money :</b> {p.phone || p.payerPhone || '—'}</div>
                        </div>
                      </div>
                    </section>
                    <section>
                      <div className="mb-3 text-xs font-black uppercase tracking-[.16em] text-slate-400">Transaction</div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="space-y-2 text-sm text-slate-500">
                          <div><b className="text-slate-700">Type :</b> {actionLabel}</div>
                          <div><b className="text-slate-700">Paiement :</b> {dateTime(p.paidAt || p.createdAt)}</div>
                          <div><b className="text-slate-700">Méthode :</b> {p.paymentMethod || 'Mobile Money'}</div>
                          <div><b className="text-slate-700">Fournisseur :</b> {p.paymentProvider || p.provider || '—'}</div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-[.14em] text-slate-400">Abonnement</div>
                    <div className="grid gap-4 p-5 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
                      <div><b className="text-sm font-black text-[#071a2d]">Abonnement {p.planName || (p.plan === 'pro' ? 'Plus' : 'Community')}</b><div className="mt-1 text-sm text-slate-400">Accès aux fonctionnalités IAMTRADER</div></div>
                      <div className="text-sm text-slate-500"><div><b className="text-slate-700">Activation :</b> {dateOnly(p.activationStartAt)} → {dateOnly(p.activationExpiresAt)}</div></div>
                      <div className="text-right text-base font-black text-[#071a2d]">{money(p.baseAmount ?? p.amount)}</div>
                    </div>
                  </div>

                  <div className="mt-5 ml-auto w-full max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between text-slate-500"><span>Sous-total</span><b className="text-slate-700">{money(baseAmount)}</b></div>
                    <div className="flex justify-between text-slate-500"><span>Frais de paiement {p.paymentFeeRate ? '· ' + (Number(p.paymentFeeRate) * 100).toFixed(0) + ' %' : '· 3 %'}</span><b className="text-slate-700">+{money(p.paymentFee || 0)}</b></div>
                    <div className="mt-2 flex justify-between border-t-2 border-[#071a2d] pt-3 text-base font-black text-[#071a2d]"><span>Total payé</span><span className="text-[#00a982]">{money(p.amount)}</span></div>
                  </div>

                  {p.status === 'paid' && <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-[#b7eadf] bg-gradient-to-r from-[#f0fbf8] to-white p-4"><div><div className="text-xs font-black uppercase tracking-[.14em] text-[#007f60]">Transaction réglée</div><div className="mt-1 text-xs text-slate-500">Paiement enregistré le {dateTime(p.paidAt || p.createdAt)}.</div></div><span className="rounded-full bg-[#071a2d] px-3 py-1.5 text-xs font-black tracking-[.1em] text-white">PAYÉ</span></div>}

                  <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-xs text-slate-400"><b className="text-slate-600">ID transaction :</b> <span className="break-all">{p.id || '—'}</span></div>
                    {<div className="flex flex-wrap justify-end gap-2">
                      <button disabled={paymentActionBusy} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'paid',paidAt:new Date().toISOString(),confirmedAt:new Date().toISOString()});await refreshPayments();setSelectedPayment(null);showToast('Paiement validé.');}catch(e:any){showToast(e?.message||'Action impossible.');}finally{setPaymentActionBusy(false);}}} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Check className="h-3.5 w-3.5"/>Valider</button>
                      <button disabled={paymentActionBusy} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'invalidated',invalidatedAt:new Date().toISOString()});await refreshPayments();setSelectedPayment(null);showToast('Paiement invalidé.');}catch(e:any){showToast(e?.message||'Action impossible.');}finally{setPaymentActionBusy(false);}}} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 disabled:opacity-50"><XCircle className="h-3.5 w-3.5"/>Invalider</button>
                      <button disabled={paymentActionBusy} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'cancelled',cancelledAt:new Date().toISOString()});await refreshPayments();setSelectedPayment(null);showToast('Paiement annulé.');}catch(e:any){showToast(e?.message||'Action impossible.');}finally{setPaymentActionBusy(false);}}} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 disabled:opacity-50">Annuler</button>
                    </div>}
                  </div>
                </div>
              </div>
            </div>;
          })()}

          {adminTab === 'support' && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(11,31,53,.05)]">
              <div className="flex h-[760px] min-h-[620px] flex-col lg:flex-row">
                <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-[360px] lg:border-b-0 lg:border-r">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-black text-[#0b1f35]">Conversations</div>
                        <div className="mt-0.5 text-xs text-slate-400">{contactMessages.length} conversation(s) · {contactMessages.filter(m => m.status === 'new').length} non lue(s)</div>
                      </div>
                      <button onClick={() => { setSupportSearch(''); load(); }} disabled={loading} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" title="Actualiser"><RefreshCw className={'h-3.5 w-3.5 '+(loading?'animate-spin':'')} /></button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <input value={supportSearch} onChange={e => setSupportSearch(e.target.value)} placeholder="Rechercher une conversation…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                      <Filter className="h-3 w-3 text-slate-300" />
                    </div>
                    <div className="mt-3 flex items-center gap-4 border-b border-slate-100">
                      {(['all','new','in_progress','resolved'] as const).map(s => (
                        <button key={s} onClick={() => setContactFilter(s)} className={'relative border-b-2 pb-2 text-xs font-bold ' + (contactFilter === s ? 'border-[#0b1f35] text-[#0b1f35]' : 'border-transparent text-slate-400')}>
                          {s === 'all' ? 'Tous' : s === 'new' ? 'Non lus' : s === 'in_progress' ? 'En cours' : 'Traités'}
                          {s === 'new' && contactMessages.filter(m => m.status === 'new').length > 0 && <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[7px] font-black text-white">{contactMessages.filter(m => m.status === 'new').length}</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {contactMessages
                      .filter(m => contactFilter === 'all' || m.status === contactFilter)
                      .filter(m => {
                        const q = supportSearch.trim().toLowerCase();
                        return !q || [m.name, m.email, decodeMimeSubject(m.subject), m.message].some(v => String(v || '').toLowerCase().includes(q));
                      })
                      .map(m => {
                        const dateValue = m.updatedAt || m.createdAt;
                        const date = dateValue ? new Date(dateValue) : null;
                        const thread = Array.isArray(m.conversation) ? m.conversation : [];
                        const last = thread.length ? thread[thread.length - 1] : null;
                        const preview = last?.body || m.lastReply || m.message || '';
                        const selectedItem = selectedMessage?.id === m.id;
                        const unread = m.status === 'new';
                        const email = emailParts(m.email);
                        return (
                          <button key={m.id} onClick={() => { setSelectedMessage(m); setContactNote(m.adminNote || ''); setReplyText(''); }} className={'flex w-full gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition ' + (selectedItem ? 'bg-blue-50/50 shadow-[inset_3px_0_0_#2563eb]' : 'hover:bg-slate-50')}>
                            <div className={'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ' + (unread ? 'bg-[#0b1f35] text-white' : 'bg-slate-100 text-slate-500')}>
                              {(m.name || m.email || '?').trim().charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className={'block truncate text-sm ' + (unread ? 'font-black text-[#0b1f35]' : 'font-semibold text-slate-700')}>{m.name || m.email}</span>
                                  <span className="mt-0.5 block truncate text-xs text-slate-400">{email.local}<span className="text-slate-300">{email.domain}</span></span>
                                </div>
                                <span className="shrink-0 text-xs text-slate-400">{date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '—'}</span>
                              </div>
                              <div className={'mt-1 truncate text-sm ' + (unread ? 'font-bold text-slate-700' : 'font-semibold text-slate-600')}>{decodeMimeSubject(m.subject) || '(Sans objet)'}</div>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="min-w-0 truncate text-xs text-slate-400">{preview}</span>
                                {thread.length > 1 && <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[7px] font-black text-blue-600">{thread.length}</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    {contactMessages.filter(m => contactFilter === 'all' || m.status === contactFilter).filter(m => {
                      const q = supportSearch.trim().toLowerCase();
                      return !q || [m.name, m.email, decodeMimeSubject(m.subject), m.message].some(v => String(v || '').toLowerCase().includes(q));
                    }).length === 0 && <div className="p-10 text-center text-sm text-slate-400">Aucune conversation.</div>}
                  </div>
                </aside>

                <div className="min-w-0 flex-1 bg-white">
                  {selectedMessage ? (
                    <div className="flex h-full min-h-0 flex-col">
                      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5 sm:px-7">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b1f35] text-sm font-black text-white">
                            {(selectedMessage.name || selectedMessage.email || '?').trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h2 className="truncate text-[14px] font-black text-[#0b1f35]">{selectedMessage.name || selectedMessage.email}</h2>
                              {selectedMessage.status === 'new' && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                            </div>
                            <div className="flex min-w-0 items-center gap-1.5 text-xs">
                              <a href={'mailto:' + String(selectedMessage.email || '').toLowerCase()} className="min-w-0 truncate font-mono text-xs font-normal text-slate-500 hover:text-blue-600" title={String(selectedMessage.email || '').toLowerCase()}>
                                <span>{emailParts(selectedMessage.email).local}</span><span className="text-slate-300">{emailParts(selectedMessage.email).domain}</span>
                              </a>
                              <button type="button" onClick={() => { navigator.clipboard?.writeText(String(selectedMessage.email || '').toLowerCase()); showToast('Adresse e-mail copiée.', 'success'); }} className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600" title="Copier l'adresse e-mail"><Copy className="h-3 w-3" /></button>
                            </div>
                          </div>
                          <div className="hidden min-w-0 max-w-[42%] text-right sm:block">
                            <div className="truncate text-sm font-semibold text-slate-600">{decodeMimeSubject(selectedMessage.subject) || '(Sans objet)'}</div>
                          </div>
                          <button onClick={async () => {
                            try {
                              const now = new Date().toISOString();
                              await adminUpdateContact(selectedMessage.id, { status:'in_progress', handledBy:auth.currentUser?.uid || '', handledAt:now });
                              setSelectedMessage(prev => prev ? {...prev,status:'in_progress',handledBy:auth.currentUser?.uid || '',handledAt:now}:prev);
                            } catch { showToast('Mise à jour impossible.'); }
                          }} className="hidden items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 sm:flex">En cours <ChevronRight className="h-3 w-3 rotate-90" /></button>
                          <button onClick={() => adminDeleteContact(selectedMessage.id).then(() => { setSelectedMessage(null); showToast('Conversation supprimée.'); }).catch(() => showToast('Suppression impossible.'))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                          <button className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 sm:block" title="Plus d'actions"><MoreVertical className="h-4 w-4" /></button>
                        </div>
                      </header>

                      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-6 sm:px-10">
                        <div className="mx-auto w-full max-w-4xl">
                          {(() => {
                            const legacyConversation = [
                              { id:'legacy-inbound', direction:'inbound' as const, body:selectedMessage.message, at:selectedMessage.createdAt || new Date().toISOString(), from:selectedMessage.email, to:'hello@iamtrader.trade' },

                            ];
                            const customerEmail = String(selectedMessage.email || '').trim().toLowerCase();
                            const rawConversation = Array.isArray(selectedMessage.conversation) && selectedMessage.conversation.length ? selectedMessage.conversation : legacyConversation;
                            const conversation = rawConversation.map(item => {
                              const senderEmail = String(item.from || '').trim().toLowerCase();
                              const recipientEmail = String(item.to || '').trim().toLowerCase();
                              let direction = item.direction;
                              if (senderEmail === customerEmail) direction = 'inbound';
                              else if (senderEmail === 'hello@iamtrader.trade' || recipientEmail === customerEmail) direction = 'outbound';
                              else if (!senderEmail && !recipientEmail && String(item.body || '') === String(selectedMessage.message || '')) direction = 'inbound';
                              return { ...item, direction };
                            }).sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime());
                            return conversation.map((item, index) => {
                              const outbound = item.direction === 'outbound';
                              const at = item.at ? new Date(item.at) : null;
                              const previous = conversation[index - 1];
                              const sameDay = previous && new Date(previous.at).toDateString() === new Date(item.at).toDateString();
                              const dayLabel = at && !Number.isNaN(at.getTime()) ? at.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '';
                              return (
                                <React.Fragment key={item.id || index}>
                                  {!sameDay && <div className="my-5 flex items-center gap-4"><span className="h-px flex-1 bg-slate-100" /><span className="whitespace-nowrap text-xs font-black uppercase tracking-wider text-slate-400">{dayLabel === new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) ? 'Aujourd’hui' : dayLabel}</span><span className="h-px flex-1 bg-slate-100" /></div>}
                                  <div className={'mb-5 flex ' + (outbound ? 'justify-end' : 'justify-start')}>
                                    <div className={'max-w-[78%] sm:max-w-[62%] ' + (outbound ? 'text-right' : 'text-left')}>
                                      <div className={'mb-1.5 flex items-center gap-2 text-xs text-slate-400 ' + (outbound ? 'justify-end' : '')}>
                                        <span className="font-bold text-slate-600">{outbound ? 'IAMTRADER Support' : (selectedMessage.name || selectedMessage.email)}</span>
                                        <span>{at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                                      </div>
                                      <div className={'inline-block rounded-xl px-4 py-3 ' + (outbound ? 'bg-[#eaf4ff] text-[#0b1f35] ring-1 ring-blue-100' : 'border border-slate-200 bg-slate-50 text-slate-800')}>
                                        <div className="whitespace-pre-wrap break-words text-[12px] leading-6">{item.body || '(Message vide)'}</div>
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-7">
                        <div className="mx-auto max-w-4xl">
                          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-1.5 shadow-sm focus-within:border-[#0b1f35] focus-within:ring-2 focus-within:ring-blue-50">
                            <button type="button" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:flex" title="Joindre un fichier"><Paperclip className="h-4 w-4" /></button>
                            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendSupportReply(); } }} rows={2} maxLength={10000} placeholder="Écrire un message…" className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-[12px] leading-5 outline-none placeholder:text-slate-400" />
                            <button type="button" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:flex" title="Emoji"><Smile className="h-4 w-4" /></button>
                            <button type="button" disabled={replyBusy || !replyText.trim()} onClick={() => void sendSupportReply()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0b1f35] text-white transition hover:bg-[#142d47] disabled:opacity-30" title="Envoyer"><Send className="h-3.5 w-3.5" /></button>
                          </div>
                          <div className="mt-1 flex justify-between px-1 text-xs text-slate-400"><span>Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</span><span>{replyText.length}/10 000</span></div>
                        </div>
                      </div>

                      <details className="shrink-0 border-t border-slate-100 bg-slate-50/40 px-4 py-2 sm:px-7">
                        <summary className="mx-auto flex max-w-4xl cursor-pointer list-none items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Info className="h-3 w-3" />Détails internes</summary>
                        <div className="mx-auto mt-2 max-w-4xl pb-2">
                          <div className="grid gap-2 text-xs sm:grid-cols-3">
                            <div><span className="text-slate-400">ID</span><b className="ml-1 font-mono text-slate-600">{selectedMessage.id}</b></div>
                            <div><span className="text-slate-400">Créé</span><b className="ml-1 text-slate-600">{selectedMessage.createdAt || '—'}</b></div>
                            <div><span className="text-slate-400">Mis à jour</span><b className="ml-1 text-slate-600">{selectedMessage.updatedAt || '—'}</b></div>
                          </div>
                          <textarea value={contactNote} onChange={e => setContactNote(e.target.value)} onBlur={() => { if (selectedMessage) adminUpdateContact(selectedMessage.id, { adminNote:contactNote }).catch(() => {}); }} rows={2} placeholder="Note interne…" className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0b1f35]" />
                        </div>
                      </details>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-50/60 text-center">
                      <div>
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-200"><Mail className="h-5 w-5 text-slate-300" /></div>
                        <p className="mt-3 text-[12px] font-bold text-slate-500">Sélectionnez une conversation</p>
                        <p className="mt-1 text-xs text-slate-400">Le fil complet s'affichera ici.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {adminTab==='analytics' && <section className="space-y-4">
            <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">{([['profiles','Profils'],['engagement','Engagement'],['trading','Trading'],['subscriptions','Abonnements']] as const).map(([key,label])=><button key={key} onClick={()=>setAnalyticsTab(key)} className={'rounded-xl px-4 py-2.5 text-xs font-black '+(analyticsTab===key?'bg-[#0b1f35] text-white':'text-slate-500')}>{label}</button>)}</div>
            {analyticsTab==='profiles'&&<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><span className="text-xs font-black uppercase text-slate-400">Profils</span><b className="mt-2 block text-3xl font-black">{users.length}</b><p className="mt-1 text-sm text-slate-400">{users.filter(u=>u.status==='active').length} actifs · {users.filter(u=>u.status==='suspended').length} suspendus</p></div><div className="rounded-2xl border bg-white p-5"><span className="text-xs font-black uppercase text-slate-400">Plans</span><b className="mt-2 block text-3xl font-black">{users.filter(u=>u.plan!=='free').length}</b><p className="mt-1 text-sm text-slate-400">utilisateurs payants</p></div><div className="rounded-2xl border bg-white p-5"><span className="text-xs font-black uppercase text-slate-400">Nouveaux 7 j</span><b className="mt-2 block text-3xl font-black">{newUsers.length}</b><p className="mt-1 text-sm text-slate-400">créations récentes</p></div><div className="md:col-span-3 rounded-2xl border bg-white p-5"><h3 className="text-sm font-black">Répartition des profils</h3><div className="mt-4 grid gap-2 sm:grid-cols-3">{[['Starter',users.filter(u=>u.plan==='free').length,'bg-slate-100'],['Plus',users.filter(u=>u.plan==='pro').length,'bg-blue-50'],['Community',users.filter(u=>u.plan==='community').length,'bg-violet-50']].map(([l,v,b])=><div className={'rounded-xl p-4 '+String(b)}><b className="text-xl">{String(v)}</b><span className="ml-2 text-sm font-bold text-slate-500">{String(l)}</span></div>)}</div></div></div>}
            {analyticsTab==='engagement'&&<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{accounts.length}</b><p className="mt-1 text-sm text-slate-400">comptes de trading créés</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{trades.length}</b><p className="mt-1 text-sm text-slate-400">trades enregistrés</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{users.filter(u=>userMetrics[u.uid]?.tradeCount>0).length}</b><p className="mt-1 text-sm text-slate-400">traders réellement actifs</p></div><div className="md:col-span-3 rounded-2xl border bg-white p-5"><h3 className="text-sm font-black">Groupes comportementaux</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><b className="text-emerald-700">{users.filter(u=>userMetrics[u.uid]?.tradeCount>=20).length}</b><p className="mt-1 text-xs text-emerald-700">Traders engagés · 20+ trades</p></div><div className="rounded-xl bg-blue-50 p-4"><b className="text-blue-700">{users.filter(u=>userMetrics[u.uid]?.tradeCount>0&&userMetrics[u.uid]?.tradeCount<20).length}</b><p className="mt-1 text-xs text-blue-700">Traders occasionnels</p></div><div className="rounded-xl bg-slate-50 p-4"><b className="text-slate-700">{users.filter(u=>userMetrics[u.uid]?.tradeCount===0).length}</b><p className="mt-1 text-xs text-slate-500">Profils sans activité trading</p></div></div></div></div>}
            {analyticsTab==='trading'&&<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{trades.length}</b><p className="text-sm text-slate-400">trades</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{accounts.length}</b><p className="text-sm text-slate-400">comptes</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{users.filter(u=>(userMetrics[u.uid]?.pnlPercent||0)>0).length}</b><p className="text-sm text-slate-400">profils actuellement positifs</p></div><div className="md:col-span-3 rounded-2xl border bg-white p-5"><h3 className="text-sm font-black">Groupes de performance</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><b>{users.filter(u=>(userMetrics[u.uid]?.pnlPercent||0)>=5).length}</b><p className="text-xs text-emerald-700">≥ +5%</p></div><div className="rounded-xl bg-slate-50 p-4"><b>{users.filter(u=>{const x=userMetrics[u.uid]?.pnlPercent;return x!==null&&x>-5&&x<5}).length}</b><p className="text-xs text-slate-500">Entre -5% et +5%</p></div><div className="rounded-xl bg-rose-50 p-4"><b>{users.filter(u=>(userMetrics[u.uid]?.pnlPercent||0)<=-5).length}</b><p className="text-xs text-rose-700">≤ -5%</p></div></div></div></div>}
            {analyticsTab==='subscriptions'&&<div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{users.filter(u=>u.plan==='pro').length}</b><p className="text-sm text-slate-400">Plus</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{users.filter(u=>u.plan==='community').length}</b><p className="text-sm text-slate-400">Community</p></div><div className="rounded-2xl border bg-white p-5"><b className="text-3xl">{payments.filter(p=>p.status==='paid').length}</b><p className="text-sm text-slate-400">paiements confirmés</p></div><div className="md:col-span-3 rounded-2xl border bg-white p-5"><h3 className="text-sm font-black">Conversion et rétention</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-blue-50 p-4"><b>{stats.total?Math.round(stats.paid/stats.total*100):0}%</b><p className="text-xs text-blue-700">utilisateurs avec paiement</p></div><div className="rounded-xl bg-amber-50 p-4"><b>{stats.expiring}</b><p className="text-xs text-amber-700">abonnements proches de l’échéance</p></div><div className="rounded-xl bg-rose-50 p-4"><b>{stats.expired}</b><p className="text-xs text-rose-700">abonnements expirés</p></div></div></div></div>}
          </section>}

          {adminTab==='audit' && <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-sm font-black">Journal d’audit</h2><p className="mt-1 text-sm text-slate-400">Traçabilité des actions administratives.</p></div><div className="divide-y divide-slate-100">{logs.slice(0,50).map(l=><div key={l.id} className="flex gap-3 p-4"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100"><History className="h-3.5 w-3.5 text-slate-500"/></div><div><b className="text-sm text-slate-800">{l.action} · {l.userName}</b><p className="mt-1 text-xs text-slate-400">{l.details}</p></div></div>)}{!logs.length&&<div className="p-10 text-center text-xs text-slate-400">Aucune action enregistrée.</div>}</div></section>}

          {selected && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#071a2d]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="manage-user-title" onClick={() => setSelected(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
              <div className="mb-5 flex items-start justify-between"><div><h2 id="manage-user-title" className="text-sm font-black text-[#0b1f35]">Gérer l’abonnement</h2><p className="mt-1 text-sm text-slate-500">{selected.displayName || selected.email}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Fermer"><X className="h-4 w-4" /></button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-500">Forfait<select value={plan} onChange={event => setPlan(event.target.value as SubscriptionPlan)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800"><option value="free">Starter</option><option value="pro">Plus</option><option value="community">Community</option></select></label>
                <label className="text-sm font-bold text-slate-500">Compte<select value={status} onChange={event => setStatus(event.target.value as UserStatus)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800"><option value="active">Actif</option><option value="suspended">Suspendu</option></select></label>
                <label className="text-sm font-bold text-slate-500">Paiement<select value={payment} onChange={event => setPayment(event.target.value as typeof payment)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800"><option value="unpaid">Non payé</option><option value="paid">Payé</option><option value="refunded">Remboursé</option></select></label>
                <label className="text-sm font-bold text-slate-500">Échéance<input type="date" value={expiry} onChange={event => setExpiry(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800" /></label>
              </div>
              <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Annuler</button><button type="button" disabled={busy} onClick={() => void saveManagedUser()} className="rounded-lg bg-[#0b1f35] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
            </div>
          </div>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        </main>
      </div>
    </div>
  );
}
