import React from 'react';
import { Plus, ChevronDown, LogOut, Menu, Sparkles } from 'lucide-react';
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
  onOpenChloe: () => void;
  currentPageTitle: string;
}

export function Navbar({ userProfile, accounts, selectedAccountId, onSelectAccount, onOpenNewTrade, onLogout, onToggleSidebar, onOpenChloe, currentPageTitle }: NavbarProps) {
  return (
    <header className="h-16 border-b border-[#e7eeeb] bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-[#71839a] hover:text-[#10233a] hover:bg-[#f5f8f7] rounded-lg transition-colors cursor-pointer"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/brand/logo-iamtrader-symbol.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain shrink-0" />
          <h1 className="text-sm font-semibold text-[#10233a] truncate">{currentPageTitle}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center">
          <div className="relative">
            <select
              value={selectedAccountId}
              onChange={e => onSelectAccount(e.target.value)}
              className="appearance-none bg-transparent text-xs font-medium text-[#314861] pr-5 pl-1.5 py-2 focus:outline-none cursor-pointer"
              aria-label="Compte"
            >
              <option value="all">Tous les comptes ({accounts.length})</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {acc.currency === 'USD' ? '$' : '€'}{acc.currentBalance.toLocaleString()}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#8da0b1] absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={onOpenChloe}
          className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#eafbf6] text-[#168c73] shadow-[0_4px_12px_rgba(0,169,130,0.14)] ring-1 ring-[#bfe8dc] transition-all hover:scale-105 hover:shadow-[0_7px_18px_rgba(0,169,130,0.2)] cursor-pointer overflow-visible"
          title="Ouvrir Chloé"
          aria-label="Ouvrir Chloé"
        >
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#00c796] to-[#00a982] text-white shadow-[0_4px_12px_rgba(0,169,130,0.28)] animate-pulse">
            <Sparkles className="h-3.5 w-3.5 animate-[spin_3s_linear_infinite]" />
            <span className="absolute inset-0 rounded-full ring-2 ring-[#00c796]/20 animate-ping" />
          </span>
        </button>

        <button
          onClick={onOpenNewTrade}
          className="btn-primary flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nouveau trade</span>
          <span className="sm:hidden">Trade</span>
        </button>

        <div className="h-6 w-px bg-[#e5ece9] hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#e7faf3] text-[#00a86b] flex items-center justify-center text-xs font-bold">
            {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'H'}
          </div>
          <button
            onClick={onLogout}
            className="hidden sm:block p-1.5 text-[#8494a5] hover:text-[#f04f63] hover:bg-[#fff1f3] rounded-lg transition-colors cursor-pointer"
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
