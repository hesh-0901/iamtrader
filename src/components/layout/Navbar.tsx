import React, { useState } from 'react';
import { 
  Plus, 
  ChevronDown, 
  LogOut, 
  Wallet, 
  Menu, 
  Bell, 
  Search, 
  ShieldCheck, 
  User as UserIcon,
  Sliders
} from 'lucide-react';
import { TradingAccount, UserProfile } from '../../types';

interface NavbarProps {
  userProfile: UserProfile | null;
  accounts: TradingAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onOpenNewTrade: () => void;
  onOpenNewAccount: () => void;
  onLogout: () => void;
  onToggleSidebar: () => void;
  currentPageTitle: string;
}

export function Navbar({
  userProfile,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onOpenNewTrade,
  onOpenNewAccount,
  onLogout,
  onToggleSidebar,
  currentPageTitle
}: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-[72px] border-b border-slate-200/70 bg-white/85 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-all select-none">
      {/* Zone 1: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-mono uppercase tracking-wider text-slate-500">IAMTRADER</span>
          <span className="hidden sm:inline text-slate-600">/</span>
          <span className="font-bold text-slate-600 text-sm tracking-tight">{currentPageTitle}</span>
        </div>
      </div>

      {/* Zone 2: Account Selector & Live Market Pill */}
      <div className="hidden md:flex items-center gap-3">
        {/* Live Market Session Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-white border border-slate-200 text-[11px] font-mono text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-400 font-semibold">Marché Ouvert</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">Londres / New York</span>
        </div>

        {/* Account Selector Dropdown */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-white hover:bg-slate-850 border border-slate-200 hover:border-slate-700 px-3 py-1.5 rounded-xl transition-all">
            <Wallet className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={selectedAccountId}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="appearance-none bg-transparent text-xs font-medium text-slate-600 pr-5 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-600">
                Tous les comptes ({accounts.length})
              </option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-white text-slate-600">
                  {acc.name} — {acc.currency === 'USD' ? '$' : '€'}{acc.currentBalance.toLocaleString()}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={onOpenNewAccount}
          className="text-xs font-medium text-slate-500 hover:text-blue-400 px-2 py-1 rounded hover:bg-slate-850 transition-colors cursor-pointer"
          title="Ajouter un compte de trading"
        >
          + Compte
        </button>
      </div>

      {/* Zone 3: Actions, Notifications & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Action Button: Nouveau Trade */}
        <button
          onClick={onOpenNewTrade}
          className="btn-primary flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Nouveau Trade</span>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors relative cursor-pointer"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute top-1.5 right-1.5" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 mb-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Notifications Système</span>
                <span className="text-[10px] text-blue-400 font-mono">1 active</span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span>Règle Drawdown Prop Firm</span>
                  <span className="text-[9px] text-emerald-400 font-mono">Conforme</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  Votre perte maximale journalière est sous contrôle strict (0.0%).
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-100 hidden sm:block"></div>

        {/* Compact User Profile with Role & Plan */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
            {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'H'}
          </div>

          <div className="hidden lg:flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 leading-none truncate max-w-[110px]">
                {userProfile?.displayName || 'Hénoch'}
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase">
                {userProfile?.plan || 'PRO'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 leading-none mt-1 font-mono uppercase">
              {userProfile?.role === 'admin' ? 'Administrateur' : 'Trader Certifié'}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-100 rounded-lg transition-colors ml-1 cursor-pointer"
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
