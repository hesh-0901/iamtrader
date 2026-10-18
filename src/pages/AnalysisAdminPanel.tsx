import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Plus, Pencil, X, ExternalLink, Save, LoaderCircle, Trash2, Bold, Italic, Heading2, List, ListOrdered, Quote, Minus } from 'lucide-react';
import { auth, db } from '../firebase/config';

type Status = 'draft' | 'published' | 'closed';
type Direction = 'BUY' | 'SELL';
type SetupGrade = 'A+' | 'A' | 'B' | 'C' | 'D';
type Bias = 'Haussier' | 'Baissier' | 'Neutre' | 'En attente';
type MarketPhase = 'Accumulation' | 'Expansion' | 'Distribution' | 'Retracement' | 'Consolidation' | 'Reversal' | 'En attente';
type Analysis = {
  id: string; asset?: string; tradingViewUrl: string; entryPrice: number; stopLoss: number;
  takeProfit: number; direction: Direction; setup: string; setupGrade?: SetupGrade; dailyBias?: Bias; htfBias?: Bias; entryBias?: Bias; htf?: string; ltf?: string; marketPhase?: MarketPhase; session?: string; liquidityTarget?: string; poi?: string; confirmation?: string; invalidation?: string; notes: string; status: Status;
  createdAt?: { toDate?: () => Date } | string;
};
type FormState = {
  tradingViewUrl: string; direction: Direction; entryPrice: string; stopLoss: string;
  takeProfit: string; setup: string; setupGrade: SetupGrade; dailyBias: Bias; htfBias: Bias; entryBias: Bias; htf: string; ltf: string; marketPhase: MarketPhase; session: string; liquidityTarget: string; poi: string; confirmation: string; invalidation: string; notes: string; status: Status;
};
const blank: FormState = { tradingViewUrl: '', direction: 'BUY', entryPrice: '', stopLoss: '', takeProfit: '', setup: '', setupGrade: 'A', dailyBias: 'En attente', htfBias: 'En attente', entryBias: 'En attente', htf: 'H4', ltf: 'M15', marketPhase: 'En attente', session: '', liquidityTarget: '', poi: '', confirmation: '', invalidation: '', notes: '', status: 'published' };

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
    const parts = text.split(/(\\*\\*[^*]+\\*\\*|\\*[^*]+\\*|__[^_]+__|_[^_]+_|`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={key + index}>{part.slice(2, -2)}</strong>;
      if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) return <em key={key + index}>{part.slice(1, -1)}</em>;
      if (part.startsWith('`') && part.endsWith('`')) return <code key={key + index} className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em]">{part.slice(1, -1)}</code>;
      return part;
    });
  };
  return <div className="space-y-2 text-sm leading-6 text-slate-600">
    {value.split(/\\n/).map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={index} className="h-1" />;
      if (/^#{1,3}\\s/.test(trimmed)) return <h4 key={index} className="pt-1 text-sm font-extrabold text-[#0b1f35]">{inline(trimmed.replace(/^#{1,3}\\s/, ''), 'h' + index)}</h4>;
      if (/^[-*]\\s/.test(trimmed)) return <div key={index} className="flex gap-2"><span className="text-emerald-600">•</span><span>{inline(trimmed.slice(2), 'l' + index)}</span></div>;
      if (/^\\d+[.)]\\s/.test(trimmed)) return <div key={index} className="flex gap-2"><span className="font-bold text-slate-400">{trimmed.match(/^\\d+[.)]/)?.[0]}</span><span>{inline(trimmed.replace(/^\\d+[.)]\\s/, ''), 'n' + index)}</span></div>;
      return <p key={index}>{inline(trimmed, 'p' + index)}</p>;
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

export function AnalysisAdminPanel({ isAdmin = true }: { isAdmin?: boolean }) {
  const [items, setItems] = useState<Analysis[]>([]);
  const [form, setForm] = useState<FormState>(blank);
  const [modalOpen, setModalOpen] = useState(false);
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
      : query(collection(db, 'dailyAnalyses'), where('status', '==', 'published'));
    return onSnapshot(q, snapshot => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Analysis));
      const visible = isAdmin ? all : all.filter(a => a.status === 'published');
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

  const openCreate = () => { setForm(blank); setEditingId(null); setError(''); setSuccess(''); setModalOpen(true); };
  const openEdit = (item: Analysis) => {
    setForm({ tradingViewUrl: item.tradingViewUrl || '', direction: item.direction || 'BUY',
      entryPrice: String(item.entryPrice ?? ''), stopLoss: String(item.stopLoss ?? ''),
      takeProfit: String(item.takeProfit ?? ''), setup: item.setup || '', setupGrade: item.setupGrade || 'A', dailyBias: item.dailyBias || 'En attente', htfBias: item.htfBias || 'En attente', entryBias: item.entryBias || 'En attente', htf: item.htf || 'H4', ltf: item.ltf || 'M15', marketPhase: item.marketPhase || 'En attente', session: item.session || '', liquidityTarget: item.liquidityTarget || '', poi: item.poi || '', confirmation: item.confirmation || '', invalidation: item.invalidation || '', notes: item.notes || '',
      status: item.status || 'draft' });
    setEditingId(item.id); setError(''); setSuccess(''); setModalOpen(true);
  };
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) return;
    if (!auth.currentUser) { setError('Votre session a expiré. Reconnectez-vous.'); return; }
    if (!validTradingViewUrl(form.tradingViewUrl.trim())) { setError('Ajoutez un lien TradingView valide en HTTPS.'); return; }
    const entry = Number(form.entryPrice), sl = Number(form.stopLoss), tp = Number(form.takeProfit);
    if (![entry, sl, tp].every(n => Number.isFinite(n) && n > 0)) { setError('Le PE, le SL et le TP doivent être des prix supérieurs à zéro.'); return; }
    if ((form.direction === 'BUY' && !(sl < entry && entry < tp)) || (form.direction === 'SELL' && !(tp < entry && entry < sl))) {
      setError('Niveaux incohérents : BUY exige SL < PE < TP ; SELL exige TP < PE < SL.'); return;
    }
    if (!form.setup.trim()) { setError('Renseignez le setup de trading.'); return; }
    if (form.status === 'published' && !editingId && todayCount >= 2) { setError('Deux analyses sont déjà publiées aujourd’hui.'); return; }
    setSaving(true); setError(''); setSuccess('');
    const payload = { asset: 'XAUUSD', tradingViewUrl: form.tradingViewUrl.trim(), direction: form.direction,
      entryPrice: entry, stopLoss: sl, takeProfit: tp, setup: form.setup.trim(), setupGrade: form.setupGrade, dailyBias: form.dailyBias, htfBias: form.htfBias, entryBias: form.entryBias, htf: form.htf, ltf: form.ltf, marketPhase: form.marketPhase, session: form.session.trim(), liquidityTarget: form.liquidityTarget.trim(), poi: form.poi.trim(), confirmation: form.confirmation.trim(), invalidation: form.invalidation.trim(), notes: form.notes.trim(),
      status: form.status, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid };
    try {
      if (editingId) await updateDoc(doc(db, 'dailyAnalyses', editingId), payload);
      else await addDoc(collection(db, 'dailyAnalyses'), { ...payload, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
      setSuccess(editingId ? 'Analyse mise à jour.' : form.status === 'published' ? 'Analyse publiée.' : 'Brouillon enregistré.');
      setModalOpen(false); setEditingId(null); setForm(blank);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible. Vérifiez les règles Firestore.');
    } finally { setSaving(false); }
  };

  const closeAnalysis = async (item: Analysis) => {
    try { await updateDoc(doc(db, 'dailyAnalyses', item.id), { status: 'closed', updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || '' }); setSuccess('Analyse clôturée.'); }
    catch { setError('Impossible de clôturer cette analyse.'); }
  };
  const removeAnalysis = async (item: Analysis) => {
    if (!window.confirm('Supprimer définitivement cette analyse ?')) return;
    try { await deleteDoc(doc(db, 'dailyAnalyses', item.id)); setSuccess('Analyse supprimée.'); }
    catch { setError('Suppression impossible.'); }
  };

  return <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 lg:px-8">
    <header className="flex items-center justify-between gap-4">
      <div><h2 className="text-xl font-black tracking-tight text-[#0b1f35]">Analyses XAUUSD</h2><p className="mt-1 text-sm text-slate-500">{isAdmin ? 'Analyses de l’or · espace de publication' : 'Scénarios publiés par IAMTRADER'}</p></div>
      {isAdmin && <button type="button" onClick={openCreate} aria-label="Ajouter une analyse" title="Ajouter une analyse" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a982] text-white shadow-sm transition hover:bg-[#008f72] focus:outline-none focus:ring-4 focus:ring-emerald-100"><Plus className="h-5 w-5" /></button>}
    </header>
    {error && !modalOpen && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}
    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement des analyses…</div>
      : items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><p className="font-bold text-[#0b1f35]">{isAdmin ? 'Aucune analyse ajoutée' : 'Aucune analyse publiée'}</p><p className="mt-2 text-sm text-slate-500">{isAdmin ? 'Utilisez le bouton + pour ajouter la première analyse.' : 'Les prochaines analyses publiées apparaîtront ici.'}</p></div>
      : <div className="grid grid-cols-1 gap-6">{items.map(item => <article key={item.id} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black tracking-wide text-amber-700">XAUUSD</span><span className={'rounded-full px-2 py-1 text-[10px] font-bold ' + (item.status === 'published' ? 'bg-emerald-50 text-emerald-700' : item.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700')}>{item.status === 'published' ? 'Publié' : item.status === 'closed' ? 'Clôturé' : 'Brouillon'}</span></div><div className="mt-2 flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold text-[#0b1f35]">{item.setup}</h3><span className={'rounded-md px-2 py-0.5 text-[10px] font-black ' + (item.setupGrade === 'A+' ? 'bg-emerald-100 text-emerald-800' : item.setupGrade === 'A' ? 'bg-emerald-50 text-emerald-700' : item.setupGrade === 'B' ? 'bg-sky-50 text-sky-700' : item.setupGrade === 'C' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')}>SETUP {item.setupGrade || '—'}</span></div><p className="mt-1 text-[11px] text-slate-400">{formatDate(item.createdAt)}</p></div>
          <span className={'rounded-lg px-2.5 py-1.5 text-[10px] font-black ' + (item.direction === 'BUY' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{item.direction === 'BUY' ? 'BUY' : 'SELL'}</span>
        </div>
        <div className="mx-4 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          {validTradingViewUrl(item.tradingViewUrl) && tradingViewSnapshotImageUrl(item.tradingViewUrl) ? <a href={item.tradingViewUrl} target="_blank" rel="noreferrer" aria-label={'Ouvrir la capture TradingView ' + item.setup} className="block bg-white"><img src={tradingViewSnapshotImageUrl(item.tradingViewUrl)} alt={'Capture TradingView XAUUSD — ' + item.setup} loading="lazy" className="block h-auto max-h-[900px] w-full object-contain" /><p className="px-4 py-2 text-center text-xs text-slate-400">Capture TradingView · cliquer pour agrandir</p></a> : <div className="flex h-44 items-center justify-center text-sm text-slate-400">Lien de capture TradingView invalide</div>}
        </div>
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          <MiniLevel label="PE" value={item.entryPrice} /><MiniLevel label="SL" value={item.stopLoss} /><MiniLevel label="TP" value={item.takeProfit} />
        </div>
        {(item.dailyBias || item.htfBias || item.entryBias || item.marketPhase || item.htf || item.ltf || item.session || item.liquidityTarget || item.poi || item.confirmation || item.invalidation) && <div className="mx-4 mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Contexte de marché</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoItem label="Biais Daily" value={item.dailyBias} />
            <InfoItem label="Biais HTF" value={item.htfBias} />
            <InfoItem label="Biais d’entrée" value={item.entryBias} />
            <InfoItem label="HTF" value={item.htf} />
            <InfoItem label="LTF" value={item.ltf} />
            <InfoItem label="Phase du marché" value={item.marketPhase} />
            <InfoItem label="Session" value={item.session} />
            <InfoItem label="Liquidité ciblée" value={item.liquidityTarget} />
            <InfoItem label="Zone d’intérêt (POI)" value={item.poi} />
            <InfoItem label="Confirmation" value={item.confirmation} />
            <InfoItem label="Invalidation" value={item.invalidation} />
          </div>
        </div>}
        {item.notes && <div className="px-5 py-4">{formatNotes(item.notes)}</div>}
        <div className="flex items-center gap-2 px-4 py-4">
          <a href={item.tradingViewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" /> Ouvrir le graphique</a>
          {isAdmin && <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => openEdit(item)} aria-label="Modifier l’analyse" title="Modifier" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-[#008f72]"><Pencil className="h-4 w-4" /></button>
            {item.status === 'published' && <button type="button" onClick={() => void closeAnalysis(item)} aria-label="Clôturer l’analyse" title="Clôturer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
            <button type="button" onClick={() => void removeAnalysis(item)} aria-label="Supprimer l’analyse" title="Supprimer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
          </div>}
        </div>
      </article>)}</div>}

    {modalOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="analysis-modal-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><h3 id="analysis-modal-title" className="text-base font-black text-[#0b1f35]">{editingId ? 'Modifier l’analyse' : 'Ajouter une analyse'}</h3><p className="mt-1 text-xs text-slate-500">XAUUSD · Gold</p></div><button type="button" onClick={() => !saving && setModalOpen(false)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
        <form onSubmit={submit} className="space-y-5 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm font-black text-emerald-700">1</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Graphique de référence</h4><p className="text-xs text-slate-400">Capture TradingView à afficher dans l’analyse</p></div></div><div><label htmlFor="analysis-tv-url" className="mb-1.5 block text-xs font-bold text-slate-600">Lien TradingView</label><input id="analysis-tv-url" type="url" required value={form.tradingViewUrl} onChange={e => setField('tradingViewUrl', e.target.value)} placeholder="https://www.tradingview.com/chart/…" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#00a982] focus:ring-2 focus:ring-emerald-50" /></div>
          {validTradingViewUrl(form.tradingViewUrl) && tradingViewSnapshotImageUrl(form.tradingViewUrl) && <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white"><p className="px-3 py-2 text-[11px] font-bold text-slate-500">Aperçu de la capture TradingView</p><img src={tradingViewSnapshotImageUrl(form.tradingViewUrl)} alt="Aperçu de la capture TradingView" loading="lazy" className="block max-h-64 w-full object-contain" /></div>}</section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sm font-black text-sky-700">2</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Identification du setup</h4><p className="text-xs text-slate-400">Direction, nom et qualité de la configuration</p></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label htmlFor="analysis-direction" className="mb-1.5 block text-xs font-bold text-slate-600">Scénario</label><select id="analysis-direction" value={form.direction} onChange={e => setField('direction', e.target.value as Direction)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="BUY">Achat · BUY</option><option value="SELL">Vente · SELL</option></select></div><div><label htmlFor="analysis-setup" className="mb-1.5 block text-xs font-bold text-slate-600">Setup</label><input id="analysis-setup" required maxLength={120} value={form.setup} onChange={e => setField('setup', e.target.value)} placeholder="Ex. Sweep + MSS" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div></div>
          <div><label htmlFor="analysis-grade" className="mb-1.5 block text-xs font-bold text-slate-600">Qualité du setup</label><select id="analysis-grade" value={form.setupGrade} onChange={e => setField('setupGrade', e.target.value as SetupGrade)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="A+">A+ · Exceptionnel</option><option value="A">A · Excellent</option><option value="B">B · Bon</option><option value="C">C · Moyen</option><option value="D">D · Faible</option></select><p className="mt-1 text-[11px] text-slate-400">Évalue la qualité de la configuration, pas le résultat futur du trade.</p></div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-sm font-black text-violet-700">3</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Lecture du marché</h4><p className="text-xs text-slate-400">Biais multi-timeframe, phase et session</p></div></div><div className="rounded-xl border border-slate-100 p-4"><h4 className="mb-3 text-sm font-extrabold text-[#0b1f35]">Contexte et biais</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectField id="analysis-daily-bias" label="Biais Daily" value={form.dailyBias} onChange={v => setField('dailyBias', v as Bias)} options={['Haussier','Baissier','Neutre','En attente']} />
              <SelectField id="analysis-htf-bias" label="Biais HTF" value={form.htfBias} onChange={v => setField('htfBias', v as Bias)} options={['Haussier','Baissier','Neutre','En attente']} />
              <SelectField id="analysis-entry-bias" label="Biais d’entrée" value={form.entryBias} onChange={v => setField('entryBias', v as Bias)} options={['Haussier','Baissier','Neutre','En attente']} />
              <SelectField id="analysis-htf" label="Timeframe HTF" value={form.htf} onChange={v => setField('htf', v)} options={['Monthly','Weekly','D1','H4','H1']} />
              <SelectField id="analysis-ltf" label="Timeframe LTF" value={form.ltf} onChange={v => setField('ltf', v)} options={['H1','M30','M15','M5','M1']} />
              <SelectField id="analysis-phase" label="Phase du marché" value={form.marketPhase} onChange={v => setField('marketPhase', v as MarketPhase)} options={['Accumulation','Expansion','Distribution','Retracement','Consolidation','Reversal','En attente']} />
              <SelectField id="analysis-session" label="Session" value={form.session} onChange={v => setField('session', v)} options={['','Asia','London','New York','London / New York']} />
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-100 p-4"><h4 className="mb-3 text-sm font-extrabold text-[#0b1f35]">Liquidité et exécution</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="analysis-liquidity" label="Liquidité ciblée" value={form.liquidityTarget} onChange={v => setField('liquidityTarget', v)} placeholder="PDH, PDL, BSL, SSL, BSL/SSL interne…" />
              <TextField id="analysis-poi" label="Zone d’intérêt (POI)" value={form.poi} onChange={v => setField('poi', v)} placeholder="OB, FVG, SIBI/BISI, zone de demande…" />
              <TextField id="analysis-confirmation" label="Confirmation attendue" value={form.confirmation} onChange={v => setField('confirmation', v)} placeholder="Sweep, MSS, displacement, clôture…" />
              <TextField id="analysis-invalidation" label="Invalidation du scénario" value={form.invalidation} onChange={v => setField('invalidation', v)} placeholder="Niveau ou condition qui invalide le biais…" />
            </div>
          </div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-sm font-black text-amber-700">4</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Plan de trading</h4><p className="text-xs text-slate-400">Prix d’entrée, invalidation et objectif</p></div></div><div className="grid grid-cols-3 gap-3"><PriceField id="analysis-pe" label="PE" value={form.entryPrice} onChange={v => setField('entryPrice', v)} /><PriceField id="analysis-sl" label="SL" value={form.stopLoss} onChange={v => setField('stopLoss', v)} /><PriceField id="analysis-tp" label="TP" value={form.takeProfit} onChange={v => setField('takeProfit', v)} /></div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-sm font-black text-indigo-700">5</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Rédaction de l’analyse</h4><p className="text-xs text-slate-400">Mise en forme, arguments et scénario</p></div></div><div><label htmlFor="analysis-notes" className="mb-1.5 block text-xs font-bold text-slate-600">Contenu de l’analyse</label>
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
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">6</span><div><h4 className="text-sm font-extrabold text-[#0b1f35]">Publication</h4><p className="text-xs text-slate-400">Choisir qui peut voir cette analyse</p></div></div><div><label htmlFor="analysis-status" className="mb-1.5 block text-xs font-bold text-slate-600">Publication</label><select id="analysis-status" value={form.status} onChange={e => setField('status', e.target.value as Status)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="published">Publier aux membres</option><option value="draft">Garder en brouillon</option><option value="closed">Clôturer</option></select></div></section>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600">Annuler</button><button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#00a982] px-4 text-sm font-bold text-white hover:bg-[#008f72] disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Ajouter'}</button></footer>
        </form>
      </section>
    </div>}
  </div>;
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-slate-700">{value}</p></div>;
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
function MiniLevel({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-black tabular-nums text-[#0b1f35]">{Number(value).toFixed(2)}</p></div>;
}
