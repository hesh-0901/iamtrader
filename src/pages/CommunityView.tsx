import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
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


type StageStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
type StageProgress = { status: StageStatus; note: string; updatedAt?: string; updatedBy?: string };
type ProgressMap = Record<string, StageProgress>;

const DEFAULT_PROGRESS: ProgressMap = {
  collection: { status: 'todo', note: '' },
  analysis: { status: 'todo', note: '' },
  storage: { status: 'todo', note: '' },
  distribution: { status: 'todo', note: '' },
};
const STATUS_OPTIONS: { value: StageStatus; label: string }[] = [
  { value: 'todo', label: 'À faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
  { value: 'blocked', label: 'Bloqué' },
];

function EconomicDataProgress() {
  const [progress, setProgress] = useState<ProgressMap>(DEFAULT_PROGRESS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!auth.currentUser) {
      setError('Session administrateur introuvable. Reconnecte-toi puis réessaie.');
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'economicDataProgress', 'main'), snapshot => {
      if (snapshot.exists()) {
        setProgress({ ...DEFAULT_PROGRESS, ...(snapshot.data().stages || {}) });
      }
      setLoading(false);
      setError('');
    }, err => {
      console.error('Economic data progress read failed:', err);
      setError('Lecture impossible. Vérifie les règles Firestore et les droits administrateur.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  function editStage(id: string, patch: Partial<StageProgress>) {
    setProgress(current => ({
      ...current,
      [id]: { ...(current[id] || { status: 'todo', note: '' }), ...patch },
    }));
    setMessage('');
  }

  async function saveStage(id: string) {
    const user = auth.currentUser;
    if (!user || saving) return;
    setSaving(id);
    setError('');
    setMessage('');
    try {
      const updatedAt = new Date().toISOString();
      await setDoc(doc(db, 'economicDataProgress', 'main'), {
        stages: { [id]: { ...progress[id], updatedAt, updatedBy: user.uid } },
        updatedAt,
        updatedBy: user.uid,
      }, { merge: true });
      setMessage('Progression enregistrée dans Firestore.');
    } catch (err) {
      console.error('Economic data progress save failed:', err);
      setError('Enregistrement refusé. Vérifie que les règles Firestore sont déployées.');
    } finally {
      setSaving(null);
    }
  }

  const stages = [
    { id: 'collection', number: '01', title: 'Collecte des données', description: 'Récupérer les événements et chiffres économiques, puis contrôler leur disponibilité et leur fraîcheur.', outputs: 'Sources, événements, valeurs réelles, prévisions et précédents', icon: Database },
    { id: 'analysis', number: '02', title: 'Analyse économique', description: 'Interpréter les publications, les surprises économiques et leurs implications potentielles pour les devises et actifs suivis.', outputs: 'Analyse macroéconomique structurée et biais argumentés', icon: BrainCircuit },
    { id: 'storage', number: '03', title: 'Stockage des résultats', description: 'Conserver les données collectées, les analyses, leurs dates de génération et les références des sources.', outputs: 'Historique consultable et résultats traçables', icon: CheckCircle2 },
    { id: 'distribution', number: '04', title: 'Distribution', description: 'Rendre les résultats accessibles dans IAMTRADER et préparer leur diffusion aux traders.', outputs: 'Calendrier, espace d’analyse et notifications éventuelles', icon: Share2 },
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
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Suivi du pipeline : collecte, analyse, stockage et distribution.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Suivi de progression</span>
        </div>
      </div>
      {loading && <p className="text-sm text-slate-500">Chargement de la progression enregistrée…</p>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      <div className="grid gap-4 xl:grid-cols-2">
        {stages.map(({ id, number, title, description, outputs, icon: Icon }) => {
          const stage = progress[id] || { status: 'todo' as const, note: '' };
          const statusLabel = STATUS_OPTIONS.find(option => option.value === stage.status)?.label || 'À faire';
          return (
            <section key={id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[#008f72]"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black tracking-widest text-slate-400">ÉTAPE {number}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{statusLabel}</span>
                  </div>
                  <h3 className="mt-2 text-base font-extrabold text-[#0b1f35]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Résultat attendu</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{outputs}</p>
              </div>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-slate-700">Statut
                  <select value={stage.status} onChange={event => editStage(id, { status: event.target.value as StageStatus })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-[#00a982]">
                    {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-700">Notes de progression
                  <textarea value={stage.note} onChange={event => editStage(id, { note: event.target.value })} rows={3} maxLength={3000} placeholder="Travail réalisé, problème rencontré, prochaine action…" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-[#00a982]" />
                </label>
                <button type="button" onClick={() => void saveStage(id)} disabled={loading || saving !== null} className="inline-flex items-center justify-center rounded-xl bg-[#0b1f35] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#163653] disabled:cursor-not-allowed disabled:opacity-50">
                  {saving === id ? 'Enregistrement…' : 'Enregistrer la progression'}
                </button>
                {stage.updatedAt && <p className="text-[10px] text-slate-400">Dernière mise à jour : {new Date(stage.updatedAt).toLocaleString('fr-FR')}</p>}
              </div>
            </section>
          );
        })}
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900">Les statuts et notes sont sauvegardés dans Firestore pour retrouver la progression lors des prochaines connexions. Chaque étape se sauvegarde séparément.</div>
    </div>
  );
}
