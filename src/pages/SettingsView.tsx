import React, { useMemo, useState } from 'react';
import { UserProfile, SubscriptionPlan, TradingAccount, Trade } from '../types';
import { PlanBadge } from '../components/common/Badge';
import {
  User, Shield, CreditCard, Sliders, Lock, Mail, Check, ArrowRight, Users, Copy,
  Activity, CalendarDays, Clock3, WalletCards, Sparkles, ChevronRight, Phone, X, Crown, Target, Coins, TrendingUp, Star, Receipt, Tag, Download, Smartphone, Monitor, LogOut
} from 'lucide-react';
import { resetUserPassword, updateTraderProfile, logoutUser } from '../services/auth';
import { subscribeDeviceSessions, revokeDeviceSession, getDeviceSessionId, endCurrentDeviceSession, DeviceSession } from '../services/deviceSessions';
import { useToast } from '../components/common/Toast';
import { TradingJournalSettings } from '../components/settings/TradingJournalSettings';
import { AffiliationSettings } from '../components/settings/AffiliationSettings';
import { PaymentHistory } from './PaymentHistory';
import { PromotionBanners } from '../components/promotions/PromotionBanners';
import { calculateTraderRating, formatCurrency } from '../utils/calculations';
import { createPayment, getPaymentStatus, PaidPlan, PaymentDetails } from '../services/payments';

interface SettingsViewProps {
  userProfile: UserProfile | null;
  accounts: TradingAccount[];
  trades: Trade[];
  selectedAccountId: string;
  onRequestPlan: (plan: 'pro' | 'community') => void;
  pendingPaymentReference?: string | null;
}

const starterLimit = 5;

const PAYMENT_FEE_RATE = 0;
const PAYMENT_PRICES = { pro: 9.99, community: 89.99 } as const;
const CINETPAY_CDF_PRICES = { pro: 23335, community: 210196 } as const;

function getPaymentAmounts(plan: PaidPlan, months = 1) {
  const safeMonths = Math.max(1, Math.min(12, Math.floor(months)));
  const baseAmount = plan === 'pro'
    ? Math.round(PAYMENT_PRICES.pro * safeMonths * 100) / 100
    : Math.round((PAYMENT_PRICES.community / 6 * safeMonths) * 100) / 100;
  const paymentFee = Math.round(baseAmount * PAYMENT_FEE_RATE * 100) / 100;
  const total = Math.round((baseAmount + paymentFee) * 100) / 100;
  const cdfTotal = Math.round(CINETPAY_CDF_PRICES[plan] * (safeMonths / (plan === 'community' ? 6 : 1)));
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
  { name: 'République démocratique du Congo', code: 'CD', flag: '🇨🇩', dialCode: '+243', phoneLength: 9, networks: [{ value: 'vodacom_cd', label: 'Vodacom M-Pesa' }, { value: 'airtel_cd', label: 'Airtel Money' }, { value: 'orange_cd', label: 'Orange Money' }] },
  { name: 'Mali', code: 'ML', flag: '🇲🇱', dialCode: '+223', phoneLength: 8, networks: [{ value: 'mobi_cash_ml', label: 'Mobi Cash' }, { value: 'moov_ml', label: 'Moov Money' }, { value: 'orange_ml', label: 'Orange Money' }] },
  { name: 'Zambie', code: 'ZM', flag: '🇿🇲', dialCode: '+260', phoneLength: 9, networks: [{ value: 'airtel_zm', label: 'Airtel Money' }, { value: 'mtn_zm', label: 'MTN MoMo' }, { value: 'zamtel_zm', label: 'Zamtel Kwacha' }] },
  { name: 'Bénin', code: 'BJ', flag: '🇧🇯', dialCode: '+229', phoneLength: 10, networks: [{ value: 'celtiis_bj', label: 'Celtiis Cash' }, { value: 'moov_bj', label: 'Moov Money' }, { value: 'mtn_bj', label: 'MTN MoMo' }] },
  { name: 'Burkina Faso', code: 'BF', flag: '🇧🇫', dialCode: '+226', phoneLength: 8, networks: [{ value: 'moov_bf', label: 'Moov Money' }, { value: 'orange_bf', label: 'Orange Money' }] },
  { name: 'Côte d’Ivoire', code: 'CI', flag: '🇨🇮', dialCode: '+225', phoneLength: 10, networks: [{ value: 'moov_ci', label: 'Moov Money' }, { value: 'mtn_ci', label: 'MTN MoMo' }, { value: 'orange_ci', label: 'Orange Money' }, { value: 'wave_ci', label: 'Wave' }] },
  { name: 'Cameroun', code: 'CM', flag: '🇨🇲', dialCode: '+237', phoneLength: 9, networks: [{ value: 'mtn_cm', label: 'MTN MoMo' }, { value: 'orange_cm', label: 'Orange Money' }] },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭', dialCode: '+233', phoneLength: 9, networks: [{ value: 'mtn_gh', label: 'MTN MoMo' }, { value: 'tigo_gh', label: 'AirtelTigo' }, { value: 'vodafone_gh', label: 'Telecel Cash' }] },
  { name: 'Guinée', code: 'GN', flag: '🇬🇳', dialCode: '+224', phoneLength: 9, networks: [{ value: 'mtn_gn', label: 'MTN MoMo' }] },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪', dialCode: '+254', phoneLength: 9, networks: [{ value: 'mpesa_ke', label: 'M-Pesa' }] },
  { name: 'Malawi', code: 'MW', flag: '🇲🇼', dialCode: '+265', phoneLength: 9, networks: [{ value: 'airtel_mw', label: 'Airtel Money' }, { value: 'tnm_mw', label: 'TNM Mpamba' }] },
  { name: 'Niger', code: 'NE', flag: '🇳🇪', dialCode: '+227', phoneLength: 8, networks: [{ value: 'airtel_ne', label: 'Airtel Money' }] },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', dialCode: '+234', phoneLength: 10, networks: [{ value: 'airtel_ng', label: 'Airtel Money' }, { value: 'mtn_ng', label: 'MTN MoMo' }] },
  { name: 'Rwanda', code: 'RW', flag: '🇷🇼', dialCode: '+250', phoneLength: 9, networks: [{ value: 'airtel_rw', label: 'Airtel Money' }, { value: 'mtn_rw', label: 'MTN MoMo' }] },
  { name: 'Sénégal', code: 'SN', flag: '🇸🇳', dialCode: '+221', phoneLength: 9, networks: [{ value: 'freemoney_sn', label: 'Free Money' }, { value: 'orange_sn', label: 'Orange Money' }, { value: 'wave_sn', label: 'Wave' }, { value: 'wizall_sn', label: 'Wizall' }] },
  { name: 'Togo', code: 'TG', flag: '🇹🇬', dialCode: '+228', phoneLength: 8, networks: [{ value: 'moov_tg', label: 'Moov Money' }, { value: 'togocel', label: 'Togocel Money' }] },
  { name: 'Tanzanie', code: 'TZ', flag: '🇹🇿', dialCode: '+255', phoneLength: 9, networks: [{ value: 'airtel_tz', label: 'Airtel Money' }, { value: 'halopesa_tz', label: 'Halopesa' }, { value: 'mpesa_tz', label: 'M-Pesa' }, { value: 'tigo_tz', label: 'Tigo Pesa' }] },
  { name: 'Ouganda', code: 'UG', flag: '🇺🇬', dialCode: '+256', phoneLength: 9, networks: [{ value: 'airtel_ug', label: 'Airtel Money' }, { value: 'mtn_ug', label: 'MTN MoMo' }] }
];
const detectCountryCode = () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (zone.startsWith('Africa/Lusaka')) return 'ZM';
  if (zone.startsWith('Africa/Bamako')) return 'ML';
  if (zone.startsWith('Europe/Paris')) return 'FR';
  if (zone.startsWith('Europe/Brussels')) return 'BE';
  if (zone.startsWith('Europe/London')) return 'GB';
  if (zone.startsWith('Africa/Johannesburg')) return 'ZA';
  if (zone.startsWith('America/')) return 'US';
  return 'CD';
};


