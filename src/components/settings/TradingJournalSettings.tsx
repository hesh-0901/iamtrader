import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Save, Settings2 } from 'lucide-react';
import { TradingInstrument, TradingSetup, UserProfile } from '../types';
import { updateUserSettings } from '../services/firestore';
import { useToast } from '../components/common/Toast';

interface TradingJournalSettingsProps {
  userProfile: UserProfile | null;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#08b77a] focus:ring-4 focus:ring-[#08b77a]/10';
const labelClass = 'block mb-1.5 text-[11px] font-semibold text-slate-500';

export function TradingJournalSettings({ userProfile }: TradingJournalSettingsProps) {
  const { showToast } = useToast();
  const [instruments, setInstruments] = useState<TradingInstrument[]>(userProfile?.settings?.instruments || []);
  const [setups, setSetups] = useState<TradingSetup[]>(userProfile?.settings?.setups || []);
  const [newSetup, setNewSetup] = useState('');
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
    await persist(instruments, next);
  };

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl card-premium">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#e7faf3] text-[#008f63] flex items-center justify-center">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Paramètres du journal</h3>
            <p className="text-xs text-slate-500">Définissez vos instruments et vos setups. Ces données pilotent automatiquement les calculs du journal.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <h4 className="text-xs font-bold text-slate-900 mb-3">Instruments</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>Symbole *</label><input className={inputClass} value={instrument.symbol} onChange={e => setInstrument(v => ({ ...v, symbol: e.target.value }))} placeholder="XAUUSD" /></div>
              <div><label className={labelClass}>Nom *</label><input className={inputClass} value={instrument.name} onChange={e => setInstrument(v => ({ ...v, name: e.target.value }))} placeholder="Gold" /></div>
              <div><label className={labelClass}>Catégorie</label><select className={inputClass} value={instrument.category} onChange={e => setInstrument(v => ({ ...v, category: e.target.value as TradingInstrument['category'] }))}><option value="forex">Forex</option><option value="metal">Métal</option><option value="index">Indice</option><option value="futures">Futures</option><option value="crypto">Crypto</option><option value="stock">Action</option><option value="other">Autre</option></select></div>
              <div><label className={labelClass}>Pas de prix *</label><input type="number" step="any" min="0" className={inputClass} value={instrument.priceStep} onChange={e => setInstrument(v => ({ ...v, priceStep: e.target.value }))} placeholder="0.01" /></div>
              <div><label className={labelClass}>Valeur par 1.00 *</label><input type="number" step="any" min="0" className={inputClass} value={instrument.valuePerPriceUnit} onChange={e => setInstrument(v => ({ ...v, valuePerPriceUnit: e.target.value }))} placeholder="100" /></div>
              <div><label className={labelClass}>Taille par défaut</label><input type="number" step="any" min="0" className={inputClass} value={instrument.defaultPositionSize} onChange={e => setInstrument(v => ({ ...v, defaultPositionSize: e.target.value }))} placeholder="1" /></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-3">« Valeur par 1.00 » = montant gagné/perdu pour un mouvement de 1.00 avec 1 unité de taille, dans la devise du compte.</p>
            <button type="button" disabled={!canAddInstrument || saving} onClick={addInstrument} className="btn-primary mt-3 px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Plus className="w-3.5 h-3.5" />Ajouter l'instrument</button>

            <div className="mt-4 space-y-2">
              {instruments.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div><span className="text-xs font-bold text-slate-900">{item.symbol}</span><span className="ml-2 text-[10px] text-slate-500">{item.name} · {item.valuePerPriceUnit}/1.00</span></div>
                  <button type="button" onClick={() => removeInstrument(item.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {!instruments.length && <p className="text-[11px] text-slate-500 py-2">Aucun instrument configuré.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <h4 className="text-xs font-bold text-slate-900 mb-3">Setup / Stratégies</h4>
            <div className="flex gap-2">
              <input className={inputClass} value={newSetup} onChange={e => setNewSetup(e.target.value)} placeholder="Liquidity Sweep, FVG, Order Block..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addSetup(); } }} />
              <button type="button" disabled={!newSetup.trim() || saving} onClick={() => void addSetup()} className="btn-primary px-3 rounded-xl disabled:opacity-50"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {setups.map(item => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"><span className="text-xs font-semibold text-slate-700">{item.name}</span><button type="button" onClick={() => void removeSetup(item.id)} className="text-rose-500"><Trash2 className="w-3 h-3" /></button></div>)}
              {!setups.length && <p className="text-[11px] text-slate-500">Aucun setup configuré.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
