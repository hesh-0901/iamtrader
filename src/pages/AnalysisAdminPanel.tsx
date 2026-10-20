import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Plus, Pencil, X, ExternalLink, Save, LoaderCircle, Trash2, Bold, Italic, Heading2, List, ListOrdered, Quote, Minus, TrendingUp, Activity, Compass, Layers3, Clock3, Target, Crosshair, ShieldCheck, CheckCircle2, Gauge } from 'lucide-react';
import { auth, db } from '../firebase/config';

type Status = 'draft' | 'published' | 'closed';
type Direction = 'BUY' | 'SELL';
type SetupGrade = 'A+' | 'A' | 'B' | 'C' | 'D';
type Bias = 'Haussier' | 'Baissier' | 'Neutre' | 'En attente';
type OutcomeStatus = 'En cours' | 'Sortie manuelle' | 'Stop touché' | 'TP touché' | 'BE' | 'Zone non touchée';
type ClosureStatus = 'Clôturer' | 'Laisser courir';
type MarketPhase = 'Accumulation' | 'Expansion' | 'Distribution' | 'Retracement' | 'Consolidation' | 'Reversal' | 'En attente';
type Analysis = {
  id: string; asset?: string; tradingViewUrl: string; afterAnalysisUrl?: string; outcomeStatus?: OutcomeStatus; exitPrice?: number; closureStatus?: ClosureStatus; entryPrice: number; stopLoss: number;
  takeProfit: number; direction: Direction; setup: string; setupGrade?: SetupGrade; dailyBias?: Bias; htfBias?: Bias; entryBias?: Bias; htf?: string; ltf?: string; marketPhase?: MarketPhase; session?: string; liquidityTarget?: string; poi?: string; confirmation?: string; invalidation?: string; notes: string; status: Status;
  createdAt?: { toDate?: () => Date } | string;
};
type FormState = {
  tradingViewUrl: string; afterAnalysisUrl: string; outcomeStatus: OutcomeStatus | ''; exitPrice: string; closureStatus: ClosureStatus | ''; direction: Direction; entryPrice: string; stopLoss: string;
  takeProfit: string; setup: string; setupGrade: SetupGrade; dailyBias: Bias; htfBias: Bias; entryBias: Bias; htf: string; ltf: string; marketPhase: MarketPhase; session: string; liquidityTarget: string; poi: string; confirmation: string; invalidation: string; notes: string; status: Status;
};
const blank: FormState = { tradingViewUrl: '', afterAnalysisUrl: '', outcomeStatus: '', exitPrice: '', closureStatus: '', direction: 'BUY', entryPrice: '', stopLoss: '', takeProfit: '', setup: '', setupGrade: 'A', dailyBias: 'En attente', htfBias: 'En attente', entryBias: 'En attente', htf: 'H4', ltf: 'M15', marketPhase: 'En attente', session: '', liquidityTarget: '', poi: '', confirmation: '', invalidation: '', notes: '', status: 'published' };

function validTradingViewUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'tradingview.com' || url.hostname.endsWith('.tradingview.com'));
  } catch { return false; }
}
function tradingViewSnapshotImageUrl(value: string) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/x\/([A-Za-z0-9]+)\/?$/);
    if (url.hostname !== 'www.tradingview.com' || !match) return '';
    const snapshotId = match[1];
    return `https://s3.tradingview.com/snapshots/${snapshotId.charAt(0).toLowerCase()}/${snapshotId}.png`;
  } catch {
    return '';
  }
}
function formatNotes(value: string) {
  const inline = (text: string, key: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={key + index} className="font-extrabold text-[#0b1f35]">{part.slice(2, -2)}</strong>;
      if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) return <em key={key + index} className="italic text-slate-700">{part.slice(1, -1)}</em>;
      return part;
    });
  };
  return <div className="space-y-3 text-sm leading-[1.25rem] text-slate-600 sm:text-[15px] sm:leading-[1.3rem]">
    {value.split(/\r?\n/).map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={index} className="h-1" />;
      if (/^#{1,3}\s/.test(trimmed)) {
        const level = trimmed.match(/^#+/)?.[0].length ?? 1;
        const heading = trimmed.replace(/^#{1,3}\s+/, '');
        return <h4 key={index} className={level === 1 ? "mt-4 border-b border-slate-100 pb-2 text-base font-black leading-5 tracking-tight text-[#0b1f35] sm:text-lg sm:leading-5" : "mt-3 text-sm font-extrabold leading-5 text-[#008f72]"}>{inline(heading, 'h' + index)}</h4>;
      }
      if (/^[-*]\s/.test(trimmed)) return <div key={index} className="flex items-start gap-3 pl-1"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#00a982]" /><div className="min-w-0 flex-1">{inline(trimmed.slice(2), 'l' + index)}</div></div>;
      if (/^\d+[.)]\s/.test(trimmed)) return <div key={index} className="flex items-start gap-3 pl-1"><span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 px-1.5 text-[11px] font-extrabold text-[#008f72]">{trimmed.match(/^\d+[.)]/)?.[0].replace(/[.)]/g, '')}</span><div className="min-w-0 flex-1">{inline(trimmed.replace(/^\d+[.)]\s+/, ''), 'n' + index)}</div></div>;
      if (trimmed.startsWith('&gt; ')) return <blockquote key={index} className="rounded-r-lg border-l-2 border-[#00a982] bg-emerald-50/60 px-4 py-3 font-medium text-[#0b1f35]">{inline(trimmed.slice(5), 'q' + index)}</blockquote>;
      return <p key={index} className="whitespace-normal">{inline(trimmed, 'p' + index)}</p>;
    })}
  </div>;
}
function dateKey(value: Analysis['createdAt']) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().toLocaleDateString('en-CA');
  if (typeof value === 'string') return new Date(value).toLocaleDateString('en-CA');
  return '';
}
function formatDate(value: Analysis['createdAt']) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().toLocaleString('fr-FR');
  if (typeof value === 'string') return new Date(value).toLocaleString('fr-FR');
  return 'Date indisponible';
}
function plannedRR(item: Analysis) {
  const risk = Math.abs(Number(item.entryPrice) - Number(item.stopLoss));
  const reward = Math.abs(Number(item.takeProfit) - Number(item.entryPrice));
  return risk > 0 ? reward / risk : null;
}
function realizedR(item: Analysis) {
  const risk = Math.abs(Number(item.entryPrice) - Number(item.stopLoss));
  if (!risk || !item.outcomeStatus) return null;
  if (item.outcomeStatus === 'Stop touché') return -1;
  if (item.outcomeStatus === 'BE') return 0;
  if (item.outcomeStatus === 'TP touché') return plannedRR(item);
  if (item.outcomeStatus === 'Zone non touchée' || item.outcomeStatus === 'En cours') return null;
  if (item.outcomeStatus === 'Sortie manuelle' && Number(item.exitPrice) > 0) return ((Number(item.exitPrice) - Number(item.entryPrice)) * (item.direction === 'BUY' ? 1 : -1)) / risk;
  return null;
}

