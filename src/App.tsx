import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { subscribeToAuth, logoutUser, getUserProfile, checkIsAdmin } from './services/auth';
import { 
  subscribeUserTrades, 
  subscribeUserAccounts,
  requestUserPlanChange
} from './services/firestore';
import { Trade, TradingAccount, UserProfile, SubscriptionPlan } from './types';
import { ToastProvider, useToast } from './components/common/Toast';
import { Navbar } from './components/layout/Navbar';
import { ChloeChat } from './components/layout/ChloeChat';
import { Sidebar, NavigationPage } from './components/layout/Sidebar';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { Journal } from './pages/Journal';
import { CalendarView } from './pages/CalendarView';
import { Performance } from './pages/Performance';
import { Psychology } from './pages/Psychology';
import { TraderScoreView } from './pages/TraderScoreView';
import { AccountsView } from './pages/AccountsView';
import { SettingsView } from './pages/SettingsView';
import { AdminConsole } from './pages/AdminConsole';
import { CommunityView } from './pages/CommunityView';
import { EconomicCalendarView } from './pages/EconomicCalendarView';
import { TradeModal } from './components/journal/TradeModal';
import { TradeDetailModal } from './components/journal/TradeDetailModal';
import { AccountModal } from './components/accounts/AccountModal';
import { AuthModal } from './components/auth/AuthModal';
import { ShieldAlert, LogOut, Loader2, Menu } from 'lucide-react';
import { syncSubscriptionStatus } from './services/payments';

