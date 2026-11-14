import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag, Zap, Activity, Sparkles, CalendarClock, AlertTriangle, BellRing, Check, CheckCircle2, ChevronLeft, Eye, ChevronRight, Clock3, CreditCard, Edit3, History, Mail, ReceiptText, RefreshCw, Search, Send, ShieldCheck, Trash2, UserCheck, UserX, Users, X, XCircle, Copy, Paperclip, Smile, MoreVertical, Info, Plus, Filter, PenLine, TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, Crown, ChartNoAxesCombined, UserRoundPlus, CircleDollarSign, CalendarDays, Phone, MapPin, UserRound, VenusAndMars, Target, Layers, UserPlus, Menu } from 'lucide-react';
import { AdminLog, PaymentRecord, SubscriptionPlan, UserProfile, UserStatus, TradingAccount, Trade } from '../types';
import { getAdminLogs, getAllAccounts, getAllTrades, getAllUsers, subscribeAllUsers, subscribeAllPayments, subscribeContactMessages } from '../services/firestore';
import { adminAddLog, adminComposeEmail, adminDeleteContact, adminGetPayments, adminMigrateSubscriptionExpiry, adminSaveEmailDraft, adminUpdateContact, adminUpdatePayment, adminUpdateUser } from '../services/adminConsole';
import { useToast } from '../components/common/Toast';
import { auth } from '../firebase/config';
import { Inbox, Archive, FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { PromotionCenter } from './PromotionCenter';
import { AIMonitoringPanel } from './AIMonitoringPanel';

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

function splitEmailSignature(value?: string) {
  const body = String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const match = body.match(/\n[ \t]*--[ \t]*\n/);
  if (!match || match.index === undefined) return { message: body, signature: '' };
  return {
    message: body.slice(0, match.index).trim(),
    signature: body.slice(match.index + match[0].length).trim()
  };
}

function inputDate(v?: string) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
function isoDate(v: string) { return v ? new Date(v + 'T23:59:59').toISOString() : undefined; }

export function AdminConsole({ onOpenSidebar, canManageUsers = false }: { onOpenSidebar?: () => void; canManageUsers?: boolean }) {
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
  const [viewUser, setViewUser] = useState<UserProfile | null>(null);
  const [profileModalUser, setProfileModalUser] = useState<UserProfile | null>(null);
  const [profileMicroModal, setProfileMicroModal] = useState<'payments' | 'affiliation' | null>(null);
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [pendingPaymentPage, setPendingPaymentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [managedRole, setManagedRole] = useState<UserProfile['role']>('trader');
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [status, setStatus] = useState<UserStatus>('active');
  const [payment, setPayment] = useState<'unpaid' | 'paid' | 'refunded'>('unpaid');
  const [expiry, setExpiry] = useState('');
  const [days, setDays] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [invoiceHtml, setInvoiceHtml] = useState('');
  const [paymentActionBusy, setPaymentActionBusy] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'processing' | 'failed'>('all');
  const [contactMessages, setContactMessages] = useState<import('../services/firestore').ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<import('../services/firestore').ContactMessage | null>(null);
  const [supportSearch, setSupportSearch] = useState('');
  const [mailboxFolder, setMailboxFolder] = useState<'inbox' | 'sent' | 'drafts' | 'unread' | 'in_progress' | 'archive' | 'trash'>('inbox');
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(true);
  const [messageListOpen, setMessageListOpen] = useState(true);
  const [expandedEmailIds, setExpandedEmailIds] = useState<string[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeId, setComposeId] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeCcOpen, setComposeCcOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeHtml, setComposeHtml] = useState('');
  const [composeFiles, setComposeFiles] = useState<File[]>([]);
  const [composeFormattingOpen, setComposeFormattingOpen] = useState(false);
  const [composeEmojiOpen, setComposeEmojiOpen] = useState(false);
  const [composeFont, setComposeFont] = useState('Arial');
  const [composeFormatState, setComposeFormatState] = useState({ bold:false, italic:false, underline:false, strikeThrough:false, insertUnorderedList:false, insertOrderedList:false });
  const composeEditorRef = useRef<HTMLDivElement | null>(null);
  const composeFileInputRef = useRef<HTMLInputElement | null>(null);
  const composeSelectionRef = useRef<Range | null>(null);
  const [composeBusy, setComposeBusy] = useState(false);
  const [contactNote, setContactNote] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyHtml, setReplyHtml] = useState('');
  const [replyFormattingOpen, setReplyFormattingOpen] = useState(false);
  const [replyEmojiOpen, setReplyEmojiOpen] = useState(false);
  const [replyFont, setReplyFont] = useState('Arial');
  const [replyFormatState, setReplyFormatState] = useState({ bold:false, italic:false, underline:false, strikeThrough:false, insertUnorderedList:false, insertOrderedList:false });
  const replyEditorRef = useRef<HTMLDivElement | null>(null);
  const replySelectionRef = useRef<Range | null>(null);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'subscriptions' | 'payments' | 'promotions' | 'support' | 'analytics' | 'audit' | 'ai-monitoring'>('overview');
  const [analyticsTab, setAnalyticsTab] = useState<'profiles' | 'engagement' | 'trading' | 'subscriptions'>('profiles');
  const [overviewUsersPage, setOverviewUsersPage] = useState(1);
  const [overviewUsersPageSize, setOverviewUsersPageSize] = useState(5);
  const perPage = 10;

  async function copyProfileValue(value: unknown) {
    const text = String(value ?? '').trim();
    if (!text || text === '—') return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Information copiée.', 'success');
    } catch {
      showToast('Copie impossible depuis ce navigateur.', 'error');
    }
  }

  function openManage(user: UserProfile) {
    setSelected(user);
    setPlan(user.plan || 'free');
    setManagedRole(user.role || 'trader');
    setStatus(user.status || 'active');
    setPayment(user.paymentStatus || 'unpaid');
    setExpiry(inputDate(user.subscriptionExpiresAt));
    setDays('');
    setHistoryOpen(false);
  }

  async function saveManagedUser() {
    if (!selected || busy || !canManageUsers) return;
    setBusy(true);
    const subscriptionExpiresAt = isoDate(expiry) || '';
    const update: Pick<UserProfile, 'role' | 'plan' | 'status' | 'paymentStatus' | 'subscriptionExpiresAt' | 'subscriptionStatus'> = {
      role: managedRole,
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
        action: 'user-account-managed',
        userUid: selected.uid,
        userName: selected.displayName || selected.email,
        details: `Rôle=${managedRole}; Plan=${plan}; statut=${status}; paiement=${payment}; échéance=${subscriptionExpiresAt || 'aucune'}`
      }).catch(error => console.warn('IAMTRADER Admin audit log unavailable:', error));
      setSelected(null);
      showToast('Profil utilisateur mis à jour.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Mise à jour impossible.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function migrateSubscriptionExpiry() {
    if (migrationBusy || !canManageUsers) return;
    setMigrationBusy(true);
    try {
      const result = await adminMigrateSubscriptionExpiry();
      showToast(`Migration terminée : ${result.migrated} profils mis à jour, ${result.expired} abonnements expirés, ${result.withoutExpiry} profils payants sans échéance.`, 'success');
      await load();
    } catch (error: any) {
      showToast(error?.message || 'Migration des échéances impossible.', 'error');
    } finally {
      setMigrationBusy(false);
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
    if (adminTab !== 'support') return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [adminTab]);

  useEffect(() => {
    if (!selectedMessage || (selectedMessage as any).__groupedSent) return;
    const liveMessage = contactMessages.find(message => message.id === selectedMessage.id);
    if (liveMessage) setSelectedMessage(liveMessage);
  }, [contactMessages, selectedMessage?.id]);

  useEffect(() => {
    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeContacts: (() => void) | undefined;
    let unsubscribePayments: (() => void) | undefined;
    let paymentTimer: number | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeUsers?.();
      unsubscribeContacts?.();
      unsubscribePayments?.();
      unsubscribeUsers = undefined;
      unsubscribeContacts = undefined;
      unsubscribePayments = undefined;

      if (!user) return;

      load();
      unsubscribePayments = subscribeAllPayments((nextPayments, realtimeError) => {
        if (realtimeError) return;
        setPayments(nextPayments);
      });
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
      unsubscribeUsers?.();
      unsubscribeContacts?.();
      unsubscribeAuth();
    };
  }, []);

  const overviewPaidUsers = users.filter(u => u.plan !== 'free');
  const overviewPendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'processing' || p.status === 'initiated');
  const overviewConfirmedPayments = payments.filter(p => p.status === 'paid');
  const overviewOpenTickets = contactMessages.filter(m => m.status !== 'resolved');
  const overviewExpiringUsers = users.filter(u => {
    const d = remaining(u);
    return d !== null && d >= 0 && d <= 5;
  });
  const overviewRevenue = overviewConfirmedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const overviewActiveTraders = users.filter(u => accounts.some(a => a.userId === u.uid) || trades.some(t => t.userId === u.uid)).length;
  const overviewRecentUsers = [...users]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const overviewUsersTotalPages = Math.max(1, Math.ceil(overviewRecentUsers.length / overviewUsersPageSize));
  const overviewUsersPageItems = overviewRecentUsers.slice((overviewUsersPage - 1) * overviewUsersPageSize, overviewUsersPage * overviewUsersPageSize);
  const overviewTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      const monthTrades = trades.filter(t => String(t.entryDate || '').slice(0, 7) === key);
      const monthPayments = overviewConfirmedPayments.filter(p => String(p.paidAt || p.createdAt || '').slice(0, 7) === key);
      return {
        key,
        label: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
        pnl: monthTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0),
        revenue: monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        trades: monthTrades.length,
        payments: monthPayments.length
      };
    });
  }, [trades, overviewConfirmedPayments]);
  const overviewMaxRevenue = Math.max(1, ...overviewTrend.map(item => item.revenue));
  const overviewMaxPnl = Math.max(1, ...overviewTrend.map(item => Math.abs(item.pnl)));
  useEffect(() => { setOverviewUsersPage(current => Math.min(current, overviewUsersTotalPages)); }, [overviewUsersTotalPages]);

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

  function rememberReplySelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount && replyEditorRef.current?.contains(selection.anchorNode)) {
      replySelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
    setReplyFormatState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList')
    });
  }

  function applyReplyCommand(command: string, value?: string) {
    replyEditorRef.current?.focus();
    const selection = window.getSelection();
    if (selection && replySelectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(replySelectionRef.current);
    }
    document.execCommand(command, false, value);
    rememberReplySelection();
    if (replyEditorRef.current) {
      setReplyText(replyEditorRef.current.innerText);
      setReplyHtml(replyEditorRef.current.innerHTML);
    }
  }

  function rememberComposeSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount && composeEditorRef.current?.contains(selection.anchorNode)) {
      composeSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
    setComposeFormatState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList')
    });
  }

  function applyComposeCommand(command: string, value?: string) {
    composeEditorRef.current?.focus();
    const selection = window.getSelection();
    if (selection && composeSelectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(composeSelectionRef.current);
    }
    document.execCommand(command, false, value);
    rememberComposeSelection();
    if (composeEditorRef.current) {
      setComposeBody(composeEditorRef.current.innerText);
      setComposeHtml(composeEditorRef.current.innerHTML);
    }
  }

  async function saveComposeDraft() {
    if (composeBusy) return;
    setComposeBusy(true);
    try {
      const saved = await adminSaveEmailDraft({ id: composeId || undefined, to: composeTo.trim(), cc: composeCc.trim(), subject: composeSubject.trim(), message: composeEditorRef.current?.innerText || composeBody, messageHtml: composeEditorRef.current?.innerHTML || composeHtml });
      setComposeId(saved.id || composeId);
      showToast('Brouillon enregistré.', 'success');
      setComposeOpen(false);
      setMailboxFolder('drafts');
    } catch (error: any) { showToast(error?.message || 'Enregistrement du brouillon impossible.', 'error'); }
    finally { setComposeBusy(false); }
  }

  async function sendComposedEmail() {
    if (composeBusy) return;
    setComposeBusy(true);
    try {
      const currentHtml = composeEditorRef.current?.innerHTML || composeHtml;
      const currentBody = composeEditorRef.current?.innerText.trim() || composeBody.trim();
      const result = await adminComposeEmail({ id: composeId || undefined, to: composeTo.trim(), cc: composeCc.trim(), subject: composeSubject.trim(), message: currentBody, messageHtml: currentHtml, attachments: await Promise.all(composeFiles.map(async file => ({ filename: file.name, content: await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '').split(',')[1] || ''); reader.onerror = () => reject(new Error('Lecture de pièce jointe impossible.')); reader.readAsDataURL(file); }) }))) });
      setComposeOpen(false); setComposeId(''); setComposeTo(''); setComposeCc(''); setComposeCcOpen(false); setComposeSubject(''); setComposeBody(''); setComposeHtml(''); setComposeFiles([]); setComposeFormattingOpen(false); setComposeEmojiOpen(false);
      setMailboxFolder('sent');
      if (result.historySaved === false) showToast(result.warning || 'E-mail envoyé, mais historique non enregistré.', 'error');
      else showToast('E-mail envoyé et enregistré dans Envoyés.', 'success');
    } catch (error: any) { showToast(error?.message || 'Envoi impossible.', 'error'); }
    finally { setComposeBusy(false); }
  }

  async function sendSupportReply() {
    const currentReplyHtml = replyEditorRef.current?.innerHTML || replyHtml;
    const currentReplyText = replyEditorRef.current?.innerText.trim() || replyText.trim();
    if (!selectedMessage || !currentReplyText || replyBusy) return;
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
          reply: currentReplyText,
          replyHtml: currentReplyHtml,
          name: selectedMessage.name,
          inReplyTo: lastInbound?.messageId || '',
          references: thread.map(item => item.messageId).filter(Boolean).slice(-20).join(' '),
          conversationId: selectedMessage.id
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; messageId?: string; id?: string; historySaved?: boolean; warning?: string };
      if (!response.ok) throw new Error(payload?.error || 'Envoi impossible');

      const now = new Date().toISOString();
      const outbound = {
        id: 'outbound-' + Date.now(),
        direction: 'outbound' as const,
        body: currentReplyText,
        bodyHtml: currentReplyHtml,
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

      setSelectedMessage(prev => prev ? { ...prev, status:'resolved', handledBy:currentUser.uid, handledAt:now, lastReply:currentReplyText, repliedAt:now, repliedBy:currentUser.uid, conversation } : prev);
      setReplyText('');
      setReplyHtml('');
      setReplyFormattingOpen(false);
      setReplyEmojiOpen(false);
      setShowReplyComposer(false);
      if (payload.historySaved === false) showToast(payload.warning || 'E-mail envoyé, mais historique non enregistré.', 'error');
      else showToast('Message envoyé et enregistré.', 'success');
    } catch (e:any) {
      showToast(e?.message || 'Envoi impossible.', 'error');
    } finally {
      setReplyBusy(false);
    }
  }

  return (
    <div className="relative min-h-dvh w-full min-w-0 overflow-x-clip bg-[#f5f8fc]"><div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.12),transparent_55%),radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.07),transparent_45%)]" />
      <div className="relative mx-auto min-h-dvh w-full min-w-0 max-w-[1480px] px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:pt-0 lg:pb-8">
        <nav aria-label="Navigation de la console administrateur" className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 flex h-16 w-full min-w-0 items-center gap-2 overflow-hidden border-b border-slate-200/80 bg-white/95 px-3 shadow-[0_8px_28px_rgba(15,35,55,.06)] backdrop-blur-xl sm:px-6 lg:left-[240px] lg:right-0 lg:top-0 lg:mx-0 lg:w-auto lg:max-w-none lg:px-6">
          <button type="button" onClick={onOpenSidebar} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0b1f35] shadow-sm transition hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 lg:hidden" aria-label="Ouvrir le menu administrateur">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain sm:flex-wrap sm:overflow-visible sm:gap-1.5">
            {([
              ['overview','Vue d’ensemble',Activity],['users','Utilisateurs',Users],['subscriptions','Abonnements',Clock3],['payments','Paiements',CreditCard],['promotions','Promotions & avantages',Tag],['support','Support',Mail],['analytics','Analytics',ChartNoAxesCombined],['audit','Journal d’audit',History],['ai-monitoring','Moteur IA',Sparkles]
            ] as const).map(([key,label,Icon])=><button key={key} onClick={()=>setAdminTab(key)} aria-label={label} title={label} aria-current={adminTab===key?'page':undefined} className={'relative flex h-10 shrink-0 snap-start items-center justify-center rounded-xl py-2 text-[11px] font-bold transition-all duration-200 '+(adminTab===key?'gap-2 bg-[#10243b] px-4 text-white shadow-[0_4px_12px_rgba(16,36,59,.18)]':'w-10 px-0 text-slate-600 hover:bg-slate-100 hover:text-[#10243b]')}><Icon className={'h-4 w-4 shrink-0 '+(adminTab===key?'text-[#55e1c3]':'text-slate-400')}/><span className={adminTab===key?'whitespace-nowrap':'sr-only'}>{label}</span>{key==='support'&&contactMessages.filter(m=>m.status==='new').length>0&&<span className={'absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold '+(adminTab===key?'bg-[#55e1c3] text-[#10243b]':'bg-emerald-100 text-emerald-800')}>{contactMessages.filter(m=>m.status==='new').length}</span>}</button>)}
          </div>
        </nav>
        <div aria-hidden="true" className="h-16 shrink-0" />
        <main className="min-w-0 space-y-4 sm:space-y-6">
          <header className="mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700 shadow-sm">Console administrateur</div><h1 className="text-3xl font-bold tracking-[-0.045em] text-[#10243b] sm:text-4xl">{adminTab==='overview'?'Dashboard admin':adminTab==='users'?'Utilisateurs':adminTab==='subscriptions'?'Abonnements':adminTab==='payments'?'Paiements':adminTab==='promotions'?'Promotions & avantages':adminTab==='support'?'Support':adminTab==='analytics'?'Analytics':adminTab==='ai-monitoring'?'Supervision du moteur IA':'Journal d’audit'}</h1><p className="mt-1 text-sm text-slate-400">{adminTab==='subscriptions'?'Suivi commercial des abonnements, répartition des plans et paiements à confirmer.':adminTab==='analytics'?'Lecture comportementale et performance des utilisateurs.':adminTab==='ai-monitoring'?'Disponibilité des clés, basculements et activité des assistants.':'Pilotage opérationnel de la plateforme IAMTRADER.'}</p></div>
              <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-700"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50"></span><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span></span>Synchronisation active</div>
              {canManageUsers && <button type="button" onClick={migrateSubscriptionExpiry} disabled={migrationBusy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${migrationBusy ? 'animate-spin' : ''}`}/>{migrationBusy ? 'Migration…' : 'Migrer les échéances'}</button>}
            </div>
          </header>

          {adminTab==='overview' && <section className="space-y-4">
            <div className="relative isolate overflow-hidden rounded-[22px] bg-[#0b1f35] px-4 py-5 text-white shadow-[0_18px_45px_rgba(11,31,53,.18)] sm:px-6 sm:py-6">
              <div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full bg-[#00d6a0]/20 blur-3xl"/>
              <div className="pointer-events-none absolute -bottom-32 right-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl"/>
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#69e8c1]"><span className="h-2 w-2 rounded-full bg-[#00d6a0] shadow-[0_0_12px_#00d6a0]"/> IAMTRADER · ADMIN INTELLIGENCE</div>
                  <h2 className="text-[25px] font-extrabold tracking-[-.045em] sm:text-3xl">Vue d’ensemble</h2>
                  <p className="mt-1 max-w-xl text-[11px] leading-5 text-slate-300 sm:text-xs">La plateforme en temps réel : croissance, revenus, activité trader et opérations prioritaires.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-2 text-[10px] font-semibold text-white/85"><span className="h-1.5 w-1.5 rounded-full bg-[#00d6a0]"/> Console synchronisée</span>
                  <button onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-[#00d6a0] px-3.5 py-2.5 text-[10px] font-extrabold text-[#082238] shadow-[0_5px_18px_rgba(0,214,160,.2)] transition hover:bg-[#49edbd]"><RefreshCw className="h-3.5 w-3.5"/> Actualiser</button>
                </div>
              </div>
              <div className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  {label:'Utilisateurs',value:users.length,detail:users.filter(u=>u.status==='active').length+' actifs',icon:Users,color:'text-[#65e8c1]',bg:'bg-[#00d6a0]/15'},
                  {label:'Revenu confirmé',value:'$'+overviewRevenue.toLocaleString('en-US',{maximumFractionDigits:0}),detail:overviewConfirmedPayments.length+' paiements validés',icon:Wallet,color:'text-cyan-300',bg:'bg-cyan-400/15'},
                  {label:'Abonnés payants',value:overviewPaidUsers.length,detail:(users.length?Math.round(overviewPaidUsers.length/users.length*100):0)+'% de conversion',icon:Crown,color:'text-violet-300',bg:'bg-violet-400/15'},
                  {label:'Trades enregistrés',value:trades.length,detail:accounts.length+' comptes trading',icon:ChartNoAxesCombined,color:'text-blue-300',bg:'bg-blue-400/15'},
                  {label:'Paiements en attente',value:overviewPendingPayments.length,detail:'À vérifier',icon:Clock3,color:'text-amber-300',bg:'bg-amber-400/15'},
                  {label:'Tickets ouverts',value:overviewOpenTickets.length,detail:overviewExpiringUsers.length+' échéances proches',icon:BellRing,color:'text-rose-300',bg:'bg-rose-400/15'}
                ].map((item,index)=><div key={item.label} className="min-w-0 bg-[#102b45]/90 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">{item.label}</span><span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl '+item.bg+' '+item.color}><item.icon className="h-4 w-4"/></span></div>
                  <b className="mt-3 block truncate text-[25px] font-extrabold tracking-[-.04em] text-white tabular-nums sm:text-[28px]">{item.value}</b>
                  <span className="mt-1 block truncate text-[9px] font-medium text-slate-400">{item.detail}</span>
                </div>)}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]">
              <section className="min-w-0 rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_28px_rgba(15,35,55,.045)] sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.16em] text-[#00a982]"><TrendingUp className="h-3.5 w-3.5"/> Performance & croissance</div><h3 className="mt-1 text-base font-extrabold tracking-tight text-[#10243b]">Activité sur les 6 derniers mois</h3><p className="mt-1 text-[10px] text-slate-400">Revenus confirmés et résultat de trading journalisé.</p></div>
                  <button onClick={()=>setAdminTab('analytics')} className="inline-flex items-center gap-1 rounded-lg bg-[#e8fbf5] px-3 py-2 text-[10px] font-bold text-[#008f70] transition hover:bg-[#d5f8ed]">Analytics <ArrowUpRight className="h-3 w-3"/></button>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[9px] font-semibold text-slate-500"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#00b98b]"/> Revenu encaissé</span><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#4778ef]"/> P&L des trades</span><span className="ml-auto text-[9px] text-slate-400">USD · par mois</span></div>
                <div className="mt-4 grid grid-cols-6 gap-2 sm:gap-4">
                  {overviewTrend.map(item=><div key={item.key} className="min-w-0">
                    <div className="flex h-36 items-end justify-center gap-1 rounded-xl bg-[#f6f9fb] px-1.5 pb-2 pt-3 sm:h-44 sm:gap-1.5 sm:px-2">
                      <div title={'Revenu : $'+item.revenue.toFixed(2)} className="relative w-1/2 max-w-7 overflow-hidden rounded-t-md bg-[#00b98b] shadow-[0_3px_9px_rgba(0,185,139,.18)]" style={{height:Math.max(item.revenue>0?5:1,item.revenue/overviewMaxRevenue*100)+'%'}}/>
                      <div title={'P&L : $'+item.pnl.toFixed(2)} className={'relative w-1/2 max-w-7 overflow-hidden rounded-t-md '+(item.pnl>=0?'bg-[#4778ef]':'bg-[#f05b70]')} style={{height:Math.max(item.pnl!==0?5:1,Math.abs(item.pnl)/overviewMaxPnl*100)+'%'}}/>
                    </div>
                    <div className="mt-2 truncate text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
                    <div className="mt-1 text-center text-[8px] text-slate-400">{item.trades} trades</div>
                  </div>)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-xl bg-[#e9fbf5] px-3 py-3"><div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-[#008f70]"><CircleDollarSign className="h-3.5 w-3.5"/> Revenu confirmé</div><b className="mt-1 block text-xl font-extrabold tracking-tight text-[#087b59]">$ {overviewRevenue.toLocaleString('en-US',{maximumFractionDigits:2})}</b></div>
                  <div className="rounded-xl bg-[#edf3ff] px-3 py-3"><div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-blue-700"><Activity className="h-3.5 w-3.5"/> P&L cumulé</div><b className={'mt-1 block text-xl font-extrabold tracking-tight '+(trades.reduce((sum,t)=>sum+Number(t.pnl||0),0)>=0?'text-blue-700':'text-rose-600')}>$ {trades.reduce((sum,t)=>sum+Number(t.pnl||0),0).toLocaleString('en-US',{maximumFractionDigits:2})}</b></div>
                </div>
                {!metricsReady&&<p className="mt-3 text-[9px] text-amber-700">Les données de trading sont momentanément partielles.</p>}
              </section>

              <section className="relative min-w-0 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#102b45] via-[#123b55] to-[#075e58] p-4 text-white shadow-[0_12px_30px_rgba(9,47,65,.14)] sm:p-5">
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border-[22px] border-white/[.05]"/>
                <div className="relative flex items-center justify-between"><div><div className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#69e8c1]">Action center</div><h3 className="mt-1 text-base font-extrabold">À traiter maintenant</h3></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#69e8c1]"><Zap className="h-4 w-4"/></span></div>
                <div className="relative mt-5 space-y-2">
                  {[
                    {label:'Paiements à confirmer',value:overviewPendingPayments.length,tab:'payments',tone:'text-amber-300',icon:CreditCard},
                    {label:'Demandes de plan',value:users.filter(u=>u.planRequest).length,tab:'subscriptions',tone:'text-blue-300',icon:Crown},
                    {label:'Support non résolu',value:overviewOpenTickets.length,tab:'support',tone:'text-violet-300',icon:Mail},
                    {label:'Abonnements à échéance',value:overviewExpiringUsers.length,tab:'subscriptions',tone:'text-rose-300',icon:CalendarDays}
                  ].map(item=><button key={item.label} onClick={()=>setAdminTab(item.tab as typeof adminTab)} className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.055] px-3 py-3 text-left transition hover:border-[#00d6a0]/40 hover:bg-white/[.11]">
                    <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 '+item.tone}><item.icon className="h-4 w-4"/></span><span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white/90">{item.label}</span><b className="text-sm font-extrabold tabular-nums text-white">{item.value}</b><ChevronRight className="h-3.5 w-3.5 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-[#69e8c1]"/>
                  </button>)}
                </div>
                <div className="relative mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-3"><div><div className="text-[8px] font-bold uppercase tracking-[.12em] text-white/55">Santé des données</div><div className="mt-1 text-[10px] font-semibold text-white/90">{metricsReady?'Synchronisation opérationnelle':'Données trading partielles'}</div></div><span className={'h-2.5 w-2.5 rounded-full '+(metricsReady?'bg-[#00d6a0] shadow-[0_0_12px_#00d6a0]':'bg-amber-400')}/></div>
              </section>
            </div>

            <div className="grid items-stretch gap-4 xl:grid-cols-2">
              <section className="flex h-auto min-h-[360px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-emerald-200 bg-white shadow-[0_12px_34px_rgba(8,80,66,.09)] sm:h-[508px] sm:min-h-[508px] sm:max-h-[508px]">
                <div className="flex min-h-[86px] shrink-0 items-center justify-between gap-3 border-b border-emerald-100 bg-gradient-to-r from-[#f0fdf8] to-white px-4 py-4 sm:px-5">
                  <div><div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.16em] text-[#008f70]"><UserRoundPlus className="h-3.5 w-3.5"/> Communauté</div><h3 className="mt-1 text-sm font-extrabold text-[#10243b]">Derniers utilisateurs inscrits</h3><p className="mt-0.5 text-[10px] text-slate-500">Profils et statut des membres IAMTRADER.</p></div>
                  <button onClick={()=>setAdminTab('users')} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-[10px] font-extrabold text-[#007d62] shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">Tous les membres <ArrowUpRight className="h-3 w-3"/></button>
                </div>
                <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                  {overviewUsersPageItems.map((u,i)=><div key={u.uid} className="flex min-h-[72px] min-w-0 items-center gap-3 px-4 py-3 transition hover:bg-emerald-50/60 sm:px-5">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#00c99a] to-[#4778ef] p-[2px] shadow-sm"><div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#e9f8f3] text-xs font-extrabold text-[#087b59]">{String(u.displayName||u.email||'?').trim().slice(0,1).toUpperCase()}</div>{(u.photoURL||u.avatarURL)&&<img src={u.photoURL||u.avatarURL} alt={u.displayName||'Utilisateur IAMTRADER'} loading="lazy" className="absolute inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)] rounded-full object-cover" onError={event=>{event.currentTarget.style.display='none';}}/>}</div>
                    <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-extrabold text-[#10243b]">{u.displayName||'Trader IAMTRADER'}</div><div className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{u.email}</div><div className="mt-1 text-[9px] font-medium text-slate-500">{fmt(u.createdAt)}</div></div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5"><span className={'rounded-md border px-2 py-1 text-[9px] font-extrabold '+(u.plan==='pro'?'border-emerald-200 bg-emerald-100 text-emerald-800':u.plan==='community'?'border-violet-200 bg-violet-100 text-violet-800':'border-slate-200 bg-slate-100 text-slate-700')}>{planLabel(u.plan)}</span><span className={'text-[9px] font-extrabold '+(u.status==='active'?'text-emerald-700':'text-rose-600')}>{u.status==='active'?'● Actif':'● Suspendu'}</span></div>
                  </div>)}
                  {!overviewUsersPageItems.length&&<div className="flex min-h-[180px] items-center justify-center px-4 text-center text-[12px] font-medium text-slate-500">Aucun utilisateur enregistré.</div>}
                </div>
                <div className="flex min-h-[62px] shrink-0 flex-wrap items-center justify-between gap-3 border-t border-emerald-100 bg-[#f8fcfb] px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2"><span className="text-[10px] font-semibold text-slate-500">Afficher</span><select value={overviewUsersPageSize} onChange={event=>{setOverviewUsersPageSize(Number(event.target.value));setOverviewUsersPage(1);}} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] font-extrabold text-[#10243b] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"><option value={5}>5</option><option value={10}>10</option><option value={50}>50</option></select><span className="text-[10px] font-medium text-slate-500">sur {overviewRecentUsers.length}</span></div>
                  <div className="flex items-center gap-2"><span className="mr-1 text-[10px] font-semibold tabular-nums text-slate-600">{overviewRecentUsers.length?((overviewUsersPage-1)*overviewUsersPageSize+1):0}–{Math.min(overviewUsersPage*overviewUsersPageSize,overviewRecentUsers.length)} / {overviewRecentUsers.length}</span><button disabled={overviewUsersPage<=1} onClick={()=>setOverviewUsersPage(p=>Math.max(1,p-1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5"/></button><button disabled={overviewUsersPage>=overviewUsersTotalPages} onClick={()=>setOverviewUsersPage(p=>Math.min(overviewUsersTotalPages,p+1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5"/></button></div>
                </div>
              </section>

              <section className="flex h-auto min-h-[360px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-violet-200 bg-white p-4 shadow-[0_12px_34px_rgba(75,50,150,.08)] sm:h-[508px] sm:min-h-[508px] sm:max-h-[508px] sm:p-5">
                <div className="flex min-h-[66px] shrink-0 items-start justify-between gap-3 border-b border-violet-100 pb-3"><div><div className="text-[9px] font-extrabold uppercase tracking-[.16em] text-violet-700">Écosystème trader</div><h3 className="mt-1 text-sm font-extrabold text-[#10243b]">Répartition des abonnements</h3><p className="mt-0.5 text-[10px] text-slate-500">Structure actuelle de la communauté.</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Crown className="h-5 w-5"/></span></div>
                <div className="mt-5 flex shrink-0 items-center gap-5">
                  <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full shadow-sm" style={{background:'conic-gradient(#00b98b 0deg '+(users.length?users.filter(u=>u.plan==='pro').length/users.length*360:0)+'deg, #8065e8 '+(users.length?users.filter(u=>u.plan==='pro').length/users.length*360:0)+'deg '+(users.length?(users.filter(u=>u.plan==='pro').length+users.filter(u=>u.plan==='community').length)/users.length*360:0)+'deg, #dce4ee '+(users.length?(users.filter(u=>u.plan==='pro').length+users.filter(u=>u.plan==='community').length)/users.length*360:0)+'deg 360deg)'}}><div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-white"><b className="text-2xl font-extrabold tracking-tight text-[#10243b]">{users.length}</b><span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Membres</span></div></div>
                  <div className="min-w-0 flex-1 space-y-3.5">
                    {[{label:'Plus',count:users.filter(u=>u.plan==='pro').length,color:'bg-[#00a982]',text:'text-[#007d62]',track:'bg-emerald-100'},{label:'Community',count:users.filter(u=>u.plan==='community').length,color:'bg-violet-600',text:'text-violet-800',track:'bg-violet-100'},{label:'Starter',count:users.filter(u=>u.plan==='free').length,color:'bg-slate-400',text:'text-slate-700',track:'bg-slate-200'}].map(item=><div key={item.label}><div className="mb-1.5 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[11px] font-bold text-slate-700"><i className={'h-2.5 w-2.5 rounded-full '+item.color}/>{item.label}</span><b className={'text-[12px] font-extrabold tabular-nums '+item.text}>{item.count}</b></div><div className={'h-2 overflow-hidden rounded-full '+item.track}><div className={'h-full rounded-full '+item.color} style={{width:(users.length?item.count/users.length*100:0)+'%'}}/></div></div>)}
                  </div>
                </div>
                <div className="mt-6 grid shrink-0 grid-cols-2 gap-3"><div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-[#d9f8ed] p-3.5"><div className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-800">Conversion</div><b className="mt-1 block text-2xl font-extrabold text-[#007d62]">{users.length?Math.round(overviewPaidUsers.length/users.length*100):0}%</b></div><div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-[#e9e2ff] p-3.5"><div className="text-[9px] font-extrabold uppercase tracking-wide text-violet-800">Traders actifs</div><b className="mt-1 block text-2xl font-extrabold text-violet-800">{overviewActiveTraders}</b></div></div>
                <div className="mt-auto pt-5"><button onClick={()=>setAdminTab('subscriptions')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#102b45] to-[#164d68] px-4 py-3.5 text-[11px] font-extrabold text-white shadow-md shadow-[#102b45]/15 transition hover:from-[#174968] hover:to-[#087f78]">Gérer les abonnements <ChevronRight className="h-4 w-4"/></button></div>
              </section>
            </div>
          </section>}

          {adminTab==='users' && <section className="space-y-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-4"><Users className="absolute -right-2 -top-3 h-20 w-20 text-emerald-600 opacity-[0.10] blur-[1px]"/><div className="relative flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Users className="h-4 w-4"/></span>Tous les utilisateurs</div><b className="relative mt-3 block text-3xl font-extrabold tracking-tight text-[#10243b]">{users.length}</b><span className="relative text-[11px] text-slate-500">Profils enregistrés</span></div>
              <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-4"><UserCheck className="absolute -right-2 -top-3 h-20 w-20 text-teal-600 opacity-[0.10] blur-[1px]"/><div className="relative flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><UserCheck className="h-4 w-4"/></span>Actifs</div><b className="relative mt-3 block text-3xl font-extrabold tracking-tight text-teal-700">{users.filter(u=>u.status==='active').length}</b><span className="relative text-[11px] text-slate-500">Accès autorisé</span></div>
              <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-4"><CreditCard className="absolute -right-2 -top-3 h-20 w-20 text-violet-600 opacity-[0.10] blur-[1px]"/><div className="relative flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><CreditCard className="h-4 w-4"/></span>Payants</div><b className="relative mt-3 block text-3xl font-extrabold tracking-tight text-violet-700">{overviewPaidUsers.length}</b><span className="relative text-[11px] text-slate-500">Forfait Plus ou Community</span></div>
              <div className="relative overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-br from-white to-rose-50 p-4"><UserX className="absolute -right-2 -top-3 h-20 w-20 text-rose-600 opacity-[0.10] blur-[1px]"/><div className="relative flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><UserX className="h-4 w-4"/></span>Suspendus</div><b className="relative mt-3 block text-3xl font-extrabold tracking-tight text-rose-700">{users.filter(u=>u.status!=='active').length}</b><span className="relative text-[11px] text-slate-500">À vérifier</span></div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_8px_28px_rgba(15,35,55,0.045)]"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher par nom ou adresse e-mail…" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm text-[#10243b] outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"/></div><div className="flex items-center gap-2"><span className="hidden text-xs font-semibold text-slate-400 sm:inline">Afficher</span><select value={filter} onChange={e=>setFilter(e.target.value as Filter)} className="min-w-[175px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3.5 text-xs font-bold text-slate-700 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"><option value="all">Tous les profils</option><option value="active">Actifs</option><option value="suspended">Suspendus</option><option value="pending">Demandes de plan</option><option value="expiring">Échéance ≤ 5 j</option><option value="expired">Expirés</option></select><span className="inline-flex h-11 items-center rounded-xl bg-[#10243b] px-3 text-xs font-bold text-white">{visible.length} résultat{visible.length>1?'s':''}</span></div></div></div>
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_34px_rgba(15,35,55,.055)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7"><div><h2 className="text-sm font-extrabold tracking-tight text-[#10243b]">Répertoire des traders</h2><p className="mt-1 text-xs text-slate-500">Clique sur un profil ou sur « Visualiser » pour ouvrir son dossier complet.</p></div><span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">{visible.length} profils</span></div>
              <div className="overflow-x-auto">
                <div className="min-w-[1120px]">
                  <div className="grid grid-cols-[42px_minmax(150px,1.05fr)_minmax(150px,1fr)_minmax(210px,1.35fr)_minmax(125px,.8fr)_minmax(150px,1fr)_minmax(105px,.65fr)_minmax(75px,.45fr)_120px] items-center gap-4 border-b border-slate-100 bg-slate-50/75 px-6 py-3 text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-400 lg:px-8">
                    <span>#</span><span>Pseudo</span><span>Vrai nom</span><span>Adresse e-mail</span><span>Inscription</span><span>Parrain</span><span>Forfait</span><span>État</span><span className="text-right">Dossier</span>
                  </div>
                  <div className="divide-y divide-slate-100/90">
                    {pagedUsers.map((u,i)=>{const doc=u as UserProfile & Record<string,any>;const profile=(doc.traderProfile||{}) as Record<string,any>;const display=u.displayName||'Sans pseudo';const realName=[profile.firstName,profile.lastName].filter(Boolean).join(' ').trim();const photo=doc.photoURL||doc.photoUrl||doc.avatarUrl||doc.avatar||doc.profileImage||doc.imageUrl||doc.picture||'';const refKey=doc.referredBy||profile.referredBy||doc.referrerCode||profile.referrerCode||doc.referredByUid||doc.sponsorId;const refText=String(refKey||'').trim().toLowerCase();const sponsor=refKey?users.find(candidate=>candidate.uid!==u.uid&&[candidate.uid,candidate.email,(candidate as any).referralCode,(candidate as any).affiliateCode,(candidate as any).traderProfile?.referralCode,(candidate as any).traderProfile?.affiliateCode].some(value=>value&&String(value).trim().toLowerCase()===refText)):undefined;const sponsorName=sponsor?.displayName||sponsor?.email||(refKey&&refKey.includes('@')?refKey:'');const created=u.createdAt?new Date(u.createdAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'';return <div key={u.uid} className="grid grid-cols-[42px_minmax(150px,1.05fr)_minmax(150px,1fr)_minmax(210px,1.35fr)_minmax(125px,.8fr)_minmax(150px,1fr)_minmax(105px,.65fr)_minmax(75px,.45fr)_120px] items-center gap-4 px-6 py-4 transition hover:bg-emerald-50/45 lg:px-8">
                      <span className="text-[10px] font-extrabold tabular-nums tracking-wide text-slate-400">#{String((page-1)*perPage+i+1).padStart(2,'0')}</span>
                      <div className="flex min-w-0 items-center gap-2.5">{photo?<img src={String(photo)} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-2 ring-white shadow-sm" onError={e=>{e.currentTarget.style.display='none';}}/>:<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-extrabold text-emerald-700">{String(display).trim().slice(0,1).toUpperCase()}</span>}<span className="truncate text-xs font-extrabold text-[#10243b]">{display}</span></div>
                      <span className={'truncate text-xs font-semibold '+(realName?'text-slate-700':'text-rose-600')}>{realName||'Non renseigné'}</span>
                      <span className="truncate text-[11px] text-slate-500" title={u.email}>{u.email||'—'}</span>
                      <span className={'text-[11px] font-medium '+(created?'text-slate-600':'text-rose-600')}>{created||'Non renseignée'}</span>
                      <span className={'truncate text-[11px] font-semibold '+(sponsorName?'text-slate-700':'text-rose-600')} title={sponsorName||'Aucun parrain identifié'}>{sponsorName||'Non renseigné'}</span>
                      <span className={'w-fit rounded-lg border px-2.5 py-1.5 text-[10px] font-bold '+planClass(u.plan)}>{planLabel(u.plan)}</span>
                      <span className={'w-fit rounded-full px-2 py-1 text-[9px] font-bold '+(u.status==='active'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700')}>{u.status==='active'?'Actif':'Suspendu'}</span>
                      <div className="flex justify-end"><button type="button" onClick={()=>{setProfileModalUser(u);setProfileMicroModal(null);}} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 text-[10px] font-extrabold text-emerald-700 shadow-sm transition hover:bg-emerald-50"><Eye className="h-3.5 w-3.5"/><span>Visualiser</span></button></div>
                    </div>})}
                    {!pagedUsers.length&&<div className="px-5 py-12 text-center text-sm text-slate-400">Aucun utilisateur ne correspond à ces critères.</div>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 text-xs text-slate-500"><span>Page <b className="text-[#10243b]">{page}</b> / <b className="text-[#10243b]">{totalPages}</b></span><div className="flex gap-2"><button disabled={page===1} onClick={()=>setPage(page-1)} className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold disabled:opacity-30"><ChevronLeft className="h-4 w-4"/>Précédent</button><button disabled={page===totalPages} onClick={()=>setPage(page+1)} className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold disabled:opacity-30">Suivant<ChevronRight className="h-4 w-4"/></button></div></div>
            </section>
          </section>}

          {adminTab==='subscriptions' && <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative isolate overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-[0_5px_20px_rgba(15,35,55,.04)]"><CreditCard className="pointer-events-none absolute -right-2 -top-3 h-20 w-20 text-blue-600 opacity-[.09] blur-[1px]"/><div className="relative flex items-center gap-2 text-xs font-bold text-slate-500"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><CreditCard className="h-4 w-4"/></span>Forfait Plus</div><b className="relative mt-4 block text-3xl font-extrabold tracking-tight text-blue-700">{users.filter(u=>u.plan==='pro').length}</b><span className="relative mt-1 block text-xs text-slate-500">Abonnements actifs</span></div>
              <div className="relative isolate overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-5 shadow-[0_5px_20px_rgba(15,35,55,.04)]"><Users className="pointer-events-none absolute -right-2 -top-3 h-20 w-20 text-violet-600 opacity-[.09] blur-[1px]"/><div className="relative flex items-center gap-2 text-xs font-bold text-slate-500"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Users className="h-4 w-4"/></span>Forfait Community</div><b className="relative mt-4 block text-3xl font-extrabold tracking-tight text-violet-700">{users.filter(u=>u.plan==='community').length}</b><span className="relative mt-1 block text-xs text-slate-500">Abonnements actifs</span></div>
              <div className="relative isolate overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-5 shadow-[0_5px_20px_rgba(15,35,55,.04)]"><Clock3 className="pointer-events-none absolute -right-2 -top-3 h-20 w-20 text-amber-600 opacity-[.10] blur-[1px]"/><div className="relative flex items-center gap-2 text-xs font-bold text-amber-800"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Clock3 className="h-4 w-4"/></span>À confirmer</div><b className="relative mt-4 block text-3xl font-extrabold tracking-tight text-amber-800">{payments.filter(p=>p.status==='processing'||p.status==='initiated').length}</b><span className="relative mt-1 block text-xs text-amber-700">Paiements en attente</span></div>
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,35,55,.045)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-700">Activité commerciale</span><h2 className="mt-1 text-sm font-extrabold text-[#10243b]">Abonnements récents</h2><p className="mt-1 text-xs text-slate-500">Derniers paiements confirmés.</p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">{payments.filter(p=>p.status==='paid').length} confirmés</span></div>
                <div className="divide-y divide-slate-100">{payments.filter(p=>p.status==='paid').slice((subscriptionPage-1)*5,subscriptionPage*5).map((p,i)=><div key={p.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/80"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-4 w-4"/></span><div className="min-w-0 flex-1"><b className="block truncate text-xs font-extrabold text-[#10243b]">{p.displayName||p.email||'Trader'}</b><span className="mt-1 block truncate text-[11px] text-slate-500">{p.planName||p.plan||'Abonnement'} · {new Date(p.paidAt||p.createdAt||'').toLocaleDateString('fr-FR')}</span><span className="mt-1 block truncate text-[10px] text-slate-400">Réf. {p.reference||p.id}</span></div><div className="text-right"><b className="block whitespace-nowrap text-sm font-extrabold text-emerald-700">{Number(p.amount||0).toFixed(2)} {p.currency||'USD'}</b><span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Confirmé</span></div></div>)}{payments.filter(p=>p.status==='paid').length===0&&<div className="px-5 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><ReceiptText className="h-5 w-5"/></div><p className="mt-3 text-sm font-bold text-slate-700">Aucun abonnement confirmé</p><p className="mt-1 text-xs text-slate-400">Les paiements validés apparaîtront ici.</p></div>}</div>
                {payments.filter(p=>p.status==='paid').length>0&&<div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3"><span className="text-xs text-slate-500">Page {subscriptionPage} / {Math.max(1,Math.ceil(payments.filter(p=>p.status==='paid').length/5))} · {payments.filter(p=>p.status==='paid').length} transactions</span><div className="flex gap-2"><button disabled={subscriptionPage===1} onClick={()=>setSubscriptionPage(v=>Math.max(1,v-1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 disabled:opacity-30"><ChevronLeft className="h-4 w-4"/></button><button disabled={subscriptionPage>=Math.ceil(payments.filter(p=>p.status==='paid').length/5)} onClick={()=>setSubscriptionPage(v=>Math.min(Math.ceil(payments.filter(p=>p.status==='paid').length/5),v+1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 disabled:opacity-30"><ChevronRight className="h-4 w-4"/></button></div></div>}
              </section>
              <section className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-[0_8px_30px_rgba(15,35,55,.045)]">
                <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/60 px-5 py-4"><div><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-amber-700">À surveiller</span><h2 className="mt-1 text-sm font-extrabold text-[#10243b]">Paiements à confirmer</h2><p className="mt-1 text-xs text-slate-500">Transactions en cours de validation.</p></div><span className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-800">{payments.filter(p=>p.status==='processing'||p.status==='initiated').length} en attente</span></div>
                <div className="divide-y divide-slate-100">{payments.filter(p=>p.status==='processing'||p.status==='initiated').slice((pendingPaymentPage-1)*5,pendingPaymentPage*5).map(p=><div key={p.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-amber-50/30"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Clock3 className="h-4 w-4"/></span><div className="min-w-0 flex-1"><b className="block truncate text-xs font-extrabold text-[#10243b]">{p.displayName||p.email||'Trader'}</b><span className="mt-1 block truncate text-[11px] text-slate-500">{p.planName||p.plan||'Abonnement'} · {p.reference||p.id}</span><span className="mt-1 block text-[10px] text-slate-400">{new Date(p.createdAt||'').toLocaleDateString('fr-FR')}</span></div><div className="text-right"><b className="block whitespace-nowrap text-sm font-extrabold text-[#10243b]">{Number(p.amount||0).toFixed(2)} {p.currency||'USD'}</b><span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">En attente</span></div></div>)}{payments.filter(p=>p.status==='processing'||p.status==='initiated').length===0&&<div className="px-5 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5"/></div><p className="mt-3 text-sm font-bold text-slate-700">Aucun paiement en attente</p><p className="mt-1 text-xs text-slate-400">Toutes les transactions sont à jour.</p></div>}</div>
                {payments.filter(p=>p.status==='processing'||p.status==='initiated').length>0&&<div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3"><span className="text-xs text-slate-500">Page {pendingPaymentPage} / {Math.max(1,Math.ceil(payments.filter(p=>p.status==='processing'||p.status==='initiated').length/5))}</span><div className="flex gap-2"><button disabled={pendingPaymentPage===1} onClick={()=>setPendingPaymentPage(v=>Math.max(1,v-1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 disabled:opacity-30"><ChevronLeft className="h-4 w-4"/></button><button disabled={pendingPaymentPage>=Math.ceil(payments.filter(p=>p.status==='processing'||p.status==='initiated').length/5)} onClick={()=>setPendingPaymentPage(v=>Math.min(Math.ceil(payments.filter(p=>p.status==='processing'||p.status==='initiated').length/5),v+1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 disabled:opacity-30"><ChevronRight className="h-4 w-4"/></button></div></div>}
              </section>
            </div>
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
                    {payments.filter(p=>paymentFilter==='all'||(paymentFilter==='processing'&&(p.status==='pending'||p.status==='processing'||p.status==='initiated'))||p.status===paymentFilter).map(p=>{
                      const rowName=(p as any).fullName || p.payerName || p.displayName || '—';
                      const rowStatus=p.status==='paid'?'PAYÉ':p.status==='pending'||p.status==='processing'||p.status==='initiated'?'EN ATTENTE':p.status==='cancelled'?'ANNULÉ':p.status==='invalidated'?'INVALIDÉ':'ÉCHEC';
                      const rowTone=p.status==='paid'?'bg-emerald-50 text-emerald-700':p.status==='pending'||p.status==='processing'||p.status==='initiated'?'bg-amber-50 text-amber-700':p.status==='cancelled'?'bg-slate-100 text-slate-600':'bg-rose-50 text-rose-700';
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
            const statusLabel = p.status === 'paid' ? 'Paiement confirmé' : p.status === 'pending' || p.status === 'processing' || p.status === 'initiated' ? 'En attente de vérification' : p.status === 'cancelled' ? 'Paiement annulé' : p.status === 'invalidated' ? 'Paiement invalidé' : 'Paiement échoué';
            const statusTone = p.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.status === 'pending' || p.status === 'processing' || p.status === 'initiated' ? 'bg-amber-50 text-amber-700 border-amber-100' : p.status === 'cancelled' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-rose-50 text-rose-700 border-rose-100';
            const dateTime = (value?: string) => value ? new Date(value).toLocaleString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }) : '—';
            const dateOnly = (value?: string) => value ? new Date(value).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
            const money = (value: any) => new Intl.NumberFormat('fr-FR', { style:'currency', currency:p.currency || 'USD', minimumFractionDigits:2 }).format(Number(value || 0));
            const baseAmount = Number(p.originalAmount ?? p.baseAmount ?? (Number(p.amount || 0) - Number(p.paymentFee || 0)));
            const discountAmount = Number(p.discountAmount || 0);
            const netAmount = Math.max(0, baseAmount - discountAmount);
            const openAdminInvoice = () => {
              const esc = (v: any) => String(v ?? '—').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch] || ch));
              const fmtMoney = (v: any) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v || 0)) + ' ' + (p.currency || 'USD');
              const paid = p.status === 'paid';
              const title = paid ? 'FACTURE' : 'ÉTAT DE TRANSACTION';
              const rows = '<tr><td>Abonnement ' + esc(p.planName || (p.plan === 'pro' ? 'Plus' : 'Community')) + '</td><td>' + fmtMoney(baseAmount) + '</td></tr>' + (discountAmount > 0 ? '<tr><td>Réduction — ' + esc(p.promoCode || p.promotionName || 'Offre promotionnelle') + '</td><td>−' + fmtMoney(discountAmount) + '</td></tr>' : '') + '<tr><td>Frais de paiement réellement enregistrés</td><td>' + fmtMoney(p.paymentFee || 0) + '</td></tr>';
              setInvoiceHtml('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + ' ' + esc(invoice) + '</title><style>*{box-sizing:border-box}body{margin:0;background:#edf2f6;color:#10243b;font:14px/1.55 Arial,sans-serif}.page{max-width:850px;min-height:100vh;margin:24px auto;background:white;padding:56px 64px;box-shadow:0 10px 45px #10243b12}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #10243b;padding-bottom:26px}.brand{font-size:26px;font-weight:900;letter-spacing:-1px}.sub{font-size:11px;color:#718096}.title{text-align:right}.title h1{margin:0;font-size:30px;letter-spacing:2px}.muted{color:#718096;font-size:12px}.status{margin:24px 0;padding:13px 16px;border-radius:10px;background:' + (paid ? '#eafaf4' : '#fff7e7') + ';color:' + (paid ? '#08785e' : '#925d10') + ';font-weight:800}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0}.label{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:#8190a2;font-weight:800;margin-bottom:8px}.box{padding:16px;border:1px solid #e4eaf0;border-radius:12px;line-height:1.9}table{width:100%;border-collapse:collapse;margin-top:28px}td{padding:16px 8px;border-bottom:1px solid #e8edf2}td:last-child{text-align:right;font-weight:700;white-space:nowrap}.totals{width:340px;max-width:100%;margin:22px 0 0 auto}.line{display:flex;justify-content:space-between;gap:16px;padding:8px 0;color:#596b7d}.total{border-top:2px solid #10243b;padding-top:14px;margin-top:8px;font-size:20px;font-weight:900;color:#10243b}.total strong{color:#00a982}.foot{border-top:1px solid #e5ebf1;margin-top:55px;padding-top:18px;display:flex;justify-content:space-between;gap:20px;color:#718096;font-size:11px}@media(max-width:600px){.page{padding:28px 20px;margin:0}.grid{grid-template-columns:1fr}.top{flex-direction:column}.title{text-align:left}.foot{flex-direction:column}}@media print{body{background:white}.page{margin:0;max-width:none;box-shadow:none;min-height:auto}.actions{display:none}}</style></head><body><main class="page"><header class="top"><div><div class="brand">IAMTRADER</div><div class="sub">Trading Performance SaaS</div></div><div class="title"><h1>' + title + '</h1><b>' + esc(invoice) + '</b><div class="muted">Émise le ' + esc(new Date(p.createdAt || Date.now()).toLocaleDateString('fr-FR')) + '</div></div></header><div class="status">' + (paid ? 'PAIEMENT CONFIRMÉ — document acquitté' : 'DOCUMENT NON ACQUITTÉ — ne constitue pas une preuve de paiement') + ' · ' + esc(statusLabel) + '</div><div class="grid"><section><div class="label">Facturé à</div><div class="box"><b>' + esc(fullName) + '</b><br>' + esc(p.email) + '<br>Téléphone : ' + esc(p.phone || p.payerPhone) + '</div></section><section><div class="label">Informations de paiement</div><div class="box">Méthode : ' + (p.paymentMethod === 'bank_transfer' ? 'Virement bancaire' : 'Mobile Money') + '<br>Référence IAMTRADER : ' + esc(p.reference || p.id) + '<br>Date : ' + esc(p.paidAt ? new Date(p.paidAt).toLocaleString('fr-FR') : 'Non confirmé') + '</div></section></div><table><tbody>' + rows + '</tbody></table><div class="totals"><div class="line"><span>Sous-total</span><b>' + fmtMoney(baseAmount) + '</b></div>' + (discountAmount > 0 ? '<div class="line"><span>Réduction appliquée</span><b>−' + fmtMoney(discountAmount) + '</b></div><div class="line"><span>Après réduction</span><b>' + fmtMoney(netAmount) + '</b></div>' : '') + '<div class="line"><span>Frais enregistrés</span><b>' + fmtMoney(p.paymentFee || 0) + '</b></div><div class="line total"><span>' + (paid ? 'Total payé' : 'Montant enregistré') + '</span><strong>' + fmtMoney(p.amount) + '</strong></div></div><footer class="foot"><div><b>IAMTRADER</b><br>' + (paid ? 'Justificatif de paiement confirmé.' : 'Document informatif, non valable comme preuve de paiement.') + '</div><div>Facture ' + esc(invoice) + '</div></footer><div class="actions" style="margin-top:24px;text-align:right"><button onclick="window.print()" style="padding:12px 18px;border:0;border-radius:9px;background:#10243b;color:white;font-weight:bold;cursor:pointer">Imprimer / Enregistrer en PDF</button></div></main></body></html>');
            };
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
                    <div className="flex shrink-0 items-center gap-2"><button onClick={openAdminInvoice} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#00a982] px-3 text-xs font-black text-white hover:bg-emerald-700"><ReceiptText className="h-3.5 w-3.5"/>Voir la facture</button><button onClick={()=>setSelectedPayment(null)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700"><X className="h-4 w-4"/></button></div>
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
                          <div><b className="text-slate-700">Téléphone de contact :</b> {p.phone || p.payerPhone || '—'}</div>
                        </div>
                      </div>
                    </section>
                    <section>
                      <div className="mb-3 text-xs font-black uppercase tracking-[.16em] text-slate-400">Transaction</div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="space-y-2 text-sm text-slate-500">
                          <div><b className="text-slate-700">Type :</b> {actionLabel}</div>
                          <div><b className="text-slate-700">Paiement :</b> {dateTime(p.paidAt || p.createdAt)}</div>
                          <div><b className="text-slate-700">Méthode :</b> {p.paymentMethod === 'bank_transfer' ? 'Virement bancaire' : 'Mobile Money'}</div>
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
                      {p.paymentMethod === 'bank_transfer' && p.status === 'pending' && <button disabled={paymentActionBusy} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'paid',paidAt:new Date().toISOString()});await refreshPayments();setSelectedPayment(null);showToast('Virement confirmé. Abonnement activé.','success');}catch(e:any){showToast(e?.message||'Confirmation impossible.','error');}finally{setPaymentActionBusy(false);}}} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5"/>Confirmer le virement</button>}
                      <button disabled={paymentActionBusy} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'invalidated',invalidatedAt:new Date().toISOString()});await refreshPayments();setSelectedPayment(null);showToast('Paiement invalidé.');}catch(e:any){showToast(e?.message||'Action impossible.');}finally{setPaymentActionBusy(false);}}} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 disabled:opacity-50"><XCircle className="h-3.5 w-3.5"/>Invalider</button>
                      <button disabled={paymentActionBusy} onClick={async()=>{setPaymentActionBusy(true);try{await adminUpdatePayment(p.id,{status:'cancelled',cancelledAt:new Date().toISOString()});await refreshPayments();setSelectedPayment(null);showToast('Paiement annulé.');}catch(e:any){showToast(e?.message||'Action impossible.');}finally{setPaymentActionBusy(false);}}} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 disabled:opacity-50">Annuler</button>
                    </div>}
                  </div>
                </div>
              </div>
            </div>;
          })()}


          {invoiceHtml && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#071a2d]/75 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Aperçu de la facture" onClick={() => setInvoiceHtml('')}>
            <section className="flex h-[calc(100dvh-1rem)] max-h-[900px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div><h2 className="text-sm font-black text-[#10243b]">Aperçu de la facture</h2><p className="mt-0.5 text-xs text-slate-500">Document IAMTRADER · affichage interne</p></div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { const frame = document.getElementById('iamtrader-admin-invoice-frame') as HTMLIFrameElement | null; frame?.contentWindow?.print(); }} className="rounded-xl bg-[#00a982] px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">Imprimer / PDF</button>
                  <button type="button" onClick={() => setInvoiceHtml('')} aria-label="Fermer l’aperçu de la facture" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4"/></button>
                </div>
              </header>
              <iframe id="iamtrader-admin-invoice-frame" title="Facture IAMTRADER" srcDoc={invoiceHtml} className="min-h-0 w-full flex-1 bg-slate-100" />
            </section>
          </div>}

          {composeOpen && adminTab === 'support' && (
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#102b24]/35 p-0 backdrop-blur-[3px] sm:items-center sm:p-5 lg:justify-end lg:p-6" role="dialog" aria-modal="true" aria-label="Nouveau message">
              <form onSubmit={event => { event.preventDefault(); if (composeEditorRef.current) { setComposeHtml(composeEditorRef.current.innerHTML); setComposeBody(composeEditorRef.current.innerText.trim()); } void sendComposedEmail(); }} className="flex h-[min(820px,96dvh)] w-full max-w-[680px] flex-col overflow-hidden rounded-t-[24px] border border-white/80 bg-white shadow-[0_28px_100px_rgba(9,35,27,.28)] sm:rounded-[24px]">
                <header className="relative flex shrink-0 items-center justify-between overflow-hidden border-b border-emerald-100/80 bg-gradient-to-r from-[#effaf5] via-white to-[#f4faf7] px-5 py-4 sm:px-6">
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#0db889] to-[#087f63]"/>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#dff5eb] text-[#087f63] shadow-sm"><Mail className="h-[18px] w-[18px]"/></div>
                    <div className="min-w-0"><h2 className="text-sm font-bold tracking-[-.01em] text-[#173b31]">Nouveau message</h2><p className="mt-0.5 text-[11px] text-slate-500">Rédigez un message professionnel</p></div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={()=>void saveComposeDraft()} disabled={composeBusy} className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-[#087f63] transition hover:bg-emerald-50 disabled:opacity-40 sm:inline-flex">Enregistrer</button>
                    <button type="button" onClick={() => setComposeOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-800" aria-label="Réduire"><span className="text-xl leading-none">−</span></button>
                    <button type="button" onClick={() => setComposeOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600" aria-label="Fermer"><X className="h-4 w-4"/></button>
                  </div>
                </header>

                <div className="shrink-0 px-5 pt-3 sm:px-7">
                  <div className="group flex min-h-11 items-center gap-3 border-b border-slate-100 transition focus-within:border-[#0b9872]">
                    <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-400">À</span>
                    <input type="text" required value={composeTo} onChange={event=>setComposeTo(event.target.value)} placeholder="Nom ou adresse e-mail" className="h-11 min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"/>
                    <button type="button" onClick={()=>setComposeCcOpen(v=>!v)} className={'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition '+(composeCcOpen?'bg-emerald-50 text-[#087f63]':'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}>Cc</button>
                  </div>
                  {composeCcOpen && <div className="flex min-h-10 items-center gap-3 border-b border-slate-100"><span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-400">Cc</span><input type="text" value={composeCc} onChange={event=>setComposeCc(event.target.value)} placeholder="Ajouter des destinataires en copie" className="h-10 min-w-0 flex-1 bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-slate-400"/></div>}
                  <div className="flex min-h-12 items-center gap-3 border-b border-slate-100 transition focus-within:border-[#0b9872]">
                    <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-400">Objet</span>
                    <input required maxLength={200} value={composeSubject} onChange={event=>setComposeSubject(event.target.value)} placeholder="Objet du message" className="h-12 min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"/>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 sm:px-7">
                  <div ref={composeEditorRef} contentEditable suppressContentEditableWarning onInput={event=>{setComposeBody(event.currentTarget.innerText);setComposeHtml(event.currentTarget.innerHTML);}} onKeyUp={event=>{setComposeBody(event.currentTarget.innerText);setComposeHtml(event.currentTarget.innerHTML);rememberComposeSelection();}} onMouseUp={rememberComposeSelection} onPaste={event=>{event.preventDefault();const html=event.clipboardData.getData("text/html");const plain=event.clipboardData.getData("text/plain");if(html){document.execCommand("insertHTML",false,html);}else{document.execCommand("insertText",false,plain);}setTimeout(()=>{if(composeEditorRef.current){setComposeBody(composeEditorRef.current.innerText);setComposeHtml(composeEditorRef.current.innerHTML);}},0);}} onBlur={event=>{setComposeBody(event.currentTarget.innerText);setComposeHtml(event.currentTarget.innerHTML);}} data-placeholder="Écrivez votre message ici…" className="email-compose-editor min-h-full w-full text-[13px] leading-7 text-slate-700 outline-none before:text-slate-400 [&:empty:before]:content-[attr(data-placeholder)] [overflow-wrap:anywhere] [&_a]:text-[#087f63] [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-300 [&_blockquote]:pl-4 [&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-bold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-7 [&_p]:my-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-7" style={{fontFamily:composeFont}}/>
                  {!!composeFiles.length && <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{composeFiles.map((file,index)=><div key={file.name+index} className="flex max-w-full items-center gap-2 rounded-xl border border-emerald-100 bg-[#f5fbf8] px-3 py-2 text-xs text-slate-600"><Paperclip className="h-3.5 w-3.5 shrink-0 text-[#087f63]"/><span className="max-w-[180px] truncate font-medium">{file.name}</span><span className="text-slate-400">{(file.size/1024).toFixed(0)} Ko</span><button type="button" onClick={()=>setComposeFiles(files=>files.filter((_,i)=>i!==index))} className="ml-1 text-slate-400 hover:text-rose-600" aria-label="Retirer la pièce jointe"><X className="h-3.5 w-3.5"/></button></div>)}</div>}
                </div>

                {composeFormattingOpen && <div className="mx-5 mb-3 rounded-2xl border border-slate-200 bg-[#f8faf9] p-2.5 shadow-[0_4px_16px_rgba(15,35,55,.05)] sm:mx-7">
                  <div className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">Mise en forme</div>
                  <div className="flex flex-wrap items-center gap-1" onMouseDown={event=>{if((event.target as HTMLElement).tagName!=='SELECT'&&(event.target as HTMLElement).tagName!=='INPUT')event.preventDefault();}}>
                    <select value={composeFont} onChange={e=>{applyComposeCommand('fontName',e.target.value);setComposeFont(e.target.value);}} className="h-8 max-w-[125px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Tahoma</option><option>Courier New</option></select>
                    <select onChange={e=>{applyComposeCommand('fontSize',e.target.value);}} defaultValue="3" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"><option value="2">Petit</option><option value="3">Normal</option><option value="4">Grand</option><option value="5">Très grand</option><option value="6">Titre</option></select>
                    <span className="mx-1 h-5 w-px bg-slate-200"/>
                    {(['bold','italic','underline','strikeThrough'] as const).map(command=><button key={command} type="button" onClick={()=>applyComposeCommand(command)} className={'flex h-8 w-8 items-center justify-center rounded-lg transition '+(composeFormatState[command]?'bg-[#dff4e9] text-[#087f63] ring-1 ring-[#b9e5d0]':'text-slate-600 hover:bg-white')} title={command==='bold'?'Gras':command==='italic'?'Italique':command==='underline'?'Souligné':'Barré'}>{command==='bold'?<b>B</b>:command==='italic'?<i>I</i>:command==='underline'?<u>U</u>:'S̶'}</button>)}
                    <label className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600" title="Couleur du texte"><input type="color" defaultValue="#183b32" onChange={e=>applyComposeCommand('foreColor',e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"/>Couleur</label>
                    <button type="button" onClick={()=>applyComposeCommand('foreColor','#334155')} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50" title="Rétablir la couleur par défaut">Couleur par défaut</button>
                    <span className="mx-1 h-5 w-px bg-slate-200"/>
                    <button type="button" onClick={()=>applyComposeCommand('justifyLeft')} className="h-8 w-8 rounded-lg text-xs text-slate-600 hover:bg-white" title="Aligner à gauche">≡</button><button type="button" onClick={()=>applyComposeCommand('justifyCenter')} className="h-8 w-8 rounded-lg text-xs text-slate-600 hover:bg-white" title="Centrer">≋</button>
                    <button type="button" onClick={()=>applyComposeCommand('insertUnorderedList')} className={'h-8 rounded-lg px-2.5 text-xs font-medium transition '+(composeFormatState.insertUnorderedList?'bg-[#dff4e9] text-[#087f63]':'text-slate-600 hover:bg-white')} title="Liste à puces">• Liste</button><button type="button" onClick={()=>applyComposeCommand('insertOrderedList')} className={'h-8 rounded-lg px-2.5 text-xs font-medium transition '+(composeFormatState.insertOrderedList?'bg-[#dff4e9] text-[#087f63]':'text-slate-600 hover:bg-white')} title="Liste numérotée">1. Liste</button><button type="button" onClick={()=>{applyComposeCommand('removeFormat');applyComposeCommand('foreColor','#334155');setComposeFont('Arial');}} className="h-8 rounded-lg px-2 text-[10px] font-semibold text-slate-500 hover:bg-white" title="Effacer la mise en forme">Effacer le style</button>
                  </div>
                </div>}
                {composeEmojiOpen && <div className="mx-5 mb-3 flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:mx-7">{['😀','😊','😂','😉','😍','🙏','👍','🎉','❤️','📌','📈','✅','⚠️','💡'].map(emoji=><button key={emoji} type="button" onClick={()=>{applyComposeCommand('insertText',emoji);if(composeEditorRef.current){setComposeBody(composeEditorRef.current.innerText);setComposeHtml(composeEditorRef.current.innerHTML);}setComposeEmojiOpen(false);}} className="rounded-lg p-2 text-lg transition hover:bg-emerald-50">{emoji}</button>)}</div>}

                <input ref={composeFileInputRef} type="file" multiple className="hidden" onChange={event=>{const incoming=Array.from(event.target.files||[]);const total=[...composeFiles,...incoming].reduce((sum,file)=>sum+file.size,0);if(total>8*1024*1024){showToast('Les pièces jointes ne peuvent pas dépasser 8 Mo au total.','error');event.target.value='';return;}setComposeFiles(files=>[...files,...incoming]);event.target.value='';}}/>
                <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-[#fbfdfc] px-5 py-3.5 sm:px-7">
                  <div className="flex min-w-0 items-center gap-2">
                    <button type="submit" disabled={composeBusy||!composeTo.trim()||!composeSubject.trim()||!composeBody.trim()} className="inline-flex h-10 items-center gap-3 rounded-xl bg-gradient-to-r from-[#087f63] to-[#0b9872] px-5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(8,127,99,.2)] transition hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(8,127,99,.25)] disabled:opacity-40">{composeBusy?'Envoi…':'Envoyer'} <Send className="h-3.5 w-3.5"/></button>
                    <button type="button" onClick={()=>setComposeFormattingOpen(v=>!v)} className={'flex h-10 w-10 items-center justify-center rounded-xl transition '+(composeFormattingOpen?'bg-[#e1f5eb] text-[#087f63]':'text-slate-500 hover:bg-slate-100 hover:text-slate-800')} title="Options de mise en forme"><span className="text-sm font-black">Aᴀ</span></button>
                    <button type="button" onClick={()=>composeFileInputRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-[#087f63]" title="Joindre des fichiers"><Paperclip className="h-4 w-4"/></button>
                    <button type="button" onClick={()=>setComposeEmojiOpen(v=>!v)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-[#087f63]" title="Insérer un emoji"><Smile className="h-4 w-4"/></button>
                  </div>
                  <button type="button" disabled={composeBusy} onClick={()=>void saveComposeDraft()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-emerald-50 hover:text-[#087f63] sm:hidden" title="Enregistrer le brouillon"><FileText className="h-4 w-4"/></button>
                </footer>
              </form>
            </div>
          )}


          {adminTab === 'support' && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(11,31,53,.05)]">
              <div className="flex h-[calc(100svh-250px)] min-h-0 flex-col lg:flex-row">
                <aside className={'h-full min-h-0 w-full min-w-0 flex-1 flex-row border-b border-slate-200 bg-white lg:flex lg:flex-none lg:border-b-0 lg:border-r ' + (messageListOpen ? 'lg:w-[650px]' : 'lg:w-auto') + ' ' + (selectedMessage ? 'hidden' : 'flex')}>
                  <nav aria-label="Dossiers de messagerie" className={'flex h-full shrink-0 flex-col border-r border-emerald-100 bg-gradient-to-b from-[#f0fbf6] via-[#f7fcfa] to-[#edf8f3] py-4 transition-[width] duration-200 ' + (folderSidebarOpen ? 'w-[224px] px-4' : 'w-[76px] items-center px-2.5')}>
                    <div className={'mb-3 flex items-center ' + (folderSidebarOpen ? 'justify-between px-1.5' : 'justify-center')}>
                      {folderSidebarOpen && <span className="text-[10px] font-black uppercase tracking-[.16em] text-[#6d9184]">Dossiers</span>}
                      <button type="button" onClick={() => setFolderSidebarOpen(value => !value)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#66877c] transition hover:bg-emerald-100 hover:text-[#008f6b]" title={folderSidebarOpen ? 'Réduire les dossiers' : 'Déployer les dossiers'} aria-label={folderSidebarOpen ? 'Réduire les dossiers' : 'Déployer les dossiers'}>
                        {folderSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                      </button>
                    </div>
                    {([
                      ['inbox','Réception',Inbox],
                      ['sent','Envoyés',Send],
                      ['drafts','Brouillons',FileText],
                      ['unread','Non lus',Mail],
                      ['in_progress','En cours',Clock3],
                      ['archive','Archivés',Archive],
                      ['trash','Corbeille',Trash2]
                    ] as const).map(([folder,label,FolderIcon]) => {
                      const active = mailboxFolder === folder;
                      const count = folder === 'unread' ? contactMessages.filter(m => m.status === 'new' && m.folder !== 'archive' && m.folder !== 'trash').length : folder === 'inbox' ? contactMessages.filter(m => (!m.folder || m.folder === 'inbox') && m.status === 'new').length : 0;
                      return <button key={folder} type="button" onClick={() => { setMailboxFolder(folder); setSelectedMessage(null); setMessageListOpen(true); setExpandedEmailIds([]); }} title={folderSidebarOpen ? undefined : label} aria-label={label} className={'mb-2 flex min-h-12 items-center rounded-xl text-left transition-all ' + (folderSidebarOpen ? 'w-full gap-3.5 px-3.5' : 'w-11 justify-center') + (active ? ' bg-white text-[#008f6b] shadow-[0_4px_12px_rgba(0,143,107,.10)] ring-1 ring-[#bce9d8]' : ' text-[#668579] hover:bg-white/80 hover:text-[#008f6b]')}>
                        <FolderIcon className={'h-[17px] w-[17px] shrink-0 ' + (active ? 'text-[#009b73]' : 'text-slate-400')} />
                        {folderSidebarOpen && <span className="min-w-0 flex-1 truncate text-xs font-bold">{label}</span>}
                        {folderSidebarOpen && count > 0 && <span className="rounded-full bg-[#00a982] px-1.5 py-0.5 text-[9px] font-black text-white">{count}</span>}
                        {!folderSidebarOpen && count > 0 && <span className="absolute ml-6 -mt-6 h-2 w-2 rounded-full bg-[#00a982]" />}
                      </button>;
                    })}
                  </nav>
                  <div className={'flex min-h-0 min-w-0 flex-1 flex-col ' + (!messageListOpen ? 'hidden' : '')}>
                  <div className="border-b border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-black text-[#0b1f35]">Boîte de réception</div>
                        <div className="mt-0.5 text-xs text-slate-400">{contactMessages.length} éléments · {contactMessages.filter(m => m.status === 'new').length} non lus</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => { setComposeId(''); setComposeTo(''); setComposeSubject(''); setComposeBody(''); setComposeOpen(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#009b73] to-[#13b88a] px-3 py-2.5 text-[11px] font-extrabold text-white shadow-[0_5px_14px_rgba(0,155,115,.20)] transition hover:brightness-105"><Plus className="h-3.5 w-3.5" />Écrire</button><button type="button" onClick={() => setMessageListOpen(false)} className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:inline-flex" title="Masquer la liste des e-mails" aria-label="Masquer la liste des e-mails"><PanelLeftClose className="h-4 w-4" /></button><button onClick={() => { setSupportSearch(''); load(); }} disabled={loading} className="rounded-xl bg-[#f0f8f5] p-2.5 text-[#729488] transition hover:bg-[#e1f4eb] hover:text-[#008f6b]" title="Actualiser"><RefreshCw className={'h-3.5 w-3.5 '+(loading?'animate-spin':'')} /></button></div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#e0eee8] bg-[#f7fbf9] px-3.5 py-2.5 shadow-inner shadow-white">
                      <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <input value={supportSearch} onChange={e => setSupportSearch(e.target.value)} placeholder="Rechercher une conversation…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                      <Filter className="h-3 w-3 text-slate-300" />
                    </div>
                  </div>

                  <div className={'min-h-0 flex-1 overflow-y-auto ' + (!messageListOpen ? 'hidden' : '')}>
                    {contactMessages
                      .filter(m => mailboxFolder === 'inbox' ? (!m.folder || m.folder === 'inbox') : mailboxFolder === 'sent' ? m.folder === 'sent' : mailboxFolder === 'drafts' ? m.folder === 'drafts' : mailboxFolder === 'unread' ? m.status === 'new' && m.folder !== 'archive' && m.folder !== 'trash' : mailboxFolder === 'in_progress' ? m.status === 'in_progress' && m.folder !== 'archive' && m.folder !== 'trash' : m.folder === mailboxFolder)
                      .filter(m => {
                        const q = supportSearch.trim().toLowerCase();
                        return !q || [m.name, m.email, decodeMimeSubject(m.subject), m.message].some(v => String(v || '').toLowerCase().includes(q));
                      })
                      .reduce((rows, m) => {
                        if (mailboxFolder !== 'sent') return [...rows, m];
                        const parentId = String((m as any).parentConversationId || '').trim();
                        const groupKey = parentId || [String(m.email || '').toLowerCase(), decodeMimeSubject(m.subject).trim().toLowerCase()].join('|');
                        const existingIndex = rows.findIndex(row => {
                          const rowParent = String((row as any).parentConversationId || '').trim();
                          const rowKey = rowParent || [String(row.email || '').toLowerCase(), decodeMimeSubject(row.subject).trim().toLowerCase()].join('|');
                          return rowKey === groupKey;
                        });
                        if (existingIndex < 0) return [...rows, { ...m, __groupedSent: mailboxFolder === 'sent' } as any];
                        const next = [...rows];
                        const previous = next[existingIndex];
                        const mergedConversation = [...(Array.isArray(previous.conversation) ? previous.conversation : []), ...(Array.isArray(m.conversation) ? m.conversation : [])]
                          .filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id || (candidate.at === item.at && candidate.body === item.body)) === index)
                          .sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime());
                        next[existingIndex] = { ...previous, ...m, __groupedSent: true, conversation: mergedConversation } as any;
                        return next;
                      }, [] as typeof contactMessages)
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
                          <button key={m.id} onClick={() => { if (m.status === 'draft' || m.folder === 'drafts') { setComposeId(m.id); setComposeTo(m.email || ''); setComposeSubject(m.subject || ''); setComposeBody(m.message || ''); setComposeOpen(true); return; } if (m.status === 'new') { const now = new Date().toISOString(); setSelectedMessage({ ...m, status: 'in_progress', handledBy: auth.currentUser?.uid || '', handledAt: now }); void adminUpdateContact(m.id, { status: 'in_progress', handledBy: auth.currentUser?.uid || '', handledAt: now }).catch(() => showToast('Impossible de marquer le message comme lu.', 'error')); } else setSelectedMessage(m); setContactNote(m.adminNote || ''); setReplyText(''); setShowReplyComposer(false); setExpandedEmailIds([]); }} className={'flex w-full gap-3 border-b border-slate-100/80 px-4 py-4 text-left transition-all ' + (selectedItem ? 'bg-gradient-to-r from-[#e5f7ef] to-[#f4fbf8] shadow-[inset_3px_0_0_#00a982]' : unread ? 'bg-[#f8fcfa] hover:bg-[#eff9f4]' : 'bg-white hover:bg-[#f7fbf9]')}>
                            <div className={'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ' + (unread ? 'bg-gradient-to-br from-[#00a982] to-[#087d65] text-white shadow-sm' : 'bg-[#edf4f1] text-[#6d8b80]')}>
                              {(m.name || m.email || '?').trim().charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className={'block truncate text-sm ' + (unread ? 'font-black text-[#087d65]' : 'font-semibold text-slate-700')}>{m.name || m.email}</span>
                                  <span className="mt-0.5 block truncate text-xs text-slate-400">{email.local}<span className="text-slate-300">{email.domain}</span></span>
                                </div>
                                <span className="shrink-0 text-xs text-slate-400">{date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '—'}</span>
                              </div>
                              <div className={'mt-1 truncate text-sm ' + (unread ? 'font-bold text-[#315b4d]' : 'font-semibold text-slate-600')}>{decodeMimeSubject(m.subject) || '(Sans objet)'}</div>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="min-w-0 truncate text-xs text-slate-400">{preview}</span>
                                {thread.length > 1 && <span className="shrink-0 rounded-full bg-[#e4f5ed] px-1.5 py-0.5 text-[8px] font-black text-[#008f6b]">{thread.length}</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    {contactMessages.filter(m => mailboxFolder === 'inbox' ? (!m.folder || m.folder === 'inbox') : mailboxFolder === 'sent' ? m.folder === 'sent' : mailboxFolder === 'drafts' ? m.folder === 'drafts' : mailboxFolder === 'unread' ? m.status === 'new' && m.folder !== 'archive' && m.folder !== 'trash' : mailboxFolder === 'in_progress' ? m.status === 'in_progress' && m.folder !== 'archive' && m.folder !== 'trash' : m.folder === mailboxFolder).filter(m => {
                      const q = supportSearch.trim().toLowerCase();
                      return !q || [m.name, m.email, decodeMimeSubject(m.subject), m.message].some(v => String(v || '').toLowerCase().includes(q));
                    }).length === 0 && <div className="p-10 text-center text-sm text-slate-400">Aucune conversation.</div>}
                  </div>
                  </div>
                </aside>

                <div className={'h-full min-h-0 min-w-0 flex-1 bg-white ' + (selectedMessage ? 'flex' : 'hidden lg:flex')}>
                  {selectedMessage ? (
                    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
                      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
                        <div className="flex items-start gap-3">
                          <button type="button" onClick={() => setSelectedMessage(null)} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Retour à la boîte"><ChevronLeft className="h-4 w-4" /></button>{!messageListOpen && <button type="button" onClick={() => setMessageListOpen(true)} className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:inline-flex" title="Afficher la liste des e-mails" aria-label="Afficher la liste des e-mails"><PanelLeftOpen className="h-4 w-4" /></button>}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-[#e8f8f2] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#087f63]">E-mail</span>
                              {selectedMessage.status === 'new' && <span className="rounded-md bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">Non lu</span>}
                            </div>
                            <h2 className="mt-2 break-words text-lg font-bold leading-snug text-[#10243b]">{decodeMimeSubject(selectedMessage.subject) || '(Sans objet)'}</h2>
                            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span className="font-semibold text-slate-700">{selectedMessage.name || selectedMessage.email}</span>
                              <span className="text-slate-300">&lt;{selectedMessage.email}&gt;</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">À <span className="font-medium text-slate-700">{(selectedMessage as any).to || "hello@iamtrader.trade"}</span></div>
                            {Boolean((selectedMessage as any).cc) && <div className="mt-1 text-xs text-slate-500">Cc <span className="text-slate-700">{Array.isArray((selectedMessage as any).cc) ? (selectedMessage as any).cc.join(', ') : (selectedMessage as any).cc}</span></div>}
                            <div className="mt-1 text-[11px] text-slate-400">{selectedMessage.createdAt ? new Date(selectedMessage.createdAt).toLocaleString('fr-FR', {dateStyle:'long',timeStyle:'short'}) : ''}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => setShowReplyComposer(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#bdebd9] bg-[#effaf5] px-3 py-2 text-xs font-bold text-[#087f63] hover:bg-[#e2f7ed]" title="Répondre"><Send className="h-3.5 w-3.5" />Répondre</button>
                            <button onClick={async () => {
                              try {
                                const now = new Date().toISOString();
                                await adminUpdateContact(selectedMessage.id, { status:'in_progress', handledBy:auth.currentUser?.uid || '', handledAt:now });
                                setSelectedMessage(prev => prev ? {...prev,status:'in_progress',handledBy:auth.currentUser?.uid || '',handledAt:now}:prev);
                              } catch { showToast('Mise à jour impossible.'); }
                            }} className="hidden rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 sm:inline-flex">En cours</button>
                            <button type="button" onClick={() => adminUpdateContact(selectedMessage.id, { folder: mailboxFolder === 'trash' || mailboxFolder === 'archive' ? 'inbox' : 'archive' }).then(() => { setSelectedMessage(null); showToast(mailboxFolder === 'trash' || mailboxFolder === 'archive' ? 'Message restauré.' : 'Message archivé.', 'success'); }).catch(() => showToast('Action impossible.', 'error'))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" title={mailboxFolder === 'trash' || mailboxFolder === 'archive' ? 'Restaurer' : 'Archiver'}><Layers className="h-4 w-4" /></button>
                            <button onClick={() => (mailboxFolder === 'trash' ? adminDeleteContact(selectedMessage.id) : adminUpdateContact(selectedMessage.id, { folder: 'trash' })).then(() => { setSelectedMessage(null); showToast(mailboxFolder === 'trash' ? 'Message supprimé définitivement.' : 'Message déplacé dans la corbeille.', 'success'); }).catch(() => showToast('Suppression impossible.', 'error'))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title={mailboxFolder === 'trash' ? 'Supprimer définitivement' : 'Corbeille'}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </header>

                      <div className="min-h-0 w-full flex-1 overflow-y-auto bg-[#f7faf8] px-4 py-5 sm:px-7">
                        <div className="mx-auto w-full max-w-4xl space-y-4">
                          {(() => {
                            const legacyConversation = [{ id:'legacy-inbound', direction:'inbound' as const, body:selectedMessage.message, at:selectedMessage.createdAt || new Date().toISOString(), from:selectedMessage.email, to:'hello@iamtrader.trade' }];
                            const customerEmail = String(selectedMessage.email || '').trim().toLowerCase();
                            const rawConversation = Array.isArray(selectedMessage.conversation) && selectedMessage.conversation.length ? selectedMessage.conversation : legacyConversation;
                            const conversation = rawConversation.map(item => {
                              const senderEmail = String(item.from || '').trim().toLowerCase();
                              const recipientEmail = String(item.to || '').trim().toLowerCase();
                              let direction = item.direction;
                              if (senderEmail === customerEmail) direction = 'inbound';
                              else if (senderEmail === 'hello@iamtrader.trade' || recipientEmail === customerEmail) direction = 'outbound';
                              return { ...item, direction };
                            }).sort((a,b)=>new Date(a.at || 0).getTime()-new Date(b.at || 0).getTime());
                            return conversation.map((item,index) => {
                              const outbound=item.direction==='outbound';
                              const at=item.at?new Date(item.at):null;
                              const bodyParts=splitEmailSignature(item.body);
                              const cc=(item as any).cc;
                              const emailCardId = String(item.id || item.messageId || index);
                              const emailExpanded = expandedEmailIds[0] === emailCardId;
                              return <article key={emailCardId} className={'overflow-hidden rounded-xl border transition-colors '+(emailExpanded?'border-[#c9e7dc] bg-white shadow-[0_3px_12px_rgba(15,35,55,.045)]':'border-slate-100 bg-[#fcfdfd] shadow-none opacity-[.94]')}>
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                                  <div className="flex min-w-0 items-start gap-3">
                                    <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black '+(outbound?'bg-[#e7f7f0] text-[#087f63]':'bg-[#eaf0f7] text-[#29445f]')}>{(outbound?'I':(selectedMessage.name || selectedMessage.email || '?').charAt(0)).toUpperCase()}</div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-[#172f45]">{outbound?'Iamtrader team':(selectedMessage.name || selectedMessage.email)}</div>
                                      <div className="mt-0.5 break-all text-xs text-slate-500">{outbound?'hello@iamtrader.trade':selectedMessage.email}</div>
                                      <div className="mt-1 text-xs text-slate-500">À {outbound?selectedMessage.email:'hello@iamtrader.trade'}</div>
                                      {(cc || (outbound && (selectedMessage as any).cc)) && <div className="mt-1 text-xs text-slate-500">Cc {Array.isArray(cc || (selectedMessage as any).cc)?(cc || (selectedMessage as any).cc).join(', '):(cc || (selectedMessage as any).cc)}</div>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                    <span>{at&&!Number.isNaN(at.getTime())?at.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'—'}</span>
                                    <button type="button" onClick={()=>{setShowReplyComposer(true);setReplyText('');setReplyHtml('');setReplyFormattingOpen(false);setReplyEmojiOpen(false);}} className="rounded-lg p-1.5 text-slate-400 hover:bg-[#effaf5] hover:text-[#087f63]" title="Répondre à cet e-mail"><Send className="h-3.5 w-3.5"/></button>
                                    
                                  </div>
                                </div>
                                <button type="button" onClick={()=>setExpandedEmailIds(current=>current[0]===emailCardId?[]:[emailCardId])} aria-expanded={emailExpanded} className="flex w-full items-center justify-between gap-3 border-t border-slate-100/70 bg-[#fdfefd] px-4 py-2 text-left text-[10px] font-medium text-slate-400 transition hover:bg-[#f6faf8] hover:text-slate-500 sm:px-5">
                                  <span>{emailExpanded?'Masquer le contenu':'Afficher le contenu du message'}</span>
                                  <ChevronRight className={'h-3.5 w-3.5 transition-transform '+(emailExpanded?'rotate-90':'')} />
                                </button>
                                {emailExpanded && <div className="px-4 py-4 sm:px-5">
                                  {!outbound && <div className="mb-3 text-sm font-bold text-[#173b31]">{decodeMimeSubject(selectedMessage.subject)||'(Sans objet)'}</div>}
                                  <div className="email-rich-content break-words text-[13px] leading-7 text-slate-700 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-7 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-7 [&_li]:my-1 [&_a]:text-[#087f63] [&_a]:underline" dangerouslySetInnerHTML={{__html: (item as any).bodyHtml || (outbound && (selectedMessage as any).messageHtml) || bodyParts.message || "(Message vide)"}} />
                                  {bodyParts.signature&&<div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500"><div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Signature</div><div className="whitespace-pre-wrap break-words">{bodyParts.signature}</div></div>}
                                </div>}
                              </article>;
                            });
                          })()}
                        </div>
                      </div>

                      {showReplyComposer && <div className="w-full shrink-0 border-t border-emerald-100 bg-gradient-to-b from-[#fbfdfc] to-white px-4 py-4 sm:px-8 lg:px-10">
                        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_5px_22px_rgba(15,35,55,.06)]">
                          <div className="flex items-center justify-between border-b border-slate-100 bg-[#f8fbf9] px-4 py-3">
                            <div className="min-w-0"><div className="text-xs font-bold text-[#234c3f]">Répondre</div><div className="mt-0.5 truncate text-[11px] text-slate-400">À {selectedMessage.email}</div></div>
                            <div className="flex items-center gap-1"><button type="button" onClick={()=>setReplyFormattingOpen(v=>!v)} className={'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition '+(replyFormattingOpen?'bg-[#e1f5eb] text-[#087f63]':'text-slate-500 hover:bg-slate-100')} title="Mise en forme">Aᴀ</button><button type="button" onClick={()=>setShowReplyComposer(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" title="Fermer"><X className="h-4 w-4"/></button></div>
                          </div>
                          <div className="min-h-[116px] max-h-64 overflow-y-auto px-4 py-3">
                            <div ref={replyEditorRef} contentEditable suppressContentEditableWarning onInput={event=>{setReplyText(event.currentTarget.innerText);setReplyHtml(event.currentTarget.innerHTML);}} onKeyUp={event=>{setReplyText(event.currentTarget.innerText);setReplyHtml(event.currentTarget.innerHTML);rememberReplySelection();}} onMouseUp={rememberReplySelection} onPaste={event=>{event.preventDefault();const html=event.clipboardData.getData("text/html");const plain=event.clipboardData.getData("text/plain");if(html)document.execCommand("insertHTML",false,html);else document.execCommand("insertText",false,plain);setTimeout(()=>{if(replyEditorRef.current){setReplyText(replyEditorRef.current.innerText);setReplyHtml(replyEditorRef.current.innerHTML);}},0);}} data-placeholder="Écrivez votre réponse…" className="email-compose-editor min-h-[90px] w-full text-[13px] leading-7 text-slate-700 outline-none before:text-slate-400 [&:empty:before]:content-[attr(data-placeholder)] [&_a]:text-[#087f63] [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-300 [&_blockquote]:pl-4 [&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-bold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-7 [&_p]:my-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-7" style={{fontFamily:replyFont}}/>
                          </div>
                          {replyFormattingOpen && <div className="border-t border-slate-100 bg-[#f8faf9] px-3 py-3">
                            <div className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">Mise en forme</div>
                            <div className="flex flex-wrap items-center gap-1" onMouseDown={event=>{if((event.target as HTMLElement).tagName!=='SELECT'&&(event.target as HTMLElement).tagName!=='INPUT')event.preventDefault();}}>
                              <select value={replyFont} onChange={e=>{applyReplyCommand('fontName',e.target.value);setReplyFont(e.target.value);}} className="h-8 max-w-[120px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Tahoma</option><option>Courier New</option></select>
                              <select onChange={e=>applyReplyCommand('fontSize',e.target.value)} defaultValue="3" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"><option value="2">Petit</option><option value="3">Normal</option><option value="4">Grand</option><option value="5">Très grand</option><option value="6">Titre</option></select>
                              <span className="mx-1 h-5 w-px bg-slate-200"/>
                              {(['bold','italic','underline','strikeThrough'] as const).map((command)=><button key={command} type="button" onClick={()=>applyReplyCommand(command)} className={'flex h-8 w-8 items-center justify-center rounded-lg transition '+(replyFormatState[command]?'bg-[#dff4e9] text-[#087f63] ring-1 ring-[#b9e5d0]':'text-slate-600 hover:bg-white')} title={command==='bold'?'Gras':command==='italic'?'Italique':command==='underline'?'Souligné':'Barré'}>{command==='bold'?<b>B</b>:command==='italic'?<i>I</i>:command==='underline'?<u>U</u>:'S̶'}</button>)}
                              <label className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600" title="Couleur du texte"><input type="color" defaultValue="#475569" onChange={e=>applyReplyCommand('foreColor',e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"/>Couleur</label>
                              <button type="button" onClick={()=>applyReplyCommand('foreColor','#475569')} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50" title="Rétablir la couleur par défaut">Couleur par défaut</button>
                              <span className="mx-1 h-5 w-px bg-slate-200"/>
                              <button type="button" onClick={()=>applyReplyCommand('insertUnorderedList')} className={'h-8 rounded-lg px-2.5 text-xs transition '+(replyFormatState.insertUnorderedList?'bg-[#dff4e9] text-[#087f63]':'text-slate-600 hover:bg-white')} title="Liste à puces">• Liste</button>
                              <button type="button" onClick={()=>applyReplyCommand('insertOrderedList')} className={'h-8 rounded-lg px-2.5 text-xs transition '+(replyFormatState.insertOrderedList?'bg-[#dff4e9] text-[#087f63]':'text-slate-600 hover:bg-white')} title="Liste numérotée">1. Liste</button>
                              <button type="button" onClick={()=>{applyReplyCommand('removeFormat');applyReplyCommand('foreColor','#475569');setReplyFont('Arial');}} className="h-8 rounded-lg px-2 text-[10px] font-semibold text-slate-500 hover:bg-white" title="Effacer la mise en forme">Effacer le style</button>
                            </div>
                          </div>}
                          {replyEmojiOpen && <div className="flex flex-wrap gap-1 border-t border-slate-100 px-3 py-2">{['😀','😊','😂','😉','😍','🙏','👍','🎉','❤️','📌','📈','✅','⚠️','💡'].map(emoji=><button key={emoji} type="button" onClick={()=>applyReplyCommand('insertText',emoji)} className="rounded-lg p-1.5 text-lg hover:bg-emerald-50">{emoji}</button>)}</div>}
                          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-[#fbfdfc] px-3 py-3">
                            <div className="flex items-center gap-1.5"><button type="button" onClick={()=>setReplyFormattingOpen(v=>!v)} className={'flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black '+(replyFormattingOpen?'bg-[#e1f5eb] text-[#087f63]':'text-slate-500 hover:bg-slate-100')} title="Mise en forme">Aᴀ</button><button type="button" onClick={()=>setReplyEmojiOpen(v=>!v)} className={'flex h-9 w-9 items-center justify-center rounded-lg '+(replyEmojiOpen?'bg-[#e1f5eb] text-[#087f63]':'text-slate-500 hover:bg-slate-100')} title="Insérer un emoji"><Smile className="h-4 w-4"/></button></div>
                            <div className="flex items-center gap-2"><span className="text-[10px] text-slate-400">{replyText.length}/10 000</span><button type="button" disabled={replyBusy||!replyText.trim()} onClick={()=>void sendSupportReply()} className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-[#087f63] to-[#0b9872] px-4 text-xs font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-40">{replyBusy?'Envoi…':'Envoyer'}<Send className="h-3.5 w-3.5"/></button></div>
                          </div>
                        </div>
                      </div>}
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
                    <div className="flex h-full w-full min-w-0 flex-1 items-center justify-center bg-gradient-to-br from-[#f4faf7] via-white to-[#f1f7fb] px-6 text-center">
                      <div>
                        {!messageListOpen && <button type="button" onClick={() => setMessageListOpen(true)} className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#cfe8dd] bg-white px-3 py-2 text-xs font-semibold text-[#087f63] shadow-sm transition hover:bg-[#f1faf6]" title="Afficher la liste des e-mails"><PanelLeftOpen className="h-4 w-4" />Afficher la liste des e-mails</button>}
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#00a982] shadow-[0_8px_24px_rgba(0,143,107,.10)] ring-1 ring-[#dcefe6]"><Mail className="h-7 w-7" /></div>
                        <p className="mt-3 text-sm font-extrabold text-[#234c3f]">Sélectionnez une conversation</p>
                        <p className="mt-1 text-[13px] text-slate-500">Le fil complet s'affichera ici.</p>
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

          {adminTab==='promotions' && <PromotionCenter />}

          {adminTab==='ai-monitoring' && <AIMonitoringPanel />}

          {adminTab==='audit' && <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-sm font-black">Journal d’audit</h2><p className="mt-1 text-sm text-slate-400">Traçabilité des actions administratives.</p></div><div className="divide-y divide-slate-100">{logs.slice(0,50).map(l=><div key={l.id} className="flex gap-3 p-4"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100"><History className="h-3.5 w-3.5 text-slate-500"/></div><div><b className="text-sm text-slate-800">{l.action} · {l.userName}</b><p className="mt-1 text-xs text-slate-400">{l.details}</p></div></div>)}{!logs.length&&<div className="p-10 text-center text-xs text-slate-400">Aucune action enregistrée.</div>}</div></section>}
 
          {profileModalUser && (()=>{const u=profileModalUser as UserProfile & Record<string,any>;const doc=u;const profile=(doc.traderProfile||{}) as Record<string,any>;const socials=Array.isArray(profile.socialLinks)?profile.socialLinks:[];const photo=doc.photoURL||doc.photoUrl||doc.avatarUrl||doc.avatar||doc.profileImage||doc.imageUrl||doc.picture||'';const metrics=userMetrics[u.uid]||{initialCapital:0,totalPnl:0,tradeCount:0,pnlPercent:null,currency:'USD'};const age=profile.age??doc.age??'—';const userPayments=payments.filter((p:any)=>[p.uid,p.userId,p.userUid,p.traderId,p.email].some(v=>String(v||'').toLowerCase()===String(u.uid||'').toLowerCase()||String(v||'').toLowerCase()===String(u.email||'').toLowerCase())).sort((a,b)=>new Date(b.paidAt||b.createdAt||0).getTime()-new Date(a.paidAt||a.createdAt||0).getTime());const pairs:[string,any][]=[['Prénom',profile.firstName],['Nom',profile.lastName],['Nom affiché',u.displayName],['E-mail',u.email],['Âge',age],['Sexe',profile.gender],['Pays',profile.country],['Ville',profile.city],['WhatsApp',profile.whatsapp],['Date d’inscription',u.createdAt?fmt(u.createdAt):'—']];const referralCode=doc.referralCode||profile.referralCode||doc.affiliateCode||profile.affiliateCode;const referredBy=doc.referredBy||profile.referredBy||doc.referrerCode||profile.referrerCode||doc.referredByUid||doc.sponsorId;const referralKey=(value:any)=>String(value||'').trim().toLowerCase();const referrerUser=users.find(candidate=>candidate.uid!==u.uid&&[candidate.uid,candidate.email,(candidate as any).referralCode,(candidate as any).affiliateCode,(candidate as any).traderProfile?.referralCode,(candidate as any).traderProfile?.affiliateCode].some(key=>key&&referralKey(key)===referralKey(referredBy)));const referredUsers=users.filter(candidate=>candidate.uid!==u.uid&&[ (candidate as any).referredBy,(candidate as any).traderProfile?.referredBy,(candidate as any).referrerCode,(candidate as any).traderProfile?.referrerCode,(candidate as any).referredByUid,(candidate as any).sponsorId].some(key=>key&&[u.uid,u.email,referralCode].filter(Boolean).some(own=>referralKey(key)===referralKey(own))));return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-2 backdrop-blur-md sm:p-5" role="dialog" aria-modal="true" aria-labelledby="trader-cv-title" onClick={()=>{setProfileModalUser(null);setProfileMicroModal(null);}}>
            <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_32px_120px_rgba(0,0,0,.42)]" onClick={e=>e.stopPropagation()}>
              <header className="relative shrink-0 overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,.18),_transparent_42%),linear-gradient(115deg,#ffffff_0%,#f0faf5_58%,#dff5e9_100%)] px-5 py-8 text-slate-800 sm:px-10 sm:py-10"><div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/[.06]"/><div className="relative flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-4">{photo?<img src={String(photo)} alt="" className="h-[76px] w-[76px] shrink-0 rounded-[24px] border border-emerald-200 object-cover shadow-[0_12px_35px_rgba(0,0,0,.35)] sm:h-24 sm:w-24"/>:<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white/70 text-2xl font-black sm:h-20 sm:w-20">{String(u.displayName||u.email||'?').slice(0,1).toUpperCase()}</div>}<div className="min-w-0"><span className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-700">IAMTRADER · DOSSIER TRADER</span><h2 id="trader-cv-title" className="mt-1 truncate text-xl font-black tracking-tight sm:text-2xl">{[profile.firstName,profile.lastName].filter(Boolean).join(' ')||u.displayName||'Trader sans nom'}</h2><p className="mt-1 truncate text-xs text-slate-600">{u.email}</p><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-lg border border-white/15 bg-white/70 px-2.5 py-1 text-[10px] font-bold">{planLabel(u.plan)}</span><span className={'rounded-lg px-2.5 py-1 text-[10px] font-bold '+(u.status==='active'?'bg-emerald-300/20 text-emerald-100':'bg-rose-300/20 text-rose-100')}>{u.status==='active'?'Compte actif':'Compte suspendu'}</span></div></div></div><button type="button" onClick={()=>{setProfileModalUser(null);setProfileMicroModal(null);}} aria-label="Fermer le dossier" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white/70 text-slate-800 transition hover:bg-emerald-50"><X className="h-4 w-4"/></button></div></header>
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5faf7] p-4 sm:p-8"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,.16)]"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Performance P&L</span><b className={'mt-2 block text-2xl font-black '+(metrics.pnlPercent===null?'text-slate-500':metrics.pnlPercent>=0?'text-emerald-700':'text-rose-600')}>{metrics.pnlPercent===null?'—':(metrics.pnlPercent>=0?'+':'')+metrics.pnlPercent.toFixed(2)+'%'}</b></div><div className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,.16)]"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Trades enregistrés</span><b className="mt-2 block text-2xl font-black text-slate-800">{metrics.tradeCount}</b></div><div className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,.16)]"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Moyen de paiement</span><b className="mt-2 block text-lg font-black text-slate-800">{u.paymentStatus==='paid'?'Confirmé':'—'}</b></div></div>
                <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.85fr)]"><section className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,.16)] sm:p-5"><div className="mb-4 flex items-center justify-between"><div><span className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-700">Curriculum trader</span><h3 className="mt-1 text-sm font-black text-slate-800">Informations personnelles</h3></div><UserCheck className="h-5 w-5 text-emerald-700"/></div><dl className="grid gap-x-6 sm:grid-cols-2">{pairs.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([label,value])=>{const displayValue=String(value);const FieldIcon=label==='E-mail'?Mail:label==='WhatsApp'?Phone:label==='Pays'||label==='Ville'?MapPin:label==='Date d’inscription'?CalendarDays:label==='Sexe'?VenusAndMars:label==='Niveau'||label==='Style de trading'||label==='Marchés'?ChartNoAxesCombined:UserRound;return <div key={label} className="group border-b border-emerald-100 py-3.5"><dt className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500"><FieldIcon className="h-3.5 w-3.5 text-emerald-600/80"/>{label}</dt><dd className="mt-1 flex min-w-0 items-center justify-between gap-2"><span className="min-w-0 break-words text-xs font-bold text-slate-800">{displayValue}</span><button type="button" onClick={()=>void copyProfileValue(displayValue)} aria-label={'Copier '+label.toLowerCase()} title="Copier" className="shrink-0 rounded-md p-1 text-slate-400 opacity-60 transition hover:bg-emerald-50 hover:text-emerald-700 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Copy className="h-3.5 w-3.5"/></button></dd></div>})}</dl></section>
                <div className="space-y-4"><section className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,.16)]"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Profil de marché</span><div className="mt-3 space-y-4"><div className="flex items-start gap-2.5"><Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/><div><p className="text-[9px] font-bold uppercase text-slate-500">Niveau</p><b className={'text-xs '+(profile.level?'text-slate-800':'text-rose-600')}>{profile.level||'Non renseigné'}</b></div></div><div className="flex items-start gap-2.5"><ChartNoAxesCombined className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/><div><p className="text-[9px] font-bold uppercase text-slate-500">Style de trading</p><b className={'text-xs '+(profile.style?'text-slate-800':'text-rose-600')}>{profile.style||'Non renseigné'}</b></div></div><div className="flex items-start gap-2.5"><Layers className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/><div><p className="text-[9px] font-bold uppercase text-slate-500">Marchés</p><b className={'text-xs '+(profile.markets&&(Array.isArray(profile.markets)?profile.markets.length>0:true)?'text-slate-800':'text-rose-600')}>{Array.isArray(profile.markets)?profile.markets.join(', ')||'Non renseigné':profile.markets||'Non renseigné'}</b></div></div></div></section><section className="rounded-[22px] border border-violet-300/15 bg-[#f4f0ff] p-5"><span className="text-[9px] font-black uppercase tracking-wider text-violet-700">Présence sociale</span>{socials.length?<div className="mt-3 flex flex-wrap gap-2">{socials.map((x:any,i:number)=><span key={i} className="rounded-lg border border-violet-100 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700">{x.network||'Réseau'} · {x.username||'—'}</span>)}</div>:<p className="mt-2 text-xs text-slate-500">Aucun réseau social renseigné.</p>}</section></div></div>
                <section className="mt-5 rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,.16)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Gestion du compte</span><h3 className="mt-1 text-sm font-black text-slate-800">Abonnement & accès</h3></div>{canManageUsers && <button onClick={()=>openManage(u)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-black text-white hover:bg-emerald-800"><PenLine className="h-3.5 w-3.5"/>Gérer le compte</button>}</div><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><span className="text-[9px] font-bold uppercase text-slate-500">Forfait</span><b className="block text-xs text-slate-800">{planLabel(u.plan)}</b></div><div><span className="text-[9px] font-bold uppercase text-slate-500">Paiement</span><b className="block text-xs text-slate-800">{u.paymentStatus||'Non renseigné'}</b></div><div><span className="text-[9px] font-bold uppercase text-slate-500">Échéance</span><b className="block text-xs text-slate-800">{u.subscriptionExpiresAt?fmt(u.subscriptionExpiresAt):'—'}</b></div></div></section>
                <div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={()=>setProfileMicroModal('payments')} className="flex items-center justify-between gap-3 rounded-[22px] border border-emerald-300/20 bg-gradient-to-br from-[#e8f8ef] to-white p-5 text-left transition hover:border-emerald-400 hover:shadow-md"><span><b className="block text-xs font-black text-emerald-900">Historique de paiement</b><small className="mt-1 block text-[10px] text-emerald-700">{userPayments.length} transaction(s) associée(s)</small></span><ChevronRight className="h-5 w-5 text-emerald-700"/></button><button onClick={()=>setProfileMicroModal('affiliation')} className="flex items-center justify-between gap-3 rounded-[22px] border border-violet-300/20 bg-gradient-to-br from-[#f2edff] to-white p-5 text-left transition hover:border-violet-400 hover:shadow-md"><span><b className="block text-xs font-black text-violet-900">Affiliation</b><small className="mt-1 block text-[10px] text-violet-700">Code, parrain et informations disponibles</small></span><ChevronRight className="h-5 w-5 text-violet-700"/></button></div>
              </div>
            </div>
            {profileMicroModal && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md" role="dialog" aria-modal="true" onClick={()=>setProfileMicroModal(null)}><div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_30px_100px_rgba(15,45,35,.28)]" onClick={e=>e.stopPropagation()}><div className={'flex items-center justify-between px-5 py-4 '+'bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,.16),_transparent_48%),linear-gradient(115deg,#ffffff_0%,#effaf4_100%)]'}><div><span className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-700">Dossier trader</span><h3 className="mt-1 text-base font-black tracking-tight text-slate-900">{profileMicroModal==='payments'?'Historique de paiement':'Affiliation'}</h3></div><button onClick={()=>setProfileMicroModal(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"><X className="h-4 w-4"/></button></div><div className="max-h-[72dvh] overflow-y-auto bg-[#f7fbf8] p-5 sm:p-6">{profileMicroModal==='payments'?<><div className="mb-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-3"><span className="text-[9px] font-bold uppercase text-emerald-700">Transactions</span><b className="mt-1 block text-xl font-black text-emerald-900">{userPayments.length}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-[9px] font-bold uppercase text-slate-500">Montant confirmé</span><b className="mt-1 block text-lg font-black text-slate-800">{userPayments.filter((p:any)=>p.status==='paid').reduce((n:number,p:any)=>n+Number(p.amount||0),0).toFixed(2)} USD</b></div></div><div className="divide-y divide-slate-100">{userPayments.map((p:any)=><div key={p.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><b className="block truncate text-xs font-black text-slate-800">{p.planName||p.plan||'Paiement'}</b><span className="mt-1 block break-all text-[10px] text-slate-500">{p.reference||p.id} · {p.paidAt||p.createdAt?fmt(p.paidAt||p.createdAt):'—'}</span><span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">{p.status||'Inconnu'}</span></div><b className="shrink-0 text-xs font-black text-slate-800">{Number(p.amount||0).toFixed(2)} {p.currency||'USD'}</b></div>)}{!userPayments.length&&<p className="py-6 text-center text-xs text-slate-500">Aucun paiement associé à cet utilisateur.</p>}</div></>:<div className="space-y-3"><div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4"><span className="text-[9px] font-bold uppercase text-emerald-700">Code d’affiliation</span><div className="mt-1 flex items-center justify-between gap-2"><b className="block min-w-0 break-all text-sm font-black text-emerald-950">{referralCode||'Aucun code enregistré'}</b>{referralCode&&<button type="button" onClick={()=>void copyProfileValue(referralCode)} aria-label="Copier le code d’affiliation" title="Copier" className="shrink-0 rounded-md p-1.5 text-emerald-600 transition hover:bg-white hover:text-emerald-800"><Copy className="h-3.5 w-3.5"/></button>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-emerald-700"/><span className="text-[9px] font-bold uppercase text-slate-500">Parrain / référent</span></div><b className={'mt-1 block break-all text-xs font-bold '+(referrerUser?'text-slate-800':'text-rose-600')}>{referrerUser?(referrerUser.displayName||referrerUser.email):referredBy||'Aucun parrain identifié'}</b>{referrerUser?.email&&<span className="mt-1 block break-all text-[10px] text-slate-500">{referrerUser.email}</span>}</div><div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-emerald-700"/><span className="text-[9px] font-bold uppercase text-emerald-700">Filleuls</span></div><b className="text-sm font-black text-emerald-800">{referredUsers.length}</b></div>{referredUsers.length?<div className="mt-3 space-y-0">{referredUsers.map(child=><div key={child.uid} className="flex items-center justify-between gap-3 border-t border-emerald-100 py-3 first:border-t-0"><span className="min-w-0 truncate text-xs font-bold text-slate-800">{child.displayName||child.email||'Trader'}</span><span className="shrink-0 text-[10px] text-slate-500">{child.email}</span></div>)}</div>:<p className="mt-2 text-[10px] font-medium text-rose-600">Aucun filleul identifié dans les données disponibles.</p>}</div><p className="rounded-xl border border-slate-200/70 bg-white/80 p-3 text-[10px] leading-5 text-slate-500">Les relations sont calculées à partir des identifiants de parrainage présents dans les profils utilisateurs. Aucun lien n’est supposé si les données ne correspondent pas.</p></div>}</div></div></div>}
          </div>})()}
          {selected && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="manage-user-title" onClick={() => setSelected(null)}>
            <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_30px_100px_rgba(15,45,35,.28)]" onClick={event => event.stopPropagation()}>
              <div className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,.18),_transparent_45%),linear-gradient(115deg,#ffffff_0%,#f0faf5_58%,#dff5e9_100%)] px-6 pb-6 pt-5 text-slate-800"><div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-emerald-300/25 blur-3xl"/><div className="relative flex items-center justify-between"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700"><CreditCard className="h-3.5 w-3.5"/>Gestion du compte</span><button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-white/80 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label="Fermer"><X className="h-4 w-4"/></button></div><h2 id="manage-user-title" className="relative mt-5 text-xl font-extrabold tracking-tight text-slate-900">Gérer l’abonnement</h2><p className="relative mt-1 text-sm text-slate-600">{selected.displayName || selected.email}</p></div>
              <div className="bg-[#f7fbf8] p-6"><p className="mb-4 text-xs leading-5 text-slate-500">Modifie le rôle, le forfait, l’accès au compte et les informations de facturation de ce trader.</p><div className="grid gap-4 sm:grid-cols-2">
                 <label className="block text-xs font-bold text-slate-600"><span className="mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-600"/>Rôle IAMTRADER</span><select value={managedRole} onChange={event => setManagedRole(event.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-[#10243b] outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"><option value="trader">Trader</option><option value="admin">Administrateur</option></select></label>
                <label className="block text-xs font-bold text-slate-600"><span className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600"/>Forfait</span><select value={plan} onChange={event => setPlan(event.target.value as SubscriptionPlan)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-[#10243b] outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"><option value="free">Starter</option><option value="pro">Plus</option><option value="community">Community</option></select></label>
                <label className="block text-xs font-bold text-slate-600"><span className="mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600"/>Accès au compte</span><select value={status} onChange={event => setStatus(event.target.value as UserStatus)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-[#10243b] outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"><option value="active">Actif</option><option value="suspended">Suspendu</option></select></label>
                <label className="block text-xs font-bold text-slate-600"><span className="mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600"/>Statut du paiement</span><select value={payment} onChange={event => setPayment(event.target.value as typeof payment)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-[#10243b] outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"><option value="unpaid">Non payé</option><option value="paid">Payé</option><option value="refunded">Remboursé</option></select></label>
                <label className="block text-xs font-bold text-slate-600"><span className="mb-2 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-600"/>Date d’échéance</span><input type="date" value={expiry} onChange={event => setExpiry(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-[#10243b] outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"/></label>
              </div><div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Annuler</button><button type="button" disabled={busy} onClick={() => void saveManagedUser()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:from-emerald-800 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50">{busy?<><RefreshCw className="h-4 w-4 animate-spin"/>Enregistrement…</>:<><Check className="h-4 w-4"/>Enregistrer les modifications</>}</button></div></div>
            </div>
          </div>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        </main>
      </div>
    </div>
  );
}
