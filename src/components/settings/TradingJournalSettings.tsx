import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Settings2, CandlestickChart, Layers3, X, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { TradingInstrument, TradingSetup, UserProfile } from '../../types';
import { updateUserSettings } from '../../services/firestore';
import { useToast } from '../common/Toast';

interface TradingJournalSettingsProps {
  userProfile: UserProfile | null;
}

const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';

export function TradingJournalSettings({ userProfile }: TradingJournalSettingsProps) {
  const { showToast } = useToast();
  const [instruments, setInstruments] = useState<TradingInstrument[]>(userProfile?.settings?.instruments || []);
  const [setups, setSetups] = useState<TradingSetup[]>(userProfile?.settings?.setups || []);
  const [newSetup, setNewSetup] = useState('');
  const [instrumentFormOpen, setInstrumentFormOpen] = useState(false);
  const [setupFormOpen, setSetupFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'instrument' | 'setup'; id: string; label: string } | null>(null);
  const [instrument, setInstrument] = useState<TradingInstrument>({
    id: '',
    symbol: '',
    name: '',
    category: 'forex',
    priceStep: '',
    valuePerPriceUnit: '',
    defaultPositionSize: ''
  });
  const [saving, setSaving] = useState(false);

  const setupSuggestions = useMemo(() => {
    const catalog = ['FVG', 'IFVG', 'BISI', 'SIBI', 'Order Block', 'Breaker Block', 'Mitigation Block', 'Unicorn', 'Market Structure Shift (MSS)', 'Change of Character (CHOCH)', 'Liquidity Sweep', 'Buy Side Liquidity (BSL)', 'Sell Side Liquidity (SSL)', 'Fair Value Gap', 'SMT Divergence', 'OTE', 'Support / Resistance', 'Trendline Breakout', 'Supply and Demand', 'Opening Range Breakout'];
    const query = newSetup.trim().toLowerCase();
    if (!query) return [];
    const initialsQuery = query.replace(/[^a-z0-9]/g, '');
    return catalog.filter(name => { const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); const initials = words.map(word => word[0]).join(''); return name.toLowerCase().includes(query) || initials.startsWith(initialsQuery); }).filter(name => !setups.some(item => item.name.toLowerCase() === name.toLowerCase())).slice(0, 5);
  }, [newSetup, setups]);

  const canAddInstrument = useMemo(
    () => Boolean(instrument.symbol.trim() && instrument.name.trim() && Number(instrument.priceStep) > 0 && Number(instrument.valuePerPriceUnit) > 0),
    [instrument]
  );

  const persist = async (nextInstruments: TradingInstrument[], nextSetups: TradingSetup[]) => {
    if (!userProfile?.uid) return;
    setSaving(true);
    try {
      await updateUserSettings(userProfile.uid, {
        instruments: nextInstruments,
        setups: nextSetups
      });
      showToast('Paramètres du journal enregistrés', 'success');
    } catch (error: any) {
      showToast(`Erreur lors de l'enregistrement : ${error.message || 'Firestore'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addInstrument = async () => {
    if (!canAddInstrument) return;
    const symbol = instrument.symbol.trim().toUpperCase();
    const next = [...instruments.filter(item => item.symbol !== symbol), {
      ...instrument,
      id: instrument.id || crypto.randomUUID(),
      symbol,
      name: instrument.name.trim(),
      priceStep: Number(instrument.priceStep),
      valuePerPriceUnit: Number(instrument.valuePerPriceUnit),
      defaultPositionSize: instrument.defaultPositionSize ? Number(instrument.defaultPositionSize) : undefined
    }];
    setInstruments(next);
    setInstrument({ id: '', symbol: '', name: '', category: 'forex', priceStep: '', valuePerPriceUnit: '', defaultPositionSize: '' });
    await persist(next, setups);
  };

  const removeInstrument = async (id: string) => {
    const next = instruments.filter(item => item.id !== id);
    setInstruments(next);
    setDeleteTarget(null);
    await persist(next, setups);
  };

  const addSetup = async () => {
    const name = newSetup.trim();
    if (!name) return;
    const next = [...setups.filter(item => item.name.toLowerCase() !== name.toLowerCase()), { id: crypto.randomUUID(), name }];
    setSetups(next);
    setNewSetup('');
    await persist(instruments, next);
  };

  const removeSetup = async (id: string) => {
    const next = setups.filter(item => item.id !== id);
    setSetups(next);
    setDeleteTarget(null);
    await persist(instruments, next);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'instrument') await removeInstrument(deleteTarget.id);
    else await removeSetup(deleteTarget.id);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-100" /><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Settings2 className="h-5 w-5" /></div><div><h3 className="text-lg font-black tracking-tight text-slate-950">Journal & calculs</h3><p className="mt-1 text-sm text-slate-500">Configurez les instruments et les setups utilisés dans votre journal.</p></div></div><div className="flex items-center gap-2 self-start rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Enregistrement automatique</div></div></section>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CandlestickChart className="h-5 w-5" /></div><div><h4 className="text-base font-extrabold text-slate-950">Instruments</h4><p className="mt-0.5 text-xs text-slate-500">Valeurs utilisées pour calculer les résultats.</p></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{instruments.length}</span></div></div>
          <div className="space-y-4 p-5 sm:p-6"><button type="button" onClick={() => setInstrumentFormOpen(v => !v)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" />{instrumentFormOpen ? 'Fermer le formulaire' : 'Ajouter un instrument'}</button>{instrumentFormOpen && <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={labelClass}>Symbole *</label><input className={inputClass} value={instrument.symbol} onChange={e=>setInstrument(v=>({...v,symbol:e.target.value}))} placeholder="XAUUSD"/></div>
            <div className="sm:col-span-2"><p className="text-xs leading-5 text-slate-600">Saisissez uniquement le symbole. Chloé vous aidera à compléter les détails de l’instrument.</p></div><div><label className={labelClass}>Nom *</label><input className={inputClass} value={instrument.name} onChange={e=>setInstrument(v=>({...v,name:e.target.value}))} placeholder="Gold"/></div>
            <div><label className={labelClass}>Catégorie</label><select className={inputClass} value={instrument.category} onChange={e=>setInstrument(v=>({...v,category:e.target.value as TradingInstrument['category']}))}><option value="forex">Forex</option><option value="metal">Métal</option><option value="index">Indice</option><option value="futures">Futures</option><option value="crypto">Crypto</option><option value="stock">Action</option><option value="other">Autre</option></select></div>
            <div><label className={labelClass}>Pas de prix *</label><input type="number" step="any" min="0" className={inputClass} value={instrument.priceStep} onChange={e=>setInstrument(v=>({...v,priceStep:e.target.value}))} placeholder="0.01"/></div>
            <div><label className={labelClass}>Valeur par 1.00 *</label><input type="number" step="any" min="0" className={inputClass} value={instrument.valuePerPriceUnit} onChange={e=>setInstrument(v=>({...v,valuePerPriceUnit:e.target.value}))} placeholder="100"/></div>
            <div><label className={labelClass}>Taille par défaut</label><input type="number" step="any" min="0" className={inputClass} value={instrument.defaultPositionSize} onChange={e=>setInstrument(v=>({...v,defaultPositionSize:e.target.value}))} placeholder="1"/></div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-xs leading-5 text-emerald-900">« Valeur par 1.00 » correspond au gain ou à la perte pour un mouvement de 1.00 avec une unité de taille, dans la devise du compte.</div>
          <button type="button" disabled={!canAddInstrument||saving} onClick={addInstrument} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Plus className="h-4 w-4"/> Ajouter l’instrument</button>
          </div>}
          <div className="border-t border-slate-100 pt-4"><div className="mb-3 flex items-center justify-between"><h5 className="text-sm font-bold text-slate-900">Instruments configurés</h5><span className="text-xs text-slate-400">{instruments.length} au total</span></div>
            {instruments.length ? <div className="space-y-2">{instruments.map(item=><div key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3.5 py-3 transition hover:border-emerald-200"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xs font-black text-slate-600">{item.symbol.slice(0,3)}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{item.symbol}</p><p className="truncate text-xs text-slate-500">{item.name} · Valeur {item.valuePerPriceUnit}/1.00</p></div></div><button type="button" aria-label={`Supprimer ${item.symbol}`} disabled={saving} onClick={()=>setDeleteTarget({type:'instrument',id:item.id,label:item.symbol})} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="h-4 w-4"/></button></div>)}</div>:<div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center"><CandlestickChart className="mx-auto h-7 w-7 text-slate-300"/><p className="mt-2 text-sm font-semibold text-slate-700">Aucun instrument configuré</p><p className="mt-1 text-xs text-slate-500">Ajoutez votre premier instrument ci-dessus.</p></div>}
          </div></div>
        </section>
        <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Layers3 className="h-5 w-5"/></div><div><h4 className="text-base font-extrabold text-slate-950">Setups & stratégies</h4><p className="mt-0.5 text-xs text-slate-500">Vos configurations d’entrée habituelles.</p></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{setups.length}</span></div></div>
          <div className="p-5 sm:p-6"><button type="button" onClick={() => setSetupFormOpen(v => !v)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" />{setupFormOpen ? 'Fermer le formulaire' : 'Ajouter un setup'}</button>{setupFormOpen && <div className="mt-4"><label className={labelClass}>Nouveau setup</label><div className="flex gap-2"><input className={inputClass} value={newSetup} onChange={e=>setNewSetup(e.target.value)} placeholder="Tapez FVG, OB, MSS…" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void addSetup();}}}/><button type="button" aria-label="Ajouter le setup" disabled={!newSetup.trim()||saving} onClick={()=>void addSetup()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-5 w-5"/></button></div>
            {setupSuggestions.length > 0 && <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3"><p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-800"><Sparkles className="h-3.5 w-3.5"/> Suggestions de setups</p><div className="flex flex-wrap gap-2">{setupSuggestions.map(name=><button key={name} type="button" onClick={()=>setNewSetup(name)} className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-800">{name}</button>)}</div></div>}
            </div>}
            <div className="mt-5">{setups.length?<div className="space-y-2">{setups.map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3.5 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"/><span className="truncate text-sm font-semibold text-slate-800">{item.name}</span></div><button type="button" aria-label={`Supprimer le setup ${item.name}`} disabled={saving} onClick={()=>setDeleteTarget({type:'setup',id:item.id,label:item.name})} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><X className="h-4 w-4"/></button></div>)}</div>:<div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center"><Layers3 className="mx-auto h-7 w-7 text-slate-300"/><p className="mt-2 text-sm font-semibold text-slate-700">Aucun setup enregistré</p><p className="mt-1 text-xs text-slate-500">Ajoutez une stratégie pour la retrouver dans le journal.</p></div>}</div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-700">À savoir</p><p className="mt-1 text-xs leading-5 text-slate-500">Les instruments et setups sont enregistrés dans votre compte et réutilisables dans le journal.</p></div>
          </div>
        </section>
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget)setDeleteTarget(null);}}>
          <div role="dialog" aria-modal="true" aria-labelledby="journal-delete-title" className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><AlertTriangle className="h-6 w-6"/></div>
            <h3 id="journal-delete-title" className="mt-4 text-lg font-black text-slate-950">Confirmer la suppression</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Voulez-vous vraiment supprimer <strong>{deleteTarget.label}</strong> ? Cette action ne peut pas être annulée.</p>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annuler</button><button type="button" disabled={saving} onClick={()=>void confirmDelete()} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">{saving?'Suppression…':'Supprimer'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
