import React, { useMemo, useState } from 'react';
import { UserProfile, SubscriptionPlan, TradingAccount, Trade } from '../types';
import { PlanBadge } from '../components/common/Badge';
import {
  User, Shield, CreditCard, Sliders, Lock, Mail, Check, ArrowRight,
  Activity, CalendarDays, Clock3, WalletCards, Sparkles, ChevronRight, Phone, X, Crown, Target, Coins, TrendingUp, Star, Receipt
} from 'lucide-react';
import { resetUserPassword, updateTraderProfile } from '../services/auth';
import { useToast } from '../components/common/Toast';
import { TradingJournalSettings } from '../components/settings/TradingJournalSettings';
import { PaymentHistory } from './PaymentHistory';
import { calculateTraderRating, formatCurrency } from '../utils/calculations';
import { confirmSimulatedPayment, createPayment, createSimulatedPayment, getPaymentStatus, PaidPlan, PaymentDetails } from '../services/payments';

interface SettingsViewProps {
  userProfile: UserProfile | null;
  accounts: TradingAccount[];
  trades: Trade[];
  selectedAccountId: string;
  onRequestPlan: (plan: 'pro' | 'community') => void;
}

const starterLimit = 5;

const PAYMENT_FEE_RATE = 0.03;
const PAYMENT_PRICES = { pro: 9.99, community: 89.99 } as const;
const CINETPAY_CDF_PRICES = { pro: 23335, community: 210196 } as const;

