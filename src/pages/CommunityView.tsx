import React, { useEffect, useState } from 'react';
import { MessageCircle, CalendarDays, BookOpen, BarChart3, Activity, Database, BrainCircuit, Share2, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Users, ShieldCheck } from 'lucide-react';
import { EconomicCalendarView } from './EconomicCalendarView';
import { ChatView } from './ChatView';
import { UserProfile } from '../types';
import { CourseSpace } from './CourseSpace';
import { AnalysisAdminPanel } from './AnalysisAdminPanel';

type CommunityTab = 'home' | 'chat' | 'calendar' | 'courses' | 'analysis' | 'sentiment' | 'economic-data';

export function CommunityView({ userProfile }: { userProfile: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<CommunityTab>('home');
  const isAdmin = userProfile?.role === 'admin';

  const tabs = [
    { id: 'home' as const, label: 'Accueil', icon: Sparkles },
    { id: 'chat' as const, label: 'PipTalk', icon: MessageCircle },
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

      {activeTab === 'home' && (
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(11,31,53,0.07)]">
          <div className="relative isolate overflow-hidden bg-[#0b1f35] px-5 py-8 sm:px-9 sm:py-11">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#00a982]/20 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative grid gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] md:items-center">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" />
                  IAMTRADER · COMMUNITY
                </div>
                <h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">Le trading progresse mieux <span className="text-emerald-300">ensemble.</span></h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">Retrouve la communauté IAMTRADER, échange avec les autres traders, partage tes idées et accède aux ressources utiles pour affiner ton analyse des marchés.</p>
                <button type="button" onClick={() => setActiveTab('chat')} className="mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#00c49a] px-5 py-3 text-sm font-extrabold text-[#062b2a] shadow-[0_8px_24px_rgba(0,196,154,.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-[#0b1f35]">
                  <MessageCircle className="h-4 w-4" /> Entrer dans PipTalk <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mx-auto w-full max-w-sm">
                <div className="absolute inset-5 rounded-[30px] bg-emerald-400/15 blur-2xl" />
                <div className="relative rounded-[26px] border border-white/15 bg-white/[0.08] p-4 shadow-2xl backdrop-blur-sm sm:p-5">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300 text-[#0b1f35]"><Users className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-white">Community Hub</p><p className="mt-0.5 text-xs text-slate-300">Le point de rencontre des traders</p></div>
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  </div>
                  <div className="space-y-3 py-4">
                    <div className="flex items-start gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-black text-cyan-800">CO</div><div className="rounded-2xl rounded-tl-md bg-white/10 px-3 py-2.5"><p className="text-[10px] font-bold text-emerald-200">Community Hub</p><p className="mt-1 text-xs leading-5 text-white">Bienvenue dans l’espace communautaire.</p></div></div>
                    <div className="flex items-start justify-end gap-2.5"><div className="rounded-2xl rounded-tr-md bg-emerald-300 px-3 py-2.5"><p className="text-xs leading-5 text-[#0b1f35]">On partage nos analyses et on apprend ensemble.</p></div><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"><MessageCircle className="h-4 w-4" /></div></div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-xs text-slate-300"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Un espace pour échanger et progresser</div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-7">
            <div className="mb-4 flex flex-col gap-1 sm:mb-5"><h2 className="text-lg font-black tracking-tight text-[#0b1f35]">Explore ton espace</h2><p className="text-sm text-slate-500">Choisis où poursuivre ton apprentissage et tes échanges.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { id: 'chat' as const, title: 'PipTalk', description: 'Discute et partage avec la communauté.', icon: MessageCircle, tint: 'bg-emerald-50 text-emerald-700' },
                { id: 'calendar' as const, title: 'Calendrier économique', description: 'Repère les événements qui peuvent influencer les marchés.', icon: CalendarDays, tint: 'bg-blue-50 text-blue-700' },
                { id: 'courses' as const, title: 'Espace cours', description: 'Retrouve les ressources de formation disponibles.', icon: BookOpen, tint: 'bg-violet-50 text-violet-700' },
                { id: 'analysis' as const, title: 'Analyses de marché', description: 'Consulte les scénarios publiés par la communauté.', icon: BarChart3, tint: 'bg-amber-50 text-amber-700' },
                { id: 'sentiment' as const, title: 'Trader Sentiment', description: 'Accède à l’espace de sentiment des traders.', icon: Activity, tint: 'bg-rose-50 text-rose-700' },
                ...(isAdmin ? [{ id: 'economic-data' as const, title: 'Analyse économique data', description: 'Consulte les diagnostics de collecte.', icon: Database, tint: 'bg-slate-100 text-slate-700' }] : [])
              ].map(({ id, title, description, icon: Icon, tint }) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)} className="group flex min-h-[132px] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-900/5 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-[#0b1f35]">{title}</span><span className="mt-1.5 block text-xs leading-5 text-slate-500">{description}</span><span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#008f72]">Explorer <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" /></span></span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

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
