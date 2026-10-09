import React, { useState } from 'react';
import { MessageCircle, CalendarDays, BookOpen, BarChart3, Activity } from 'lucide-react';
import { EconomicCalendarView } from './EconomicCalendarView';
import { ChatView } from './ChatView';
import { UserProfile } from '../types';

type CommunityTab = 'chat' | 'calendar' | 'courses' | 'analysis' | 'sentiment';

export function CommunityView({ userProfile }: { userProfile: UserProfile | null }) {
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
      <div className="border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-all ${isActive ? 'border-[#00a982] text-[#0b1f35]' : 'border-transparent text-slate-500 hover:text-[#0b1f35]'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'calendar' && <EconomicCalendarView />}

      {activeTab === 'chat' && <ChatView userProfile={userProfile} />}
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
