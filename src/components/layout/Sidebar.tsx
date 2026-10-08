import React from 'react';
import { LayoutDashboard, BookOpen, LineChart, ShieldCheck, Wallet, CalendarDays, BrainCircuit, Sliders, ShieldAlert, ChevronLeft, X, Users } from 'lucide-react';
import { UserRole } from '../../types';

export type NavigationPage = 'dashboard' | 'journal' | 'calendar' | 'performance' | 'psychology' | 'trader-score' | 'accounts' | 'history' | 'community' | 'settings' | 'admin';

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
      { id: 'psychology' as NavigationPage, label: 'Psychologie & Biais', icon: BrainCircuit },
      { id: 'community' as NavigationPage, label: 'Community', icon: Users, tag: 'BETA' }
    ]},
    { group: 'Système', items: [
      ...(userRole === 'admin' ? [{ id: 'admin' as NavigationPage, label: 'Console Admin', icon: ShieldAlert, tag: 'ADMIN' }] : []),
      { id: 'settings' as NavigationPage, label: 'Paramètres', icon: Sliders }
    ]}
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-[#0A192F] border-r border-[#19324D] select-none">
      <div>
        <div className="h-[78px] flex items-center justify-between px-5 border-b border-[#19324D] bg-[#0A192F]">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={isCollapsed ? '/brand/logo-iamtrader-symbol-white.png' : '/brand/logo-iamtrader-full-white.png'}
              alt="IAMTRADER"
              className={isCollapsed ? 'w-10 h-10 object-contain shrink-0' : 'w-[142px] h-auto max-h-11 object-contain object-left shrink-0'}
            />
          </div>
          <button onClick={onToggleCollapse} className="hidden lg:flex p-1.5 text-[#8EA3B8] hover:text-white rounded-lg hover:bg-[#132B47] transition-all cursor-pointer" title={isCollapsed ? 'Développer le menu' : 'Réduire le menu'}><ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} /></button>
          <button onClick={onCloseMobile} className="lg:hidden p-1.5 text-[#8EA3B8] hover:text-white rounded-lg hover:bg-[#132B47] cursor-pointer" aria-label="Fermer le menu"><X className="w-5 h-5" /></button>
        </div>
        <nav className="px-3 py-5 space-y-7 overflow-y-auto max-h-[calc(100vh-150px)]">
          {navSections.map(section => (
            <div key={section.group}>
              {!isCollapsed && <div className="px-3 mb-2.5 text-[9px] font-bold tracking-[.16em] text-[#7F96AC] uppercase">{section.group}</div>}
              <div className="space-y-1">
                {section.items.map(item => {
                  const isActive = currentPage === item.id;
                  const Icon = item.icon;
                  return <button key={item.id} onClick={() => { onNavigate(item.id); onCloseMobile(); }} title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12.5px] font-medium transition-all duration-150 text-left relative cursor-pointer group ${isActive ? 'bg-[#123A3A] text-[#5BE2BE] border border-[#1D6659]' : 'text-[#A8BACB] hover:text-white hover:bg-[#102D49] border border-transparent'}`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-[#0F2A42] text-[#00C796] shadow-sm' : 'text-[#8299AF] group-hover:text-white'}`}><Icon className="w-4 h-4 stroke-[2]" /></span>
                    {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                    {!isCollapsed && item.tag && <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase bg-[#123A3A] text-[#5BE2BE] border-[#1D6659]">{item.tag}</span>}
                    {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-[#00C796]" />}
                  </button>;
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
      {!isCollapsed && <div className="p-3 border-t border-[#19324D]"><div className="rounded-xl bg-[#102B46] border border-[#1C405F] p-3.5"><div className="flex items-center justify-between text-[10px] mb-2"><span className="text-[#9DB0C2] font-medium">Système</span><span className="flex items-center gap-1.5 text-[#5BE2BE] font-semibold font-mono"><span className="w-1.5 h-1.5 rounded-full bg-[#00C796] animate-pulse" />OPÉRATIONNEL</span></div><div className="text-[9px] text-[#70879D] font-mono truncate">IAMTRADER / PERFORMANCE OS</div></div></div>}
    </div>
  );

  return <>
    <aside className={`hidden lg:block shrink-0 transition-all duration-200 ${isCollapsed ? 'w-[4.5rem]' : 'w-60'}`}><div className="fixed top-0 bottom-0 z-40 h-full transition-all duration-200" style={{width:isCollapsed?'4.5rem':'15rem'}}>{sidebarContent}</div></aside>
    {isMobileOpen && <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onCloseMobile}><div className="w-72 h-full max-w-[88vw] shadow-xl" onClick={e=>e.stopPropagation()}>{sidebarContent}</div></div>}
  </>;
}
