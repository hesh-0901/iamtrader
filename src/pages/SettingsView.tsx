import React, { useMemo, useState } from 'react';
import { UserProfile, SubscriptionPlan, TradingAccount, Trade } from '../types';
import { PlanBadge } from '../components/common/Badge';
import {
  User, Shield, CreditCard, Sliders, Lock, Mail, Check, ArrowRight,
  Activity, CalendarDays, Clock3, WalletCards, Sparkles, ChevronRight, Phone, X, Crown, Target, Coins, TrendingUp, Star, Receipt
} from 'lucide-react';
import { resetUserPassword, updateTraderProfile } from '../services/auth';
import { AvatarStudio } from '../components/settings/AvatarStudio';
import { useToast } from '../components/common/Toast';
import { TradingJournalSettings } from '../components/settings/TradingJournalSettings';
import { PaymentHistory } from './PaymentHistory';
import { calculateTraderRating, formatCurrency } from '../utils/calculations';
import { confirmSimulatedPayment, createPayment, createSimulatedPayment, getSasPayPaymentStatus, verifySasPayPayment, PaidPlan, PaymentDetails } from '../services/payments';

interface SettingsViewProps {
  userProfile: UserProfile | null;
  accounts: TradingAccount[];
  trades: Trade[];
  selectedAccountId: string;
  onRequestPlan: (plan: 'pro' | 'community') => void;
  pendingPaymentReference?: string | null;
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
  { name: 'République démocratique du Congo', code: 'CD', flag: '🇨🇩', supported: true },
  { name: 'Zambie', code: 'ZM', flag: '🇿🇲', supported: false },
  { name: 'France', code: 'FR', flag: '🇫🇷', supported: false },
  { name: 'Belgique', code: 'BE', flag: '🇧🇪', supported: false },
  { name: 'États-Unis', code: 'US', flag: '🇺🇸', supported: false },
  { name: 'Royaume-Uni', code: 'GB', flag: '🇬🇧', supported: false },
  { name: 'Afrique du Sud', code: 'ZA', flag: '🇿🇦', supported: false },
  { name: 'Angola', code: 'AO', flag: '🇦🇴', supported: false },
  { name: 'Congo', code: 'CG', flag: '🇨🇬', supported: false },
  { name: 'Côte d’Ivoire', code: 'CI', flag: '🇨🇮', supported: false },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪', supported: false },
  { name: 'Rwanda', code: 'RW', flag: '🇷🇼', supported: false },
  { name: 'Tanzanie', code: 'TZ', flag: '🇹🇿', supported: false },
  { name: 'Ouganda', code: 'UG', flag: '🇺🇬', supported: false },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', supported: false },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭', supported: false },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', supported: false },
  { name: 'Allemagne', code: 'DE', flag: '🇩🇪', supported: false },
  { name: 'Suisse', code: 'CH', flag: '🇨🇭', supported: false },
  { name: 'Émirats arabes unis', code: 'AE', flag: '🇦🇪', supported: false }
];
const detectCountryCode = () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (zone.startsWith('Africa/Lusaka')) return 'ZM';
  if (zone.startsWith('Europe/Paris')) return 'FR';
  if (zone.startsWith('Europe/Brussels')) return 'BE';
  if (zone.startsWith('Europe/London')) return 'GB';
  if (zone.startsWith('Africa/Johannesburg')) return 'ZA';
  if (zone.startsWith('America/')) return 'US';
  return 'CD';
};