function getPaymentAmounts(plan: PaidPlan) {
  const baseAmount = PAYMENT_PRICES[plan];
  const paymentFee = Math.round(baseAmount * PAYMENT_FEE_RATE * 100) / 100;
  const total = Math.round((baseAmount + paymentFee) * 100) / 100;
  const cdfTotal = CINETPAY_CDF_PRICES[plan];
  return { baseAmount, paymentFee, total, cdfTotal };
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function daysBetween(from?: string, to?: string) {
  if (!from || !to) return null;
  return Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
}
const countryOptions = [
  'Afrique du Sud','Algérie','Allemagne','Angola','Australie','Autriche','Belgique','Bénin','Botswana','Brésil','Burkina Faso','Burundi','Cameroun','Canada','Chine','Colombie','Congo','Côte d’Ivoire','Égypte','Émirats arabes unis','Espagne','États-Unis','France','Gabon','Ghana','Guinée','Inde','Italie','Kenya','Madagascar','Malawi','Mali','Maroc','Maurice','Mozambique','Namibie','Niger','Nigeria','Ouganda','République démocratique du Congo','Royaume-Uni','Rwanda','Sénégal','Suisse','Tanzanie','Tchad','Togo','Tunisie','Turquie','Ukraine','Zambie','Zimbabwe'
];


export function SettingsView({ userProfile, accounts, trades, selectedAccountId, onRequestPlan }: SettingsViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'certificates' | 'subscription' | 'security' | 'preferences' | 'journal' | 'history'>('subscription');
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [firstName, setFirstName] = useState(userProfile?.traderProfile?.firstName || '');
  const [lastName, setLastName] = useState(userProfile?.traderProfile?.lastName || '');
  const [gender, setGender] = useState(userProfile?.traderProfile?.gender || '');
  const [age, setAge] = useState(userProfile?.traderProfile?.age ? String(userProfile.traderProfile.age) : '');
  const [city, setCity] = useState(userProfile?.traderProfile?.city || '');
  const [country, setCountry] = useState(userProfile?.traderProfile?.country || '');
  const [whatsapp, setWhatsapp] = useState(userProfile?.traderProfile?.whatsapp || '');
  const [traderLevel, setTraderLevel] = useState(userProfile?.traderProfile?.level || '');
  const [traderStyle, setTraderStyle] = useState(userProfile?.traderProfile?.style || '');
  const [traderMarkets, setTraderMarkets] = useState<string[]>(userProfile?.traderProfile?.markets || []);
  const [socialLinks, setSocialLinks] = useState(userProfile?.traderProfile?.socialLinks || []);
  const [socialNetwork, setSocialNetwork] = useState('Instagram');
  const [socialUsername, setSocialUsername] = useState('');
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(!userProfile?.traderProfile);
  const [defaultCurrency, setDefaultCurrency] = useState(userProfile?.settings?.defaultCurrency || 'USD');
  const [theme, setTheme] = useState<'light'>('light');
  const [dashboardMode, setDashboardMode] = useState<'standard' | 'focus' | 'analysis' | 'compact'>(() => (localStorage.getItem('iamtrader-dashboard-mode') as any) || 'standard');
  const [paymentPlan, setPaymentPlan] = useState<PaidPlan | null>(null);
  const [paymentMode, setPaymentMode] = useState<'simulation' | 'live'>('live');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentProvider, setPaymentProvider] = useState('Airtel Money');
  const [paymentPayerName, setPaymentPayerName] = useState(userProfile?.displayName || [userProfile?.traderProfile?.firstName, userProfile?.traderProfile?.lastName].filter(Boolean).join(' ') || '');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'paid' | 'failed'>('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentAction, setPaymentAction] = useState<'initial' | 'renewal' | 'upgrade' | null>(null);
  const [paymentActivationStart, setPaymentActivationStart] = useState<string | null>(null);
  const [paymentActivationExpires, setPaymentActivationExpires] = useState<string | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const traderRating = useMemo(() => calculateTraderRating(trades), [trades]);

  const downloadTraderBadge = async () => {
    const templateUrl = '/assets/iamtrader-badge-template.png';
    const templateWidth = 1665;
    const templateHeight = 945;
    const exportScale = 4;
    const canvasWidth = templateWidth * exportScale;
    const canvasHeight = templateHeight * exportScale;

    const traderName = (displayName || [firstName, lastName].filter(Boolean).join(' ') || userProfile?.email || 'Trader').trim();
    const status = traderRating.isSufficientData ? traderRating.label : 'Données insuffisantes';
    const scoreText = traderRating.isSufficientData ? `${traderRating.score}/100` : '—';
    const grade = traderRating.grade;
    const winRate = traderRating.isSufficientData ? `${traderRating.winRate.toFixed(1)}%` : '—';
    const profitFactor = traderRating.isSufficientData ? traderRating.profitFactor.toFixed(2) : '—';
    const tradesText = `${traderRating.tradesAnalyzed} trades`;
    const generatedAt = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const image = new Image();
    image.src = templateUrl;

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Badge template unavailable'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.scale(exportScale, exportScale);

      context.drawImage(image, 0, 0, templateWidth, templateHeight);

      const fitText = (
        text: string,
        maxWidth: number,
        initialSize: number,
        minSize: number,
        weight = 700,
        family = 'Arial, sans-serif'
      ) => {
        let size = initialSize;
        while (size > minSize) {
          context.font = `${weight} ${size}px ${family}`;
          if (context.measureText(text).width <= maxWidth) break;
          size -= 1;
        }
        return size;
      };

      const drawCentered = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        initialSize: number,
        minSize: number,
        color: string,
        weight = 700
      ) => {
        const size = fitText(text, maxWidth, initialSize, minSize, weight);
        context.font = `${weight} ${size}px Arial, sans-serif`;
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, x, y);
      };

      const drawLeft = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        initialSize: number,
        minSize: number,
        color: string,
        weight = 700
      ) => {
        const size = fitText(text, maxWidth, initialSize, minSize, weight);
        context.font = `${weight} ${size}px Arial, sans-serif`;
        context.fillStyle = color;
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.fillText(text, x, y);
      };

      // Score + grade — centered inside the fixed medal area.
      drawCentered(scoreText, 330, 560, 220, 58, 40, '#ffffff', 800);
      drawCentered(grade, 330, 650, 110, 62, 44, '#2bb58a', 900);

      // Trader identity block.
      drawLeft(traderName, 735, 469, 285, 28, 17, '#0b1b2e', 800);
      drawLeft(status, 735, 580, 285, 21, 14, '#16876a', 800);
      drawLeft(tradesText, 735, 690, 285, 21, 15, '#0b1b2e', 800);

      // Performance indicators.
      drawCentered(winRate, 1228, 590, 170, 30, 21, '#0b1b2e', 800);
      drawCentered(profitFactor, 1480, 590, 170, 30, 21, '#0b1b2e', 800);
      drawLeft(generatedAt, 1225, 717, 350, 20, 14, '#0b1b2e', 700);

      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';

      const pngUrl = canvas.toDataURL('image/png', 1);
      const anchor = document.createElement('a');
      anchor.href = pngUrl;
      anchor.download = 'iamtrader-performance-badge.png';
      anchor.click();

      showToast('Badge IAMTRADER téléchargé en PNG.', 'success');
    } catch {
      showToast('Le template du badge est introuvable. Vérifiez public/assets/iamtrader-badge-template.png.', 'error');
    }
  };

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
  const subscriptionActive = !!userProfile?.subscriptionExpiresAt && new Date(userProfile.subscriptionExpiresAt).getTime() > Date.now() && userProfile?.plan !== 'free';
  const canBuyPlan = (plan: PaidPlan) => {
    if (userProfile?.scheduledPlan) return false;
    if (!subscriptionActive) return true;
    if (userProfile?.plan === plan) return false;
    if (userProfile?.plan === 'community' && plan === 'pro') return false;
    return true;
  };

  const changeDashboardMode = (mode: 'standard' | 'focus' | 'analysis' | 'compact') => {
    setDashboardMode(mode);
    localStorage.setItem('iamtrader-dashboard-mode', mode);
  };

  const startPayment = (plan: PaidPlan) => { setPaymentPlan(plan); setPaymentMode('live'); setPaymentPhone(userProfile?.traderProfile?.whatsapp || ''); setPaymentProvider('Airtel Money'); setPaymentPayerName(userProfile?.displayName || [userProfile?.traderProfile?.firstName, userProfile?.traderProfile?.lastName].filter(Boolean).join(' ') || ''); setPaymentId(null); setPaymentStatus('idle'); setPaymentMessage(''); setPaymentAction(null); setPaymentActivationStart(null); setPaymentActivationExpires(null); };

  const submitPayment = async () => {
    if (!paymentPlan) return;
    setIsPaymentLoading(true); setPaymentMessage('');
    try {
      const details: PaymentDetails = { phone: paymentPhone, paymentMethod: 'mobile_money', paymentProvider, payerName: paymentPayerName.trim() };
      const payment = paymentMode === 'simulation'
        ? await createSimulatedPayment(paymentPlan, details)
        : await createPayment(paymentPlan, details);
      setPaymentId(payment.id);
      setPaymentAction(payment.subscriptionAction || null);
      setPaymentActivationStart(payment.activationStartAt || null);
      setPaymentActivationExpires(payment.activationExpiresAt || null);
      setPaymentStatus('processing');
      setPaymentMessage(payment.message || 'Paiement en cours de traitement.');
      if (paymentMode === 'live' && payment.paymentUrl) window.location.assign(payment.paymentUrl);
    } catch (error: any) {
      setPaymentStatus('failed');
      setPaymentMessage(error?.message || 'Impossible d’initier le paiement.');
    } finally { setIsPaymentLoading(false); }
  };

  const confirmSimulation = async () => {
    if (!paymentId) return;
    setIsPaymentLoading(true); setPaymentMessage('');
    try {
      await confirmSimulatedPayment(paymentId);
      setPaymentStatus('paid');
      setPaymentMessage('Paiement confirmé. La transaction a été enregistrée côté administration et votre abonnement est activé.');
    } catch (error: any) {
      setPaymentStatus('failed');
      setPaymentMessage(error?.message || 'Impossible de confirmer la simulation.');
    } finally { setIsPaymentLoading(false); }
  };

  React.useEffect(() => {
    if (!paymentId || paymentStatus !== 'processing' || paymentMode === 'simulation') return;
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
  }, [paymentId, paymentStatus, paymentMode]);

  const saveTraderProfile = async () => {
    if (!userProfile?.uid) return;
    setIsProfileSaving(true);
    try {
      await updateTraderProfile(userProfile.uid, {
        firstName, lastName, gender, age: age ? Number(age) : undefined, city, country, whatsapp,
        level: traderLevel, style: traderStyle, markets: traderMarkets, socialLinks
      }, displayName);
      setIsEditingProfile(false);
      showToast('Profil trader enregistré avec succès', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Impossible d’enregistrer le profil', 'error');
    } finally { setIsProfileSaving(false); }
  };

  const addSocialLink = () => {
    const username = socialUsername.trim();
    if (!username) return;
    setSocialLinks(current => [...current, { network: socialNetwork, username }]);
    setSocialUsername('');
  };

  const removeSocialLink = (index: number) => setSocialLinks(current => current.filter((_, i) => i !== index));

  const toggleMarket = (market: string) => setTraderMarkets(current => current.includes(market) ? current.filter(item => item !== market) : [...current, market]);

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
    ['certificates', 'Certificats', Shield],
    ['subscription', 'Compte & Abonnement', CreditCard],
    ['security', 'Sécurité & Accès', Lock],
    ['preferences', 'Préférences Interface', Sliders],
    ['journal', 'Journal & Calculs', Activity],
    ['history', 'Historique des paiements', Receipt],
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

      {activeTab === 'history' && <PaymentHistory />}

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
              {userProfile?.scheduledPlan && userProfile.scheduledStartAt && <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-[10px] font-semibold text-indigo-800">Votre prochain forfait <b>{userProfile.scheduledPlan === 'community' ? 'Community' : 'Plus'}</b> est programmé pour le {formatDate(userProfile.scheduledStartAt)}. Votre forfait actuel reste actif jusque-là.</div>}
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
              <div><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-500">Changer de formule</span><h3 className="mt-1 text-lg font-black text-slate-950">Choisissez votre niveau d’accès</h3><p className="mt-1 text-xs text-slate-500">Paiement en mode test maintenant, puis branchement du prestataire réel lundi.</p></div>
              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:inline-flex">Paiement sécurisé</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-[24px] border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-[0_10px_35px_rgba(79,70,229,0.07)]">
                <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[9px] font-bold text-indigo-700">PLUS</span><span className="text-lg font-black text-slate-950">$9.99<span className="text-[10px] font-semibold text-slate-500">/mois</span></span></div>
                <div className="mt-4 space-y-2 text-[11px] text-slate-600"><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-indigo-500" /> Trades sans quota mensuel</div><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-indigo-500" /> Analyses avancées</div><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-indigo-500" /> Plusieurs comptes de trading</div></div>
                <button onClick={() => startPayment('pro')} disabled={!canBuyPlan('pro')} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-300 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 cursor-pointer">{!canBuyPlan('pro') ? (userProfile?.plan === 'pro' ? 'Déjà actif' : userProfile?.scheduledPlan ? 'Abonnement programmé' : 'Indisponible') : 'Choisir Plus'}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></button>
              </div>
              <div className="relative overflow-hidden rounded-[24px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-5 shadow-[0_10px_35px_rgba(20,184,166,0.06)]">
                <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[9px] font-bold text-cyan-700">COMMUNITY · 6 MOIS</span><span className="text-lg font-black text-slate-950">$89.99</span></div>
                <div className="mt-4 space-y-2 text-[11px] text-slate-600"><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-cyan-600" /> Outils et formations</div><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-cyan-600" /> Cours et ressources</div><div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-cyan-600" /> Accompagnement pendant 6 mois</div></div>
                <button onClick={() => startPayment('community')} disabled={!canBuyPlan('community')} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-cyan-50 px-4 py-2.5 text-xs font-bold text-cyan-900 ring-1 ring-cyan-300 hover:bg-cyan-100 disabled:opacity-50 cursor-pointer">{!canBuyPlan('community') ? (userProfile?.plan === 'community' ? 'Déjà actif' : userProfile?.scheduledPlan ? 'Abonnement programmé' : 'Indisponible') : 'Choisir Community'}<ChevronRight className="ml-1.5 h-3.5 w-3.5 text-cyan-600" /></button>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-5">
          {!isEditingProfile ? (
            <div className="space-y-6">
              <section className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br from-white via-white to-[#effaf7] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#00a982]/10 blur-2xl" />
                <div className="relative border-b border-slate-200/80 pb-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#00a982]">Profil trader</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-3xl font-black tracking-[-0.03em] text-slate-950">{displayName || [firstName, lastName].filter(Boolean).join(' ') || 'Trader IAMTRADER'}</h2>
                      <PlanBadge plan={userProfile?.plan || 'free'} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{[city, country].filter(Boolean).join(', ') || 'Localisation non renseignée'}{city || country ? ' · ' : ''}{userProfile?.email || '—'}</p>
                  </div>
                  <button type="button" onClick={() => setIsEditingProfile(true)} className="self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:self-auto">Modifier</button>
                </div>
              </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e5faf5] text-[#00896e]"><User className="h-4 w-4" /></span><div><div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Informations personnelles</div><div className="mt-0.5 text-sm font-bold text-slate-900">Identité & coordonnées</div></div></div>
                <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Prénom', firstName], ['Nom', lastName], ['Sexe', gender], ['Âge', age ? age + ' ans' : '—'],
                    ['Ville', city], ['Pays', country], ['WhatsApp', whatsapp], ['Membre depuis', formatDate(userProfile?.createdAt)]
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                      <div className="mt-1.5 truncate text-sm font-semibold text-slate-900">{value || '—'}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="relative overflow-hidden rounded-[24px] border border-[#dceee9] bg-gradient-to-br from-[#f8fffd] via-white to-[#eef8ff] p-6 shadow-[0_14px_42px_rgba(15,23,42,0.06)]">
                <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#00a982]/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-blue-100/60 blur-3xl" />
                <div className="relative">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#00a982]">Trading</div>
                      <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Profil de trading</h3>
                      <p className="mt-1 text-[11px] text-slate-500">Votre style, votre niveau et vos marchés principaux.</p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#00a982] shadow-sm ring-1 ring-[#dceee9]"><TrendingUp className="h-4 w-4" /></div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100"><Crown className="h-4 w-4" /></span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Niveau</span>
                      </div>
                      <div className="mt-3 text-sm font-black text-slate-950">{traderLevel || '—'}</div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100"><Target className="h-4 w-4" /></span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Style</span>
                      </div>
                      <div className="mt-3 text-sm font-black text-slate-950">{traderStyle || '—'}</div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><Coins className="h-4 w-4" /></span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Marchés</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                        {traderMarkets.length ? traderMarkets.map(m => <span key={m} className="text-sm font-black text-slate-950">{m}</span>) : <span className="text-sm font-black text-slate-950">—</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600">◎</span><div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Réseaux sociaux</div></div>
                {socialLinks.length ? (
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {socialLinks.map((link, index) => <div key={link.network + link.username + index} className="text-sm"><span className="font-semibold text-slate-900">{link.network}</span><span className="mx-2 text-slate-300">·</span><span className="text-slate-500">{link.username}</span></div>)}
                  </div>
                ) : <p className="text-xs text-slate-500">Aucun réseau social renseigné.</p>}
              </section>

              <section className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-r from-white via-[#f7fffc] to-[#f5f3ff] p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-amber-100"><Star className="h-5 w-5" /></div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">IAMTRADER Rating</div>
                      <div className="mt-1 text-sm font-black text-slate-950">Cote automatique de performance</div>
                      <p className="mt-1 text-[10px] text-slate-500">{traderRating.isSufficientData ? traderRating.tradesAnalyzed + ' trades analysés · Win Rate ' + traderRating.winRate.toFixed(1) + '% · PF ' + traderRating.profitFactor.toFixed(2) : traderRating.tradesAnalyzed + '/5 trades nécessaires pour obtenir une cote'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 self-start sm:items-end sm:self-auto">
                    <div className={traderRating.isSufficientData ? 'flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-sm' : 'flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm'}>
                      <span className={traderRating.isSufficientData ? 'flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200' : 'flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-black text-slate-500 ring-1 ring-slate-200'}>{traderRating.grade}</span>
                      <span className={traderRating.isSufficientData ? 'text-xs font-black text-emerald-800' : 'text-xs font-black text-slate-600'}>{traderRating.isSufficientData ? traderRating.label : 'En attente'}</span>
                      {traderRating.isSufficientData && <span className="text-[10px] font-bold text-emerald-600">{traderRating.score}/100</span>}
                    </div>
                    <button type="button" onClick={downloadTraderBadge} disabled={!traderRating.isSufficientData} className="rounded-xl bg-slate-950 px-4 py-2 text-[10px] font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Télécharger le badge</button>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div><h3 className="text-lg font-black text-slate-900">Profil du trader</h3><p className="mt-1 text-xs text-slate-500">Les informations visibles dans votre profil IAMTRADER.</p></div>
                  <PlanBadge plan={userProfile?.plan || 'free'} />
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Prénom', firstName, setFirstName], ['Nom', lastName, setLastName], ['Nom d’affichage', displayName, setDisplayName],
                    ['Âge', age, setAge], ['Ville', city, setCity], ['WhatsApp', whatsapp, setWhatsapp]
                  ].map(([label, value, setter], index) => <div key={String(label)} className={index === 2 ? 'lg:col-span-1' : ''}><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label as string}</label><input value={value as string} onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} type={label === 'WhatsApp' ? 'tel' : 'text'} inputMode={label === 'Âge' ? 'numeric' : label === 'WhatsApp' ? 'tel' : undefined} placeholder={label === 'WhatsApp' ? '+243 9XX XXX XXX' : undefined} autoComplete={label === 'WhatsApp' ? 'tel' : undefined} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#00a982] focus:ring-2 focus:ring-[#e5faf5]" /></div>)}
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Pays</label><select value={country} onChange={e => setCountry(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#00a982] focus:ring-2 focus:ring-[#e5faf5]"><option value="">Sélectionner un pays</option>{countryOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Sexe</label><select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#00a982]"><option value="">Sélectionner</option><option>Homme</option><option>Femme</option><option>Autre</option></select></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail</label><input disabled value={userProfile?.email || ''} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" /></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Date d’inscription</label><input disabled value={formatDate(userProfile?.createdAt)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" /></div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">Profil de trading</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Niveau</label><select value={traderLevel} onChange={e => setTraderLevel(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Sélectionner</option><option>Débutant</option><option>Intermédiaire</option><option>Avancé</option><option>Professionnel</option></select></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Style</label><select value={traderStyle} onChange={e => setTraderStyle(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Sélectionner</option><option>Scalping</option><option>Day Trading</option><option>Swing Trading</option><option>Position Trading</option></select></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Marchés principaux</label><div className="flex flex-wrap gap-2">{['Forex','Gold','Indices','Crypto'].map(m => <button type="button" key={m} onClick={() => toggleMarket(m)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${traderMarkets.includes(m) ? 'bg-[#e5faf5] text-[#007f60] ring-1 ring-[#b7ebdd]' : 'bg-slate-100 text-slate-500'}`}>{m}</button>)}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">Réseaux sociaux</h3><p className="mt-1 text-xs text-slate-500">Choisissez un réseau et ajoutez uniquement votre identifiant.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row"><select value={socialNetwork} onChange={e => setSocialNetwork(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:w-40"><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>X</option><option>LinkedIn</option><option>YouTube</option></select><input value={socialUsername} onChange={e => setSocialUsername(e.target.value)} placeholder="@votre_nom" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><button type="button" onClick={addSocialLink} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white">+ Ajouter</button></div>
                {socialLinks.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{socialLinks.map((link, index) => <div key={link.network + link.username + index} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"><span className="font-bold text-slate-700">{link.network}</span><span className="text-slate-500">{link.username}</span><button type="button" onClick={() => removeSocialLink(index)} className="text-slate-400 hover:text-rose-500">×</button></div>)}</div>}
              </section>

              <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsEditingProfile(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700">Annuler</button><button onClick={saveTraderProfile} disabled={isProfileSaving} className="rounded-xl bg-[#0a192f] px-5 py-3 text-xs font-bold text-white disabled:opacity-50">{isProfileSaving ? 'Enregistrement…' : 'Enregistrer le profil'}</button></div>
            </>
          )}
        </div>
      )}

      {activeTab === 'certificates' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e5faf5] text-[#007f60]"><Shield className="h-5 w-5" /></div><div><h3 className="text-lg font-black text-slate-900">Mes certificats</h3><p className="mt-1 text-xs text-slate-500">Certificats délivrés directement par IAMTRADER.</p></div></div>
          {(userProfile?.certificates || []).length === 0 ? <div className="py-12 text-center text-xs text-slate-500">Aucun certificat IAMTRADER délivré pour le moment.</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{userProfile?.certificates?.map(certificate => <div key={certificate.id} className="rounded-xl border border-slate-200 p-4"><div className="font-bold text-slate-900">{certificate.title}</div><div className="mt-1 text-xs text-slate-500">Obtenu le {formatDate(certificate.issuedAt)}</div>{certificate.certificateNumber && <div className="mt-2 text-[10px] font-mono text-slate-400">N° {certificate.certificateNumber}</div>}</div>)}</div>}
        </section>
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

      {paymentPlan && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,.25)]">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5">
              <div><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-500">Paiement sécurisé</div><h3 className="mt-1 text-lg font-black text-slate-950">{paymentPlan === 'pro' ? 'Passer à Plus' : 'Activer Community'}</h3><p className="mt-1 text-[11px] text-slate-500">Checkout IAMTRADER — le moteur suit le cycle d’un vrai paiement : création, traitement, confirmation et activation.</p></div>
              <button onClick={() => setPaymentPlan(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-slate-900" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              {paymentStatus === 'idle' && (<>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  <button type="button" onClick={() => setPaymentMode('simulation')} className={`rounded-lg px-3 py-2 text-[10px] font-bold transition ${paymentMode === 'simulation' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>Simulation</button>
                  <button type="button" onClick={() => setPaymentMode('live')} className={`rounded-lg px-3 py-2 text-[10px] font-bold transition ${paymentMode === 'live' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'}`}>Paiement réel</button>
                </div>
                {paymentMode === 'simulation' && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800"><b>Mode test.</b> Aucun argent n’est débité. La transaction sera néanmoins créée dans le registre de paiements et visible par l’administration.</div>}
                {(() => {
                  const amounts = getPaymentAmounts(paymentPlan);
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-600">Formule</span>
                        <span className="text-sm font-black text-slate-950">{paymentPlan === 'pro' ? 'Plus · 1 mois' : 'Community · 6 mois'}</span>
                      </div>
                      <div className="mt-4 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Abonnement</span>
                          <span className="font-semibold text-slate-700">${amounts.baseAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Frais de paiement (3 %)</span>
                          <span className="font-semibold text-slate-700">+${amounts.paymentFee.toFixed(2)}</span>
                        </div>
                        <div className="mt-3 flex items-end justify-between border-t border-slate-200 pt-3">
                          <span className="text-xs font-bold text-slate-700">Total à payer</span>
                          <div className="text-right"><span className="block text-xl font-black text-slate-950">{amounts.cdfTotal.toLocaleString('fr-FR')} CDF</span><span className="text-[10px] font-semibold text-slate-400">≈ ${amounts.total.toFixed(2)}</span></div>
                        </div>
                      </div>
                      <p className="mt-3 text-[10px] leading-4 text-slate-400">Le montant CinetPay est débité en CDF. Le total de référence inclut les frais de paiement de 3 % et la conversion utilisée pour le checkout RDC.</p>
                      <p className="mt-1 text-[10px] text-slate-500">L’activation intervient uniquement après confirmation serveur de la transaction.</p>
                      {(() => {
                        const currentExpiry = userProfile?.subscriptionExpiresAt ? new Date(userProfile.subscriptionExpiresAt) : null;
                        const activeNow = !!currentExpiry && currentExpiry.getTime() > Date.now() && userProfile?.plan !== 'free';
                        const estimatedStart = activeNow ? currentExpiry : new Date();
                        const estimatedEnd = new Date(estimatedStart.getTime() + (paymentPlan === 'pro' ? 30 : 180) * 86400000);
                        return <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                          <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200"><div className="font-bold uppercase tracking-wider text-slate-400">Début prévu</div><div className="mt-1 font-black text-slate-800">{formatDate(estimatedStart.toISOString())}</div></div>
                          <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200"><div className="font-bold uppercase tracking-wider text-slate-400">Fin prévue</div><div className="mt-1 font-black text-slate-800">{formatDate(estimatedEnd.toISOString())}</div></div>
                        </div>;
                      })()}
                    </div>
                  );
                })()}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Titulaire du paiement</label><input value={paymentPayerName} onChange={e => setPaymentPayerName(e.target.value)} placeholder="Nom complet" autoComplete="name" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" /></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Mode de paiement</label><select value="mobile_money" disabled className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"><option value="mobile_money">Mobile Money</option></select></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Opérateur</label><select value={paymentProvider} onChange={e => setPaymentProvider(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900"><option>Airtel Money</option><option>M-Pesa</option><option>Orange Money</option><option>Africell Money</option></select></div>
                  <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Identifiant Mobile Money</label><div className="relative"><Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} placeholder="0812345678" inputMode="tel" autoComplete="tel" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold text-slate-950 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" /></div></div>
                </div>
                <p className="text-[10px] leading-4 text-slate-400">Le nom, l’opérateur et l’identifiant seront associés à la transaction. Pour un paiement réel, utilisez les informations du compte Mobile Money qui recevra la demande.</p>
                <button onClick={submitPayment} disabled={isPaymentLoading || !paymentPhone.trim() || !paymentPayerName.trim() || !paymentProvider} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{isPaymentLoading ? 'Initialisation du paiement…' : 'Continuer vers le paiement'}</button>
              </>)}
              {paymentStatus === 'processing' && (<div className="py-5 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" /></div><h4 className="mt-4 text-base font-black text-slate-950">Paiement en traitement</h4><p className="mt-2 text-xs leading-5 text-slate-500">{paymentMessage || 'Nous attendons la confirmation du prestataire.'}</p>
                {paymentActivationStart && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-left text-[10px]">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Type</span><b className="text-slate-800">{paymentAction === 'upgrade' ? 'Upgrade programmé' : paymentAction === 'renewal' ? 'Renouvellement' : 'Nouvelle souscription'}</b></div>
                  <div className="mt-1 flex justify-between gap-3"><span className="text-slate-500">Début</span><b className="text-slate-800">{formatDate(paymentActivationStart)}</b></div>
                  <div className="mt-1 flex justify-between gap-3"><span className="text-slate-500">Expiration</span><b className="text-slate-800">{formatDate(paymentActivationExpires || undefined)}</b></div>
                </div>}{paymentMode === 'simulation' ? <button onClick={confirmSimulation} disabled={isPaymentLoading} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">{isPaymentLoading ? 'Confirmation serveur…' : 'Simuler la validation du paiement'}</button> : <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700">Validez la demande Mobile Money avant de fermer.</div>}</div>)}
              {paymentStatus === 'paid' && (<div className="py-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-7 w-7" /></div><h4 className="mt-4 text-base font-black text-slate-950">Paiement confirmé</h4><p className="mt-2 text-xs text-slate-500">{paymentMessage}</p><div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">Référence : {paymentId}</div></div>)}
              {paymentStatus === 'failed' && (<div className="space-y-4 py-3 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">!</div><h4 className="text-base font-black text-slate-950">Paiement non finalisé</h4><p className="text-xs leading-5 text-slate-500">{paymentMessage}</p><button onClick={() => setPaymentStatus('idle')} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white">Réessayer</button></div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
