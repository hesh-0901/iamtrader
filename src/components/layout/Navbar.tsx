import React, { useState } from 'react';
import { Plus, ChevronDown, LogOut, Wallet, Menu, Bell } from 'lucide-react';
import { TradingAccount, UserProfile } from '../../types';

interface NavbarProps {
  userProfile: UserProfile | null; accounts: TradingAccount[]; selectedAccountId: string;
  onSelectAccount: (accountId: string) => void; onOpenNewTrade: () => void; onOpenNewAccount: () => void;
  onLogout: () => void; onToggleSidebar: () => void; currentPageTitle: string;
}

export function Navbar({ userProfile, accounts, selectedAccountId, onSelectAccount, onOpenNewTrade, onOpenNewAccount, onLogout, onToggleSidebar, currentPageTitle }: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  return (
    <header className="h-[76px] border-b border-[#e7eeeb] bg-white/95 backdrop-blur-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onToggleSidebar} className="lg:hidden p-2 text-[#71839a] hover:text-[#10233a] hover:bg-[#f1f6f4] rounded-xl transition-all cursor-pointer" aria-label="Menu"><Menu className="w-5 h-5" /></button>
        <div className="hidden sm:flex items-center gap-2 min-w-0"><span className="text-[10px] font-mono uppercase tracking-[.15em] text-[#9aa9b8]">IAMTRADER</span><span className="text-[#d7e1dd]">/</span><span className="font-semibold text-[#203a53] text-sm tracking-tight truncate">{currentPageTitle}</span></div>
      </div>
      <div className="hidden md:flex items-center gap-2.5">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#f7fbf9] border border-[#e2ece8] text-[10px] font-mono"><span className="w-1.5 h-1.5 rounded-full bg-[#08b77a] animate-pulse" /><span className="text-[#476078] font-semibold">Marché ouvert</span><span className="text-[#b2bec8]">·</span><span className="text-[#8091a2]">Londres / New York</span></div>
        <div className="relative"><div className="flex items-center gap-2 bg-white border border-[#e1eae7] hover:border-[#c6ddd5] px-3.5 py-2 rounded-xl transition-all shadow-sm"><Wallet className="w-3.5 h-3.5 text-[#00a86b] shrink-0" /><select value={selectedAccountId} onChange={e=>onSelectAccount(e.target.value)} className="appearance-none bg-transparent text-xs font-medium text-[#203a53] pr-6 focus:outline-none cursor-pointer"><option value="all">Tous les comptes ({accounts.length})</option>{accounts.map(acc=><option key={acc.id} value={acc.id}>{acc.name} — {acc.currency === 'USD' ? '$' : '€'}{acc.currentBalance.toLocaleString()}</option>)}</select><ChevronDown className="w-3.5 h-3.5 text-[#8da0b1] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" /></div></div>
        <button onClick={onOpenNewAccount} className="text-[11px] font-semibold text-[#5f748c] hover:text-[#008f63] px-2.5 py-2 rounded-lg hover:bg-[#f1f7f4] transition-colors cursor-pointer">+ Compte</button>
      </div>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button onClick={onOpenNewTrade} className="btn-primary flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs cursor-pointer"><Plus className="w-3.5 h-3.5 stroke-[2.7]" /><span className="hidden sm:inline">Nouveau Trade</span><span className="sm:hidden">Trade</span></button>
        <div className="relative">
          <button onClick={()=>setShowNotifications(!showNotifications)} className="p-2 text-[#71839a] hover:text-[#10233a] hover:bg-[#f1f6f4] rounded-xl transition-colors relative cursor-pointer" title="Notifications" aria-label="Notifications"><Bell className="w-4 h-4" /><span className="w-1.5 h-1.5 rounded-full bg-[#08b77a] absolute top-1.5 right-1.5 ring-2 ring-white" /></button>
          {showNotifications && <div className="absolute right-0 mt-2 w-80 bg-white border border-[#e1eae7] rounded-2xl shadow-xl p-3.5 z-50"><div className="flex items-center justify-between pb-3 border-b border-[#edf2f0] mb-3"><span className="text-[10px] font-bold text-[#203a53] uppercase tracking-[.12em]">Notifications</span><span className="text-[9px] text-[#00a86b] font-mono">1 active</span></div><div className="p-3 rounded-xl bg-[#f7fbf9] border border-[#e4ece9]"><div className="flex items-center justify-between text-[11px] font-semibold text-[#314861]"><span>Règle Drawdown Prop Firm</span><span className="text-[9px] text-[#00a86b] font-mono">Conforme</span></div><p className="text-[10px] text-[#74869a] leading-relaxed mt-1">Votre perte maximale journalière est sous contrôle strict (0.0%).</p></div></div>}
        </div>
        <div className="h-7 w-px bg-[#e5ece9] hidden sm:block" />
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-9 h-9 rounded-xl bg-[#e7faf3] border border-[#c5ecde] text-[#00a86b] flex items-center justify-center text-xs font-bold shrink-0">{userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'H'}</div>
          <div className="hidden lg:flex flex-col text-left"><div className="flex items-center gap-1.5"><span className="text-xs font-semibold text-[#203a53] leading-none truncate max-w-[120px]">{userProfile?.displayName || 'Hénoch'}</span><span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border bg-[#eafaf4] text-[#008f63] border-[#ccecdf] uppercase">{userProfile?.plan || 'PRO'}</span></div><span className="text-[9px] text-[#8a9aab] leading-none mt-1.5 font-mono uppercase tracking-wider">{userProfile?.role === 'admin' ? 'Administrateur' : 'Trader'}</span></div>
          <button onClick={onLogout} className="p-1.5 text-[#8494a5] hover:text-[#f04f63] hover:bg-[#fff1f3] rounded-lg transition-colors ml-1 cursor-pointer" title="Se déconnecter" aria-label="Se déconnecter"><LogOut className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </header>
  );
}
