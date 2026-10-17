import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Copy, Gift, Loader2, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { auth } from '../firebase/config';
import { useToast } from '../components/common/Toast';

type PromoKind = 'code' | 'seasonal';
type Plan = 'pro' | 'community';
type Promotion = {
  id: string; kind: PromoKind; code?: string; name: string; active: boolean;
  discountType: 'percent' | 'fixed'; discountValue: number; plans: Plan[];
  startsAt: string; endsAt: string; createdAt?: string; maxUses?: number | null; uses?: number;
  creatorName?: string; newSubscriptions?: number; renewals?: number; imageUrl?: string; imagePublicId?: string;
};
const PLAN_PRICES: Record<Plan, number> = { pro: 9.99, community: 89.99 };
const money = (value: number) => '$' + value.toFixed(2);
const localDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const makeCode = (prefix: string) => prefix + '-' + Array.from(crypto.getRandomValues(new Uint8Array(5))).map(value => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[value % 32]).join('');

export function PromotionCenter() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<PromoKind>('code');
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState('');
  const [prefix, setPrefix] = useState('IAM');
  const [code, setCode] = useState(() => makeCode('IAM'));
  const [confirmedCode, setConfirmedCode] = useState('');
  const [name, setName] = useState('');
  const [plans, setPlans] = useState<Plan[]>(['pro']);
  const [discount, setDiscount] = useState('10');
  const [startsAt, setStartsAt] = useState(() => localDateTime(new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(() => localDateTime(new Date(Date.now() + 7 * 86400000).toISOString()));
  const [maxUses, setMaxUses] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePublicId, setImagePublicId] = useState('');
  const [editing, setEditing] = useState<Promotion | null>(null);

  async function request<T = any>(action: string, data?: Record<string, unknown>): Promise<T> {
    const user = auth.currentUser;
    if (!user) throw new Error('Session administrateur introuvable.');
    const token = await user.getIdToken();
    const response = await fetch('/api/admin/mutation', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action, data })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Opération impossible.');
    return payload as T;
  }
  async function load() {
    setLoading(true);
    try { const result = await request<{ promotions: Promotion[] }>('get-promotions'); setItems(result.promotions || []); }
    catch (error: any) { showToast(error?.message || 'Chargement des offres impossible.', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => items.filter(item => item.kind === tab && [item.name, item.code, item.creatorName].some(value => String(value || '').toLowerCase().includes(query.toLowerCase()))).sort((a,b) => new Date(b.createdAt || b.startsAt).getTime() - new Date(a.createdAt || a.startsAt).getTime()), [items, tab, query]);

  function openCreate() {
    setEditing(null); setName(''); setPlans(['pro']); setDiscount('10'); setMaxUses('');
    setStartsAt(localDateTime(new Date().toISOString())); setEndsAt(localDateTime(new Date(Date.now() + 7 * 86400000).toISOString()));
    setPrefix('IAM'); setCode(makeCode('IAM')); setConfirmedCode(''); setSeasonId(''); setImageUrl(''); setImagePublicId(''); setModal(true);
  }
  function regenerate(nextPrefix = prefix) { setPrefix(nextPrefix); setCode(makeCode(nextPrefix)); setConfirmedCode(''); }
  function openEdit(item: Promotion) {
    setEditing(item); setName(item.name); setPlans(item.plans); setDiscount(String(item.discountValue));
    setStartsAt(localDateTime(item.startsAt)); setEndsAt(localDateTime(item.endsAt)); setMaxUses(item.maxUses ? String(item.maxUses) : '');
    setPrefix(item.code?.split('-')[0] || 'IAM'); setCode(item.code || ''); setConfirmedCode(item.code || ''); setSeasonId(item.id); setImageUrl(item.imageUrl || ''); setImagePublicId(item.imagePublicId || ''); setModal(true);
  }
  const amountFor = (plan: Plan) => {
    const base = PLAN_PRICES[plan]; const amount = Number(discount);
    const reduction = !Number.isFinite(amount) || amount <= 0 ? 0 : Math.min(base, base * Math.min(100, amount) / 100);
    return { base, reduction, final: Math.max(0, base - reduction) };
  };
  async function save() {
    if (!name.trim() || !plans.length || !startsAt || !endsAt || new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      showToast('Complétez le nom, les forfaits et une période valide.', 'error'); return;
    }
    if (tab === 'code' && code !== confirmedCode.trim().toUpperCase()) { showToast('Confirmez exactement le code généré.', 'error'); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        id: editing?.id || seasonId || undefined, kind: tab, name: name.trim(), code: tab === 'code' ? code : undefined,
        discountType: 'percent', discountValue: Number(discount), plans,
        startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(),
        maxUses: maxUses.trim() ? Number(maxUses) : null, active: editing?.active ?? true,
        ...(tab === 'seasonal' ? { imageUrl: imageUrl || null, imagePublicId: imagePublicId || null } : {}),
        editing: Boolean(editing)
      };
      await request('save-promotion', payload);
      showToast(tab === 'code' ? 'Code promo enregistré.' : 'Discount enregistré.', 'success');
      setModal(false); await load();
    } catch (error: any) { showToast(error?.message || 'Enregistrement impossible.', 'error'); }
    finally { setBusy(false); }
  }
  async function remove(item: Promotion) {
    if (!window.confirm('Supprimer cette offre ? Cette action ne peut pas être annulée.')) return;
    try { await request('delete-promotion', { id: item.id }); showToast('Offre supprimée.', 'success'); await load(); }
    catch (error: any) { showToast(error?.message || 'Suppression impossible.', 'error'); }
  }

  return <section className="space-y-5">
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-700"><Gift className="h-4 w-4"/>Centre des offres</div><h2 className="mt-2 text-2xl font-black tracking-tight text-[#10243b]">Promotions & avantages</h2><p className="mt-1 text-sm text-slate-500">Gérez les codes promo et les campagnes de réduction saisonnières.</p></div>
      <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10243b] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#173c57]"><Plus className="h-4 w-4"/>Créer {tab === 'code' ? 'un code promo' : 'un discount'}</button>
    </div>
    <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
      <button onClick={() => setTab('code')} className={'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold '+(tab === 'code' ? 'bg-[#10243b] text-white' : 'text-slate-500 hover:bg-slate-50')}><Tag className="h-4 w-4"/>Code promo</button>
      <button onClick={() => setTab('seasonal')} className={'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold '+(tab === 'seasonal' ? 'bg-[#10243b] text-white' : 'text-slate-500 hover:bg-slate-50')}><CalendarClock className="h-4 w-4"/>Discount</button>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold text-[#10243b]">{tab === 'code' ? 'Répertoire des codes promo' : 'Répertoire des discounts'}</h3><p className="mt-1 text-xs text-slate-500">{visible.length} offre(s) enregistrée(s)</p></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 sm:w-64"/></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{['#','Date','Début','Fin',tab === 'code' ? 'Code' : 'Campagne','Créateur','Prix','Réduc. %','Prix réduit','Nouv. abonn.','Réabonn.','Actions'].map(label=><th key={label} className="whitespace-nowrap px-4 py-3 font-extrabold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? <tr><td colSpan={12} className="p-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin"/>Chargement…</td></tr> : visible.map((item,index) => { const plan = item.plans[0] || 'pro'; const amount = PLAN_PRICES[plan]; const final = item.discountType === 'percent' ? amount * (1 - item.discountValue / 100) : Math.max(0, amount - item.discountValue); return <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-4 font-bold text-slate-400">{index+1}</td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{new Date(item.createdAt || item.startsAt).toLocaleDateString('fr-FR')}</td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{new Date(item.startsAt).toLocaleString('fr-FR')}</td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{new Date(item.endsAt).toLocaleString('fr-FR')}</td><td className="px-4 py-4">{item.code ? <button onClick={() => { void navigator.clipboard.writeText(item.code!); showToast('Code copié.', 'success'); }} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 font-mono font-black text-blue-700">{item.code}<Copy className="h-3 w-3"/></button> : <span className="inline-flex items-center gap-2 font-bold text-slate-800">{item.imageUrl && <img src={item.imageUrl} alt="Visuel de campagne" className="h-8 w-16 rounded object-cover"/>}{item.name}</span>}</td><td className="px-4 py-4 text-slate-600">{item.creatorName || '—'}</td><td className="px-4 py-4 font-semibold text-slate-500">{money(amount)}{item.plans.length > 1 ? '+' : ''}</td><td className="px-4 py-4 text-center font-extrabold text-emerald-700">{item.discountType === 'percent' ? `${item.discountValue}%` : `${amount > 0 ? Math.round((Math.min(amount, item.discountValue) / amount) * 100) : 0}%`}</td><td className="px-4 py-4 font-black text-emerald-700">{money(Math.max(0, final))}{item.plans.length > 1 ? '+' : ''}</td><td className="px-4 py-4 text-center font-bold">{item.newSubscriptions || 0}</td><td className="px-4 py-4 text-center font-bold">{item.renewals || 0}</td><td className="px-4 py-4"><div className="flex gap-2"><button onClick={() => openEdit(item)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">Modifier</button><button onClick={() => void remove(item)} className="rounded-lg border border-rose-100 p-1.5 text-rose-600 hover:bg-rose-50" title="Supprimer"><Trash2 className="h-3.5 w-3.5"/></button></div></td></tr>; })}
        {!loading && !visible.length && <tr><td colSpan={12} className="p-12 text-center text-sm text-slate-400">Aucune offre dans cet onglet.</td></tr>}
      </tbody></table></div>
    </div>
    {modal && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#071a2d]/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="promotion-modal-title" onClick={() => !busy && setModal(false)}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 p-5"><div><h3 id="promotion-modal-title" className="text-xl font-black text-[#10243b]">{editing ? 'Modifier l’offre' : tab === 'code' ? 'Créer un code promo' : 'Créer un discount'}</h3><p className="mt-1 text-sm text-slate-500">Les réductions sont calculées avant la création du paiement.</p></div><button onClick={() => setModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
        <div className="space-y-5 p-5">
          {tab === 'code' && <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4"><label className="mb-2 block text-xs font-extrabold text-slate-700">Code généré automatiquement</label><div className="flex flex-wrap gap-2"><select value={prefix} disabled={!!editing} onChange={event => regenerate(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"><option>IAM</option><option>XAU</option><option>FX</option></select><input readOnly value={code} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm font-black tracking-wider"/><button type="button" disabled={!!editing} onClick={() => regenerate()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold">Régénérer</button></div><label className="mt-3 block text-xs font-bold text-slate-600">Confirmer le code en le recopiant</label><input value={confirmedCode} onChange={event => setConfirmedCode(event.target.value.toUpperCase())} placeholder="Recopiez le code affiché" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-blue-400"/></div>}
          <label className="block text-xs font-bold text-slate-600">Nom de l’offre<input value={name} onChange={event => setName(event.target.value)} placeholder={tab === 'code' ? 'Ex. Offre communauté' : 'Ex. Noël 2026'} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"/></label>
          <div><div className="mb-2 text-xs font-bold text-slate-600">Formule(s) concernée(s)</div><div className="grid gap-2 sm:grid-cols-2">{(['pro','community'] as Plan[]).map(plan => <label key={plan} className={'flex cursor-pointer items-center gap-3 rounded-xl border p-3 '+(plans.includes(plan) ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200')}><input type="checkbox" checked={plans.includes(plan)} onChange={event => setPlans(current => event.target.checked ? [...current,plan] : current.filter(value => value !== plan))}/><span className="flex-1"><b className="block text-sm text-slate-800">{plan === 'pro' ? 'Plus' : 'Community'}</b><small className="text-slate-500">{money(PLAN_PRICES[plan])} au tarif normal</small></span></label>)}</div></div>
          <label className="block text-xs font-bold text-slate-600">Pourcentage de réduction (%)<input type="number" min="0.01" max="100" step="0.01" value={discount} onChange={event => setDiscount(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"/></label>
          <div className="grid gap-2 sm:grid-cols-2">{plans.map(plan => { const amount=amountFor(plan); return <div key={plan} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"><div className="text-xs font-bold text-slate-500">{plan === 'pro' ? 'Plus' : 'Community'}</div><div className="mt-1 flex items-center gap-2 text-sm"><span className="text-slate-400 line-through">{money(amount.base)}</span><span className="font-black text-emerald-700">{money(amount.final)}</span><span className="ml-auto rounded-md bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">−{money(amount.reduction)}</span></div></div>; })}</div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-600">Début de l’offre (date et heure)<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"/></label><label className="block text-xs font-bold text-slate-600">Fin de l’offre (date et heure)<input type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"/></label></div>
          {tab === 'seasonal' && <div className="rounded-xl border border-dashed border-slate-300 p-4">
            <label className="block text-xs font-extrabold text-slate-700">Image de la campagne <span className="font-normal text-slate-400">(facultative)</span></label>
            <p className="mt-1 text-xs text-slate-500">Format recommandé : 1200 × 400 px (ratio 3:1), JPG, PNG ou WebP, 450 Ko maximum.</p>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold" onChange={async event => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { showToast('Utilisez une image JPG, PNG ou WebP.', 'error'); event.target.value = ''; return; }
              if (file.size > 450 * 1024) { showToast('L’image doit peser 450 Ko maximum.', 'error'); event.target.value = ''; return; }
              try {
                const dimensions = await new Promise<{width:number;height:number}>((resolve,reject) => {
                  const url = URL.createObjectURL(file); const img = new Image();
                  img.onload = () => { resolve({width:img.naturalWidth,height:img.naturalHeight}); URL.revokeObjectURL(url); };
                  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); }; img.src = url;
                });
                if (Math.abs(dimensions.width / dimensions.height - 3) > 0.03) { showToast('L’image doit être au format horizontal 3:1, idéalement 1200 × 400 px.', 'error'); event.target.value = ''; return; }
                setBusy(true);
                const form = new FormData();
                form.append('file', file, file.name);
                form.append('upload_preset', 'piptalk_media');
                form.append('folder', 'iamtrader/promotions/' + (editing?.id || seasonId || crypto.randomUUID()));
                const response = await fetch('https://api.cloudinary.com/v1_1/ocgef9bk/auto/upload', { method: 'POST', body: form });
                const uploaded = await response.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
                if (!response.ok || !uploaded.secure_url || !uploaded.public_id) throw new Error(uploaded.error?.message || 'Échec du téléversement Cloudinary. Vérifiez le preset piptalk_media.');
                setImageUrl(uploaded.secure_url); setImagePublicId(uploaded.public_id);
              } catch (error: any) { showToast(error?.message || 'Impossible de téléverser l’image.', 'error'); event.target.value = ''; }
              finally { setBusy(false); }
            }}/>
            {imageUrl && <div className="mt-3"><img src={imageUrl} alt="Aperçu de la bannière" className="max-h-36 w-full rounded-lg border border-slate-200 object-cover"/><button type="button" onClick={() => { setImageUrl(''); setImagePublicId(''); }} className="mt-2 text-xs font-bold text-rose-600">Retirer l’image</button></div>}
          </div>}
          <label className="block text-xs font-bold text-slate-600">Nombre maximal d’utilisations <span className="font-normal text-slate-400">(facultatif)</span><input type="number" min="1" step="1" value={maxUses} onChange={event => setMaxUses(event.target.value)} placeholder="Illimité si vide" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"/></label>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:justify-end"><button onClick={() => setModal(false)} disabled={busy} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600">Annuler</button><button onClick={() => void save()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10243b] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}{busy ? 'Enregistrement…' : 'Enregistrer l’offre'}</button></div>
      </div>
    </div>}
  </section>;
}
