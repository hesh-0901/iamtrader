import React, { useEffect, useState } from 'react';
import { MessageCircle, CalendarDays, BookOpen, BarChart3, Activity, Database, BrainCircuit, Share2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { EconomicCalendarView } from './EconomicCalendarView';
import { ChatView } from './ChatView';
import { UserProfile } from '../types';
import { CourseSpace } from './CourseSpace';
import { AnalysisAdminPanel } from './AnalysisAdminPanel';

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
      {activeTab === 'courses' && <CourseSpace isAdmin={isAdmin} />}
      {activeTab === 'analysis' && (
        <AnalysisAdminPanel isAdmin={isAdmin} />
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



type CalendarDiagnostics = {
  events?: Array<Record<string, unknown>>;
  source?: string;
  diagnostics?: string[];
  configuration?: string;
  fetchedAt?: string;
  error?: string;
};

function EconomicDataProgress() {
  const [calendar, setCalendar] = useState<CalendarDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    let mounted = true;
    let activeRequest = false;
    const load = async () => {
      if (activeRequest) return;
      activeRequest = true;
      try {
        const now = new Date();
        const from = new Date(now);
        from.setDate(now.getDate() - 7);
        const to = new Date(now);
        to.setDate(now.getDate() + 13);
        const date = (value: Date) => value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
        const response = await fetch('/api/economic-calendar?from=' + date(from) + '&to=' + date(to) + '&limit=500&calendarVersion=admin-progress-v1', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const payload = await response.json() as CalendarDiagnostics;
        if (!response.ok) throw new Error(payload.error || ('Erreur HTTP ' + response.status));
        if (mounted) {
          setCalendar(payload);
          setRequestError('');
          setLastChecked(new Date().toISOString());
        }
      } catch (error) {
        if (mounted) {
          setRequestError(error instanceof Error ? error.message : 'Calendrier économique inaccessible.');
          setLastChecked(new Date().toISOString());
        }
      } finally {
        activeRequest = false;
        if (mounted) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, []);

  const events = Array.isArray(calendar?.events) ? calendar.events : [];
  const actualCount = events.filter(event => {
    const value = event.actual ?? event.result;
    return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-' && String(value).trim() !== '—';
  }).length;
  const missingActualCount = Math.max(0, events.length - actualCount);
  const collectionProgress = requestError ? 0 : events.length > 0 ? 100 : calendar ? 50 : 0;
  const collectionStatus = requestError ? 'Erreur' : loading && !calendar ? 'Vérification' : events.length > 0 ? 'Flux disponible' : 'À vérifier';

  const stages = [
    {
      id: 'collection', number: '01', title: 'Collecte des données', icon: Database,
      description: 'Récupération du calendrier économique et vérification de la disponibilité du flux.',
      status: collectionStatus,
      state: requestError || (events.length + ' événement(s) reçus · ' + actualCount + ' valeur(s) réelle(s) présente(s) · ' + missingActualCount + ' valeur(s) réelle(s) absente(s).'),
      progress: collectionProgress, progressLabel: requestError ? 'Flux indisponible' : events.length > 0 ? 'Réponse du flux reçue' : loading ? 'Contrôle en cours' : 'Aucun événement reçu',
      detail: 'Source déclarée par l’API : ' + (calendar?.source || 'inconnue') + '.',
    },
    {
      id: 'analysis', number: '02', title: 'Analyse économique', icon: BrainCircuit,
      description: 'Production d’interprétations macroéconomiques et de biais argumentés.',
      status: 'Non instrumenté',
      state: 'Aucune télémétrie disponible pour confirmer les analyses produites ou leur volume.',
      progress: null, progressLabel: 'Progression non mesurée',
      detail: 'Aucun pourcentage ne sera affiché sans indicateur réel du moteur d’analyse.',
    },
    {
      id: 'storage', number: '03', title: 'Stockage des résultats', icon: CheckCircle2,
      description: 'Conservation des données collectées et des analyses avec leur historique.',
      status: 'Non instrumenté',
      state: 'Aucun indicateur fiable ne confirme les écritures et l’historique réellement stocké.',
      progress: null, progressLabel: 'Progression non mesurée',
      detail: 'La réception des données par le calendrier ne prouve pas leur archivage durable.',
    },
    {
      id: 'distribution', number: '04', title: 'Distribution', icon: Share2,
      description: 'Mise à disposition des résultats dans IAMTRADER et diffusion aux utilisateurs.',
      status: 'Non instrumenté',
      state: 'Aucune mesure ne confirme la publication ou la livraison des analyses.',
      progress: null, progressLabel: 'Progression non mesurée',
      detail: 'La progression sera mesurable lorsque les indicateurs de publication seront exposés.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#eef7f4] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#008f72]">
              <Database className="h-3.5 w-3.5" /> Espace réservé à l’administration
            </div>
            <h2 className="text-xl font-black tracking-tight text-[#0b1f35] sm:text-2xl">Analyse économique data</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Tableau de bord en lecture seule : statut, état actuel et barre de progression mesurable.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">Actualisation automatique · 60 s</span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Événements reçus" value={calendar ? String(events.length) : '—'} />
          <SummaryMetric label="Valeurs réelles présentes" value={calendar ? String(actualCount) : '—'} />
          <SummaryMetric label="Dernière vérification" value={lastChecked ? new Date(lastChecked).toLocaleTimeString('fr-FR') : '—'} />
        </div>
      </div>

      {requestError && <div role="status" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Collecte non confirmée.</strong> {requestError}</div></div>}

      <div className="grid gap-4 xl:grid-cols-2">
        {stages.map(({ id, number, title, description, icon: Icon, status, state, progress, progressLabel, detail }) => (
          <section key={id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[#008f72]"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest text-slate-400">ÉTAPE {number}</span>
                  <span className={'rounded-full px-2.5 py-1 text-[10px] font-bold ' + (status === 'Erreur' ? 'bg-rose-100 text-rose-700' : status === 'Flux disponible' ? 'bg-emerald-100 text-emerald-700' : status === 'Vérification' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}>{status}</span>
                </div>
                <h3 className="mt-2 text-base font-extrabold text-[#0b1f35]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">État actuel</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{state}</p>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-600">Progression</span>
                <span className="text-xs font-bold text-slate-500">{progress === null ? 'Non mesurée' : progress + '%'}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={'Progression : ' + title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === null ? undefined : progress} aria-valuetext={progress === null ? 'Progression non mesurée' : progress + '%'}>
                {progress !== null && <div className={'h-full rounded-full transition-all duration-500 ' + (progress === 0 ? 'bg-rose-500' : 'bg-[#00a982]')} style={{ width: progress + '%' }} />}
              </div>
              <p className="mt-2 text-xs text-slate-500">{progressLabel}</p>
            </div>
            <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">{detail}</p>
          </section>
        ))}
      </div>

      {calendar?.diagnostics?.length ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-xs font-bold text-slate-600">Détails techniques de la collecte</summary>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">{calendar.diagnostics.map((line, index) => <li key={index}>{line}</li>)}</ul>
          {calendar.fetchedAt && <p className="mt-3 text-[10px] text-slate-400">Réponse API datée du {new Date(calendar.fetchedAt).toLocaleString('fr-FR')}</p>}
          {calendar.configuration && <p className="mt-2 text-xs text-amber-700">{calendar.configuration}</p>}
        </details>
      ) : null}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-lg font-black tabular-nums text-[#0b1f35]">{value}</p></div>;
}