export function AnalysisAdminPanel({ isAdmin = true }: { isAdmin?: boolean }) {
  const [items, setItems] = useState<Analysis[]>([]);
  const [form, setForm] = useState<FormState>(blank);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [postAnalysisModalOpen, setPostAnalysisModalOpen] = useState(false);
  const [postAnalysisItemId, setPostAnalysisItemId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [explanationItem, setExplanationItem] = useState<Analysis | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Pour les membres, éviter la requête composée status + createdAt qui exige
    // un index Firestore composite. Le tri est effectué côté client.
    const q = isAdmin
      ? query(collection(db, 'dailyAnalyses'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'dailyAnalyses'), where('status', 'in', ['published', 'closed']));
    return onSnapshot(q, snapshot => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Analysis));
      const visible = isAdmin ? all : all.filter(a => a.status === 'published' || a.status === 'closed');
      visible.sort((a, b) => {
        const toMillis = (value: Analysis['createdAt']) => {
          if (value && typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().getTime();
          if (typeof value === 'string') return new Date(value).getTime();
          return 0;
        };
        return toMillis(b.createdAt) - toMillis(a.createdAt);
      });
      setItems(visible);
      setLoading(false);
      setError('');
    }, err => {
      console.error('[dailyAnalyses] Firestore read failed:', err.code, err.message);
      setError(err.code === 'permission-denied'
        ? 'Lecture refusée par Firestore. Vérifiez les règles et le rôle du compte.'
        : err.code === 'failed-precondition'
          ? 'Index Firestore requis. Consultez le lien fourni dans la console.'
          : `Impossible de charger les analyses (${err.code || 'erreur inconnue'}).`);
      setLoading(false);
    });
  }, [isAdmin]);

  const todayCount = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return items.filter(a => a.status === 'published' && a.createdAt && dateKey(a.createdAt) === today).length;
  }, [items]);

  const openCreate = () => { setForm(blank); setEditingId(null); setActiveStep(0); setPostAnalysisModalOpen(false); setError(''); setSuccess(''); setModalOpen(true); };
  const openEdit = (item: Analysis) => {
    setActiveStep(0); setPostAnalysisModalOpen(false);
    setForm({ tradingViewUrl: item.tradingViewUrl || '', afterAnalysisUrl: item.afterAnalysisUrl || '', outcomeStatus: item.outcomeStatus || '', exitPrice: item.exitPrice == null ? '' : String(item.exitPrice), closureStatus: item.closureStatus || '', direction: item.direction || 'BUY',
      entryPrice: String(item.entryPrice ?? ''), stopLoss: String(item.stopLoss ?? ''),
      takeProfit: String(item.takeProfit ?? ''), setup: item.setup || '', setupGrade: item.setupGrade || 'A', dailyBias: item.dailyBias || 'En attente', htfBias: item.htfBias || 'En attente', entryBias: item.entryBias || 'En attente', htf: item.htf || 'H4', ltf: item.ltf || 'M15', marketPhase: item.marketPhase || 'En attente', session: item.session || '', liquidityTarget: item.liquidityTarget || '', poi: item.poi || '', confirmation: item.confirmation || '', invalidation: item.invalidation || '', notes: item.notes || '',
      status: item.status || 'draft' });
    setEditingId(item.id); setError(''); setSuccess(''); setModalOpen(true);
  };
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (!isAdmin) return;
    if (!auth.currentUser) { setError('Votre session a expiré. Reconnectez-vous.'); return; }
    if (!validTradingViewUrl(form.tradingViewUrl.trim())) { setError('Ajoutez un lien TradingView valide en HTTPS.'); return; }
    const entry = Number(form.entryPrice), sl = Number(form.stopLoss), tp = Number(form.takeProfit);
    if (![entry, sl, tp].every(n => Number.isFinite(n) && n > 0)) { setError('Le PE, le SL et le TP doivent être des prix supérieurs à zéro.'); return; }
    if ((form.direction === 'BUY' && !(sl < entry && entry < tp)) || (form.direction === 'SELL' && !(tp < entry && entry < sl))) {
      setError('Niveaux incohérents : BUY exige SL < PE < TP ; SELL exige TP < PE < SL.'); return;
    }
    if (!form.setup.trim()) { setError('Renseignez le setup de trading.'); return; }
    if ((form.outcomeStatus === 'BE' || form.outcomeStatus === 'Sortie manuelle') && !(Number(form.exitPrice) > 0)) { setError('Indiquez un prix de sortie valide pour un BE ou une sortie manuelle.'); return; }
    if (form.status === 'published' && !editingId && todayCount >= 2) { setError('Deux analyses sont déjà publiées aujourd’hui.'); return; }
    setSaving(true); setError(''); setSuccess('');
    const payload = { asset: 'XAUUSD', tradingViewUrl: form.tradingViewUrl.trim(), afterAnalysisUrl: form.afterAnalysisUrl.trim(), outcomeStatus: form.outcomeStatus || '', exitPrice: form.exitPrice.trim() ? Number(form.exitPrice) : null, closureStatus: form.closureStatus || '', direction: form.direction,
      entryPrice: entry, stopLoss: sl, takeProfit: tp, setup: form.setup.trim(), setupGrade: form.setupGrade, dailyBias: form.dailyBias, htfBias: form.htfBias, entryBias: form.entryBias, htf: form.htf, ltf: form.ltf, marketPhase: form.marketPhase, session: form.session.trim(), liquidityTarget: form.liquidityTarget.trim(), poi: form.poi.trim(), confirmation: form.confirmation.trim(), invalidation: form.invalidation.trim(), notes: form.notes.trim(),
      status: form.status, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid };
    try {
      if (editingId) await updateDoc(doc(db, 'dailyAnalyses', editingId), payload);
      else await addDoc(collection(db, 'dailyAnalyses'), { ...payload, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
      setSuccess(editingId ? 'Analyse mise à jour.' : form.status === 'published' ? 'Analyse publiée.' : 'Brouillon enregistré.');
      setModalOpen(false);
      setEditingId(null);
    } catch (err) {
      const firebaseError = err as { code?: string; message?: string; name?: string };
      console.error('[dailyAnalyses] Firestore write failed', {
        code: firebaseError?.code ?? 'unknown',
        message: firebaseError?.message ?? String(err),
        operation: editingId ? 'update' : 'create',
        uid: auth.currentUser?.uid ?? null,
        projectId: 'iamtrader'
      });
      const code = firebaseError?.code ?? '';
      setError(
        code === 'permission-denied'
          ? 'Firestore a refusé l’écriture. Vérifiez que les règles sont publiées et que votre compte possède le rôle admin.'
          : code === 'unauthenticated'
            ? 'Votre session Firebase n’est plus authentifiée. Reconnectez-vous puis réessayez.'
            : code === 'unavailable' || code === 'deadline-exceeded'
              ? 'Firestore ne répond pas correctement. Vérifiez la connexion réseau et les bloqueurs du navigateur.'
              : `Échec Firestore (${code || firebaseError?.name || 'erreur inconnue'}) : ${firebaseError?.message ?? String(err)}`
      );
    } finally { setSaving(false); }
  };

  const openAfterTrade = (item: Analysis) => {
    setForm(prev => ({ ...prev, tradingViewUrl: item.tradingViewUrl || '', afterAnalysisUrl: item.afterAnalysisUrl || '', outcomeStatus: item.outcomeStatus || '', exitPrice: item.exitPrice == null ? '' : String(item.exitPrice), closureStatus: item.closureStatus || '', direction: item.direction || 'BUY', entryPrice: String(item.entryPrice ?? ''), stopLoss: String(item.stopLoss ?? ''), takeProfit: String(item.takeProfit ?? ''), setup: item.setup || '', setupGrade: item.setupGrade || 'A', dailyBias: item.dailyBias || 'En attente', htfBias: item.htfBias || 'En attente', entryBias: item.entryBias || 'En attente', htf: item.htf || 'H4', ltf: item.ltf || 'M15', marketPhase: item.marketPhase || 'En attente', session: item.session || '', liquidityTarget: item.liquidityTarget || '', poi: item.poi || '', confirmation: item.confirmation || '', invalidation: item.invalidation || '', notes: item.notes || '', status: item.status || 'published' }));
    setPostAnalysisItemId(item.id); setError(''); setPostAnalysisModalOpen(true);
  };

  const saveAfterTrade = async () => {
    if (!postAnalysisItemId) { setPostAnalysisModalOpen(false); return; }
    if (!auth.currentUser) { setError('Votre session a expiré. Reconnectez-vous.'); return; }
    if ((form.outcomeStatus === 'BE' || form.outcomeStatus === 'Sortie manuelle') && !(Number(form.exitPrice) > 0)) { setError('Indiquez un prix de sortie valide pour un BE ou une sortie manuelle.'); return; }
    setSaving(true); setError('');
    try {
      const nextStatus: Status = form.closureStatus === 'Clôturer' ? 'closed' : form.status === 'closed' ? 'published' : form.status;
      await updateDoc(doc(db, 'dailyAnalyses', postAnalysisItemId), { afterAnalysisUrl: form.afterAnalysisUrl.trim(), outcomeStatus: form.outcomeStatus || '', exitPrice: form.exitPrice.trim() ? Number(form.exitPrice) : null, closureStatus: form.closureStatus || '', status: nextStatus, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
      setSuccess('Après trade enregistré.'); setPostAnalysisModalOpen(false); setPostAnalysisItemId(null);
    } catch (err) {
      const e = err as { code?: string };
      setError(e?.code === 'permission-denied' ? 'Firestore a refusé la mise à jour. Vérifiez les règles publiées.' : 'Impossible d’enregistrer l’après-trade.');
    } finally { setSaving(false); }
  };
  const removeAnalysis = async (item: Analysis) => {
    if (!window.confirm('Supprimer définitivement cette analyse ?')) return;
    try { await deleteDoc(doc(db, 'dailyAnalyses', item.id)); setSuccess('Analyse supprimée.'); }
    catch { setError('Suppression impossible.'); }
  };

  const journalView = showHistory || !isAdmin;

  return <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-2 lg:px-8">
    <header className="flex items-center justify-between gap-4">
      <div><h2 className="text-xl font-black tracking-tight text-[#0b1f35]">Analyses XAUUSD</h2><p className="mt-1 text-sm text-slate-500">{isAdmin ? 'Analyses de l’or · espace de publication' : 'Scénarios publiés par IAMTRADER'}</p></div>
      {isAdmin && <button type="button" onClick={openCreate} aria-label="Ajouter une analyse" title="Ajouter une analyse" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a982] text-white shadow-sm transition hover:bg-[#008f72] focus:outline-none focus:ring-4 focus:ring-emerald-100"><Plus className="h-5 w-5" /></button>}
    </header>
    {<div className="flex gap-2 border-b border-slate-200 pb-3"><button type="button" onClick={() => setShowHistory(false)} className={'rounded-xl px-4 py-2 text-xs font-bold ' + (!showHistory ? 'bg-[#00a982] text-white' : 'bg-white text-slate-600 border border-slate-200')}>Analyses actives</button><button type="button" onClick={() => setShowHistory(true)} className={'rounded-xl px-4 py-2 text-xs font-bold ' + (showHistory ? 'bg-[#00a982] text-white' : 'bg-white text-slate-600 border border-slate-200')}>Historique</button></div>}
    {error && !modalOpen && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}
    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement des analyses…</div>
      : items.filter(item => showHistory ? item.status === 'closed' : item.status === 'published' || (isAdmin && item.status === 'draft')).length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><p className="font-bold text-[#0b1f35]">{showHistory ? 'Aucune analyse dans l’historique' : isAdmin ? 'Aucune analyse active' : 'Aucune analyse publiée'}</p><p className="mt-2 text-sm text-slate-500">{showHistory ? 'Les analyses clôturées apparaîtront ici avec leurs détails.' : isAdmin ? 'Utilisez le bouton + pour ajouter la première analyse.' : 'Les prochaines analyses publiées apparaîtront ici.'}</p></div>
      : <div className="space-y-3">{journalView && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><div className="min-w-[1120px] grid grid-cols-[44px_1.25fr_0.7fr_1.2fr_0.75fr_0.75fr_0.75fr_0.8fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-100/80 px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><span>N°</span><span>Date / Actif</span><span>Ordre</span><span>Setup</span><span>Entrée</span><span>SL</span><span>TP</span><span>RR prévu</span><span>P&amp;L (R)</span></div></div>}<div className="grid grid-cols-1 gap-3">{items.filter(item => showHistory ? item.status === 'closed' : item.status === 'published' || (isAdmin && item.status === 'draft')).map((item, index) => journalView && expandedHistoryId !== item.id ? <button key={item.id} type="button" onClick={() => setExpandedHistoryId(item.id)} aria-label={`Développer l’analyse ${item.setup || 'XAUUSD'}`} className="grid w-full grid-cols-[28px_minmax(180px,1.25fr)_minmax(70px,0.7fr)_minmax(120px,1.2fr)_minmax(82px,0.75fr)_minmax(82px,0.75fr)_minmax(82px,0.75fr)_minmax(85px,0.8fr)_minmax(90px,0.8fr)] items-center gap-3 border-0 border-b border-slate-100 bg-white px-5 py-4 text-left transition last:border-b-0 hover:bg-emerald-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00a982] sm:min-w-[1120px] even:bg-slate-50/40"><span className="text-xs font-black text-slate-400">{index + 1}</span><span className="min-w-0"><span className="block text-xs font-black text-[#0b1f35]">XAUUSD · {formatDate(item.createdAt)}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{item.outcomeStatus || 'Résultat non renseigné'}</span></span><span className={'text-xs font-extrabold ' + (item.direction === 'BUY' ? 'text-emerald-700' : 'text-rose-700')}>{item.direction}</span><span className="truncate text-xs font-semibold text-slate-700">{item.setup || 'Analyse du marché'}</span><span className="text-xs tabular-nums text-slate-700">{Number(item.entryPrice).toFixed(2)}</span><span className="text-xs tabular-nums text-rose-700">{Number(item.stopLoss).toFixed(2)}</span><span className="text-xs tabular-nums text-emerald-700">{Number(item.takeProfit).toFixed(2)}</span><span className="text-xs font-bold tabular-nums text-slate-700">{plannedRR(item) == null ? '—' : '1:' + plannedRR(item)!.toFixed(2)}</span><span className={'text-xs font-black tabular-nums ' + ((realizedR(item) ?? 0) > 0 ? 'text-emerald-700' : (realizedR(item) ?? 0) < 0 ? 'text-rose-700' : 'text-slate-600')}>{realizedR(item) == null ? '—' : (realizedR(item)! > 0 ? '+' : '') + realizedR(item)!.toFixed(2) + 'R'}<span className="ml-2 text-slate-400">⌄</span></span></button> : <article key={item.id} className="group w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.045)] transition-shadow hover:shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
        {item.closureStatus && <div className={'px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider sm:px-6 ' + (item.closureStatus === 'Clôturer' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-800')}>{item.closureStatus === 'Clôturer' ? 'Analyse clôturée · Historique' : 'Scénario actif · Laisser courir'}</div>}
        <div className="relative overflow-hidden border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <div className="absolute inset-y-0 left-0 w-1 bg-[#00a982]" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#008f72]">IAMTRADER <span className="mx-1 text-slate-300">/</span> Analyse de marché</span>
                <span className={'rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] ' + (item.status === 'published' ? 'bg-emerald-50 text-emerald-700' : item.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700')}>{item.status === 'published' ? 'Publié' : item.status === 'closed' ? 'Clôturé' : 'Brouillon'}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-4xl font-black leading-none tracking-tight text-[#0b1f35] sm:text-5xl">XAUUSD</h3>
                <span className="hidden h-9 w-px bg-slate-200 sm:block" />
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-[#0b1f35] sm:text-lg">{item.setup || 'Analyse du marché'}</p>
                  <span className={'mt-1 inline-flex rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ' + (item.setupGrade === 'A+' ? 'bg-emerald-100 text-emerald-800' : item.setupGrade === 'A' ? 'bg-emerald-50 text-emerald-700' : item.setupGrade === 'B' ? 'bg-sky-50 text-sky-700' : item.setupGrade === 'C' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')}>Qualité {item.setupGrade || '—'}</span>
                </div>
              </div>
              <p className="mt-1.5 text-[10px] font-medium text-slate-500"><span className="mr-2 font-bold uppercase tracking-wider text-slate-400">Publié le</span>{formatDate(item.createdAt)}</p>
            </div>
            <span className={'inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border px-3 py-2 text-xs font-black tracking-[0.08em] sm:self-center sm:px-3.5 sm:py-2.5 sm:text-sm ' + (item.direction === 'BUY' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800')}>{item.direction === 'BUY' ? <><span aria-hidden="true">↑</span> BUY</> : <><span aria-hidden="true">↓</span> SELL</>}<span className="text-[10px] font-bold tracking-[0.08em] opacity-75">SCÉNARIO</span></span>
          </div>
        </div>
        <div className="px-3 pt-2 sm:px-4"><AnalysisChartCarousel item={item} /></div>
        <section className="mx-3 mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:mx-4 sm:px-4"><div className="space-y-3">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2"><span className="h-4 w-1 rounded-full bg-[#00a982]" /><div><h4 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Plan de trading</h4><p className="text-[9px] text-slate-400">Niveaux clés du scénario</p></div></div>
            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">XAUUSD</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <MiniLevel label="PE · Entrée" value={item.entryPrice} kind="entry" />
            <MiniLevel label="SL · Risque" value={item.stopLoss} kind="risk" />
            <MiniLevel label="TP · Objectif" value={item.takeProfit} kind="target" />
          </div>
        </div>
        {(item.dailyBias || item.htfBias || item.entryBias || item.marketPhase || item.htf || item.ltf || item.session || item.liquidityTarget || item.poi || item.confirmation || item.invalidation) && <section className="rounded-lg border-t border-slate-200 px-1 pt-2">
          <div className="mb-1.5 flex items-center gap-2"><span className="h-3.5 w-0.5 rounded-full bg-violet-400" /><div><h4 className="text-[9px] font-black uppercase tracking-[0.12em] text-[#0b1f35]">Contexte du marché</h4><p className="text-[8px] text-slate-400">Biais, unités de temps et exécution</p></div></div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <InfoItem label="Biais Daily" value={item.dailyBias} icon={TrendingUp} tone="emerald" />
            <InfoItem label="Biais HTF" value={item.htfBias} icon={Compass} tone="blue" />
            <InfoItem label="Biais d’entrée" value={item.entryBias} icon={Crosshair} tone="violet" />
            <InfoItem label="HTF" value={item.htf} icon={Layers3} tone="slate" />
            <InfoItem label="LTF" value={item.ltf} icon={Activity} tone="slate" />
            <InfoItem label="Phase du marché" value={item.marketPhase} icon={Gauge} tone="amber" />
            <InfoItem label="Session" value={item.session} icon={Clock3} tone="blue" />
            <InfoItem label="Liquidité ciblée" value={item.liquidityTarget} icon={Target} tone="emerald" />
            <InfoItem label="Zone d’intérêt (POI)" value={item.poi} icon={Crosshair} tone="violet" />
            <InfoItem label="Confirmation" value={item.confirmation} icon={CheckCircle2} tone="emerald" />
            <InfoItem label="Invalidation" value={item.invalidation} icon={ShieldCheck} tone="rose" />
          </div>
        </div>
        {item.notes && <section className="rounded-lg border-t border-slate-200 px-1 pt-2"><div className="mb-3 flex items-center gap-2"><span className="h-4 w-1 rounded-full bg-amber-400" /><h4 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Analyse & scénario</h4></div><div className="relative max-h-28 overflow-hidden">{formatNotes(item.notes)}<div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50/95 to-transparent" /></div>{item.notes.length > 260 && <button type="button" onClick={() => setExplanationItem(item)} className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-[#008f72] transition hover:border-emerald-300 hover:bg-emerald-50">Voir plus <span aria-hidden="true">→</span></button>}</section>}</section>
        <div className="mt-2 flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2 sm:px-5">
          <a href={item.tradingViewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir le graphique</a>
          {journalView && <button type="button" onClick={() => setExpandedHistoryId(null)} className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100" aria-label="Replier les détails de l’analyse">Replier <span aria-hidden="true">⌃</span></button>}{isAdmin && <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => openEdit(item)} aria-label="Modifier l’analyse" title="Modifier" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-[#008f72]"><Pencil className="h-4 w-4" /></button>
            {item.status !== 'closed' && <button type="button" onClick={() => openAfterTrade(item)} aria-label="Après trade : renseigner le résultat ou clôturer" title="Après trade" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><TrendingUp className="h-4 w-4" /></button>}
            <button type="button" onClick={() => void removeAnalysis(item)} aria-label="Supprimer l’analyse" title="Supprimer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
          </div>}
        </div>
      </article>)}</div></div>}

    {modalOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="analysis-modal-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><h3 id="analysis-modal-title" className="text-base font-black text-[#0b1f35]">{editingId ? 'Modifier l’analyse' : 'Ajouter une analyse'}</h3><p className="mt-1 text-xs text-slate-500">XAUUSD · Gold</p></div><button type="button" onClick={() => !saving && setModalOpen(false)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
        <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="grid grid-cols-4 gap-2">
            {[
              { title: 'Analyse', subtitle: 'Graphique & setup' },
              { title: 'Contexte', subtitle: 'Biais & structure' },
              { title: 'Exécution', subtitle: 'PE, SL & TP' },
              { title: 'Rédaction', subtitle: 'Note & publication' },
            ].map((step, index) => <button key={step.title} type="button" onClick={() => { if (index <= activeStep) setActiveStep(index); }} className="group min-w-0 text-left" aria-current={activeStep === index ? 'step' : undefined}>
              <div className="flex items-center gap-2">
                <span className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ' + (activeStep === index ? 'bg-[#00a982] text-white' : activeStep > index ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{activeStep > index ? '✓' : index + 1}</span>
                <span className={'truncate text-xs font-extrabold sm:text-sm ' + (activeStep === index ? 'text-[#008f72]' : 'text-slate-500')}>{step.title}</span>
              </div>
              <p className="ml-9 mt-1 hidden truncate text-[10px] text-slate-400 sm:block">{step.subtitle}</p>
              <div className="mt-2 h-1 rounded-full bg-slate-100"><div className={'h-1 rounded-full transition-all ' + (activeStep >= index ? 'bg-[#00a982]' : 'bg-transparent')} /></div>
            </button>)}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Étape {activeStep + 1} sur 4</p>
        </div>
        <form onSubmit={event => event.preventDefault()} className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/60">
          {activeStep === 0 && <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6"><section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm font-black text-emerald-700">1</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Graphique de référence</h4><p className="text-xs text-slate-400">Capture TradingView à afficher dans l’analyse</p></div></div><div><label htmlFor="analysis-tv-url" className="mb-1.5 block text-xs font-bold text-slate-600">Lien TradingView</label><input id="analysis-tv-url" type="url" required value={form.tradingViewUrl} onChange={e => setField('tradingViewUrl', e.target.value)} placeholder="https://www.tradingview.com/chart/…" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#00a982] focus:ring-2 focus:ring-emerald-50" /></div>
          {validTradingViewUrl(form.tradingViewUrl) && tradingViewSnapshotImageUrl(form.tradingViewUrl) && <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white"><p className="px-3 py-2 text-[11px] font-bold text-slate-500">Aperçu de la capture TradingView</p><img src={tradingViewSnapshotImageUrl(form.tradingViewUrl)} alt="Aperçu de la capture TradingView" loading="lazy" className="block max-h-64 w-full object-contain" /></div>}<button type="button" onClick={() => setPostAnalysisModalOpen(true)} className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-[#008f72] transition hover:bg-emerald-100"><TrendingUp className="h-3.5 w-3.5" />Après trade · graphique et résultat</button></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sm font-black text-sky-700">2</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Identification du setup</h4><p className="text-xs text-slate-400">Direction, nom et qualité de la configuration</p></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label htmlFor="analysis-direction" className="mb-1.5 block text-xs font-bold text-slate-600">Scénario</label><select id="analysis-direction" value={form.direction} onChange={e => setField('direction', e.target.value as Direction)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="BUY">Achat · BUY</option><option value="SELL">Vente · SELL</option></select></div><div><label htmlFor="analysis-setup" className="mb-1.5 block text-xs font-bold text-slate-600">Setup</label><input id="analysis-setup" required maxLength={120} value={form.setup} onChange={e => setField('setup', e.target.value)} placeholder="Ex. Sweep + MSS" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div></div>
          <div><label htmlFor="analysis-grade" className="mb-1.5 block text-xs font-bold text-slate-600">Qualité du setup</label><select id="analysis-grade" value={form.setupGrade} onChange={e => setField('setupGrade', e.target.value as SetupGrade)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="A+">A+ · Exceptionnel</option><option value="A">A · Excellent</option><option value="B">B · Bon</option><option value="C">C · Moyen</option><option value="D">D · Faible</option></select><p className="mt-1 text-[11px] text-slate-400">Évalue la qualité de la configuration, pas le résultat futur du trade.</p></div></section></div>}
          {activeStep === 1 && <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6"><section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-sm font-black text-violet-700">2</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Lecture du marché</h4><p className="text-xs text-slate-400">Biais multi-timeframe, phase et session</p></div></div><div className="rounded-xl border border-slate-100 p-4"><h4 className="mb-3 text-sm font-extrabold text-[#0b1f35]">Contexte et biais</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectField id="analysis-daily-bias" label="Biais Daily" value={form.dailyBias} onChange={v => setField('dailyBias', v as Bias)} options={['Haussier','Baissier','Neutre','En attente']} />
              <SelectField id="analysis-htf-bias" label="Biais HTF" value={form.htfBias} onChange={v => setField('htfBias', v as Bias)} options={['Haussier','Baissier','Neutre','En attente']} />
              <SelectField id="analysis-entry-bias" label="Biais d’entrée" value={form.entryBias} onChange={v => setField('entryBias', v as Bias)} options={['Haussier','Baissier','Neutre','En attente']} />
              <SelectField id="analysis-htf" label="Timeframe HTF" value={form.htf} onChange={v => setField('htf', v)} options={['Monthly','Weekly','D1','H4','H1']} />
              <SelectField id="analysis-ltf" label="Timeframe LTF" value={form.ltf} onChange={v => setField('ltf', v)} options={['H1','M30','M15','M5','M1']} />
              <SelectField id="analysis-phase" label="Phase du marché" value={form.marketPhase} onChange={v => setField('marketPhase', v as MarketPhase)} options={['Accumulation','Expansion','Distribution','Retracement','Consolidation','Reversal','En attente']} />
            </div>
          </div>
</section></div>}
          {activeStep === 2 && <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6"><section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-sm font-black text-amber-700">3</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Plan de trading</h4><p className="text-xs text-slate-400">Prix d’entrée, invalidation et objectif</p></div></div><div className="grid grid-cols-3 gap-3"><PriceField id="analysis-pe" label="PE" value={form.entryPrice} onChange={v => setField('entryPrice', v)} /><PriceField id="analysis-sl" label="SL" value={form.stopLoss} onChange={v => setField('stopLoss', v)} /><PriceField id="analysis-tp" label="TP" value={form.takeProfit} onChange={v => setField('takeProfit', v)} /></div>
          </section></div>}
          {activeStep === 3 && <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6"><section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-sm font-black text-indigo-700">4</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Rédaction de l’analyse</h4><p className="text-xs text-slate-400">Mise en forme, arguments et scénario</p></div></div><div><label htmlFor="analysis-notes" className="mb-1.5 block text-xs font-bold text-slate-600">Contenu de l’analyse</label>
            <div className="mb-2 flex flex-wrap items-center gap-1 rounded-t-xl border border-slate-200 bg-slate-50 p-2">
              {[
                { label: 'Titre', title: 'Titre de section', before: '## ', after: '' },
                { label: 'Gras', title: 'Gras', before: '**', after: '**' },
                { label: 'Italique', title: 'Italique', before: '*', after: '*' },
                { label: 'Liste à puces', title: 'Liste à puces', before: '\n- ', after: '' },
                { label: 'Liste numérotée', title: 'Liste numérotée', before: '\n1. ', after: '' },
                { label: 'Paragraphe', title: 'Nouveau paragraphe', before: '\n\n', after: '' },
              ].map(tool => <button key={tool.label} type="button" title={tool.title} onClick={() => { const el = document.getElementById('analysis-notes') as HTMLTextAreaElement | null; if (!el) return; const start = el.selectionStart, end = el.selectionEnd; const selected = form.notes.slice(start, end); const next = form.notes.slice(0, start) + tool.before + selected + tool.after + form.notes.slice(end); setField('notes', next); requestAnimationFrame(() => { el.focus(); const pos = start + tool.before.length + selected.length + tool.after.length; el.setSelectionRange(pos, pos); }); }} className="min-h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">{tool.label}</button>)}
            </div>
            <textarea id="analysis-notes" rows={8} maxLength={5000} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder={"## 1. Contexte du marché\\nDécris la structure et le biais.\\n\\n## 2. Raisons de l'entrée\\n- Prise de liquidité\\n- Cassure de structure\\n\\n**Invalidation :** niveau qui annule le scénario."} className="w-full rounded-b-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-[#00a982] focus:ring-2 focus:ring-emerald-50" />
            <p className="mt-1.5 text-[11px] text-slate-400">Raccourcis : sélectionne un texte puis clique sur Gras ou Italique. Les titres commencent par ##, les listes par - ou 1.</p>
          </div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">4</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Publication</h4><p className="text-xs text-slate-400">Choisir la visibilité de cette analyse</p></div></div><label htmlFor="analysis-status" className="mb-1.5 block text-xs font-bold text-slate-600">Visibilité</label><select id="analysis-status" value={form.status === 'closed' ? 'published' : form.status} onChange={e => setField('status', e.target.value as Status)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="published">Publier aux membres</option><option value="draft">Garder en brouillon</option></select></section>
          </div>}
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{error}</p>}
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            {activeStep > 0 ? <button type="button" onClick={() => setActiveStep(activeStep - 1)} disabled={saving} className="min-h-10 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-50">← Précédent</button> : <span className="px-3 text-xs text-slate-400">Fermez avec la croix ×</span>}
            {activeStep < 3 ? <button type="button" onClick={() => {
              setError('');
              if (activeStep === 0 && (!validTradingViewUrl(form.tradingViewUrl) || !form.setup.trim())) { setError(!validTradingViewUrl(form.tradingViewUrl) ? 'Ajoutez un lien TradingView valide avant de continuer.' : 'Indiquez le nom du setup avant de continuer.'); return; }
              if (activeStep === 2 && (![form.entryPrice, form.stopLoss, form.takeProfit].every(v => Number.isFinite(Number(v)) && Number(v) > 0))) { setError('Renseignez un PE, un SL et un TP valides avant de continuer.'); return; }
              setActiveStep(activeStep + 1);
            }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#00a982] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#008f72]">Suivant <span aria-hidden="true">→</span></button> : <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#00a982] px-5 text-sm font-bold text-white hover:bg-[#008f72] disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Publier l’analyse'}</button>}
          </footer>
        </form>
      </section>
    </div>}
    {explanationItem && <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" onClick={() => setExplanationItem(null)}><section role="dialog" aria-modal="true" aria-labelledby="analysis-explanation-title" onClick={e => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#008f72]">IAMTRADER · XAUUSD</p><h3 id="analysis-explanation-title" className="mt-1 text-base font-black text-[#0b1f35]">Analyse & scénario</h3><p className="mt-1 text-xs text-slate-500">{formatDate(explanationItem.createdAt)} · {explanationItem.setup || "Analyse du marché"}</p></div><button type="button" onClick={() => setExplanationItem(null)} aria-label="Fermer l’explication" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="overflow-y-auto p-5 sm:p-7">{formatNotes(explanationItem.notes)}</div><footer className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-3"><button type="button" onClick={() => setExplanationItem(null)} className="min-h-9 rounded-lg bg-[#00a982] px-4 text-xs font-bold text-white hover:bg-[#008f72]">Fermer</button></footer></section></div>}
    {postAnalysisModalOpen && <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="after-trade-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 id="after-trade-title" className="text-base font-black text-[#0b1f35]">Après trade</h3><p className="mt-1 text-xs text-slate-500">Graphique de suivi, résultat et prix de sortie</p></div><button type="button" onClick={() => setPostAnalysisModalOpen(false)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="space-y-4 p-5"><div><label htmlFor="analysis-after-url" className="mb-1.5 block text-xs font-bold text-slate-600">Lien du graphique après analyse</label><input id="analysis-after-url" type="url" value={form.afterAnalysisUrl} onChange={e => setField('afterAnalysisUrl', e.target.value)} placeholder="https://www.tradingview.com/chart/…" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#00a982] focus:ring-2 focus:ring-emerald-50" /></div><div><label htmlFor="analysis-outcome-status" className="mb-1.5 block text-xs font-bold text-slate-600">Statut du trade</label><select id="analysis-outcome-status" value={form.outcomeStatus} onChange={e => setField('outcomeStatus', e.target.value as OutcomeStatus | '')} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Choisir un statut</option><option value="En cours">En cours</option><option value="Sortie manuelle">Sortie manuelle</option><option value="Stop touché">Stop touché</option><option value="TP touché">TP touché</option><option value="BE">BE</option><option value="Zone non touchée">Zone non touchée</option></select></div>{(form.outcomeStatus === 'BE' || form.outcomeStatus === 'Sortie manuelle') && <div><label htmlFor="analysis-exit-price" className="mb-1.5 block text-xs font-bold text-slate-600">Prix de sortie</label><input id="analysis-exit-price" type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.exitPrice} onChange={e => setField('exitPrice', e.target.value)} placeholder="Ex. 4350.00" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm tabular-nums" /></div>}{validTradingViewUrl(form.afterAnalysisUrl) && tradingViewSnapshotImageUrl(form.afterAnalysisUrl) && <div className="overflow-hidden rounded-xl border border-slate-200"><p className="px-3 py-2 text-[11px] font-bold text-slate-500">Aperçu du graphique</p><img src={tradingViewSnapshotImageUrl(form.afterAnalysisUrl)} alt="Aperçu du graphique après trade" loading="lazy" className="block max-h-56 w-full object-contain" /></div>}<div><label htmlFor="analysis-closure-status-after" className="mb-1.5 block text-xs font-bold text-slate-600">Statut de clôture</label><select id="analysis-closure-status-after" value={form.closureStatus} onChange={e => setField('closureStatus', e.target.value as ClosureStatus | '')} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Choisir une action</option><option value="Laisser courir">Laisser courir · garder active</option><option value="Clôturer">Clôturer · déplacer vers l’historique</option></select></div></div><footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3"><button type="button" onClick={() => { setPostAnalysisModalOpen(false); setPostAnalysisItemId(null); }} className="min-h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">Annuler</button><button type="button" onClick={() => void saveAfterTrade()} disabled={saving} className="min-h-9 rounded-lg bg-[#00a982] px-4 text-xs font-bold text-white hover:bg-[#008f72] disabled:opacity-60">{saving ? 'Enregistrement…' : postAnalysisItemId ? 'Enregistrer l’après-trade' : 'Terminer'}</button></footer></section></div>}
  </div>;
}

function AnalysisChartCarousel({ item }: { item: Analysis }) {
  const [activeChart, setActiveChart] = useState(0);
  const hasAfter = Boolean(item.afterAnalysisUrl);
  const url = activeChart === 1 && hasAfter ? item.afterAnalysisUrl! : item.tradingViewUrl;
  const title = activeChart === 1 && hasAfter ? 'Après trade' : 'Analyse initiale';
  const imageUrl = tradingViewSnapshotImageUrl(url);
  return <section className="overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50">
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
      <div className="min-w-0"><h4 className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[#0b1f35]">{title}</h4><p className="text-[9px] text-slate-400">{activeChart === 1 && item.outcomeStatus ? item.outcomeStatus + (item.exitPrice ? ' · Sortie : ' + Number(item.exitPrice).toFixed(2) : '') : 'Graphique de référence'}</p></div>
      {hasAfter && <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => setActiveChart(0)} aria-label="Voir le graphique initial" disabled={activeChart === 0} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500 shadow-sm transition hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"><span aria-hidden="true" className="text-3xl font-light leading-none">‹</span></button><span className="px-1 text-xs font-bold tabular-nums text-slate-500">{activeChart + 1}/2</span><button type="button" onClick={() => setActiveChart(1)} aria-label="Voir le graphique après trade" disabled={activeChart === 1} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500 shadow-sm transition hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"><span aria-hidden="true" className="text-3xl font-light leading-none">›</span></button></div>}
    </div>
    {imageUrl ? <img src={imageUrl} alt={title + ' — ' + (item.setup || 'XAUUSD')} loading="lazy" className="mx-auto block h-auto max-h-[150px] w-full max-w-[760px] bg-white object-contain sm:max-h-[190px]" /> : <div className="flex min-h-16 items-center justify-center bg-white"><a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008f72] hover:underline">Ouvrir le graphique <ExternalLink className="h-3.5 w-3.5" /></a></div>}
  </section>;
}

function InfoItem({ label, value, icon: Icon, tone = 'slate' }: { label: string; value?: string; icon: React.ElementType; tone?: 'emerald' | 'blue' | 'violet' | 'slate' | 'amber' | 'rose' }) {
  if (!value) return null;
  const tones = { emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', slate: 'bg-slate-100 text-slate-600', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700' };
  return <div className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5">
    
    <div className="min-w-0"><p className="truncate text-[8px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className="break-words text-[10px] font-extrabold leading-3.5 text-[#0b1f35]">{value}</p></div>
  </div>;
}
function TextField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-bold text-slate-600">{label}</label><input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>;
}
function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-bold text-slate-600">{label}</label><select id={id} value={value} onChange={e => onChange(e.target.value)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{options.map(option => <option key={option || 'none'} value={option}>{option || 'Non précisée'}</option>)}</select></div>;
}
function PriceField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-bold text-slate-600">{label}</label><input id={id} type="number" inputMode="decimal" step="0.01" min="0.01" required value={value} onChange={e => onChange(e.target.value)} placeholder="4350.00" className="min-h-10 w-full min-w-0 rounded-xl border border-slate-200 px-2.5 text-sm tabular-nums" /></div>;
}
function MiniLevel({ label, value, kind }: { label: string; value: number; kind: 'entry' | 'risk' | 'target' }) {
  const styles = {
    entry: { icon: Crosshair, wrap: 'border-sky-100 bg-sky-50/60', badge: 'bg-sky-100 text-sky-700', label: 'text-sky-700', bar: 'bg-sky-400' },
    risk: { icon: ShieldCheck, wrap: 'border-rose-100 bg-rose-50/50', badge: 'bg-rose-100 text-rose-700', label: 'text-rose-700', bar: 'bg-rose-400' },
    target: { icon: Target, wrap: 'border-emerald-100 bg-emerald-50/60', badge: 'bg-emerald-100 text-emerald-700', label: 'text-emerald-700', bar: 'bg-[#00a982]' },
  };
  const style = styles[kind]; const Icon = style.icon;
  return <div className={'relative min-w-0 overflow-hidden rounded-xl border px-2 py-2 sm:px-3 sm:py-2.5 ' + style.wrap}>
    <div className={'absolute inset-y-0 left-0 w-[3px] ' + style.bar} />
    <div className="flex min-w-0 items-center gap-1 pl-1">
      
      <div className="min-w-0 flex-1"><p className={'truncate text-[8px] font-black uppercase tracking-[0.08em] sm:text-[9px] ' + style.label}>{label}</p><p className="mt-0.5 truncate text-xs font-black tabular-nums tracking-tight text-[#0b1f35] sm:text-sm">{Number(value).toFixed(2)}</p></div>
    </div>
  </div>;
}
