import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ExternalLink, Pencil, Plus, Save, ShieldCheck, Trash2, AlertCircle, Clock3 } from 'lucide-react';
import { auth, db } from '../firebase/config';

type AnalysisStatus = 'draft' | 'published' | 'closed';
type AnalysisDirection = 'BUY' | 'SELL';
type DailyAnalysis = {
  id: string;
  tradingViewUrl: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  direction: AnalysisDirection;
  setup: string;
  notes: string;
  status: AnalysisStatus;
  createdAt?: { toDate?: () => Date } | string;
  updatedAt?: unknown;
};

type FormState = {
  tradingViewUrl: string;
  direction: AnalysisDirection;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  setup: string;
  notes: string;
  status: AnalysisStatus;
};

const emptyForm: FormState = {
  tradingViewUrl: '',
  direction: 'BUY',
  entryPrice: '',
  stopLoss: '',
  takeProfit: '',
  setup: '',
  notes: '',
  status: 'draft',
};

function isTradingViewUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'tradingview.com' || url.hostname.endsWith('.tradingview.com'));
  } catch {
    return false;
  }
}

function getDateKey(value: DailyAnalysis['createdAt']) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().toLocaleDateString('en-CA');
  if (typeof value === 'string') return new Date(value).toLocaleDateString('en-CA');
  return '';
}

function formatDate(value: DailyAnalysis['createdAt']) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().toLocaleString('fr-FR');
  if (typeof value === 'string') return new Date(value).toLocaleString('fr-FR');
  return 'Date en cours de synchronisation';
}