export function SettingsView({ userProfile, accounts, trades, selectedAccountId, onRequestPlan, pendingPaymentReference }: SettingsViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'certificates' | 'subscription' | 'security' | 'preferences' | 'journal' | 'history' | 'affiliation'>('profile');
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
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState(userProfile?.settings?.defaultCurrency || 'USD');
  const [theme, setTheme] = useState<'light'>('light');
  const [dashboardMode, setDashboardMode] = useState<'standard' | 'focus' | 'analysis' | 'compact'>(() => (localStorage.getItem('iamtrader-dashboard-mode') as any) || 'standard');
  const [paymentPlan, setPaymentPlan] = useState<PaidPlan | null>(null);
  const [paymentMonths, setPaymentMonths] = useState(1);
  const [paymentMethod] = useState<'mobile_money' | 'bank_transfer'>('mobile_money');
  const [paymentStep, setPaymentStep] = useState<'duration' | 'details' | 'summary'>('duration');
  const [paymentBankDetails, setPaymentBankDetails] = useState<{ bankName: string; accountName: string; accountNumber: string; swift?: string; branch?: string; currency?: string; instructions?: string } | null>(null);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoQuote, setPromoQuote] = useState<{ baseAmount: number; discountAmount: number; finalAmount: number; promotionName: string; promoCode: string | null } | null>(null);
  const [isPromoApplying, setIsPromoApplying] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');
  const [paymentCountryCode, setPaymentCountryCode] = useState<string>(() => detectCountryCode());
  const [paymentProvider, setPaymentProvider] = useState(() => countryOptions.find(item => item.code === detectCountryCode())?.networks[0]?.value || 'vodacom_cd');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'paid' | 'failed'>('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentLastCheckedAt, setPaymentLastCheckedAt] = useState<string | null>(null);
  const [paymentCheckError, setPaymentCheckError] = useState('');
  const [paymentPollTimedOut, setPaymentPollTimedOut] = useState(false);
  const [isPaymentChecking, setIsPaymentChecking] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const currentDeviceSessionId = getDeviceSessionId();

  const refreshPaymentStatus = async () => {
    if (!paymentId || isPaymentChecking) return;
    setIsPaymentChecking(true);
    try {
      const result = await getPaymentStatus(paymentId);
      setPaymentLastCheckedAt(new Date().toISOString());
      setPaymentCheckError('');
      if (result.status === 'paid') {
        setPaymentStatus('paid');
        setPaymentMessage('Paiement confirmé. Votre abonnement est activé.');
        setPaymentPollTimedOut(false);
      } else if (result.status === 'failed') {
        setPaymentStatus('failed');
        setPaymentMessage(result.failureMessage || 'Le paiement a été refusé par le service Mobile Money. Vérifiez votre portefeuille ou contactez votre opérateur.');
      } else {
        setPaymentMessage('Nous attendons la confirmation de votre opérateur Mobile Money.');
      }
    } catch (error: any) {
      setPaymentLastCheckedAt(new Date().toISOString());
      setPaymentCheckError(error?.message || 'La vérification est momentanément indisponible.');
    } finally {
      setIsPaymentChecking(false);
    }
  };

  const traderRating = useMemo(() => calculateTraderRating(trades), [trades]);

  React.useEffect(() => {
    const syncInstallPrompt = () => setInstallPrompt(window.__iamtraderInstallPrompt || null);
    const handleInstalled = () => setInstallPrompt(null);
    syncInstallPrompt();
    window.addEventListener('iamtrader:install-available', syncInstallPrompt);
    window.addEventListener('iamtrader:installed', handleInstalled);
    return () => {
      window.removeEventListener('iamtrader:install-available', syncInstallPrompt);
      window.removeEventListener('iamtrader:installed', handleInstalled);
    };
  }, []);

  React.useEffect(() => {
    if (!userProfile?.uid || activeTab !== 'security') return;
    setDevicesLoading(true);
    return subscribeDeviceSessions(userProfile.uid, sessions => {
      setDeviceSessions(sessions);
      setDevicesLoading(false);
    });
  }, [userProfile?.uid, activeTab]);

  const handleInstallApp = async () => {
    const promptEvent = installPrompt || window.__iamtraderInstallPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === 'accepted') showToast('IAMTRADER est en cours d’installation.', 'success');
        else showToast('Installation non confirmée. Vous pourrez réessayer.', 'info');
      } catch (error) {
        showToast('Le navigateur n’a pas pu ouvrir l’installation. Réessayez depuis ce bouton.', 'error');
      } finally {
        window.__iamtraderInstallPrompt = undefined;
        setInstallPrompt(null);
      }
      return;
    }
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (isStandalone) {
      showToast('IAMTRADER est déjà installé sur cet appareil.', 'success');
      return;
    }
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isEdge = /Edg\//i.test(ua);
    const isChrome = /Chrome\//i.test(ua) && !isEdge;
    if (isIOS) {
      showToast('Sur iPhone/iPad : ouvrez Partager dans Safari, puis choisissez « Sur l’écran d’accueil ».', 'info');
    } else if (isAndroid) {
      showToast('Sur Android : ouvrez IAMTRADER dans Chrome, touchez ⋮, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».', 'info');
    } else if (isEdge || isChrome) {
      showToast('Dans Edge/Chrome, ouvrez le menu du navigateur et choisissez « Installer IAMTRADER » ou recherchez l’icône d’installation dans la barre d’adresse.', 'info');
    } else {
      showToast('Pour installer IAMTRADER, ouvrez le site dans Chrome ou Edge sur ordinateur, Chrome sur Android, ou Safari sur iPhone/iPad.', 'info');
    }
  };

  const handleLogoutCurrentDevice = async () => {
    try {
      if (userProfile?.uid) await endCurrentDeviceSession(userProfile.uid);
    } catch (error) {
      console.warn('Device session end notice:', error);
    }
    try {
      await logoutUser();
      showToast('Vous avez été déconnecté.', 'info');
    } catch (error: any) {
      showToast(error?.message || 'Déconnexion impossible.', 'error');
    }
  };

  const handleRevokeDevice = async (session: DeviceSession) => {
    if (!userProfile?.uid || revokingDeviceId) return;
    const isCurrent = session.id === currentDeviceSessionId;
    if (!window.confirm(isCurrent ? 'Déconnecter cet appareil ?' : 'Révoquer l’accès de cet appareil ? Il sera déconnecté dès qu’il recevra la révocation.' )) return;
    setRevokingDeviceId(session.id);
    try {
      await revokeDeviceSession(userProfile.uid, session.id);
      if (isCurrent) await logoutUser();
      else showToast('Accès de l’appareil révoqué.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Impossible de révoquer cet appareil.', 'error');
    } finally {
      setRevokingDeviceId(null);
    }
  };

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

  const loadAutomaticPromotion = async (plan: PaidPlan, months = paymentMonths) => {
    const selectedMonths = plan === 'community' ? 6 : Math.max(1, Math.min(12, Math.floor(months)));
    try {
      const response = await fetch('/api/promotions/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, months: selectedMonths })
      });
      if (!response.ok) return;
      const result = await response.json() as { success?: boolean; promotion?: { baseAmount: number; discountAmount: number; finalAmount: number; promotionName: string; promoCode: string | null } };
      if (result.success && result.promotion && result.promotion.discountAmount > 0) {
        setPromoQuote(result.promotion);
        setPromoMessage('Une offre active a été appliquée automatiquement.');
      }
    } catch {
      // Do not block checkout if no public promotion quote is available.
    }
  };

  const startPayment = (plan: PaidPlan) => {
    const savedPhone = (userProfile?.traderProfile?.whatsapp || '').trim();
    const digits = savedPhone.replace(/[^0-9]/g, '');
    const matchedCountry = countryOptions.find(item => digits.startsWith(item.dialCode.replace(/[^0-9]/g, '')));
    const initialCountry = matchedCountry || countryOptions.find(item => item.code === paymentCountryCode) || countryOptions[0];
    const dialDigits = initialCountry.dialCode.replace(/[^0-9]/g, '');
    const nationalDigits = digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits;
    setPaymentCountryCode(initialCountry.code);
    setPaymentPhone(nationalDigits.replace(/^0+/, '').slice(0, initialCountry.phoneLength));
    const initialMonths = plan === 'community' ? 6 : 1;
    setPaymentPlan(plan); setPaymentMonths(initialMonths); setPaymentStep('duration'); setPaymentBankDetails(null); setPromoCode(''); setPromoQuote(null); setPromoMessage(''); setIsPromoModalOpen(false); void loadAutomaticPromotion(plan, initialMonths);
    setPaymentProvider(initialCountry.networks[0]?.value || '');
    setPaymentId(null); setPaymentReference(null); setPaymentStatus('idle'); setPaymentMessage(''); setPaymentLastCheckedAt(null); setPaymentCheckError(''); setPaymentPollTimedOut(false);
  };

  const applyPromoCode = async () => {
    if (!paymentPlan || !promoCode.trim()) {
      setPromoMessage('Saisissez un code promo.');
      return;
    }
    setIsPromoApplying(true);
    setPromoMessage('');
    try {
      const response = await fetch('/api/promotions/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: paymentPlan, months: paymentPlan === 'community' ? 6 : paymentMonths, code: promoCode.trim().toUpperCase() })
      });
      const result = await response.json() as { success?: boolean; message?: string; promotion?: { baseAmount: number; discountAmount: number; finalAmount: number; promotionName: string; promoCode: string | null } };
      if (!response.ok || !result.success || !result.promotion) {
        setPromoQuote(null);
        setPromoMessage(result.message || 'Ce code promo ne peut pas être appliqué.');
        return;
      }
      setPromoQuote(result.promotion);
      setPromoCode(result.promotion.promoCode || promoCode.trim().toUpperCase());
      setPromoMessage('Code appliqué. Le montant a été recalculé par le serveur.');
      setIsPromoModalOpen(false);
    } catch {
      setPromoQuote(null);
      setPromoMessage('Impossible de vérifier le code. Réessayez.');
    } finally {
      setIsPromoApplying(false);
    }
  };

  const submitPayment = async () => {
    if (!paymentPlan) return;
    setIsPaymentLoading(true); setPaymentMessage(''); setPaymentLastCheckedAt(null); setPaymentCheckError(''); setPaymentPollTimedOut(false);
    try {
      const details: PaymentDetails = {
        months: paymentPlan === 'community' ? 6 : paymentMonths,
        phone: paymentMethod === 'mobile_money' ? paymentPhone.trim() : undefined,
        countryCode: paymentCountryCode,
        paymentMethod,
        paymentProvider: paymentMethod === 'mobile_money' ? paymentProvider : undefined,
        payerName: userProfile?.displayName || [userProfile?.traderProfile?.firstName, userProfile?.traderProfile?.lastName].filter(Boolean).join(' ') || '',
        promoCode: promoCode.trim().toUpperCase() || undefined
      };
      const payment = await createPayment(paymentPlan, details);
      setPaymentId(payment.id);
      setPaymentReference(payment.reference || null);
      setPaymentBankDetails(payment.bankDetails || null);
      setPaymentStatus('processing');
      setPaymentMessage(payment.message || (paymentMethod === 'bank_transfer'
        ? 'Demande enregistrée. Effectuez le virement puis transmettez la preuve à IAMTRADER.'
        : 'Demande envoyée. Confirmez le paiement sur votre téléphone.'));
    } catch (error: any) {
      setPaymentStatus('failed');
      setPaymentMessage(error?.message || 'Impossible d’initier le paiement.');
    } finally { setIsPaymentLoading(false); }
  };

  React.useEffect(() => {
    if (!paymentId || paymentStatus !== 'processing' || paymentMethod === 'bank_transfer') return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const check = async () => {
      attempts += 1;
      try {
        const result = await getPaymentStatus(paymentId);
        if (cancelled) return;
        setPaymentLastCheckedAt(new Date().toISOString());
        setPaymentCheckError('');
        if (result.plan === 'pro' || result.plan === 'community') setPaymentPlan(result.plan);
        if (result.reference) setPaymentReference(result.reference);
        if (result.status === 'paid') {
          setPaymentStatus('paid');
          setPaymentMessage('Paiement confirmé. Votre abonnement est activé.');
          setPaymentPollTimedOut(false);
          return;
        }
        if (result.status === 'failed') {
          setPaymentStatus('failed');
          setPaymentMessage(result.failureMessage || 'Le paiement a été refusé par le service Mobile Money. Vérifiez votre portefeuille ou contactez votre opérateur.');
          return;
        }
      } catch (error: any) {
        if (!cancelled) setPaymentCheckError(error?.message || 'La vérification est momentanément indisponible.');
      }
      if (!cancelled && attempts < 90) timer = window.setTimeout(check, 4000);
      else if (!cancelled) setPaymentPollTimedOut(true);
    };
    void check();
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [paymentId, paymentStatus, paymentMethod]);

  React.useEffect(() => {
    if (!pendingPaymentReference) return;
    setPaymentId(pendingPaymentReference);
    setPaymentStatus('processing');
    setPaymentMessage('Nous vérifions la confirmation auprès du prestataire de paiement.');
    setPaymentPollTimedOut(false);
    setPaymentCheckError('');
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
    ['affiliation', 'Affiliation', Users],
  ] as const;

  return (
    <div className="w-full max-w-6xl min-w-0 space-y-4 sm:space-y-6 overflow-x-hidden">
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
      {activeTab === 'affiliation' && <AffiliationSettings />}

      {activeTab === 'subscription' && (
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-black text-emerald-700 ring-1 ring-emerald-100">
                  {(userProfile?.displayName || userProfile?.email || 'T').trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-700">COMPTE IAMTRADER</p>
                  <h2 className="mt-1 truncate text-xl font-black tracking-tight text-slate-950">{userProfile?.displayName || [userProfile?.traderProfile?.firstName, userProfile?.traderProfile?.lastName].filter(Boolean).join(' ') || 'Trader'}</h2>
                  <p className="mt-1 truncate text-sm text-slate-500">{userProfile?.email || 'Adresse e-mail non renseignée'}</p>
                  {userProfile?.traderProfile?.whatsapp && <p className="mt-1 text-xs text-slate-500">{userProfile.traderProfile.whatsapp}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:self-center">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Compte actif
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 bg-gradient-to-r from-emerald-50 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Votre abonnement</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">{isStarter ? 'Starter' : userProfile?.plan === 'pro' ? 'Plus' : 'Community'}</h2>
                  <PlanBadge plan={userProfile?.plan || 'free'} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{isStarter ? 'Formule gratuite' : userProfile?.plan === 'pro' ? 'Accès complet aux outils de trading' : 'Accès aux outils et à la communauté'}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 sm:min-w-48">
                <p className="text-xs text-slate-500">{isStarter ? 'Durée' : 'Expire le'}</p>
                <p className="mt-1 text-base font-extrabold text-slate-950">{isStarter ? 'Sans expiration' : formatDate(userProfile?.subscriptionExpiresAt)}</p>
                {!isStarter && <p className="mt-1 text-xs font-medium text-emerald-700">{subscriptionActive ? (daysRemaining ?? 0) + ' jour(s) restant(s)' : 'Abonnement expiré ou inactif'}</p>}
              </div>
            </div>
            {userProfile?.scheduledPlan && userProfile.scheduledStartAt && (
              <div className="mx-5 mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:mx-7">
                <span className="font-bold">Prochain abonnement :</span> {userProfile.scheduledPlan === 'community' ? 'Community' : 'Plus'} à partir du {formatDate(userProfile.scheduledStartAt)}.
              </div>
            )}
            {isStarter && (
              <div className="border-t border-slate-100 px-5 py-4 sm:px-7">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-700">Trades utilisés ce mois-ci</span>
                  <span className="font-black text-slate-950">{monthlyTrades} / {starterLimit}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: Math.min(100, monthlyTrades / starterLimit * 100) + '%' }} />
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <h3 className="text-lg font-black tracking-tight text-slate-950">Changer de formule</h3>
              <p className="mt-1 text-sm text-slate-500">Choisissez l’abonnement adapté à vos besoins.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-lg font-extrabold text-slate-950">Plus</h4>
                  {userProfile?.plan === 'pro' && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Formule actuelle</span>}
                </div>
                <p className="mt-1 text-sm text-slate-500">Pour gérer votre trading sans quota mensuel.</p>
                <div className="mt-4"><span className="text-3xl font-black tracking-tight text-slate-950">$9.99</span><span className="ml-2 text-sm text-slate-500">/ mois</span></div>
                <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-700">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> Journal sans quota mensuel</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> Analyses avancées</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> Plusieurs comptes de trading</li>
                </ul>
                <button onClick={() => startPayment('pro')} disabled={!canBuyPlan('pro')} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {!canBuyPlan('pro') ? (userProfile?.plan === 'pro' ? 'Déjà actif' : userProfile?.scheduledPlan ? 'Abonnement programmé' : 'Indisponible') : 'Choisir Plus'} <ArrowRight className="h-4 w-4" />
                </button>
              </article>

              <article className="flex flex-col rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-5 shadow-sm transition hover:border-emerald-300 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-lg font-extrabold text-slate-950">Community</h4>
                  {userProfile?.plan === 'community' && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Formule actuelle</span>}
                </div>
                <p className="mt-1 text-sm text-slate-500">Pour profiter des ressources et de la communauté.</p>
                <div className="mt-4"><span className="text-3xl font-black tracking-tight text-slate-950">$89.99</span><span className="ml-2 text-sm text-slate-500">/ 6 mois</span></div>
                <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-700">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> Outils et formations</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> Cours et ressources</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> Accompagnement pendant 6 mois</li>
                </ul>
                <button onClick={() => startPayment('community')} disabled={!canBuyPlan('community')} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {!canBuyPlan('community') ? (userProfile?.plan === 'community' ? 'Déjà actif' : userProfile?.scheduledPlan ? 'Abonnement programmé' : 'Indisponible') : 'Choisir Community'} <ChevronRight className="h-4 w-4" />
                </button>
              </article>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-4 sm:space-y-5">
          {!isEditingProfile ? (
            <>
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-100" />
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                  <div className="flex min-w-0 items-center gap-4">
                    <button type="button" onClick={() => (userProfile?.avatarURL || userProfile?.photoURL) && setIsAvatarPreviewOpen(true)} disabled={!(userProfile?.avatarURL || userProfile?.photoURL)} aria-label="Agrandir la photo de profil" title={(userProfile?.avatarURL || userProfile?.photoURL) ? "Agrandir la photo" : "Aucune photo de profil"} className={`group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50 text-xl font-black text-emerald-700 ring-1 ring-emerald-100 ${(userProfile?.avatarURL || userProfile?.photoURL) ? "cursor-zoom-in" : "cursor-default"}`}>
                      {(userProfile?.avatarURL || userProfile?.photoURL) ? <><img src={userProfile?.avatarURL || userProfile?.photoURL || ''} alt="Avatar" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" /><span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/25 group-hover:opacity-100"><span className="rounded-full bg-slate-950/55 px-2 py-1 text-[9px] font-bold">Agrandir</span></span></> : (displayName || [firstName, lastName].filter(Boolean).join(' ') || 'T').charAt(0).toUpperCase()}
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Profil trader</p>
                      <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-950">{displayName || [firstName, lastName].filter(Boolean).join(' ') || 'Trader IAMTRADER'}</h2>
                      <p className="mt-1 truncate text-sm text-slate-500">{userProfile?.email || 'Adresse e-mail non renseignée'}</p>
                      <div className="mt-2"><PlanBadge plan={userProfile?.plan || 'free'} /></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setIsEditingProfile(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"><User className="h-4 w-4" /> Modifier le profil</button>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div><h3 className="text-base font-extrabold text-slate-950">Informations personnelles</h3><p className="mt-1 text-sm text-slate-500">Les informations principales de votre compte.</p></div>
                  <span className="rounded-xl bg-slate-50 p-2.5 text-slate-500"><User className="h-4 w-4" /></span>
                </div>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Prénom', firstName], ['Nom', lastName], ['WhatsApp', whatsapp], ['Ville', city], ['Pays', country], ['Membre depuis', formatDate(userProfile?.createdAt)]
                  ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                    <div key={String(label)} className="min-w-0 border-b border-slate-100 pb-3">
                      <p className="text-xs text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                  {!firstName && !lastName && !whatsapp && !city && !country && <p className="text-sm text-slate-500">Complétez votre profil pour afficher vos informations ici.</p>}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-base font-extrabold text-slate-950">Votre profil de trading</h3><p className="mt-1 text-sm text-slate-500">Votre niveau, votre style et vos marchés.</p></div><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Niveau', value: traderLevel || 'Non renseigné' },
                    { label: 'Style', value: traderStyle || 'Non renseigné' },
                    { label: 'Marchés', value: traderMarkets.length ? traderMarkets.join(' · ') : 'Non renseignés' }
                  ].map(item => <div key={item.label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-2 text-sm font-bold text-slate-900">{item.value}</p></div>)}
                </div>
              </section>

              {socialLinks.length > 0 && (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="text-base font-extrabold text-slate-950">Réseaux sociaux</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{socialLinks.map((link, index) => <span key={link.network + link.username + index} className="rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-700">{link.network} <span className="text-slate-400">·</span> {link.username}</span>)}</div>
                </section>
              )}

              <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">IAMTRADER Rating</p>
                  <h3 className="mt-1 text-base font-extrabold text-slate-950">Votre cote de performance</h3>
                  <p className="mt-1 text-sm text-slate-500">{traderRating.isSufficientData ? traderRating.tradesAnalyzed + ' trades analysés · Win rate ' + traderRating.winRate.toFixed(1) + '% · PF ' + traderRating.profitFactor.toFixed(2) : traderRating.tradesAnalyzed + '/5 trades nécessaires pour calculer votre cote'}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <div className={traderRating.isSufficientData ? 'flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800' : 'flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-slate-600'}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black shadow-sm">{traderRating.grade}</span>
                    <span className="text-sm font-bold">{traderRating.isSufficientData ? traderRating.label : 'En attente'}</span>
                    {traderRating.isSufficientData && <span className="text-xs font-black">{traderRating.score}/100</span>}
                  </div>
                  <button type="button" onClick={downloadTraderBadge} disabled={!traderRating.isSufficientData} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Télécharger le badge</button>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4"><div><h3 className="text-lg font-black text-slate-950">Modifier le profil</h3><p className="mt-1 text-sm text-slate-500">Mettez à jour vos informations essentielles.</p></div><button type="button" onClick={() => setIsEditingProfile(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Prénom', firstName, setFirstName], ['Nom', lastName, setLastName], ['Nom d’affichage', displayName, setDisplayName],
                    ['Âge', age, setAge], ['Ville', city, setCity], ['WhatsApp', whatsapp, setWhatsapp]
                  ].map(([label, value, setter], index) => <div key={String(label)}><label className="mb-1.5 block text-xs font-semibold text-slate-600">{label as string}</label><input value={value as string} onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} type={label === 'WhatsApp' ? 'tel' : 'text'} inputMode={label === 'Âge' ? 'numeric' : label === 'WhatsApp' ? 'tel' : undefined} placeholder={label === 'WhatsApp' ? '+243 9XX XXX XXX' : undefined} autoComplete={label === 'WhatsApp' ? 'tel' : undefined} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></div>)}
                  <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Pays</label><select value={country} onChange={e => setCountry(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"><option value="">Sélectionner un pays</option>{countryOptions.map(item => <option key={item.code} value={item.name}>{item.name}</option>)}</select></div>
                  <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Sexe</label><select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500"><option value="">Sélectionner</option><option>Homme</option><option>Femme</option><option>Autre</option></select></div>
                  <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">E-mail</label><input disabled value={userProfile?.email || ''} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-500" /></div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h3 className="text-base font-extrabold text-slate-950">Profil de trading</h3>
                <p className="mt-1 text-sm text-slate-500">Sélectionnez les informations qui décrivent votre pratique.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Niveau</label><select value={traderLevel} onChange={e => setTraderLevel(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm"><option value="">Sélectionner</option><option>Débutant</option><option>Intermédiaire</option><option>Avancé</option><option>Professionnel</option></select></div>
                  <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Style</label><select value={traderStyle} onChange={e => setTraderStyle(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm"><option value="">Sélectionner</option><option>Scalping</option><option>Day Trading</option><option>Swing Trading</option><option>Position Trading</option></select></div>
                  <div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Marchés principaux</label><div className="flex flex-wrap gap-2">{['Forex','Gold','Indices','Crypto'].map(m => <button type="button" key={m} onClick={() => toggleMarket(m)} className={`rounded-full px-3 py-2 text-xs font-bold transition ${traderMarkets.includes(m) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{m}</button>)}</div></div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h3 className="text-base font-extrabold text-slate-950">Réseaux sociaux</h3>
                <p className="mt-1 text-sm text-slate-500">Facultatif : ajoutez les profils que vous souhaitez partager.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row"><select value={socialNetwork} onChange={e => setSocialNetwork(e.target.value)} className="rounded-xl border border-slate-200 px-3.5 py-3 text-sm sm:w-44"><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>X</option><option>LinkedIn</option><option>YouTube</option></select><input value={socialUsername} onChange={e => setSocialUsername(e.target.value)} placeholder="@votre_nom" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-3 text-sm" /><button type="button" onClick={addSocialLink} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Ajouter</button></div>
                {socialLinks.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{socialLinks.map((link, index) => <div key={link.network + link.username + index} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"><span className="font-semibold text-slate-700">{link.network}</span><span className="text-slate-500">{link.username}</span><button type="button" aria-label={`Retirer ${link.network}`} onClick={() => removeSocialLink(index)} className="text-slate-400 hover:text-rose-600">×</button></div>)}</div>}
              </section>

              <div className="sticky bottom-3 z-10 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <button type="button" onClick={() => setIsEditingProfile(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Annuler</button>
                <button type="button" onClick={saveTraderProfile} disabled={isProfileSaving} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{isProfileSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
              </div>
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
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-5"><h3 className="font-bold text-slate-900">Sécurité & accès</h3><p className="mt-1 text-xs text-slate-500">Gérez votre mot de passe, votre application et vos appareils connectés.</p></div>
            <div className="grid gap-3 lg:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-[#f8fbfd] p-4">
                <div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Download className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h4 className="text-sm font-bold text-slate-900">Télécharger l’application</h4><p className="mt-1 text-xs leading-5 text-slate-500">Installez IAMTRADER sur cet appareil pour y accéder depuis votre écran d’accueil.</p></div></div>
                <button type="button" onClick={handleInstallApp} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"><Smartphone className="h-4 w-4" />{installPrompt ? 'Installer IAMTRADER' : 'Installer IAMTRADER'}</button>
              </article>
              <article className="rounded-xl border border-slate-200 bg-[#f8fbfd] p-4">
                <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Mail className="h-5 w-5" /></span><div><h4 className="text-sm font-bold text-slate-900">Réinitialisation du mot de passe</h4><p className="mt-1 text-xs leading-5 text-slate-500">Un lien sécurisé sera transmis à {userProfile?.email}.</p></div></div>
                <button type="button" onClick={handlePasswordReset} className="mt-4 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700">Envoyer l’e-mail</button>
              </article>
              <article className="rounded-xl border border-slate-200 bg-[#f8fbfd] p-4">
                <div className="flex items-start gap-3"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><LogOut className="h-5 w-5" /></span><div><h4 className="text-sm font-bold text-slate-900">Déconnexion</h4><p className="mt-1 text-xs leading-5 text-slate-500">Fermez votre session IAMTRADER sur cet appareil.</p></div></div>
                <button type="button" onClick={() => void handleLogoutCurrentDevice()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"><LogOut className="h-4 w-4" />Se déconnecter</button>
              </article>
              <article className="rounded-xl border border-slate-200 bg-[#f8fbfd] p-4">
                <div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Shield className="h-5 w-5" /></span><div><h4 className="text-sm font-bold text-slate-900">Données privées</h4><p className="mt-1 text-xs leading-5 text-slate-500">Vos données de trading restent isolées dans votre espace Firestore.</p></div></div>
              </article>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">Appareils connectés</h3><p className="mt-1 text-xs text-slate-500">Consultez les navigateurs associés à votre compte et révoquez leur accès.</p></div><Monitor className="h-5 w-5 text-slate-500" /></div>
            {devicesLoading ? <div className="py-8 text-center text-xs text-slate-500">Chargement des appareils…</div> : deviceSessions.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-xs leading-5 text-slate-500">Aucun appareil enregistré pour le moment. Les appareils apparaîtront après leur connexion avec cette version de IAMTRADER.</div> : <div className="mt-4 space-y-3">{deviceSessions.map(session => { const isCurrent = session.id === currentDeviceSessionId; const timestamp = session.lastSeenAt && typeof session.lastSeenAt === 'object' && 'toMillis' in session.lastSeenAt && typeof session.lastSeenAt.toMillis === 'function' ? session.lastSeenAt.toMillis() : session.lastSeenAt ? new Date(session.lastSeenAt as string).getTime() : 0; return <div key={session.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><Monitor className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-900">{session.deviceName || 'Navigateur inconnu'}</p>{isCurrent && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Cet appareil</span>}{session.revoked && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Révoqué</span>}</div><p className="mt-1 text-[11px] text-slate-500">Dernière activité : {timestamp ? new Date(timestamp).toLocaleString('fr-FR') : '—'}</p></div></div>{!session.revoked && <button type="button" onClick={() => void handleRevokeDevice(session)} disabled={!!revokingDeviceId} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><LogOut className="h-3.5 w-3.5" />{revokingDeviceId === session.id ? 'Révocation…' : isCurrent ? 'Déconnecter' : 'Révoquer l’accès'}</button>}</div>; })}</div>}
            <p className="mt-3 text-[11px] leading-5 text-slate-500">La révocation est appliquée par IAMTRADER aux sessions qui surveillent leur état. Un appareil hors ligne sera déconnecté dès qu’il se reconnectera.</p>
          </section>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:px-5 sm:py-6" role="dialog" aria-modal="true" aria-labelledby="payment-checkout-title">
          <div className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-3xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">IAMTRADER · Abonnement</p>
                <h3 id="payment-checkout-title" className="mt-1 text-lg font-black tracking-tight sm:text-xl">{paymentPlan === 'pro' ? 'Passer à Plus' : 'Activer Community'}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Étape {paymentStep === 'duration' ? '1' : paymentStep === 'details' ? '2' : '3'} sur 3 · {paymentStep === 'duration' ? 'Durée et paiement' : paymentStep === 'details' ? 'Informations' : 'Récapitulatif'}</p>
              </div>
              <button type="button" onClick={() => setPaymentPlan(null)} className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
              {paymentStatus === 'idle' && (
                <>
                  <div className="mb-5 grid grid-cols-4 gap-1.5" aria-label="Progression du paiement">
                    {(['duration','details','summary'] as const).map((step, index) => (
                      <div key={step} className={'h-1.5 rounded-full ' + ((['duration','details','summary'] as const).indexOf(paymentStep) >= index ? 'bg-emerald-500' : 'bg-slate-100')} />
                    ))}
                  </div>

                  {paymentStep === 'duration' && (
                    <div className="mx-auto max-w-md space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                        <p className="text-xs font-bold text-emerald-700">Formule sélectionnée</p>
                        <h4 className="mt-1 text-xl font-black">{paymentPlan === 'pro' ? 'IAMTRADER Plus' : 'IAMTRADER Community'}</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{paymentPlan === 'pro' ? 'Accès complet aux outils de trading.' : 'Accès aux ressources et à la communauté.'}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50/80 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-semibold text-slate-500">Durée de l’abonnement</label>
                          {paymentPlan === 'pro' ? (
                            <div className="flex items-center gap-2">
                              <button type="button" aria-label="Diminuer la durée" disabled={paymentMonths <= 1} onClick={() => { const next = Math.max(1, paymentMonths - 1); setPaymentMonths(next); setPromoQuote(null); setPromoMessage(''); void loadAutomaticPromotion(paymentPlan, next); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-30"><span className="text-lg leading-none">−</span></button>
                              <span className="min-w-14 text-center text-base font-bold tabular-nums text-slate-800">{paymentMonths} <span className="text-xs font-medium text-slate-500">mois</span></span>
                              <button type="button" aria-label="Augmenter la durée" disabled={paymentMonths >= 12} onClick={() => { const next = Math.min(12, paymentMonths + 1); setPaymentMonths(next); setPromoQuote(null); setPromoMessage(''); void loadAutomaticPromotion(paymentPlan, next); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-30"><span className="text-lg leading-none">+</span></button>
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-slate-700">6 mois</span>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">{paymentPlan === 'pro' ? 'De 1 à 12 mois' : 'Durée fixe pour Community'}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">Montant de l’abonnement</span><strong className="text-xl font-black text-slate-950">${getPaymentAmounts(paymentPlan, paymentMonths).total.toFixed(2)} USD</strong></div>
                        <p className="mt-1 text-[11px] leading-4 text-slate-500">{paymentPlan === 'pro' ? '$9.99 par mois.' : 'Tarif calculé à partir du forfait Community de 6 mois à $89.99.'}</p>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-3.5 sm:p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div><label className="block text-base font-extrabold text-slate-900">Choisissez votre moyen de paiement</label><p className="mt-0.5 text-[11px] text-slate-500">Sélectionnez comment régler votre abonnement.</p></div>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-700">Disponible</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex min-w-0 items-center gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 shadow-sm shadow-emerald-100/70"> 
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><Smartphone className="h-5 w-5" /></span>
                            <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-950">Mobile Money</span><span className="mt-1 block text-xs leading-4 text-slate-600">Paiement mobile sécurisé</span></span>
                            <span className="h-4 w-4 shrink-0 rounded-full border-[5px] border-emerald-600 bg-white" />
                          </div>
                          <div aria-disabled="true" className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 opacity-65">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400"><WalletCards className="h-5 w-5" /></span>
                            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-500">Virement bancaire</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-400">Bientôt disponible</span></span>
                            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">Indisponible</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={() => setPaymentPlan(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 sm:flex-1">Annuler</button>
                        <button type="button" onClick={() => setPaymentStep('details')} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 sm:flex-[1.5]">Continuer <ArrowRight className="ml-1 inline h-4 w-4" /></button>
                      </div>
                    </div>
                  )}

                  {paymentStep === 'details' && (
                    <div className="mx-auto max-w-md space-y-4">
                      {paymentMethod === 'mobile_money' ? (
                        <>
                          <div><h4 className="text-lg font-black">Informations Mobile Money</h4><p className="mt-1 text-xs leading-5 text-slate-500">Renseignez le pays, le numéro et le réseau associé à votre portefeuille mobile.</p></div>
                          <div><label className="mb-1.5 block text-xs font-bold text-slate-700">Pays</label><select value={paymentCountryCode} onChange={event => { const code = event.target.value; setPaymentCountryCode(code); setPaymentProvider(countryOptions.find(item => item.code === code)?.networks[0]?.value || ''); setPaymentPhone(''); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500">{countryOptions.map(item => <option key={item.code} value={item.code}>{item.flag} {item.name} ({item.dialCode})</option>)}</select></div>
                          <div><label className="mb-1.5 block text-xs font-bold text-slate-700">Numéro de téléphone</label><div className="flex min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"><span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">{countryOptions.find(item => item.code === paymentCountryCode)?.dialCode || '+243'}</span><input type="tel" inputMode="numeric" autoComplete="tel-national" value={paymentPhone} onChange={event => setPaymentPhone(event.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, countryOptions.find(item => item.code === paymentCountryCode)?.phoneLength || 9))} placeholder={'X'.repeat(countryOptions.find(item => item.code === paymentCountryCode)?.phoneLength || 9)} className="min-w-0 flex-1 px-3 py-3 text-sm text-slate-900 outline-none" /></div><p className="mt-1 text-[10px] text-slate-500">Sans le zéro initial. L’indicatif est ajouté automatiquement.</p></div>
                          <div><label className="mb-1.5 block text-xs font-bold text-slate-700">Réseau Mobile Money</label><select value={paymentProvider} onChange={event => setPaymentProvider(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500">{(countryOptions.find(item => item.code === paymentCountryCode)?.networks || []).map(network => <option key={network.value} value={network.value}>{network.label}</option>)}</select></div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                          <div className="flex items-center gap-2 text-sm font-extrabold text-sky-900"><WalletCards className="h-5 w-5" /> Virement bancaire</div>
                          <p className="mt-2 text-xs leading-5 text-sky-900/80">Les coordonnées du compte bancaire IAMTRADER seront affichées après l’enregistrement de votre demande. Votre abonnement restera en attente jusqu’à la vérification effective du virement.</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2"><button type="button" onClick={() => setPaymentStep('duration')} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Retour</button><button type="button" onClick={() => setPaymentStep('summary')} disabled={paymentMethod === 'mobile_money' && (!paymentPhone.trim() || !paymentProvider)} className="flex-[1.5] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Continuer</button></div>
                    </div>
                  )}

                  {paymentStep === 'summary' && (
                    <div className="mx-auto max-w-md space-y-4">
                      <div><h4 className="text-lg font-black">Vérifiez votre commande</h4><p className="mt-1 text-xs leading-5 text-slate-500">Vérifiez les informations avant de confirmer votre demande.</p></div>
                      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
                        <div className="flex justify-between gap-3 py-3 text-sm"><span className="text-slate-500">Abonnement</span><strong>{paymentPlan === 'pro' ? 'Plus' : 'Community'}</strong></div>
                        <div className="flex justify-between gap-3 py-3 text-sm"><span className="text-slate-500">Durée</span><strong>{paymentMonths} mois</strong></div>
                        <div className="flex justify-between gap-3 py-3 text-sm"><span className="text-slate-500">Paiement</span><strong>{paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Virement bancaire'}</strong></div>
                        {paymentMethod === 'mobile_money' && <div className="flex justify-between gap-3 py-3 text-sm"><span className="text-slate-500">Téléphone</span><strong className="max-w-[60%] break-all text-right">{countryOptions.find(item => item.code === paymentCountryCode)?.dialCode}{paymentPhone}</strong></div>}
                        <div className="flex justify-between gap-3 py-4"><span className="text-sm font-bold text-slate-700">Total à payer</span><strong className="text-xl font-black text-emerald-700">${(promoQuote?.finalAmount ?? getPaymentAmounts(paymentPlan, paymentMonths).total).toFixed(2)} USD</strong></div>
                      </div>
                      <button type="button" onClick={() => { setPromoMessage(''); setIsPromoModalOpen(true); }} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><Tag className="h-4 w-4" /> Ajouter un code promo</button>
                      {promoMessage && <p className="text-xs text-slate-500">{promoMessage}</p>}
                      <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => setPaymentStep('details')} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 sm:flex-1">Modifier</button><button type="button" onClick={() => void submitPayment()} disabled={isPaymentLoading} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 sm:flex-[1.5]">{isPaymentLoading ? 'Enregistrement…' : 'Confirmer et continuer'}</button></div>
                    </div>
                  )}
                </>
              )}

              {isPromoModalOpen && paymentStatus === 'idle' && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="promo-code-modal-title">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">Avantage abonnement</p><h3 id="promo-code-modal-title" className="mt-1 text-lg font-black">Appliquer un code promo</h3></div><button type="button" onClick={() => setIsPromoModalOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
                    <label htmlFor="payment-promo-code" className="mt-5 mb-1.5 block text-xs font-bold text-slate-700">Code promo</label>
                    <input id="payment-promo-code" value={promoCode} onChange={event => { setPromoCode(event.target.value.toUpperCase().replace(/\s/g,'')); setPromoQuote(null); setPromoMessage(''); }} placeholder="Ex. IAM-XXXXX" autoComplete="off" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-mono font-bold text-slate-900 outline-none focus:border-emerald-500" />
                    {promoMessage && <p className={'mt-2 text-xs font-semibold ' + (promoQuote ? 'text-emerald-700' : 'text-rose-600')}>{promoMessage}</p>}
                    <div className="mt-5 flex gap-2"><button type="button" onClick={() => setIsPromoModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600">Annuler</button><button type="button" onClick={() => void applyPromoCode()} disabled={isPromoApplying || !promoCode.trim()} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white disabled:opacity-50">{isPromoApplying ? 'Vérification…' : 'Appliquer'}</button></div>
                  </div>
                </div>
              )}

              {paymentStatus === 'processing' && paymentMethod === 'bank_transfer' && (
                <div className="mx-auto max-w-lg space-y-4 py-2">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-sm font-extrabold text-amber-900"><Clock3 className="h-5 w-5" /> Paiement en attente de vérification</div><p className="mt-2 text-xs leading-5 text-amber-900/80">{paymentMessage}</p></div>
                  {paymentBankDetails ? (
                    <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                      <h4 className="text-sm font-black">Coordonnées bancaires</h4>
                      <dl className="mt-3 space-y-3 text-sm">
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-slate-500">Banque</dt><dd className="font-bold sm:text-right">{paymentBankDetails.bankName}</dd></div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-slate-500">Titulaire</dt><dd className="font-bold sm:text-right">{paymentBankDetails.accountName}</dd></div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-slate-500">Numéro de compte</dt><dd className="break-all font-mono font-bold sm:text-right">{paymentBankDetails.accountNumber}</dd></div>
                        {paymentBankDetails.swift && <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-slate-500">SWIFT / BIC</dt><dd className="font-mono font-bold sm:text-right">{paymentBankDetails.swift}</dd></div>}
                        {paymentBankDetails.branch && <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-slate-500">Agence</dt><dd className="font-bold sm:text-right">{paymentBankDetails.branch}</dd></div>}
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-slate-500">Devise</dt><dd className="font-bold sm:text-right">{paymentBankDetails.currency || 'USD'}</dd></div>
                      </dl>
                      {paymentBankDetails.instructions && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{paymentBankDetails.instructions}</p>}
                    </div>
                  ) : <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">Les coordonnées bancaires ne sont pas encore disponibles. Votre demande n’a pas été enregistrée ; contactez l’assistance IAMTRADER.</p>}
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Référence à communiquer</p><p className="mt-1 break-all font-mono text-base font-black">{paymentReference || paymentId}</p><p className="mt-2 text-xs leading-5 text-slate-500">Après le virement, transmettez la preuve de paiement à l’assistance en indiquant cette référence. L’abonnement sera activé uniquement après vérification.</p></div>
                  <button type="button" onClick={() => setPaymentPlan(null)} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Terminer</button>
                </div>
              )}

              {paymentStatus === 'processing' && paymentMethod === 'mobile_money' && (
                <div className="mx-auto max-w-lg space-y-5 py-4">
                  <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><span className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-600" /></div>
                    <h4 className="mt-4 text-xl font-black text-slate-900">Confirmation du paiement</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{paymentMessage || 'La demande a été envoyée. Validez-la sur votre téléphone.'}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-900"><Clock3 className="h-4 w-4" /> Suivi automatique en cours</div>
                    <ol className="mt-3 space-y-2.5 text-xs text-emerald-950">
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0" /> Demande de paiement envoyée</li>
                      <li className="flex items-center gap-2"><span className="h-4 w-4 shrink-0 animate-pulse rounded-full border-2 border-emerald-600" /> En attente de la réponse de l’opérateur</li>
                      <li className="flex items-center gap-2 text-emerald-800/55"><span className="h-4 w-4 shrink-0 rounded-full border border-emerald-300" /> Activation de l’abonnement après confirmation</li>
                    </ol>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Référence</span><strong className="break-all font-mono text-slate-800">{paymentReference || paymentId}</strong></div>
                    {paymentLastCheckedAt && <p className="mt-2 text-[10px] text-slate-400">Dernière vérification : {new Date(paymentLastCheckedAt).toLocaleTimeString('fr-FR')}</p>}
                    {paymentCheckError && <p className="mt-2 text-xs leading-5 text-amber-700">Connexion de vérification perturbée : {paymentCheckError} Le système réessaie automatiquement.</p>}
                    {paymentPollTimedOut && <p className="mt-2 text-xs leading-5 text-amber-700">La confirmation prend plus de temps que prévu. Vérifiez votre téléphone puis relancez une vérification.</p>}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => void refreshPaymentStatus()} disabled={isPaymentChecking} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{isPaymentChecking ? 'Vérification…' : 'Vérifier maintenant'}</button>
                    <button type="button" onClick={() => setPaymentPlan(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Fermer</button>
                  </div>
                </div>
              )}

              {paymentStatus === 'paid' && <div className="mx-auto max-w-md py-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-7 w-7" /></div><h4 className="mt-4 text-lg font-black">Paiement confirmé</h4><p className="mt-2 text-sm leading-6 text-slate-500">{paymentMessage}</p><button type="button" onClick={() => setPaymentPlan(null)} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Terminer</button></div>}

              {paymentStatus === 'failed' && <div className="mx-auto max-w-md space-y-4 py-8">
                <div className="text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600"><X className="h-7 w-7" /></div><h4 className="mt-4 text-lg font-black text-slate-900">Paiement échoué</h4><p className="mt-2 text-sm leading-5 text-slate-600">Le fournisseur n’a pas confirmé votre paiement.</p></div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">Motif communiqué</p><p className="mt-1 text-sm leading-5 text-rose-900">{paymentMessage || 'Le paiement a été refusé. Vérifiez votre solde et les informations de votre portefeuille, puis réessayez.'}</p></div>
                {paymentReference && <p className="break-all text-center text-[11px] text-slate-400">Référence : {paymentReference}</p>}
                <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => { setPaymentStatus('idle'); setPaymentStep('summary'); setPaymentMessage(''); setPaymentCheckError(''); }} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Réessayer</button><button type="button" onClick={() => setPaymentPlan(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Fermer</button></div>
              </div>}
            </div>
          </div>
        </div>
      )}

      {isAvatarPreviewOpen && (userProfile?.avatarURL || userProfile?.photoURL) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Photo de profil agrandie" onClick={() => setIsAvatarPreviewOpen(false)}>
          <button type="button" onClick={() => setIsAvatarPreviewOpen(false)} className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20" aria-label="Fermer l’aperçu"><X className="h-6 w-6" /></button>
          <img src={userProfile?.avatarURL || userProfile?.photoURL || ''} alt="Photo de profil en grand format" className="max-h-[88vh] max-w-[min(90vw,900px)] rounded-2xl object-contain shadow-2xl" onClick={event => event.stopPropagation()} />
          <p className="absolute bottom-5 text-xs font-medium text-white/65">Cliquez en dehors de la photo ou sur × pour fermer</p>
        </div>
      )}
    </div>
  );
}
