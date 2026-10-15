import React, { useState } from 'react';
import { MessageCircle, CalendarDays, BookOpen, BarChart3, Activity, Database, BrainCircuit, Share2, CheckCircle2 } from 'lucide-react';
import { EconomicCalendarView } from './EconomicCalendarView';
import { ChatView } from './ChatView';
import { UserProfile } from '../types';

type CommunityTab = 'chat' | 'calendar' | 'courses' | 'analysis' | 'sentiment' | 'economic-data';

export function CommunityView({ userProfile }: { userProfile: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<CommunityTab>('chat');
  const isAdmin = userProfile?.role === 'admin';

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageCircle },
    { id: 'calendar' as const, label: 'Calendrier', icon: CalendarDays },
    { id: 'courses' as const, label: 'Cours', icon: BookOpen },
    { id: 'analysis' as const, label: 'Analyse', icon: BarChart3 },
    { id: 'sentiment' as const, label: 'Trader Sentiment', icon: Activity },
    ...(isAdmin ? [{ id: 'economic-data' as const, label: 'Analyse économique data', icon: Database }] : []),
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
      {activeTab === 'economic-data' && isAdmin && <EconomicDataProgress />}
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


function EconomicDataProgress() {
  const stages = [
    {
      number: '01',
      title: 'Collecte des données',
      description: 'Récupérer les événements et chiffres économiques depuis les sources configurées, contrôler leur disponibilité et leur fraîcheur.',
      icon: Database,
      outputs: 'Sources, événements, valeurs réelles, prévisions et précédents',
    },
    {
      number: '02',
      title: 'Analyse économique',
      description: 'Interpréter les publications, les surprises économiques et leurs implications potentielles pour les devises et les actifs suivis.',
      icon: BrainCircuit,
      outputs: 'Analyse macroéconomique structurée et biais argumentés',
    },
    {
      number: '03',
      title: 'Stockage des résultats',
      description: 'Conserver les données collectées, les analyses produites, leur date de génération et les références des sources.',
      icon: CheckCircle2,
      outputs: 'Historique consultable et résultats traçables',
    },
    {
      number: '04',
      title: 'Distribution',
      description: 'Rendre les résultats accessibles dans IAMTRADER et préparer leur diffusion aux traders selon les canaux retenus.',
      icon: Share2,
      outputs: 'Calendrier, espace d’analyse et éventuelles notifications',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#eef7f4] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#008f72]">
              <Database className="h-3.5 w-3.5" />
              Espace réservé à l’administration
            </div>
            <h2 className="text-xl font-black tracking-tight text-[#0b1f35] sm:text-2xl">Analyse économique data</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Tableau de suivi du pipeline de données économiques : collecte, analyse, stockage et distribution.
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
            Suivi à initialiser
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {stages.map(({ number, title, description, icon: Icon, outputs }) => (
          <section key={number} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[#008f72]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest text-slate-400">ÉTAPE {number}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">À suivre</span>
                </div>
                <h3 className="mt-2 text-base font-extrabold text-[#0b1f35]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Résultat attendu</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{outputs}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900">
        Cette première version présente les quatre étapes de travail. Les statuts, les notes de progression et leur sauvegarde persistante pourront être ajoutés dans une étape dédiée ; aucun avancement n’est enregistré automatiquement pour l’instant.
      </div>
    </div>
  );
}
