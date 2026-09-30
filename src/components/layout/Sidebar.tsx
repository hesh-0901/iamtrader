import React from 'react';
import { LayoutDashboard, BookOpen, LineChart, ShieldCheck, Wallet, CalendarDays, BrainCircuit, Sliders, ShieldAlert, ChevronLeft, X, Activity } from 'lucide-react';
import { UserRole } from '../../types';

export type NavigationPage = 'dashboard' | 'journal' | 'calendar' | 'performance' | 'psychology' | 'trader-score' | 'accounts' | 'settings' | 'admin';

interface SidebarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  userRole?: UserRole;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ currentPage, onNavigate, userRole, isMobileOpen, onCloseMobile, isCollapsed, onToggleCollapse }: SidebarProps) {
  const navSections = [
    { group: 'Espace de travail', items: [
      { id: 'dashboard' as NavigationPage, label: 'Dashboard', icon: LayoutDashboard },
      { id: 'journal' as NavigationPage, label: 'Journal de trading', icon: BookOpen },
      { id: 'performance' as NavigationPage, label: 'Analyses & Edge', icon: LineChart },
      { id: 'trader-score' as NavigationPage, label: 'Trader Score', icon: ShieldCheck, tag: 'PRO' }
    ]},
    { group: 'Trading', items: [
      { id: 'accounts' as NavigationPage, label: 'Comptes & Prop Firms', icon: Wallet },
      { id: 'calendar' as NavigationPage, label: 'Calendrier P&L', icon: CalendarDays },
      { id: 'psychology' as NavigationPage, label: 'Psychologie & Biais', icon: BrainCircuit }
    ]},
    { group: 'Système', items: [
      ...(userRole === 'admin' ? [{ id: 'admin' as NavigationPage, label: 'Console Admin', icon: ShieldAlert, tag: 'ADMIN' }] : []),
      { id: 'settings' as NavigationPage, label: 'Paramètres', icon: Sliders }
    ]}
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white border-r border-[#e7eeeb] select-none">
      <div>
        <div className="h-[78px] flex items-center justify-between px-5 border-b border-[#edf2f0] bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#e9faf4] border border-[#c8eee0] text-[#00a86b] flex items-center justify-center shrink-0"><Activity className="w-5 h-5 stroke-[2.4]" /></div>
            {!isCollapsed && <div className="min-w-0"><div className="font-bold tracking-[-0.03em] text-[#10233a] text-[15px] leading-none">iam<span className="text-[#00a86b]">trader</span></div><div className="text-[9px] text-[#93a1af] font-mono tracking-[.16em] mt-1.5 uppercase">Performance OS</div></div>}
          </div>
          <button onClick={onToggleCollapse} className="hidden lg:flex p-1.5 text-[#8494a5] hover:text-[#10233a] rounded-lg hover:bg-[#f1f6f4] transition-all cursor-pointer" title={isCollapsed ? 'Développer le menu' : 'Réduire le menu'}><ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} /></button>
          <button onClick={onCloseMobile} className="lg:hidden p-1.5 text-[#8494a5] hover:text-[#10233a] rounded-lg hover:bg-[#f1f6f4] cursor-pointer" aria-label="Fermer le menu"><X className="w-5 h-5" /></button>
        </div>
        <nav className="px-3 py-5 space-y-7 overflow-y-auto max-h-[calc(100vh-150px)]">
          {navSections.map(section => (
            <div key={section.group}>
              {!isCollapsed && <div className="px-3 mb-2.5 text-[9px] font-bold tracking-[.16em] text-[#a0adb9] uppercase">{section.group}</div>}
              <div className="space-y-1">
                {section.items.map(item => {
                  const isActive = currentPage === item.id;
                  const Icon = item.icon;
                  return <button key={item.id} onClick={() => { onNavigate(item.id); onCloseMobile(); }} title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12.5px] font-medium transition-all duration-150 text-left relative cursor-pointer group ${isActive ? 'bg-[#e8faf3] text-[#008f63] border border-[#c9eee1]' : 'text-[#60758d] hover:text-[#203a53] hover:bg-[#f5f9f7] border border-transparent'}`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-white text-[#00a86b] shadow-sm' : 'text-[#71859a] group-hover:text-[#3f5870]'}`}><Icon className="w-4 h-4 stroke-[2]" /></span>
                    {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                    {!isCollapsed && item.tag && <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase bg-[#f0faf6] text-[#008f63] border-[#ccecdf]">{item.tag}</span>}
                    {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-[#08b77a]" />}
                  </button>;
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
      {!isCollapsed && <div className="p-3 border-t border-[#edf2f0]"><div className="rounded-xl bg-[#f7fbf9] border border-[#e2ece8] p-3.5"><div className="flex items-center justify-between text-[10px] mb-2"><span className="text-[#71839a] font-medium">Système</span><span className="flex items-center gap-1.5 text-[#00a86b] font-semibold font-mono"><span className="w-1.5 h-1.5 rounded-full bg-[#08b77a] animate-pulse" />OPÉRATIONNEL</span></div><div className="text-[9px] text-[#9aa9b8] font-mono truncate">IAMTRADER / PERFORMANCE OS</div></div></div>}
    </div>
  );

  return <>
    <aside className={`hidden lg:block shrink-0 transition-all duration-200 ${isCollapsed ? 'w-[4.5rem]' : 'w-60'}`}><div className="fixed top-0 bottom-0 z-40 h-full transition-all duration-200" style={{width:isCollapsed?'4.5rem':'15rem'}}>{sidebarContent}</div></aside>
    {isMobileOpen && <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onCloseMobile}><div className="w-72 h-full max-w-[88vw] shadow-xl" onClick={e=>e.stopPropagation()}>{sidebarContent}</div></div>}
  </>;
}
