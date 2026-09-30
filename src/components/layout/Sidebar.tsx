import React from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  LineChart, 
  ShieldCheck, 
  Wallet, 
  CalendarDays, 
  BrainCircuit, 
  Sliders, 
  ShieldAlert,
  ChevronLeft,
  X,
  Layers,
  Activity
} from 'lucide-react';
import { UserRole } from '../../types';

export type NavigationPage = 
  | 'dashboard' 
  | 'journal' 
  | 'calendar' 
  | 'performance' 
  | 'psychology' 
  | 'trader-score' 
  | 'accounts' 
  | 'settings' 
  | 'admin';

interface SidebarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  userRole?: UserRole;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  currentPage,
  onNavigate,
  userRole,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  // Logical grouping matching FTMO / FundedNext architecture
  const navSections = [
    {
      group: 'PRINCIPAL',
      items: [
        { 
          id: 'dashboard' as NavigationPage, 
          label: 'Dashboard', 
          icon: LayoutDashboard,
          tag: undefined
        },
        { 
          id: 'journal' as NavigationPage, 
          label: 'Journal de Trading', 
          icon: BookOpen,
          tag: undefined
        },
        { 
          id: 'performance' as NavigationPage, 
          label: 'Analyses & Edge', 
          icon: LineChart,
          tag: undefined
        },
        { 
          id: 'trader-score' as NavigationPage, 
          label: 'Trader Score', 
          icon: ShieldCheck,
          tag: 'Pro'
        }
      ]
    },
    {
      group: 'TRADING',
      items: [
        { 
          id: 'accounts' as NavigationPage, 
          label: 'Comptes & Prop Firms', 
          icon: Wallet,
          tag: undefined
        },
        { 
          id: 'calendar' as NavigationPage, 
          label: 'Calendrier P&L', 
          icon: CalendarDays,
          tag: undefined
        },
        { 
          id: 'psychology' as NavigationPage, 
          label: 'Psychologie & Biais', 
          icon: BrainCircuit,
          tag: undefined
        }
      ]
    },
    {
      group: 'ADMINISTRATION',
      isSeparate: true,
      items: [
        ...(userRole === 'admin' ? [
          { 
            id: 'admin' as NavigationPage, 
            label: 'Console Admin', 
            icon: ShieldAlert,
            tag: 'Admin'
          }
        ] : []),
        { 
          id: 'settings' as NavigationPage, 
          label: 'Paramètres', 
          icon: Sliders,
          tag: undefined
        }
      ]
    }
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white border-r border-slate-200/80 select-none">
      {/* Brand Header */}
      <div>
        <div className="h-[72px] flex items-center justify-between px-5 border-b border-slate-200/80 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/15 flex items-center justify-center text-blue-400 font-bold shadow-xs">
              <Activity className="w-4 h-4 stroke-[2.5]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold tracking-tight text-slate-900 text-sm leading-none">
                  IAM<span className="text-blue-500">TRADER</span>
                </span>
                <span className="text-[9px] text-slate-500 font-mono tracking-widest mt-1 uppercase font-semibold">
                  Prop Trading Station
                </span>
              </div>
            )}
          </div>
          
          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
            title={isCollapsed ? "Développer le menu" : "Réduire le menu"}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>

          {/* Mobile close */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Categories */}
        <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          {navSections.map((section, idx) => (
            <div key={section.group} className={section.isSeparate ? 'pt-2 border-t border-slate-200/70' : ''}>
              {!isCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
                  <span>{section.group}</span>
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = currentPage === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        onCloseMobile();
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 text-left relative cursor-pointer group ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm font-semibold'
                          : 'text-slate-500 hover:text-slate-600 hover:bg-slate-100 border border-transparent'
                      }`}
                    >
                      {/* Geometric Icon */}
                      <div className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-600'
                      }`}>
                        <Icon className="w-4 h-4 stroke-[2]" />
                      </div>
                      
                      {!isCollapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}

                      {/* Clean Badge Pill */}
                      {!isCollapsed && item.tag && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                          isActive 
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {item.tag}
                        </span>
                      )}

                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer System Status Card */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-200/80 bg-white">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500 font-medium">Connexion Serveur</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Opérationnel
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate">
              Standard FTMO / Prop 2026
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden lg:block shrink-0 transition-all duration-200 ${
          isCollapsed ? 'w-18' : 'w-60'
        }`}
      >
        <div className="fixed top-0 bottom-0 z-40 h-full transition-all duration-200" style={{ width: isCollapsed ? '4.5rem' : '15rem' }}>
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        >
          <div 
            className="w-68 h-full max-w-[85vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