export function AnalysisAdminPanel() {
  const [analyses, setAnalyses] = useState<DailyAnalysis[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'dailyAnalyses'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => {
      setAnalyses(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as DailyAnalysis)));
      setLoading(false);
      setError('');
    }, err => {
      setError(err.code === 'permission-denied'
        ? 'Accès refusé par Firestore. Vérifiez les règles administrateur.'
        : 'Impossible de charger les analyses. Vérifiez la connexion puis réessayez.');
      setLoading(false);
    });
  }, []);

  const todayCount = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return analyses.filter(item => item.status === 'published' && getDateKey(item.createdAt) === today).length;
  }, [analyses]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setSuccess('');
  };

  const editAnalysis = (item: DailyAnalysis) => {
    setEditingId(item.id);
    setForm({
      tradingViewUrl: item.tradingViewUrl || '',
      direction: item.direction || 'BUY',
      entryPrice: String(item.entryPrice ?? ''),
      stopLoss: String(item.stopLoss ?? ''),
      takeProfit: String(item.takeProfit ?? ''),
      setup: item.setup || '',
      notes: item.notes || '',
      status: item.status || 'draft',
    });
    setSuccess('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.currentUser) {
      setError('Votre session a expiré. Reconnectez-vous.');
      return;
    }
    if (!isTradingViewUrl(form.tradingViewUrl.trim())) {
      setError('Collez un lien TradingView valide commençant par https://www.tradingview.com/.');
      return;
    }
    const entryPrice = Number(form.entryPrice);
    const stopLoss = Number(form.stopLoss);
    const takeProfit = Number(form.takeProfit);
    if (![entryPrice, stopLoss, takeProfit].every(value => Number.isFinite(value) && value > 0)) {
      setError('Le PE, le SL et le TP doivent être des prix supérieurs à zéro.');
      return;
    }
    if ((form.direction === 'BUY' && !(stopLoss < entryPrice && entryPrice < takeProfit)) ||
        (form.direction === 'SELL' && !(takeProfit < entryPrice && entryPrice < stopLoss))) {
      setError('Vérifiez les niveaux : pour un achat, SL < PE < TP ; pour une vente, TP < PE < SL.');
      return;
    }
    if (!form.setup.trim()) {
      setError('Renseignez le setup de trading.');
      return;
    }
    if (form.status === 'published' && !editingId && todayCount >= 2) {
      setError('La limite de deux analyses publiées aujourd’hui est atteinte. Modifiez une analyse existante ou enregistrez un brouillon.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    const payload = {
      asset: 'XAUUSD',
      tradingViewUrl: form.tradingViewUrl.trim(),
      direction: form.direction,
      entryPrice,
      stopLoss,
      takeProfit,
      setup: form.setup.trim(),
      notes: form.notes.trim(),
      status: form.status,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, 'dailyAnalyses', editingId), payload);
        setSuccess('Analyse mise à jour.');
      } else {
        await addDoc(collection(db, 'dailyAnalyses'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser.uid,
        });
        setSuccess(form.status === 'published' ? 'Analyse XAUUSD publiée.' : 'Brouillon enregistré.');
      }
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible. Vérifiez les règles Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const removeAnalysis = async (item: DailyAnalysis) => {
    if (!window.confirm('Supprimer définitivement cette analyse XAUUSD ?')) return;
    try {
      await deleteDoc(doc(db, 'dailyAnalyses', item.id));
      if (editingId === item.id) resetForm();
      setSuccess('Analyse supprimée.');
      setError('');
    } catch {
      setError('Suppression impossible. Vérifiez les autorisations Firestore.');
    }
  };

  const closeAnalysis = async (item: DailyAnalysis) => {
    try {
      await updateDoc(doc(db, 'dailyAnalyses', item.id), {
        status: 'closed',
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || '',
      });
      setSuccess('Analyse clôturée.');
      setError('');
    } catch {
      setError('Impossible de clôturer cette analyse.');
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-[#0b1f35] p-5 text-white sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" /> Administration
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Publier une analyse</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Espace de publication réservé à l’admin. Actif suivi : XAUUSD (Gold) uniquement.</p>
            </div>
            <div className="min-w-32 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Publications du jour</p>
              <p className="mt-1 text-3xl font-black tabular-nums">{todayCount}<span className="text-base text-slate-400"> / 2</span></p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-black text-[#0b1f35]">{editingId ? 'Modifier l’analyse' : 'Nouvelle analyse XAUUSD'}</h3>
            {editingId && <button type="button" onClick={resetForm} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"><X className="h-4 w-4" /> Annuler la modification</button>}
          </div>

          <div>
            <label htmlFor="analysis-tv" className="mb-2 block text-xs font-bold text-slate-600">Lien TradingView <span className="text-rose-500">*</span></label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="analysis-tv" type="url" required value={form.tradingViewUrl} onChange={e => setField('tradingViewUrl', e.target.value)} placeholder="https://www.tradingview.com/chart/…" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#00a982] focus:ring-2 focus:ring-[#00a982]/15" />
              {isTradingViewUrl(form.tradingViewUrl) && <a href={form.tradingViewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-[#0b1f35] hover:bg-slate-50"><ExternalLink className="h-4 w-4" /> Tester le lien</a>}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">Le lien sera conservé et proposé aux membres. L’affichage intégré dépendra des possibilités d’intégration TradingView de ce lien.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="analysis-direction" className="mb-2 block text-xs font-bold text-slate-600">Sens du scénario <span className="text-rose-500">*</span></label>
              <select id="analysis-direction" value={form.direction} onChange={e => setField('direction', e.target.value as AnalysisDirection)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#0b1f35] outline-none focus:border-[#00a982]">
                <option value="BUY">ACHAT — BUY</option><option value="SELL">VENTE — SELL</option>
              </select>
            </div>
            <div>
              <label htmlFor="analysis-setup" className="mb-2 block text-xs font-bold text-slate-600">Setup <span className="text-rose-500">*</span></label>
              <input id="analysis-setup" required maxLength={120} value={form.setup} onChange={e => setField('setup', e.target.value)} placeholder="Ex. Sweep de liquidité + MSS" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#00a982]" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <PriceField id="analysis-entry" label="Prix d’entrée (PE)" value={form.entryPrice} onChange={value => setField('entryPrice', value)} />
            <PriceField id="analysis-sl" label="Stop-loss (SL)" value={form.stopLoss} onChange={value => setField('stopLoss', value)} />
            <PriceField id="analysis-tp" label="Take-profit (TP)" value={form.takeProfit} onChange={value => setField('takeProfit', value)} />
          </div>

          <div>
            <label htmlFor="analysis-notes" className="mb-2 block text-xs font-bold text-slate-600">Notes explicatives</label>
            <textarea id="analysis-notes" rows={5} maxLength={5000} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Explique le scénario, les confirmations attendues et les conditions qui invalideraient l’idée…" className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#00a982]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_2fr] sm:items-end">
            <div>
              <label htmlFor="analysis-status" className="mb-2 block text-xs font-bold text-slate-600">État de publication</label>
              <select id="analysis-status" value={form.status} onChange={e => setField('status', e.target.value as AnalysisStatus)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#00a982]">
                <option value="draft">Brouillon — admin uniquement</option><option value="published">Publier aux membres</option><option value="closed">Clôturée</option>
              </select>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={resetForm} className="min-h-12 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50">Réinitialiser</button>
              <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#00a982] px-6 text-sm font-black text-white transition hover:bg-[#008f72] disabled:cursor-wait disabled:opacity-60">{saving ? <Clock3 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{saving ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : form.status === 'published' ? 'Publier l’analyse' : 'Enregistrer le brouillon'}</button>
            </div>
          </div>
          {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{success}</div>}
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h3 className="text-lg font-black text-[#0b1f35]">Mes analyses XAUUSD</h3><p className="mt-1 text-sm text-slate-500">Brouillons, publications et analyses clôturées.</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{analyses.length} analyse(s)</span>
        </div>
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement des analyses…</div> :
          analyses.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-bold text-[#0b1f35]">Aucune analyse pour le moment</p><p className="mt-2 text-sm text-slate-500">Créez la première analyse XAUUSD avec le formulaire ci-dessus.</p></div> :
          <div className="grid gap-4 xl:grid-cols-2">{analyses.map(item => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">XAUUSD</span><span className={'rounded-full px-2.5 py-1 text-[10px] font-black uppercase ' + (item.status === 'published' ? 'bg-emerald-100 text-emerald-700' : item.status === 'closed' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700')}>{item.status === 'published' ? 'Publié' : item.status === 'closed' ? 'Clôturé' : 'Brouillon'}</span></div><h4 className="mt-3 text-base font-black text-[#0b1f35]">{item.setup}</h4><p className="mt-1 text-xs text-slate-400">{formatDate(item.createdAt)}</p></div>
                <span className={'rounded-xl px-3 py-2 text-xs font-black ' + (item.direction === 'BUY' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{item.direction === 'BUY' ? 'ACHAT' : 'VENTE'}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Level label="PE" value={item.entryPrice} />
                <Level label="SL" value={item.stopLoss} />
                <Level label="TP" value={item.takeProfit} />
              </div>
              {item.notes && <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.notes}</p>}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <a href={item.tradingViewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-[#0b1f35] hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" /> TradingView</a>
                <button type="button" onClick={() => editAnalysis(item)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
                {item.status === 'published' && <button type="button" onClick={() => void closeAnalysis(item)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Clôturer</button>}
                <button type="button" onClick={() => void removeAnalysis(item)} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-100 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
              </div>
            </article>
          ))}</div>
        }
      </section>
    </div>
  );
}

function PriceField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className="mb-2 block text-xs font-bold text-slate-600">{label} <span className="text-rose-500">*</span></label><input id={id} type="number" inputMode="decimal" step="0.01" min="0.01" required value={value} onChange={event => onChange(event.target.value)} placeholder="Ex. 4350.00" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-sm tabular-nums outline-none focus:border-[#00a982]" /></div>;
}

function Level({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-black tabular-nums text-[#0b1f35]">{Number(value).toFixed(2)}</p></div>;
}