export function SettingsView({ userProfile, accounts, trades, selectedAccountId, onRequestPlan, pendingPaymentReference }: SettingsViewProps) {
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
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(!userProfile?.traderProfile);
  const [defaultCurrency, setDefaultCurrency] = useState(userProfile?.settings?.defaultCurrency || 'USD');
  const [theme, setTheme] = useState<'light'>('light');
  const [dashboardMode, setDashboardMode] = useState<'standard' | 'focus' | 'analysis' | 'compact'>(() => (localStorage.getItem('iamtrader-dashboard-mode') as any) || 'standard');
  const [paymentPlan, setPaymentPlan] = useState<PaidPlan | null>(null);
  const [paymentMode, setPaymentMode] = useState<'simulation' | 'live'>('live');
  const [paymentGateway, setPaymentGateway] = useState<'cinetpay' | 'saspay'>('saspay');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentCountryCode, setPaymentCountryCode] = useState<string>(() => detectCountryCode());
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryListOpen, setIsCountryListOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('Airtel Money');
  const [paymentPayerName, setPaymentPayerName] = useState(userProfile?.displayName || [userProfile?.traderProfile?.firstName, userProfile?.traderProfile?.lastName].filter(Boolean).join(' ') || '');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
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

  const startPayment = (plan: PaidPlan) => {
    setPaymentPlan(plan); setPaymentMode('live'); setPaymentGateway('saspay');
    setPaymentPhone(userProfile?.traderProfile?.whatsapp || '');
    setPaymentProvider('Airtel Money'); setPaymentUrl(null); setPaymentPayerName('');
    setPaymentId(null); setPaymentReference(null); setPaymentStatus('idle'); setPaymentMessage('');
    setPaymentAction(null); setPaymentActivationStart(null); setPaymentActivationExpires(null);
  };

  const submitPayment = async () => {
    if (!paymentPlan) return;
    setIsPaymentLoading(true); setPaymentMessage('');
    try {
      const details: PaymentDetails = {
        phone: paymentPhone.trim(),
        paymentMethod: 'mobile_money',
        paymentProvider,
        payerName: paymentPayerName.trim()
      };
      const payment = paymentMode === 'simulation'
        ? await createSimulatedPayment(paymentPlan, details)
        : await createPayment(paymentPlan, details);
      setPaymentId(payment.id);
      setPaymentReference(payment.reference || null);
      setPaymentUrl(null);
      setPaymentAction(payment.subscriptionAction || null);
      setPaymentActivationStart(payment.activationStartAt || null);
      setPaymentActivationExpires(payment.activationExpiresAt || null);
      setPaymentStatus('processing');
      setPaymentMessage(payment.message || 'Demande Mobile Money envoyée. Confirmez-la sur votre téléphone.');
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
    if (!paymentReference || paymentStatus !== 'processing' || paymentMode === 'simulation') return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const check = async () => {
      attempts += 1;
      try {
        const result = await getSasPayPaymentStatus(paymentReference);
        if (cancelled) return;
        if (result.status === 'SUCCESS') {
          setPaymentStatus('paid');
          setPaymentMessage('Paiement confirmé. Votre abonnement est activé.');
          window.setTimeout(() => window.location.reload(), 1200);
          return;
        }
        if (['FAILED', 'FAILURE', 'CANCELLED', 'CANCELED', 'EXPIRED'].includes(result.status)) {
          setPaymentStatus('failed');
          setPaymentMessage('Le paiement a été refusé, annulé ou expiré. Vous pouvez réessayer.');
          return;
        }
      } catch (error: any) {
        if (!cancelled) setPaymentMessage(error?.message || 'Vérification du paiement en cours…');
      }
      if (!cancelled && attempts < 60) timer = window.setTimeout(check, 4000);
      else if (!cancelled) setPaymentMessage('Le paiement est toujours en attente. Revenez vérifier votre abonnement plus tard.');
    };
    void check();
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [paymentReference, paymentStatus, paymentMode]);

  React.useEffect(() => {
    if (!pendingPaymentReference) return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    setPaymentGateway('saspay');
    setPaymentMode('live');
    setPaymentId(pendingPaymentReference);
    setPaymentStatus('processing');
    setPaymentMessage('Vérification du paiement auprès de SasPay…');
    const checkPending = async () => {
      attempts += 1;
      try {
        const result = await verifySasPayPayment(pendingPaymentReference);
        if (cancelled) return;
        if (result.payment?.plan === 'pro' || result.payment?.plan === 'community') setPaymentPlan(result.payment.plan);
        if (result.status === 'paid') {
          setPaymentStatus('paid');
          setPaymentMessage('Paiement confirmé. Actualisation de votre abonnement…');
          window.setTimeout(() => window.location.reload(), 1200);
          return;
        }
        if (result.status === 'failed') {
          setPaymentStatus('failed');
          setPaymentMessage('Le paiement n’a pas été finalisé. Vous pouvez réessayer.');
          return;
        }
      } catch (error: any) {
        if (!cancelled) setPaymentMessage(error?.message || 'Vérification temporairement indisponible.');
      }
      if (!cancelled && attempts < 40) timer = window.setTimeout(checkPending, 3000);
      else if (!cancelled) setPaymentMessage('Le paiement est toujours en attente. Revenez vérifier votre abonnement plus tard.');
    };
    void checkPending();
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [pendingPaymentReference]);

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
              <div><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-500">Changer de formule</span><h3 className="mt-1 text-lg font-black text-slate-950">Choisissez votre niveau d’accès</h3><p className="mt-1 text-xs text-slate-500">Choisissez votre prestataire de paiement et confirmez la transaction sur son checkout sécurisé.</p></div>
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

              <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Sparkles className="h-5 w-5" /></div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Avatar personnalisé</h3>
                    <p className="mt-1 text-xs text-slate-500">Créez et personnalisez votre identité visuelle sur IAMTRADER et PipTalk.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsAvatarModalOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700">
                  <Sparkles className="h-4 w-4" /> {userProfile?.avatarURL || userProfile?.photoURL ? 'Modifier mon avatar' : 'Créer mon avatar'}
                </button>
              </section>
              {isAvatarModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setIsAvatarModalOpen(false); }}>
                  <div role="dialog" aria-modal="true" aria-label="Studio de création d’avatar" className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[26px] bg-white shadow-2xl">
                    <button type="button" aria-label="Fermer le studio d’avatar" onClick={() => setIsAvatarModalOpen(false)} className="sticky top-3 z-10 ml-auto mr-3 mt-3 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"><X className="h-4 w-4" /></button>
                    <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                      <AvatarStudio userProfile={userProfile} onSaved={() => setIsAvatarModalOpen(false)} />
                    </div>
                  </div>
                </div>
              )}

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
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#020b12]/85 p-2 backdrop-blur-xl sm:p-5">
          <div className="relative my-auto grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-emerald-300/25 bg-[#08151d] text-white shadow-[0_35px_120px_rgba(0,0,0,.65)] animate-in fade-in zoom-in-95 duration-300 lg:grid-cols-[0.88fr_1.12fr]">
            <aside className="relative hidden overflow-hidden border-r border-emerald-300/15 bg-[radial-gradient(ellipse_at_top_left,rgba(0,199,150,.32),transparent_55%),linear-gradient(145deg,#06382f,#061b20_65%,#07131b)] p-8 lg:flex lg:flex-col xl:p-10">
              <div className="pointer-events-none absolute inset-0 opacity-30" style={{backgroundImage:'linear-gradient(rgba(0,220,166,.12) 1px, transparent 1px),linear-gradient(90deg,rgba(0,220,166,.12) 1px, transparent 1px)',backgroundSize:'34px 34px',maskImage:'linear-gradient(to bottom,black,transparent)'}} />
              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30"><TrendingUp className="h-6 w-6" /></div>
                <div><div className="text-xl font-black tracking-tight">IAM<span className="text-emerald-400">TRADER</span></div><div className="text-[9px] font-semibold tracking-[.24em] text-emerald-100/65">TRADE · TRACK · PROGRESS</div></div>
              </div>
              <div className="relative mt-12"><span className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-300">Passez au niveau supérieur</span><h2 className="mt-5 max-w-sm text-4xl font-black leading-[1.08] tracking-tight">Votre trading mérite de meilleurs outils.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-slate-300/80">Analysez vos résultats, maîtrisez vos habitudes et progressez avec une vision plus claire.</p></div>
              <div className="relative mt-9 space-y-5">
                {[
                  ['Journal de trading avancé','Analysez vos performances en détail',Activity],
                  ['Statistiques & analytics','Visualisez votre progression',TrendingUp],
                  ['IA Vyra','Un assistant pour mieux structurer vos décisions',Sparkles],
                  ['Gestion multi-comptes','Vos comptes au même endroit',WalletCards],
                  ['Export & suivi','Gardez une trace claire de vos données',Receipt]
                ].map(([title,desc,Icon]: any) => <div key={title} className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"><Icon className="h-4 w-4" /></div><div><div className="text-sm font-bold text-white">{title}</div><div className="mt-0.5 text-xs text-slate-300/65">{desc}</div></div></div>)}
              </div>
              <div className="relative mt-auto pt-8"><div className="rounded-2xl border border-emerald-300/20 bg-black/15 p-4 text-sm leading-6 text-emerald-50/85">« Un meilleur suivi. De meilleures décisions. De meilleurs résultats. »</div></div>
            </aside>
            <section className="min-w-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,199,150,.08),transparent_42%),linear-gradient(150deg,#0b1a23,#07121a)]">
            <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/20"><Shield className="h-5 w-5" /></div><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Paiement sécurisé par SasPay</div><h3 className="mt-1 text-xl font-extrabold tracking-tight text-white sm:text-2xl">{paymentPlan === 'pro' ? 'Passer à Plus' : 'Activer Community'}</h3><p className="mt-1 max-w-lg text-xs leading-5 text-slate-300/70">Vérifiez votre formule et poursuivez vers le paiement sécurisé pour activer votre abonnement.</p></div></div>
              <button onClick={() => setPaymentPlan(null)} className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-white" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-5 p-5 sm:p-7 lg:p-8">
              {paymentStatus === 'processing' && paymentGateway === 'saspay' && paymentUrl ? (
                <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                  <section className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Récapitulatif</div>
                    <h4 className="mt-2 text-lg font-black text-slate-950">{paymentPlan === 'pro' ? 'Abonnement Plus' : 'Abonnement Community'}</h4>
                    <p className="mt-1 text-xs text-slate-500">La transaction est sécurisée et traitée par SasPay.</p>
                    <div className="mt-5 flex items-end justify-between border-t border-slate-200 pt-4"><span className="text-sm font-semibold text-slate-600">Total prévu</span><strong className="text-2xl font-black text-slate-950">${getPaymentAmounts(paymentPlan!).total.toFixed(2)} USD</strong></div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">Ne fermez pas cette fenêtre avant la fin du paiement. L’abonnement sera activé uniquement après confirmation serveur.</p>
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">{paymentMessage || 'En attente de confirmation de SasPay…'}</div>
                  </section>
                  <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800"><Lock className="h-4 w-4 text-emerald-700" /> Paiement SasPay sécurisé</div>
                    <div className="flex min-h-[420px] flex-col items-center justify-center bg-slate-50 px-6 py-10 text-center sm:min-h-[520px]"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Lock className="h-6 w-6" /></div><h4 className="mt-4 text-base font-extrabold text-slate-900">Finalisez sur SasPay</h4><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Vous allez être redirigé vers la page de paiement sécurisée pour finaliser votre abonnement.</p><button type="button" onClick={() => window.location.assign(paymentUrl)} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"><Lock className="h-4 w-4" /> Continuer vers le paiement sécurisé</button><p className="mt-3 text-[11px] text-slate-400">Après le paiement, vous serez ramené sur IAMTRADER. L’abonnement sera activé après confirmation serveur.</p></div>
                  </section>
                </div>
              ) : null}
              {paymentStatus === 'idle' && (<>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Votre formule</div>
                    <div className="mt-1 text-base font-black text-slate-950">{paymentPlan === 'pro' ? 'Plus · 1 mois' : 'Community · 6 mois'}</div>
                    <p className="mt-1 break-words text-xs text-slate-500">Compte : {userProfile?.displayName || userProfile?.email || 'Votre compte IAMTRADER'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-semibold text-slate-400">Total à payer</div>
                    <div className="mt-1 text-xl font-black tracking-tight text-slate-950">{paymentGateway === 'saspay' ? `${getPaymentAmounts(paymentPlan).total.toFixed(2)} USD` : `${getPaymentAmounts(paymentPlan).cdfTotal.toLocaleString('fr-FR')} CDF`}</div>
                  </div>
                </div>
                {paymentMode === 'live' && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                    <div className="relative">
                      <label className="mb-1.5 block text-xs font-bold text-slate-200">Pays de paiement</label>
                      <button type="button" onClick={() => setIsCountryListOpen(open => !open)} className="flex w-full items-center gap-3 rounded-xl border border-emerald-400/45 bg-[#10242c] px-3 py-3 text-left transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/25">
                        <span className="text-2xl leading-none">{countryOptions.find(item => item.code === paymentCountryCode)?.flag || '🌐'}</span>
                        <span className="min-w-0 flex-1"><span className="mr-2 text-xs font-black text-emerald-300">{paymentCountryCode}</span><span className="text-sm font-semibold text-white">{countryOptions.find(item => item.code === paymentCountryCode)?.name || 'Sélectionner un pays'}</span><span className="mt-0.5 block text-[10px] text-sky-300">{paymentCountryCode === 'CD' ? 'Pays détecté · paiement disponible' : 'Pays sélectionné · paiement pas encore disponible'}</span></span>
                        <ChevronRight className={'h-4 w-4 text-slate-400 transition ' + (isCountryListOpen ? 'rotate-90' : '')} />
                      </button>
                      {isCountryListOpen && <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/15 bg-[#0c1c25] p-2 shadow-2xl shadow-black/50">
                        <input value={countrySearch} onChange={event => setCountrySearch(event.target.value)} placeholder="Rechercher un pays..." className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60" />
                        <div className="max-h-52 overflow-y-auto">{countryOptions.filter(item => (item.name + item.code).toLowerCase().includes(countrySearch.toLowerCase())).map(item => <button type="button" key={item.code} onClick={() => { setPaymentCountryCode(item.code); setIsCountryListOpen(false); setCountrySearch(''); }} className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ' + (paymentCountryCode === item.code ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/50' : 'text-slate-200 hover:bg-white/5')}><span className="text-xl">{item.flag}</span><span className="w-7 text-xs font-black">{item.code}</span><span className="flex-1 text-xs">{item.name}</span>{paymentCountryCode === item.code && <Check className="h-4 w-4 text-emerald-300" />}</button>)}</div>
                      </div>}
                    </div>
                    {paymentCountryCode !== 'CD' && <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-3 text-xs leading-5 text-amber-100/90">Le paiement Mobile Money via SasPay est actuellement configuré pour la RDC. Vous pouvez choisir ce pays, mais le paiement ne sera pas lancé tant que son opérateur n’est pas pris en charge.</div>}
                    <div>
                      <label htmlFor="saspay-phone" className="mb-1.5 block text-xs font-bold text-slate-700">Numéro Mobile Money</label>
                      <input id="saspay-phone" type="tel" inputMode="tel" autoComplete="tel" required aria-required="true" value={paymentPhone} onChange={event => setPaymentPhone(event.target.value)} placeholder="+243 8XX XXX XXX" className="w-full rounded-xl border border-white/10 bg-[#10242c] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15" />
                    </div>
                    <div>
                      <label htmlFor="saspay-network" className="mb-1.5 block text-xs font-bold text-slate-700">Moyen de paiement</label>
                      <select id="saspay-network" value={paymentProvider} onChange={event => setPaymentProvider(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#10242c] px-3 py-3 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15">
                        <option value="Vodacom M-Pesa">Vodacom M-Pesa</option>
                        <option value="Airtel Money">Airtel Money</option>
                        <option value="Orange Money">Orange Money</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-3 text-xs leading-5 text-emerald-100/90"><Shield className="mr-2 inline h-4 w-4" />Paiement sécurisé intégré à IAMTRADER. Une demande de confirmation sera envoyée par votre opérateur. L’abonnement ne sera activé qu’après confirmation serveur.</div>
                <button onClick={submitPayment} disabled={isPaymentLoading || (paymentGateway === 'saspay' && paymentMode === 'live' && (!paymentPhone.trim() || paymentCountryCode !== 'CD'))} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-400 to-teal-300 px-4 py-3.5 text-sm font-extrabold text-[#05221b] shadow-[0_10px_30px_rgba(0,199,150,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,199,150,.25)] focus:outline-none focus:ring-4 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40">{isPaymentLoading ? 'Envoi de la demande…' : 'Continuer vers le paiement'}</button>
              </>)}
              {paymentStatus === 'processing' && !(paymentGateway === 'saspay' && paymentUrl) && (<div className="py-5 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" /></div><h4 className="mt-4 text-base font-black text-slate-950">Paiement en traitement</h4><p className="mt-2 text-xs leading-5 text-slate-500">{paymentMessage || 'Nous attendons la confirmation du prestataire.'}</p>
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
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
