import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Plus, Pencil, X, ExternalLink, Save, LoaderCircle, Trash2 } from 'lucide-react';
import { auth, db } from '../firebase/config';

type Status = 'draft' | 'published' | 'closed';
type Direction = 'BUY' | 'SELL';
type Analysis = {
  id: string; asset?: string; tradingViewUrl: string; entryPrice: number; stopLoss: number;
  takeProfit: number; direction: Direction; setup: string; notes: string; status: Status;
  createdAt?: { toDate?: () => Date } | string;
};
type FormState = {
  tradingViewUrl: string; direction: Direction; entryPrice: string; stopLoss: string;
  takeProfit: string; setup: string; notes: string; status: Status;
};
const blank: FormState = { tradingViewUrl: '', direction: 'BUY', entryPrice: '', stopLoss: '', takeProfit: '', setup: '', notes: '', status: 'published' };

function validTradingViewUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'tradingview.com' || url.hostname.endsWith('.tradingview.com'));
  } catch { return false; }
}
function tradingViewEmbedUrl(_value: string) {
  const params = new URLSearchParams({
    frameElementId: 'tradingview_analysis_chart',
    symbol: 'OANDA:XAUUSD',
    interval: '60',
    hidesidetoolbar: '1',
    symboledit: '0',
    saveimage: '0',
    toolbarbg: 'F1F3F6',
    studies: '[]',
    theme: 'light',
    style: '1',
    timezone: 'Etc/UTC',
    withdateranges: '1',
    hideideas: '1',
    locale: 'fr',
    utm_source: 'iamtrader.com',
    utm_medium: 'widget',
    utm_campaign: 'chart',
  });
  return 'https://s.tradingview.com/widgetembed/?' + params.toString();
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
    const q = isAdmin
      ? query(collection(db, 'dailyAnalyses'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'dailyAnalyses'), where('status', '==', 'published'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Analysis));
      setItems(isAdmin ? all : all.filter(a => a.status === 'published'));
      setLoading(false);
      setError('');
    }, err => {
      setError(err.code === 'permission-denied' ? 'Accès refusé par Firestore.' : 'Impossible de charger les analyses pour le moment.');
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
      takeProfit: String(item.takeProfit ?? ''), setup: item.setup || '', notes: item.notes || '',
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
      entryPrice: entry, stopLoss: sl, takeProfit: tp, setup: form.setup.trim(), notes: form.notes.trim(),
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
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black tracking-wide text-amber-700">XAUUSD</span><span className={'rounded-full px-2 py-1 text-[10px] font-bold ' + (item.status === 'published' ? 'bg-emerald-50 text-emerald-700' : item.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700')}>{item.status === 'published' ? 'Publié' : item.status === 'closed' ? 'Clôturé' : 'Brouillon'}</span></div><h3 className="mt-2 truncate text-sm font-extrabold text-[#0b1f35]">{item.setup}</h3><p className="mt-1 text-[11px] text-slate-400">{formatDate(item.createdAt)}</p></div>
          <span className={'rounded-lg px-2.5 py-1.5 text-[10px] font-black ' + (item.direction === 'BUY' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{item.direction === 'BUY' ? 'BUY' : 'SELL'}</span>
        </div>
        <div className="mx-4 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          {validTradingViewUrl(item.tradingViewUrl) ? <iframe title={'Graphique TradingView XAUUSD ' + item.setup} src={tradingViewEmbedUrl(item.tradingViewUrl)} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-[70vh] min-h-[520px] max-h-[1000px] w-full bg-white" /> : <div className="flex h-44 items-center justify-center text-sm text-slate-400">Aperçu TradingView indisponible</div>}
        </div>
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          <MiniLevel label="PE" value={item.entryPrice} /><MiniLevel label="SL" value={item.stopLoss} /><MiniLevel label="TP" value={item.takeProfit} />
        </div>
        {item.notes && <p className="px-5 pt-4 text-sm leading-6 text-slate-600">{item.notes}</p>}
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
      <section role="dialog" aria-modal="true" aria-labelledby="analysis-modal-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 id="analysis-modal-title" className="text-base font-black text-[#0b1f35]">{editingId ? 'Modifier l’analyse' : 'Ajouter une analyse'}</h3><p className="mt-1 text-xs text-slate-500">XAUUSD · Gold</p></div><button type="button" onClick={() => !saving && setModalOpen(false)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
        <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5">
          <div><label htmlFor="analysis-tv-url" className="mb-1.5 block text-xs font-bold text-slate-600">Lien TradingView</label><input id="analysis-tv-url" type="url" required value={form.tradingViewUrl} onChange={e => setField('tradingViewUrl', e.target.value)} placeholder="https://www.tradingview.com/chart/…" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#00a982] focus:ring-2 focus:ring-emerald-50" /></div>
          {validTradingViewUrl(form.tradingViewUrl) && <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><div className="flex items-center justify-between px-3 py-2"><span className="text-[11px] font-bold text-slate-500">Aperçu du graphique</span><a href={form.tradingViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#008f72]">Ouvrir <ExternalLink className="h-3 w-3" /></a></div><iframe title="Aperçu TradingView" src={tradingViewEmbedUrl(form.tradingViewUrl)} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-40 w-full border-t border-slate-200 bg-white sm:h-48" /></div>}
          <div className="grid grid-cols-2 gap-3"><div><label htmlFor="analysis-direction" className="mb-1.5 block text-xs font-bold text-slate-600">Scénario</label><select id="analysis-direction" value={form.direction} onChange={e => setField('direction', e.target.value as Direction)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="BUY">Achat · BUY</option><option value="SELL">Vente · SELL</option></select></div><div><label htmlFor="analysis-setup" className="mb-1.5 block text-xs font-bold text-slate-600">Setup</label><input id="analysis-setup" required maxLength={120} value={form.setup} onChange={e => setField('setup', e.target.value)} placeholder="Ex. Sweep + MSS" className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div></div>
          <div className="grid grid-cols-3 gap-3"><PriceField id="analysis-pe" label="PE" value={form.entryPrice} onChange={v => setField('entryPrice', v)} /><PriceField id="analysis-sl" label="SL" value={form.stopLoss} onChange={v => setField('stopLoss', v)} /><PriceField id="analysis-tp" label="TP" value={form.takeProfit} onChange={v => setField('takeProfit', v)} /></div>
          <div><label htmlFor="analysis-notes" className="mb-1.5 block text-xs font-bold text-slate-600">Notes (facultatif)</label><textarea id="analysis-notes" rows={3} maxLength={5000} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Contexte, confirmations et invalidation du scénario…" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-5" /></div>
          <div><label htmlFor="analysis-status" className="mb-1.5 block text-xs font-bold text-slate-600">Publication</label><select id="analysis-status" value={form.status} onChange={e => setField('status', e.target.value as Status)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="published">Publier aux membres</option><option value="draft">Garder en brouillon</option><option value="closed">Clôturer</option></select></div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600">Annuler</button><button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#00a982] px-4 text-sm font-bold text-white hover:bg-[#008f72] disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Ajouter'}</button></footer>
        </form>
      </section>
    </div>}
  </div>;
}

function PriceField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-bold text-slate-600">{label}</label><input id={id} type="number" inputMode="decimal" step="0.01" min="0.01" required value={value} onChange={e => onChange(e.target.value)} placeholder="4350.00" className="min-h-10 w-full min-w-0 rounded-xl border border-slate-200 px-2.5 text-sm tabular-nums" /></div>;
}
function MiniLevel({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-black tabular-nums text-[#0b1f35]">{Number(value).toFixed(2)}</p></div>;
}
