import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Loader2, Settings2, CandlestickChart, Layers3, X, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { TradingInstrument, TradingSetup, UserProfile } from '../../types';
import { updateUserSettings } from '../../services/firestore';
import { useToast } from '../common/Toast';

interface TradingJournalSettingsProps {
  userProfile: UserProfile | null;
}

const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';

type BrokerSpecsView = { broker: string; contractSize: number; contractUnit: string; pipSize: number; minVolume: number; valueCurrency: string; sourceUrl: string; };

type MarketQuoteView = {
  symbol: string; price: number; currency: string | null; bid: number | null; ask: number | null;
  changePercent: number | null; timestamp: string | null; source: string; isProxy: boolean; note: string;
};

export function TradingJournalSettings({ userProfile }: TradingJournalSettingsProps) {
  const { showToast } = useToast();
  const [instruments, setInstruments] = useState<TradingInstrument[]>(userProfile?.settings?.instruments || []);
  const instrumentsRef = useRef(instruments);
  const pendingInstrumentSymbols = useRef(new Set<string>());
  const [setups, setSetups] = useState<TradingSetup[]>(userProfile?.settings?.setups || []);
  const [instrumentPage, setInstrumentPage] = useState(1);
  const [setupPage, setSetupPage] = useState(1);
  const pageSize = 5;
  const instrumentPageCount = Math.max(1, Math.ceil(instruments.length / pageSize));
  const setupPageCount = Math.max(1, Math.ceil(setups.length / pageSize));
  const visibleInstruments = instruments.slice((instrumentPage - 1) * pageSize, instrumentPage * pageSize);
  const visibleSetups = setups.slice((setupPage - 1) * pageSize, setupPage * pageSize);
  const [newSetup, setNewSetup] = useState('');
  const [instrumentFormOpen, setInstrumentFormOpen] = useState(false);
  const [editingInstrumentId, setEditingInstrumentId] = useState<string | null>(null);
  const [instrumentDetailsOpen, setInstrumentDetailsOpen] = useState(false);
  const [suggestingInstrument, setSuggestingInstrument] = useState(false);
  const [instrumentSuggestionNote, setInstrumentSuggestionNote] = useState('');
  const [marketQuote, setMarketQuote] = useState<MarketQuoteView | null>(null);
  const [brokerSpecs, setBrokerSpecs] = useState<BrokerSpecsView | null>(null);
  const [marketQuoteLoading, setMarketQuoteLoading] = useState(false);
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
    () => Boolean(instrument.symbol.trim() && instrument.name.trim() && Number(instrument.priceStep) > 0 && Number(instrument.valuePerPriceUnit) > 0 && (!instrument.defaultPositionSize || Number(instrument.defaultPositionSize) > 0)),
    [instrument]
  );

  // Local fallback for recognized symbols; Chloé's server endpoint supplies the full editable suggestion.
  const suggestInstrument = (rawSymbol: string, current: TradingInstrument): TradingInstrument => {
    const symbol = rawSymbol.trim().toUpperCase();
    const known: Record<string, { name: string; category: TradingInstrument['category'] }> = {
      XAUUSD: { name: 'Gold', category: 'metal' },
      XAGUSD: { name: 'Silver', category: 'metal' },
      EURUSD: { name: 'Euro / US Dollar', category: 'forex' },
      GBPUSD: { name: 'British Pound / US Dollar', category: 'forex' },
      USDJPY: { name: 'US Dollar / Japanese Yen', category: 'forex' },
      AUDUSD: { name: 'Australian Dollar / US Dollar', category: 'forex' },
      NZDUSD: { name: 'New Zealand Dollar / US Dollar', category: 'forex' },
      USDCAD: { name: 'US Dollar / Canadian Dollar', category: 'forex' },
      USDCHF: { name: 'US Dollar / Swiss Franc', category: 'forex' },
      BTCUSD: { name: 'Bitcoin / US Dollar', category: 'crypto' },
      ETHUSD: { name: 'Ethereum / US Dollar', category: 'crypto' },
      US30: { name: 'Dow Jones 30', category: 'index' },
      NAS100: { name: 'Nasdaq 100', category: 'index' },
      SPX500: { name: 'S&P 500', category: 'index' },
      GER40: { name: 'DAX 40', category: 'index' },
      UK100: { name: 'FTSE 100', category: 'index' }
    };
    const suggestion = known[symbol];
    if (!suggestion) return { ...current, symbol };
    const shouldReplaceName = !current.name.trim() || current.name.trim() === current.symbol || current.name.trim() === 'Gold' && current.symbol !== 'XAUUSD';
    return { ...current, symbol, name: shouldReplaceName ? suggestion.name : current.name, category: suggestion.category };
  };

  const startEditInstrument = (item: TradingInstrument) => {
    setEditingInstrumentId(item.id);
    setInstrument({
      ...item,
      priceStep: String(item.priceStep ?? ''),
      valuePerPriceUnit: String(item.valuePerPriceUnit ?? ''),
      defaultPositionSize: item.defaultPositionSize == null ? '' : String(item.defaultPositionSize)
    });
    setInstrumentFormOpen(true);
    setInstrumentDetailsOpen(true);
    setInstrumentSuggestionNote('');
  };

  const requestInstrumentSuggestion = async (symbol: string) => {
    setMarketQuote(null);
    setBrokerSpecs(null);
    setMarketQuoteLoading(true);
    void fetch('/api/market-data?symbol=' + encodeURIComponent(symbol), { cache: 'no-store' })
      .then(response => response.json())
      .then(data => setMarketQuote(data?.quote || null))
      .catch(() => setMarketQuote(null))
      .finally(() => setMarketQuoteLoading(false));

    const response = await fetch('/api/instruments/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        symbol,
        accountCurrency: userProfile?.settings?.defaultCurrency || 'USD'
      })
    });
    const data = await response.json().catch(() => ({})) as {
      error?: string;
      instrument?: {
        symbol: string;
        name: string;
        category: TradingInstrument['category'];
        priceStep: number | null;
        valuePerPriceUnit: number | null;
        defaultPositionSize: number;
      };
      brokerSpecs?: BrokerSpecsView;
      note?: string;
    };
    if (!response.ok || !data.instrument) {
      throw new Error(data.error || 'Les fournisseurs IA ne peuvent pas compléter cet instrument pour le moment.');
    }
    const suggestion = data.instrument;
    if (
      suggestion.symbol?.toUpperCase() !== symbol ||
      !suggestion.name?.trim()
    ) {
      throw new Error('La réponse de Chloé est incomplète. Complétez les paramètres manuellement.');
    }
    return { suggestion, note: data.note || '', brokerSpecs: data.brokerSpecs || null };
  };

  const closeInstrumentForm = () => {
    setInstrumentFormOpen(false);
    setEditingInstrumentId(null);
    setInstrumentDetailsOpen(false);
    setInstrumentSuggestionNote('');
    setMarketQuote(null);
    setBrokerSpecs(null);
    setInstrument({ id: '', symbol: '', name: '', category: 'forex', priceStep: '', valuePerPriceUnit: '', defaultPositionSize: '' });
  };

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
    const symbol = instrument.symbol.trim().toUpperCase();
    if (!symbol) return;

    // Ouvrir immédiatement les champs manuels pendant que Chloé prépare sa proposition.
    if (!editingInstrumentId && !instrumentDetailsOpen) {
      if (!/^[A-Z0-9._-]{1,24}$/.test(symbol)) {
        showToast('Saisissez un symbole valide.', 'error');
        return;
      }
      if (instrumentsRef.current.some(item => item.symbol.toUpperCase() === symbol)) {
        showToast('Cet instrument existe déjà. Ouvrez-le pour le modifier.', 'error');
        return;
      }
      if (pendingInstrumentSymbols.current.has(symbol)) return;

      pendingInstrumentSymbols.current.add(symbol);
      setInstrumentDetailsOpen(true);
      setInstrumentSuggestionNote('Chloé analyse les caractéristiques de cet instrument. Vous pourrez vérifier et modifier les paramètres avant de les enregistrer.');
      setSuggestingInstrument(true);
      void (async () => {
        try {
          const { suggestion, note, brokerSpecs: specs } = await requestInstrumentSuggestion(symbol);
          setBrokerSpecs(specs);
          setInstrument(current => ({
            ...current,
            symbol,
            name: suggestion.name.trim(),
            category: suggestion.category,
            priceStep: String(suggestion.priceStep ?? ''),
            valuePerPriceUnit: String(suggestion.valuePerPriceUnit ?? ''),
            defaultPositionSize: String(Number(suggestion.defaultPositionSize) || 1)
          }));
          setInstrumentSuggestionNote(note || 'Paramètres proposés par Chloé. Vérifiez les spécifications exactes de votre broker avant l’enregistrement.');
        } catch (error: any) {
          const isExnessGoldUsd = symbol === 'XAUUSD' && (userProfile?.settings?.defaultCurrency || 'USD') === 'USD';
          if (isExnessGoldUsd) {
            setInstrument(current => ({ ...suggestInstrument(symbol, current), symbol, name: 'Gold / US Dollar', category: 'metal', priceStep: '0.01', valuePerPriceUnit: '100', defaultPositionSize: '0.01' }));
            setBrokerSpecs({ broker: 'Exness', contractSize: 100, contractUnit: 'troy ounces', pipSize: 0.01, minVolume: 0.01, valueCurrency: 'USD', sourceUrl: 'https://get.exness.help/hc/fr/articles/17854173039388-Mati%C3%A8res-premi%C3%A8res' });
            setInstrumentSuggestionNote('Profil Exness de secours utilisé : contrat 100 onces troy, pip 0,01, minimum 0,01 lot. 1 lot = 100 USD par variation de prix de 1,00. Source officielle Exness ci-dessous.');
          } else {
            setInstrument(current => ({ ...suggestInstrument(symbol, current), symbol }));
            setInstrumentSuggestionNote('Échec des fournisseurs IA. Les spécifications de valeur restent à renseigner ; vérifiez la devise du compte et le contrat du broker.');
            showToast(error?.message || 'Complétez les paramètres manuellement.', 'error');
          }
        } finally {
          setSuggestingInstrument(false);
          pendingInstrumentSymbols.current.delete(symbol);
        }
      })();
      return;
    }

    if (!canAddInstrument) return;
    const duplicate = instruments.some(item => item.symbol.toUpperCase() === symbol && item.id !== editingInstrumentId);
    if (duplicate) {
      showToast('Cet instrument existe déjà. Ouvrez-le pour le modifier.', 'error');
      return;
    }
    const normalized: TradingInstrument = {
      ...instrument,
      id: editingInstrumentId || crypto.randomUUID(),
      symbol,
      name: instrument.name.trim(),
      priceStep: Number(instrument.priceStep),
      valuePerPriceUnit: Number(instrument.valuePerPriceUnit),
      defaultPositionSize: instrument.defaultPositionSize ? Number(instrument.defaultPositionSize) : undefined
    };
    const next = editingInstrumentId
      ? instruments.map(item => item.id === editingInstrumentId ? normalized : item)
      : [...instruments, normalized];
    instrumentsRef.current = next;
    setInstruments(next);
    if (!editingInstrumentId) setInstrumentPage(Math.ceil(next.length / pageSize));
    closeInstrumentForm();
    await persist(next, setups);
  };

  const removeInstrument = async (id: string) => {
    const next = instruments.filter(item => item.id !== id);
    instrumentsRef.current = next;
    setInstruments(next);
    setInstrumentPage(page => Math.min(page, Math.max(1, Math.ceil(next.length / pageSize))));
    setDeleteTarget(null);
    await persist(next, setups);
  };

  const addSetup = async () => {
    const name = newSetup.trim();
    if (!name) return;
    const next = [...setups.filter(item => item.name.toLowerCase() !== name.toLowerCase()), { id: crypto.randomUUID(), name }];
    setSetups(next);
    setSetupPage(Math.ceil(next.length / pageSize));
    setNewSetup('');
    await persist(instruments, next);
  };

  const removeSetup = async (id: string) => {
    const next = setups.filter(item => item.id !== id);
    setSetups(next);
    setSetupPage(page => Math.min(page, Math.max(1, Math.ceil(next.length / pageSize))));
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
      <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:flex xl:h-[690px] xl:flex-col">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CandlestickChart className="h-5 w-5" /></div><div><h4 className="text-base font-extrabold text-slate-950">Instruments</h4><p className="mt-0.5 text-xs text-slate-500">Valeurs utilisées pour calculer les résultats.</p></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{instruments.length}</span></div></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <button type="button" onClick={() => { setInstrument({ id: '', symbol: '', name: '', category: 'forex', priceStep: '', valuePerPriceUnit: '', defaultPositionSize: '' }); setEditingInstrumentId(null); setInstrumentDetailsOpen(false); setInstrumentSuggestionNote(''); setInstrumentFormOpen(true); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 sm:w-auto">
              <Plus className="h-4 w-4" /> Ajouter un instrument
            </button>
          </div>
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 sm:px-6 sm:pb-6"><div className="mb-3 flex items-center justify-between"><h5 className="text-sm font-bold text-slate-900">Instruments configurés</h5><span className="text-xs text-slate-400">{instruments.length} au total</span></div>
            {instruments.length ? <div className="space-y-2">{visibleInstruments.map((item, index)=><div key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3.5 py-3 transition hover:border-emerald-200"><div className="flex min-w-0 items-center gap-3"><span aria-label={`Instrument ${(instrumentPage - 1) * pageSize + index + 1}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-extrabold tabular-nums text-slate-500">{String((instrumentPage - 1) * pageSize + index + 1).padStart(2, '0')}</span><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xs font-black text-slate-600">{item.symbol.slice(0,3)}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{item.symbol}</p><p className="truncate text-xs text-slate-500">{item.name} · Valeur {item.valuePerPriceUnit}/1.00</p></div></div><div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={`Modifier ${item.symbol}`} disabled={saving} onClick={()=>startEditInstrument(item)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"><Pencil className="h-4 w-4"/></button><button type="button" aria-label={`Supprimer ${item.symbol}`} disabled={saving} onClick={()=>setDeleteTarget({type:'instrument',id:item.id,label:item.symbol})} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="h-4 w-4"/></button></div></div>)}</div>:<div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center"><CandlestickChart className="mx-auto h-7 w-7 text-slate-300"/><p className="mt-2 text-sm font-semibold text-slate-700">Aucun instrument configuré</p><p className="mt-1 text-xs text-slate-500">Ajoutez votre premier instrument ci-dessus.</p></div>}{instruments.length > pageSize && <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs font-medium text-slate-500">Page {instrumentPage} sur {instrumentPageCount}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setInstrumentPage(page => Math.max(1, page - 1))} disabled={instrumentPage === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Précédent</button><button type="button" onClick={() => setInstrumentPage(page => Math.min(instrumentPageCount, page + 1))} disabled={instrumentPage === instrumentPageCount} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Suivant</button></div></div>}
          </div>
        </section>
        <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:flex xl:h-[690px] xl:flex-col">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Layers3 className="h-5 w-5"/></div><div><h4 className="text-base font-extrabold text-slate-950">Setups & stratégies</h4><p className="mt-0.5 text-xs text-slate-500">Vos configurations d’entrée habituelles.</p></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{setups.length}</span></div></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"><button type="button" onClick={() => setSetupFormOpen(v => !v)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" />{setupFormOpen ? 'Fermer le formulaire' : 'Ajouter un setup'}</button>{setupFormOpen && <div className="mt-4"><label className={labelClass}>Nouveau setup</label><div className="flex gap-2"><input className={inputClass} value={newSetup} onChange={e=>setNewSetup(e.target.value)} placeholder="Tapez FVG, OB, MSS…" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void addSetup();}}}/><button type="button" aria-label="Ajouter le setup" disabled={!newSetup.trim()||saving} onClick={()=>void addSetup()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-5 w-5"/></button></div>
            {setupSuggestions.length > 0 && <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3"><p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-800"><Sparkles className="h-3.5 w-3.5"/> Suggestions de setups</p><div className="flex flex-wrap gap-2">{setupSuggestions.map(name=><button key={name} type="button" onClick={()=>setNewSetup(name)} className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-800">{name}</button>)}</div></div>}
            </div>}
            <div className="mt-5">{setups.length?<div className="space-y-2">{visibleSetups.map((item, index)=><div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3.5 py-3"><div className="flex min-w-0 items-center gap-2.5"><span aria-label={`Setup ${(setupPage - 1) * pageSize + index + 1}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[11px] font-extrabold tabular-nums text-emerald-700">{String((setupPage - 1) * pageSize + index + 1).padStart(2, '0')}</span><span className="truncate text-sm font-semibold text-slate-800">{item.name}</span></div><button type="button" aria-label={`Supprimer le setup ${item.name}`} disabled={saving} onClick={()=>setDeleteTarget({type:'setup',id:item.id,label:item.name})} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><X className="h-4 w-4"/></button></div>)}</div>:<div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center"><Layers3 className="mx-auto h-7 w-7 text-slate-300"/><p className="mt-2 text-sm font-semibold text-slate-700">Aucun setup enregistré</p><p className="mt-1 text-xs text-slate-500">Ajoutez une stratégie pour la retrouver dans le journal.</p></div>}{setups.length > pageSize && <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs font-medium text-slate-500">Page {setupPage} sur {setupPageCount}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setSetupPage(page => Math.max(1, page - 1))} disabled={setupPage === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Précédent</button><button type="button" onClick={() => setSetupPage(page => Math.min(setupPageCount, page + 1))} disabled={setupPage === setupPageCount} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Suivant</button></div></div>}</div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-700">À savoir</p><p className="mt-1 text-xs leading-5 text-slate-500">Les instruments et setups sont enregistrés dans votre compte et réutilisables dans le journal.</p></div>
          </div>
        </section>
      </div>
      {instrumentFormOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget && !suggestingInstrument && !saving) closeInstrumentForm(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="instrument-modal-title" className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><CandlestickChart className="h-5 w-5"/></div>
                <div className="min-w-0">
                  <h3 id="instrument-modal-title" className="text-base font-extrabold tracking-tight text-slate-950">{editingInstrumentId ? 'Modifier l’instrument' : 'Ajouter un instrument'}</h3>
                  <p className="mt-1 text-xs text-slate-500">Identité et paramètres utilisés pour les calculs du journal.</p>
                </div>
              </div>
              <button type="button" aria-label="Fermer" disabled={suggestingInstrument || saving} onClick={closeInstrumentForm} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X className="h-5 w-5"/></button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Identification</h4>
                    <p className="mt-0.5 text-xs text-slate-500">Commencez par le symbole négocié chez votre broker.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Étape 1</span>
                </div>
                <div>
                  <label className={labelClass}>Symbole de l’instrument <span className="text-rose-500">*</span></label>
                  <input className={inputClass} value={instrument.symbol} onChange={e => setInstrument(v => suggestInstrument(e.target.value, v))} placeholder="Ex. XAUUSD, EURUSD, NAS100" autoComplete="off" disabled={suggestingInstrument}/>
                </div>
              </section>

              {suggestingInstrument && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600"><Loader2 className="h-5 w-5 animate-spin"/></div>
                  <div><p className="text-sm font-bold text-slate-800">Chloé analyse {instrument.symbol.toUpperCase()}…</p><p className="mt-1 text-xs leading-5 text-slate-500">Recherche des caractéristiques de l’instrument. Vous pourrez vérifier les valeurs avant l’enregistrement.</p></div>
                </div>
              )}

              {instrumentDetailsOpen && (
                <>
                  {brokerSpecs && (
                    <details className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-800">
                        <span>Référence broker · {brokerSpecs.broker}<span className="mt-1 block text-xs font-normal text-slate-500">Contrat : {brokerSpecs.contractSize} {brokerSpecs.contractUnit}</span></span>
                        <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 group-open:hidden">Voir</span>
                        <span className="hidden shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 group-open:inline">Masquer</span>
                      </summary>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-3">
                        <div><p className="text-[11px] text-slate-500">Pas / pip</p><p className="mt-1 text-sm font-bold text-slate-800">{brokerSpecs.pipSize}</p></div>
                        <div><p className="text-[11px] text-slate-500">Volume minimum</p><p className="mt-1 text-sm font-bold text-slate-800">{brokerSpecs.minVolume} lot</p></div>
                        <div><p className="text-[11px] text-slate-500">Valeur / 1,00</p><p className="mt-1 text-sm font-bold text-slate-800">{instrument.valuePerPriceUnit ? instrument.valuePerPriceUnit + ' ' + brokerSpecs.valueCurrency : 'À confirmer'}</p></div>
                      </div>
                      <a href={brokerSpecs.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-emerald-700 underline underline-offset-2">Consulter la source officielle</a>
                    </details>
                  )}

                  <section className="space-y-4 border-t border-slate-100 pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Paramètres de calcul</h4>
                        <p className="mt-0.5 text-xs text-slate-500">Ces valeurs déterminent le calcul du risque et du résultat.</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Étape 2</span>
                    </div>

                    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                      <div><label className={labelClass}>Nom <span className="text-rose-500">*</span></label><input className={inputClass} value={instrument.name} onChange={e=>setInstrument(v=>({...v,name:e.target.value}))} placeholder="Ex. Gold / US Dollar"/></div>
                      <div><label className={labelClass}>Catégorie</label><select className={inputClass} value={instrument.category} onChange={e=>setInstrument(v=>({...v,category:e.target.value as TradingInstrument['category']}))}><option value="forex">Forex</option><option value="metal">Métal</option><option value="index">Indice</option><option value="futures">Futures</option><option value="crypto">Crypto</option><option value="stock">Action</option><option value="other">Autre</option></select></div>
                      <div><label className={labelClass}>Pas de prix <span className="text-rose-500">*</span></label><input type="number" step="any" min="0" className={inputClass} value={instrument.priceStep} onChange={e=>setInstrument(v=>({...v,priceStep:e.target.value}))} placeholder="Ex. 0.01"/><p className="mt-1.5 text-[11px] text-slate-400">Plus petite variation de prix prise en compte.</p></div>
                      <div><label className={labelClass}>Valeur par 1,00 <span className="text-rose-500">*</span></label><input type="number" step="any" min="0" className={inputClass} value={instrument.valuePerPriceUnit} onChange={e=>setInstrument(v=>({...v,valuePerPriceUnit:e.target.value}))} placeholder="Ex. 100"/><p className="mt-1.5 text-[11px] text-slate-400">Valeur dans la devise de votre compte, pour 1 lot.</p></div>
                      <div className="sm:col-span-2"><label className={labelClass}>Taille de position par défaut <span className="font-normal text-slate-400">(facultatif)</span></label><input type="number" step="any" min="0" className={inputClass} value={instrument.defaultPositionSize} onChange={e=>setInstrument(v=>({...v,defaultPositionSize:e.target.value}))} placeholder="Ex. 0.01"/><p className="mt-1.5 text-[11px] text-slate-400">Préremplie lors de la saisie d’une opération. Vous pourrez toujours la modifier.</p></div>
                    </div>
                  </section>

                  <div className="flex gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs leading-5 text-amber-950">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"/>
                    <p><strong className="font-bold">Vérification recommandée.</strong> Les spécifications peuvent varier selon le broker et le type de compte. {instrumentSuggestionNote || 'Confirmez le contrat et la valeur du lot avant d’utiliser ces paramètres pour calculer votre risque.'}</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button type="button" disabled={saving || suggestingInstrument} onClick={closeInstrumentForm} className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:w-auto">Annuler</button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                {!instrumentDetailsOpen && !editingInstrumentId ? (
                  <>
                    <button type="button" disabled={!instrument.symbol.trim() || saving || suggestingInstrument} onClick={() => { if (!instrument.symbol.trim()) return; setInstrumentDetailsOpen(true); setInstrumentSuggestionNote('Saisie manuelle : vérifiez les spécifications exactes de votre broker.'); }} className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 sm:w-auto">Saisie manuelle</button>
                    <button type="button" disabled={!instrument.symbol.trim() || saving || suggestingInstrument} onClick={() => void addInstrument()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"><Sparkles className="h-4 w-4"/> Analyser avec Chloé</button>
                  </>
                ) : (
                  <button type="button" disabled={saving || suggestingInstrument || !canAddInstrument} onClick={() => void addInstrument()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}{editingInstrumentId ? 'Enregistrer les modifications' : 'Enregistrer l’instrument'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