function MainAppContent() {
  const { showToast } = useToast();

  // Auth & User Profile State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Navigation State
  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Domain Data State
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Modals State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalDefaultMode, setAuthModalDefaultMode] = useState<'login' | 'register'>('login');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
  const [inspectingTrade, setInspectingTrade] = useState<Trade | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isChloeOpen, setIsChloeOpen] = useState(false);

  // 1. Auth Subscription
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          try { await syncSubscriptionStatus(); } catch (subscriptionError: any) { console.warn('Subscription lifecycle notice:', subscriptionError?.message); }
          const profile = await getUserProfile(user.uid);
          const isAdmin = await checkIsAdmin(user);

          if (profile) {
            setUserProfile({
              ...profile,
              role: isAdmin ? 'admin' : profile.role
            });
          } else {
            setUserProfile({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Trader',
              plan: 'free',
              role: isAdmin ? 'admin' : 'trader',
              status: 'active',
              createdAt: new Date().toISOString()
            });
          }
        } catch (err: any) {
          console.warn("User profile fetch notice:", err.message);
        }
      } else {
        setUserProfile(null);
        setAccounts([]);
        setTrades([]);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Data Subscriptions for Authenticated User
  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.uid;
    setIsLoadingData(true);

    // Subscribe to accounts
    const unsubAccounts = subscribeUserAccounts(uid, (fetchedAccounts, err) => {
      if (err) {
        console.warn("Accounts subscription notice:", err.message);
      }
      setAccounts(fetchedAccounts);
    });

    // Subscribe to trades
    const unsubTrades = subscribeUserTrades(uid, (fetchedTrades, err) => {
      setIsLoadingData(false);
      if (err) {
        console.warn("Trades subscription notice:", err.message);
      }
      setTrades(fetchedTrades);
    }, selectedAccountId);

    return () => {
      unsubAccounts();
      unsubTrades();
    };
  }, [currentUser, selectedAccountId]);

  const currentMonthTradeCount = trades.filter((trade) => {
    const date = new Date(trade.entryDate);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;

  const starterTradeLimit = 5;

  const handleOpenNewTrade = () => {
    if (userProfile?.plan === 'free' && currentMonthTradeCount >= starterTradeLimit) {
      showToast('Votre limite Starter de 5 trades ce mois-ci est atteinte. Passez à Plus pour continuer sans limite.', 'info');
      setCurrentPage('settings');
      return;
    }
    setTradeToEdit(null);
    setIsTradeModalOpen(true);
  };

  const handleOpenNewAccount = () => {
    if (userProfile?.plan === 'free' && accounts.length >= 1) {
      showToast('Le plan Starter est limité à 1 compte. Passez à Plus pour ajouter d’autres comptes.', 'info');
      setCurrentPage('settings');
      return;
    }
    setIsAccountModalOpen(true);
  };

  const handleRequestPlan = async (plan: 'pro' | 'community') => {
    if (!userProfile) return;
    try {
      await requestUserPlanChange(userProfile.uid, plan);
      setUserProfile({ ...userProfile, pendingPlan: plan, planChangeRequestedAt: new Date().toISOString() });
      showToast('Votre demande d’upgrade a été transmise.', 'success');
    } catch (err: any) {
      showToast('Impossible d’envoyer la demande pour le moment.', 'error');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    showToast('Vous avez été déconnecté', 'info');
    setCurrentPage('dashboard');
  };

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthModalDefaultMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleUpdatePlan = (newPlan: SubscriptionPlan) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, plan: newPlan });
    }
  };

  // If initial auth is verifying
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-4 animate-in fade-in duration-300">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xl shadow-slate-900/10">
            <img src="/brand/logo-iamtrader-symbol.png" alt="IAMTRADER" className="w-10 h-10 object-contain animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
          </span>
        </div>
        <div className="text-center space-y-1">
          <span className="font-extrabold text-slate-900 text-base tracking-tight">
            IAM<span className="text-blue-500">TRADER</span>
          </span>
          <p className="text-xs text-slate-500 font-mono tracking-wider">
            Initialisation de la station sécurisée...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated -> Landing Page
  if (!currentUser) {
    return (
      <>
        <LandingPage
          onOpenAuth={handleOpenAuth}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          defaultMode={authModalDefaultMode}
        />
      </>
    );
  }

  // Rule 29: Suspended User Guard
  if (userProfile?.status === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-neutral-100">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-rose-500/40 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-100">Compte IAMTRADER Suspendu</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Votre accès à la plateforme a été temporairement désactivé par l'administration. Veuillez contacter le support de conformité à <span className="text-neutral-200 underline font-mono">support@iamtrader.com</span> pour réactiver votre compte.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    );
  }

  const pageTitles: Record<NavigationPage, string> = {
    'dashboard': 'Dashboard Principal',
    'journal': 'Journal de Trading',
    'calendar': 'Calendrier de Rentabilité',
    'economic-calendar': 'Calendrier économique',
    'performance': 'Analytique & Performance',
    'psychology': 'Matrice Psychologique',
    'trader-score': 'Trader Score™',
    'accounts': 'Comptes de Trading',
    'settings': 'Paramètres Système',
    'community': 'Community',
    'admin': 'Console Administration'
  };

  if (currentPage === 'admin' && userProfile?.role === 'admin') {
    return (
      <div className="min-h-screen bg-[#f5f8fb] text-slate-900 flex">
        <Sidebar
          currentPage={currentPage}
          onNavigate={(page) => setCurrentPage(page)}
          userRole={userProfile?.role}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div className="flex-1 min-w-0 relative">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="lg:hidden fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0b1f35] shadow-lg"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <AdminConsole />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex selection:bg-blue-600/25 selection:text-blue-300">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
        userRole={userProfile?.role}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <Navbar
          userProfile={userProfile}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={(accId) => setSelectedAccountId(accId)}
          onOpenNewTrade={handleOpenNewTrade}
          onOpenNewAccount={handleOpenNewAccount}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenChloe={() => setIsChloeOpen(true)}
          currentPageTitle={pageTitles[currentPage]}
        />

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">


          {/* Page Routing */}
          {currentPage === 'dashboard' && (
            <Dashboard
              trades={trades}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              userProfile={userProfile}
              onOpenNewTrade={handleOpenNewTrade}
              onSelectTrade={(t) => setInspectingTrade(t)}
              onNavigateToJournal={() => setCurrentPage('journal')}
            />
          )}

          {currentPage === 'journal' && (
            <Journal
              trades={trades}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onOpenNewTrade={handleOpenNewTrade}
              onSelectTrade={(t) => setInspectingTrade(t)}
              onEditTrade={(t) => {
                setTradeToEdit(t);
                setIsTradeModalOpen(true);
              }}
            />
          )}

          {currentPage === 'calendar' && (
            <CalendarView
              trades={trades}
              accounts={accounts}
              onSelectTrade={(t) => setInspectingTrade(t)}
            />
          )}

          {currentPage === 'economic-calendar' && (
            <EconomicCalendarView />
          )}

          {currentPage === 'performance' && (
            <Performance
              trades={trades}
              accounts={accounts}
            />
          )}

          {currentPage === 'psychology' && (
            <Psychology
              trades={trades}
            />
          )}

          {currentPage === 'trader-score' && (
            <TraderScoreView
              trades={trades}
            />
          )}

          {currentPage === 'accounts' && (
            <AccountsView
              accounts={accounts}
              trades={trades}
              onOpenNewAccount={handleOpenNewAccount}
              selectedAccountId={selectedAccountId}
              onSelectAccount={(id) => setSelectedAccountId(id)}
            />
          )}

          {currentPage === 'community' && (
            <CommunityView />
          )}

          {currentPage === 'settings' && (
            <SettingsView
              userProfile={userProfile}
              accounts={accounts}
              trades={trades}
              selectedAccountId={selectedAccountId}
              onRequestPlan={handleRequestPlan}
            />
          )}

          {currentPage === 'admin' && userProfile?.role === 'admin' && (
            <AdminConsole />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <TradeModal
        isOpen={isTradeModalOpen}
        onClose={() => {
          setIsTradeModalOpen(false);
          setTradeToEdit(null);
        }}
        userId={currentUser?.uid || ''}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        tradeToEdit={tradeToEdit}
      />

      <TradeDetailModal
        trade={inspectingTrade}
        accounts={accounts}
        isOpen={!!inspectingTrade}
        onClose={() => setInspectingTrade(null)}
        onEdit={(t) => {
          setInspectingTrade(null);
          setTradeToEdit(t);
          setIsTradeModalOpen(true);
        }}
      />

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        userId={currentUser?.uid || ''}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authModalDefaultMode}
      />

      <ChloeChat
        isOpen={isChloeOpen}
        onClose={() => setIsChloeOpen(false)}
        userId={currentUser?.uid || ''}
        userProfile={userProfile}
        accounts={accounts}
        trades={trades}
        currentPage={pageTitles[currentPage]}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainAppContent />
    </ToastProvider>
  );
}
