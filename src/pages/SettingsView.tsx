import React, { useMemo, useState } from 'react';
import { UserProfile, SubscriptionPlan, TradingAccount, Trade } from '../types';
import { PlanBadge } from '../components/common/Badge';
import {
  User, Shield, CreditCard, Sliders, Lock, Mail, Check, ArrowRight,
  Activity, CalendarDays, Clock3, WalletCards, Sparkles, ChevronRight, Phone, X, Crown, Target, Coins, TrendingUp, Star, Receipt, Tag, Download, Smartphone, Monitor, LogOut
} from 'lucide-react';
import { resetUserPassword, updateTraderProfile, logoutUser } from '../services/auth';
import { subscribeDeviceSessions, revokeDeviceSession, getDeviceSessionId, endCurrentDeviceSession, DeviceSession } from '../services/deviceSessions';
import { useToast } from '../components/common/Toast';
import { TradingJournalSettings } from '../components/settings/TradingJournalSettings';
import { PaymentHistory } from './PaymentHistory';
import { PromotionBanners } from '../components/promotions/PromotionBanners';
import { calculateTraderRating, formatCurrency } from '../utils/calculations';
import { createPayment, getSasPayPaymentStatus, verifySasPayPayment, PaidPlan, PaymentDetails } from '../services/payments';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'certificates' | 'subscription' | 'security' | 'preferences' | 'journal' | 'history'>('profile');
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
  const [paymentGateway, setPaymentGateway] = useState<'cinetpay' | 'saspay'>('saspay');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoQuote, setPromoQuote] = useState<{ baseAmount: number; discountAmount: number; finalAmount: number; promotionName: string; promoCode: string | null } | null>(null);
  const [isPromoApplying, setIsPromoApplying] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');
  const [paymentCountryCode, setPaymentCountryCode] = useState<string>(() => detectCountryCode());
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryListOpen, setIsCountryListOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState(() => countryOptions.find(item => item.code === detectCountryCode())?.networks[0]?.value || 'vodacom_cd');
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
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const currentDeviceSessionId = getDeviceSessionId();

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

  const loadAutomaticPromotion = async (plan: PaidPlan) => {
    try {
      const response = await fetch('/api/promotions/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
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
    setPaymentPlan(plan); setPromoCode(''); setPromoQuote(null); setPromoMessage(''); setIsPromoModalOpen(false); setPaymentGateway('saspay'); void loadAutomaticPromotion(plan);
    setPaymentProvider(initialCountry.networks[0]?.value || '');
    setPaymentUrl(null); setPaymentPayerName('');
    setPaymentId(null); setPaymentReference(null); setPaymentStatus('idle'); setPaymentMessage('');
    setPaymentAction(null); setPaymentActivationStart(null); setPaymentActivationExpires(null);
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
        body: JSON.stringify({ plan: paymentPlan, code: promoCode.trim().toUpperCase() })
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
    setIsPaymentLoading(true); setPaymentMessage('');
    try {
      const details: PaymentDetails = {
        phone: paymentPhone.trim(),
        countryCode: paymentCountryCode,
        paymentMethod: 'mobile_money',
        paymentProvider,
        payerName: paymentPayerName.trim(),
        promoCode: promoCode.trim().toUpperCase() || undefined
      };
      const payment = await createPayment(paymentPlan, details);
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

  React.useEffect(() => {
    if (!paymentReference || paymentStatus !== 'processing') return;
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
          // The profile subscription updates the active plan without a full-page reload.
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
  }, [paymentReference, paymentStatus]);

  React.useEffect(() => {
    if (!pendingPaymentReference) return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    setPaymentGateway('saspay');
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
          // The profile subscription updates the active plan without a full-page reload.
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
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50 text-xl font-black text-emerald-700 ring-1 ring-emerald-100">
                      {(userProfile?.avatarURL || userProfile?.photoURL) ? <img src={userProfile?.avatarURL || userProfile?.photoURL || ''} alt="Avatar" className="h-full w-full object-cover" /> : (displayName || [firstName, lastName].filter(Boolean).join(' ') || 'T').charAt(0).toUpperCase()}
                    </div>
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-900/35 p-2 backdrop-blur-md sm:p-5">
          <div className="relative my-auto grid w-full max-w-7xl overflow-hidden rounded-[30px] border border-emerald-100 bg-white text-slate-900 shadow-[0_30px_100px_rgba(15,23,42,.22)] animate-in fade-in zoom-in-95 duration-300 lg:grid-cols-[0.68fr_1.32fr]">
            <style>{`
              @keyframes iamAmbientGlow { 0%,100% { opacity:.24; transform:scale(1) } 50% { opacity:.52; transform:scale(1.12) } }
              @keyframes iamRipple { 0% { transform:scale(.65); opacity:.65 } 100% { transform:scale(1.55); opacity:0 } }
              @keyframes iamPhoneFloat { 0%,100% { transform:translateY(0) rotate(-2deg) } 50% { transform:translateY(-8px) rotate(1deg) } }
              @keyframes iamScreenSpin { to { transform:rotate(360deg) } }
              @keyframes iamProgressShine { 0% { transform:translateX(-110%) } 100% { transform:translateX(240%) } }
              @keyframes iamEntrance { from { opacity:0; transform:translateY(12px) scale(.985) } to { opacity:1; transform:translateY(0) scale(1) } }
              .iam-checkout-brand:before { content:""; position:absolute; width:230px; height:230px; right:-100px; bottom:-80px; border-radius:999px; background:rgba(0,210,150,.24); filter:blur(45px); animation:iamAmbientGlow 8s ease-in-out infinite; pointer-events:none }
              .iam-checkout-brand:after { content:""; position:absolute; inset:0; opacity:.22; pointer-events:none; background-image:linear-gradient(rgba(5,150,105,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(5,150,105,.09) 1px,transparent 1px); background-size:28px 28px; mask-image:linear-gradient(to bottom,black,transparent 85%) }
              .iam-payment-enter { animation:iamEntrance .45s cubic-bezier(.16,1,.3,1) both }
              .iam-payment-ripple { position:absolute; inset:0; border:1px solid rgba(16,185,129,.48); border-radius:999px; animation:iamRipple 2.4s cubic-bezier(.2,.7,.3,1) infinite; pointer-events:none }
              .iam-payment-ripple.delay { animation-delay:1.2s }
              .iam-payment-phone { animation:iamPhoneFloat 3s ease-in-out infinite; filter:drop-shadow(0 14px 18px rgba(5,150,105,.15)) }
              .iam-payment-spinner { transform-origin:center; animation:iamScreenSpin 1.15s linear infinite }
              .iam-payment-progress:after { content:""; position:absolute; inset:0; width:42%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent); animation:iamProgressShine 2s ease-in-out infinite }
              @media (prefers-reduced-motion: reduce) { .iam-checkout-brand:before,.iam-payment-enter,.iam-payment-ripple,.iam-payment-phone,.iam-payment-spinner,.iam-payment-progress:after { animation:none !important } }
            `}</style>
            <aside className="iam-checkout-brand relative hidden overflow-hidden border-r border-emerald-900/40 bg-[radial-gradient(ellipse_at_10%_90%,rgba(0,220,170,.24),transparent_44%),linear-gradient(145deg,#032f2b_0%,#064e3b_52%,#047857_100%)] p-7 text-left text-white lg:flex lg:flex-col lg:items-start">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(167,243,208,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(167,243,208,.045)_1px,transparent_1px)] bg-[size:28px_28px]" />
              <div className="relative flex min-h-10 items-center rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10"><img src="/brand/logo-iamtrader-full.png" alt="IAMTRADER" className="h-10 w-auto object-contain drop-shadow-sm" /></div>
              <div className="relative mt-8 w-full text-left"><span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-200">IAMTRADER Plus</span><h2 className="mt-4 max-w-xs text-3xl font-black leading-tight tracking-tight text-white">Progressez avec de meilleurs outils.</h2><p className="mt-3 max-w-xs text-sm leading-6 text-emerald-50/80">Un suivi clair de vos performances et de vos décisions.</p></div>
              <div className="relative mt-7 space-y-4">
                {[
                  ['Journal avancé',Activity],
                  ['Statistiques détaillées',TrendingUp],
                  ['IA Chloé',Sparkles]
                ].map(([title,Icon]: any) => <div key={title} className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-400/15 text-emerald-200"><Icon className="h-4 w-4" /></div><div className="text-sm font-bold text-white">{title}</div></div>)}
              </div>
              <div className="relative mt-auto w-full border-t border-emerald-100/10 pt-4"><PromotionBanners placement="ticker" /></div>
            </aside>
            <section className="min-w-0 bg-white">
            <div className="relative flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Shield className="h-5 w-5" /></div><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Paiement sécurisé par SasPay</div><h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{paymentPlan === 'pro' ? 'Passer à Plus' : 'Activer Community'}</h3><p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">Vérifiez votre formule et poursuivez vers le paiement sécurisé pour activer votre abonnement.</p></div></div>
              <button onClick={() => setPaymentPlan(null)} className="shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-5 p-5 sm:p-7 lg:p-8">

              {isPromoModalOpen && paymentStatus === 'idle' && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="promo-code-modal-title">
                  <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xl sm:p-6">
                    <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">Avantage abonnement</div><h3 id="promo-code-modal-title" className="mt-1 text-lg font-black text-slate-950">Appliquer un code promo</h3><p className="mt-1 text-xs leading-5 text-slate-500">Le serveur vérifie le code et recalcule le prix avant le paiement.</p></div><button type="button" onClick={() => setIsPromoModalOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
                    <label htmlFor="payment-promo-code" className="mt-5 mb-1.5 block text-xs font-bold text-slate-700">Code promo</label>
                    <input id="payment-promo-code" value={promoCode} onChange={event => { setPromoCode(event.target.value.toUpperCase().replace(/\\s/g,'')); setPromoQuote(null); setPromoMessage(''); }} placeholder="Ex. IAM-XXXXX" autoComplete="off" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-mono font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    {promoMessage && <p className={`mt-2 text-xs font-semibold ${promoQuote ? 'text-emerald-700' : 'text-rose-600'}`}>{promoMessage}</p>}
                    <div className="mt-5 flex gap-2"><button type="button" onClick={() => setIsPromoModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Annuler</button><button type="button" onClick={() => void applyPromoCode()} disabled={isPromoApplying || !promoCode.trim()} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">{isPromoApplying ? 'Vérification…' : 'Appliquer'}</button></div>
                  </div>
                </div>
              )}
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
                    <div className="mt-1 text-xl font-black tracking-tight text-slate-950">{paymentGateway === 'saspay' ? `${(promoQuote?.finalAmount ?? getPaymentAmounts(paymentPlan).total).toFixed(2)} USD` : `${getPaymentAmounts(paymentPlan).cdfTotal.toLocaleString('fr-FR')} CDF`}</div>
                  </div>
                </div>
                {promoQuote && paymentStatus === 'idle' && <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-[#f0fdf8] via-white to-[#effcf7] p-4 shadow-sm sm:p-5"><div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500"/><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800"><Sparkles className="h-3 w-3"/> Offre appliquée</span><span className="text-xs font-bold text-slate-700">{promoQuote.promotionName || 'Avantage abonnement'}</span></div><div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-sm font-semibold text-slate-400 line-through">${promoQuote.baseAmount.toFixed(2)} USD</span><span className="text-2xl font-black tracking-tight text-slate-950">${promoQuote.finalAmount.toFixed(2)} <span className="text-sm font-bold">USD</span></span><span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white">−${promoQuote.discountAmount.toFixed(2)}</span></div><p className="mt-1.5 text-[11px] font-medium text-emerald-800">Vous économisez ${promoQuote.discountAmount.toFixed(2)} sur cet abonnement.</p></div><button type="button" onClick={() => { setPromoQuote(null); setPromoCode(''); setPromoMessage(''); }} className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-slate-800">Retirer</button></div></div>}
                {(
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                    <div className="relative">
                      <div className="mb-1.5 flex items-center justify-between gap-3"><label className="block text-xs font-bold text-slate-700">Pays de paiement</label><button type="button" onClick={() => { setPromoMessage(''); setIsPromoModalOpen(true); }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-800"><Tag className="h-3.5 w-3.5" /> Code promo {promoQuote && <Check className="h-3.5 w-3.5" />}</button></div>
                      <button type="button" onClick={() => setIsCountryListOpen(open => !open)} className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-3 text-left transition hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                        <img src={`https://flagcdn.com/w40/${paymentCountryCode.toLowerCase()}.png`} alt={paymentCountryCode} className="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" onError={event => { event.currentTarget.style.display = 'none'; }} />
                        <span className="min-w-0 flex-1"><span className="mr-2 text-xs font-black text-emerald-300">{paymentCountryCode}</span><span className="text-sm font-semibold text-slate-800">{countryOptions.find(item => item.code === paymentCountryCode)?.name || 'Sélectionner un pays'}</span><span className="mt-0.5 block text-[10px] text-sky-700">{`Indicatif ${countryOptions.find(item => item.code === paymentCountryCode)?.dialCode || ''} · Mobile Money`}</span></span>
                        <ChevronRight className={'h-4 w-4 text-slate-400 transition ' + (isCountryListOpen ? 'rotate-90' : '')} />
                      </button>
                      {isCountryListOpen && <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                        <input value={countrySearch} onChange={event => setCountrySearch(event.target.value)} placeholder="Rechercher un pays..." className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-400" />
                        <div className="max-h-52 overflow-y-auto">{countryOptions.filter(item => (item.name + item.code).toLowerCase().includes(countrySearch.toLowerCase())).map(item => <button type="button" key={item.code} onClick={() => { setPaymentCountryCode(item.code); setPaymentProvider(item.networks[0]?.value || ''); setPaymentPhone(''); setIsCountryListOpen(false); setCountrySearch(''); }} className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ' + (paymentCountryCode === item.code ? 'bg-emerald-400/10 text-emerald-700 ring-1 ring-emerald-200' : 'text-slate-700 hover:bg-slate-50')}><img src={`https://flagcdn.com/w40/${item.code.toLowerCase()}.png`} alt={item.code} loading="lazy" className="h-4 w-6 shrink-0 rounded-sm object-cover shadow-sm" onError={event => { event.currentTarget.style.display = 'none'; }} /><span className="w-7 text-xs font-black">{item.code}</span><span className="flex-1 text-xs">{item.name}</span>{paymentCountryCode === item.code && <Check className="h-4 w-4 text-emerald-600" />}</button>)}</div>
                      </div>}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
                      <div className="min-w-0">
                        <label htmlFor="saspay-phone" className="mb-1.5 block text-xs font-bold text-slate-700">Numéro Mobile Money</label>
                        <div className="flex min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                          <span aria-label={`Indicatif téléphonique ${countryOptions.find(item => item.code === paymentCountryCode)?.dialCode || '+243'}`} className="flex shrink-0 items-center border-r border-slate-200 bg-emerald-50 px-2.5 text-sm font-bold text-emerald-800">{countryOptions.find(item => item.code === paymentCountryCode)?.dialCode || '+243'}</span>
                          <input id="saspay-phone" type="tel" inputMode="numeric" autoComplete="tel-national" required aria-required="true" value={paymentPhone} onChange={event => setPaymentPhone(event.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, countryOptions.find(item => item.code === paymentCountryCode)?.phoneLength || 9))} placeholder={'X'.repeat(countryOptions.find(item => item.code === paymentCountryCode)?.phoneLength || 9)} className="min-w-0 w-full bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
                        </div>
                        <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Indicatif ajouté automatiquement, sans le 0 initial.</p>
                      </div>
                      <div className="min-w-0">
                        <label htmlFor="saspay-network" className="mb-1.5 block text-xs font-bold text-slate-700">Réseau Mobile Money</label>
                        <select id="saspay-network" value={paymentProvider} onChange={event => setPaymentProvider(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                          {(countryOptions.find(item => item.code === paymentCountryCode)?.networks || []).map(network => <option key={network.value} value={network.value}>{network.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800"><Shield className="mr-2 inline h-4 w-4" />Paiement sécurisé intégré à IAMTRADER. Une demande de confirmation sera envoyée par votre opérateur. L’abonnement ne sera activé qu’après confirmation serveur.</div>
                <button onClick={submitPayment} disabled={isPaymentLoading || (paymentGateway === 'saspay' && (!paymentPhone.trim() || !paymentProvider))} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(0,199,150,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,199,150,.25)] focus:outline-none focus:ring-4 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40">{isPaymentLoading ? 'Envoi de la demande…' : 'Continuer vers le paiement'}</button>
              </>)}
              {paymentStatus === 'processing' && !(paymentGateway === 'saspay' && paymentUrl) && (<div className="iam-payment-enter space-y-5 py-2">
                <div className="grid items-center gap-5 md:grid-cols-[0.78fr_1.22fr] md:gap-8">
                  <div className="relative flex min-h-[230px] items-center justify-center overflow-hidden rounded-[26px] border border-emerald-100 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,.16),transparent_68%),linear-gradient(145deg,#f0fdf8,#ffffff_68%,#ecfdf5)] p-5">
                    <div className="iam-payment-ripple h-36 w-36" />
                    <div className="iam-payment-ripple delay h-36 w-36" />
                    <div className="absolute h-40 w-40 rounded-full bg-emerald-200/40 blur-2xl" />
                    <svg className="iam-payment-phone relative z-10 h-40 w-28" viewBox="0 0 96 144" fill="none" role="img" aria-label="Téléphone en attente de confirmation Mobile Money">
                      <defs><linearGradient id="iamPhoneFrame" x1="10" y1="8" x2="86" y2="136" gradientUnits="userSpaceOnUse"><stop stopColor="#10B981"/><stop offset="1" stopColor="#064E3B"/></linearGradient><linearGradient id="iamPhoneScreen" x1="20" y1="18" x2="76" y2="126" gradientUnits="userSpaceOnUse"><stop stopColor="#10B981"/><stop offset="1" stopColor="#064E3B"/></linearGradient></defs>
                      <rect x="7" y="3" width="82" height="138" rx="17" fill="#0F2925" stroke="url(#iamPhoneFrame)" strokeWidth="3"/>
                      <rect x="13" y="12" width="70" height="120" rx="11" fill="url(#iamPhoneScreen)"/>
                      <path d="M37 18h22" stroke="#A7F3D0" strokeWidth="3" strokeLinecap="round"/>
                      <circle cx="48" cy="57" r="18" stroke="#A7F3D0" strokeWidth="4" opacity=".5"/>
                      <circle className="iam-payment-spinner" cx="48" cy="57" r="18" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeDasharray="38 75"/>
                      <rect x="24" y="86" width="48" height="17" rx="8.5" fill="#FFFFFF" fillOpacity=".16"/>
                      <path d="M32 94.5h32" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round"/>
                      <circle cx="39" cy="115" r="2.5" fill="#A7F3D0"/><circle cx="48" cy="115" r="2.5" fill="#A7F3D0" opacity=".75"/><circle cx="57" cy="115" r="2.5" fill="#A7F3D0" opacity=".5"/>
                    </svg>
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                      <span className="rounded-full border border-emerald-100 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">M-Pesa</span>
                      <span className="rounded-full border border-emerald-100 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">Airtel</span>
                      <span className="rounded-full border border-emerald-100 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">Orange</span>
                    </div>
                  </div>
                  <div className="min-w-0 py-2 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.13em] text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />Paiement sécurisé par SasPay</div>
                    <h4 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Paiement <span className="text-emerald-600">en traitement</span></h4>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 md:mx-0">{paymentMessage || 'Demande Mobile Money envoyée. Confirmez le paiement sur votre téléphone.'}</p>
                    <div className="iam-payment-progress relative mt-5 h-2 overflow-hidden rounded-full bg-emerald-50 ring-1 ring-emerald-100"><div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300" /></div>
                    <div className="mt-5 grid grid-cols-3 items-start gap-2">
                      <div className="flex flex-col items-center gap-2 md:items-start"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white shadow-md shadow-emerald-600/20"><Check className="h-4 w-4" /></span><span className="text-[10px] font-bold leading-4 text-slate-700">Demande envoyée</span></div>
                      <div className="flex flex-col items-center gap-2 border-x border-slate-100 px-1"><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 text-xs font-black text-emerald-700"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" /></span><span className="text-center text-[10px] font-bold leading-4 text-emerald-700">Confirmez sur votre téléphone</span></div>
                      <div className="flex flex-col items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-400">3</span><span className="text-center text-[10px] font-semibold leading-4 text-slate-400">Confirmation opérateur</span></div>
                    </div>
                  </div>
                </div>
                {paymentActivationStart && <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div><div className="text-[10px] font-medium text-slate-500">Type</div><div className="mt-1 text-xs font-bold text-slate-800">{paymentAction === 'upgrade' ? 'Upgrade programmé' : paymentAction === 'renewal' ? 'Renouvellement' : 'Nouvelle souscription'}</div></div>
                    <div><div className="text-[10px] font-medium text-slate-500">Début</div><div className="mt-1 text-xs font-bold text-slate-800">{formatDate(paymentActivationStart)}</div></div>
                    <div><div className="text-[10px] font-medium text-slate-500">Expiration</div><div className="mt-1 text-xs font-bold text-slate-800">{formatDate(paymentActivationExpires || undefined)}</div></div>
                  </div>
                </div>}
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg></div><div><div className="text-xs font-extrabold text-amber-800">Validez la demande Mobile Money sur votre téléphone</div><p className="mt-1 text-xs leading-5 text-amber-700">Une notification vient d’être envoyée. Ouvrez-la et confirmez le paiement avant de fermer cette fenêtre.</p></div></div>
              </div>)}{paymentStatus === 'paid' && (<div className="py-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-7 w-7" /></div><h4 className="mt-4 text-base font-black text-slate-950">Paiement confirmé</h4><p className="mt-2 text-xs text-slate-500">{paymentMessage}</p><div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">Référence : {paymentId}</div></div>)}
              {paymentStatus === 'failed' && (<div className="space-y-4 py-3 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">!</div><h4 className="text-base font-black text-slate-950">Paiement non finalisé</h4><p className="text-xs leading-5 text-slate-500">{paymentMessage}</p><button onClick={() => setPaymentStatus('idle')} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white">Réessayer</button></div>)}
            </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
