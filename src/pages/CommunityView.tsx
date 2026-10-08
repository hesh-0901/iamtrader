import React, { useState } from 'react';
import { Users, MessageCircle, CalendarDays, BookOpen, BarChart3, Activity } from 'lucide-react';
import { EconomicCalendarView } from './EconomicCalendarView';

type CommunityTab = 'chat' | 'calendar' | 'courses' | 'analysis' | 'sentiment';

export function CommunityView() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('chat');

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageCircle },
    { id: 'calendar' as const, label: 'Calendrier', icon: CalendarDays },
    { id: 'courses' as const, label: 'Cours', icon: BookOpen },
    { id: 'analysis' as const, label: 'Analyse', icon: BarChart3 },
    { id: 'sentiment' as const, label: 'Trader Sentiment', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 pb-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8f8f3] text-[#00a982]">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-[#0b1f35]">Community</h1>
                <span className="rounded-full bg-[#eef7f4] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#008f72]">Bientôt</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                L’espace Community d’IAMTRADER centralisera les échanges, le calendrier économique, les cours, les analyses et le sentiment des traders.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 px-3 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#0b1f35] text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-[#0b1f35]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === 'calendar' && <EconomicCalendarView />}

      {activeTab === 'chat' && (
        <Placeholder title="Chat" icon={MessageCircle} text="Un espace de discussion dédié aux traders IAMTRADER." />
      )}
      {activeTab === 'courses' && (
        <Placeholder title="Cours" icon={BookOpen} text="Les cours et ressources pédagogiques seront regroupés ici." />
      )}
      {activeTab === 'analysis' && (
        <Placeholder title="Analyse" icon={BarChart3} text="Les analyses de marché et idées de trading seront regroupées ici." />
      )}
      {activeTab === 'sentiment' && (
        <Placeholder title="Trader Sentiment" icon={Activity} text="Le sentiment des traders et les indicateurs de positionnement seront disponibles ici." />
      )}
    </div>
  );
}

function Placeholder({ title, icon: Icon, text }: { title: string; icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-[#00a982]">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-base font-black text-[#0b1f35]">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{text}</p>
        <span className="mt-4 rounded-full bg-[#eef7f4] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#008f72]">
          En préparation
        </span>
      </div>
    </div>
  );
}
