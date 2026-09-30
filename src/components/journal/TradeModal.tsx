import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Trade, TradingAccount, TradeDirection, TradeResult, TradingSession, TradingTimeframe, EmotionalState, TradingInstrument, TradingSetup } from '../../types';
import { addTrade, updateTrade } from '../../services/firestore';
import { getUserProfile } from '../../services/auth';
import { useToast } from '../common/Toast';
import { ArrowLeft, ArrowRight, Check, Link2, Save, BarChart3, BrainCircuit, FileText, Activity, Calculator } from 'lucide-react';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  accounts: TradingAccount[];
  selectedAccountId?: string;
  tradeToEdit?: Trade | null;
}

type Step = 1 | 2 | 3 | 4;

const steps = [
  { id: 1 as Step, label: 'Données', icon: Activity, description: 'Instrument, prix et calculs' },
  { id: 2 as Step, label: 'Contexte', icon: BarChart3, description: 'Setup et environnement' },
  { id: 3 as Step, label: 'Psychologie', icon: BrainCircuit, description: 'État mental et discipline' },
  { id: 4 as Step, label: 'Notes & liens', icon: FileText, description: 'Débriefing et graphique' },
];

function getSessionFromDate(value: string): TradingSession | '' {
  if (!value) return '';
  const hour = new Date(value).getUTCHours();
  if (hour >= 0 && hour < 8) return 'Asia';
  if (hour >= 8 && hour < 13) return 'London';
  if (hour >= 13 && hour < 16) return 'Overlap';
  if (hour >= 16 && hour < 22) return 'New York';
  return 'Asia';
}

export function TradeModal({ isOpen, onClose, userId, accounts, selectedAccountId, tradeToEdit }: TradeModalProps) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [instruments, setInstruments] = useState<TradingInstrument[]>([]);
  const [setups, setSetups] = useState<TradingSetup[]>([]);

  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<TradeDirection | ''>('');
  const [entryDate, setEntryDate] = useState('');
  const [exitDate, setExitDate] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [setup, setSetup] = useState('');
  const [timeframe, setTimeframe] = useState<TradingTimeframe | ''>('');
  const [emotion, setEmotion] = useState<EmotionalState | ''>('');
  const [notes, setNotes] = useState('');
  const [screenshotBeforeUrl, setScreenshotBeforeUrl] = useState('');
  const [screenshotAfterUrl, setScreenshotAfterUrl] = useState('');

  const selectedInstrument = useMemo(
    () => instruments.find(item => item.symbol.toUpperCase() === symbol.toUpperCase()),
    [instruments, symbol]
  );

  const calculations = useMemo(() => {
    const entry = Number(entryPrice);
    const exit = Number(exitPrice);
    const sl = Number(stopLoss);
    const size = Number(positionSize);
    const multiplier = selectedInstrument ? Number(selectedInstrument.valuePerPriceUnit) : 0;

    const hasEntry = Number.isFinite(entry) && entry > 0;
    const hasExit = Number.isFinite(exit) && exit > 0;
    const hasSize = Number.isFinite(size) && size > 0;
    const hasMultiplier = Number.isFinite(multiplier) && multiplier > 0;

    let pnl: number | undefined;
    if (hasEntry && hasExit && hasSize && hasMultiplier && direction) {
      const priceMove = direction === 'BUY' ? exit - entry : entry - exit;
      pnl = priceMove * size * multiplier;
    }

    let risk: number | undefined;
    if (hasEntry && Number.isFinite(sl) && sl > 0 && hasSize && hasMultiplier) {
      risk = Math.abs(entry - sl) * size * multiplier;
    }

    const rMultiple = pnl !== undefined && risk !== undefined && risk > 0 ? pnl / risk : undefined;
    const result: TradeResult = pnl === undefined ? 'OPEN' : pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';

    return {
      pnl,
      risk,
      rMultiple,
      result,
      session: getSessionFromDate(entryDate)
    };
  }, [entryDate, entryPrice, exitPrice, stopLoss, positionSize, selectedInstrument, direction]);

  useEffect(() => {
    if (!isOpen || !userId) return;
    let active = true;
    (async () => {
      try {
        const profile = await getUserProfile(userId);
        if (active) {
          setInstruments(profile?.settings?.instruments || []);
          setSetups(profile?.settings?.setups || []);
        }
      } catch {
        if (active) {
          setInstruments([]);
          setSetups([]);
        }
      }
    })();
    return () => { active = false; };
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);

    if (tradeToEdit) {
      setAccountId(tradeToEdit.accountId || '');
      setSymbol(tradeToEdit.symbol || '');
      setDirection(tradeToEdit.direction || '');
      setEntryDate(tradeToEdit.entryDate ? tradeToEdit.entryDate.slice(0, 16) : '');
      setExitDate(tradeToEdit.exitDate ? tradeToEdit.exitDate.slice(0, 16) : '');
      setEntryPrice(tradeToEdit.entryPrice?.toString() || '');
      setExitPrice(tradeToEdit.exitPrice?.toString() || '');
      setStopLoss(tradeToEdit.stopLoss?.toString() || '');
      setTakeProfit(tradeToEdit.takeProfit?.toString() || '');
      setPositionSize(tradeToEdit.positionSize?.toString() || '');
      setSetup(tradeToEdit.setup || '');
      setTimeframe(tradeToEdit.timeframe || '');
      setEmotion(tradeToEdit.emotion || '');
      setNotes(tradeToEdit.notes || '');
      setScreenshotBeforeUrl(tradeToEdit.screenshotBeforeUrl || '');
      setScreenshotAfterUrl(tradeToEdit.screenshotAfterUrl || '');
    } else {
      setAccountId('');
      setSymbol('');
      setDirection('');
      setEntryDate('');
      setExitDate('');
      setEntryPrice('');
      setExitPrice('');
      setStopLoss('');
      setTakeProfit('');
      setPositionSize('');
      setSetup('');
      setTimeframe('');
      setEmotion('');
      setNotes('');
      setScreenshotBeforeUrl('');
      setScreenshotAfterUrl('');
    }
  }, [isOpen, tradeToEdit]);

  const inputClass = 'w-full rounded-xl border border-[#dfe9e5] bg-white px-3 py-2.5 text-sm text-[#10233a] outline-none transition focus:border-[#08b77a] focus:ring-4 focus:ring-[#08b77a]/10';
  const labelClass = 'block mb-1.5 text-[11px] font-semibold text-[#5f748c]';

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!accountId || !symbol || !direction || !entryDate || !entryPrice || !positionSize || !setup || !timeframe || !emotion) {
      showToast('Veuillez compléter les champs obligatoires du trade', 'error');
      setStep(1);
      return;
    }

    if (!selectedInstrument) {
      showToast('Configurez cet instrument dans Paramètres > Journal avant de l’utiliser', 'error');
      setStep(1);
      return;
    }

    if (calculations.risk === undefined) {
      showToast('Le risque initial nécessite un Stop Loss valide', 'error');
      setStep(1);
      return;
    }

    try {
      setIsSubmitting(true);

      const tradeData: Omit<Trade, 'id'> = {
        userId,
        accountId,
        symbol: symbol.toUpperCase().trim(),
        direction,
        entryDate: new Date(entryDate).toISOString(),
        ...(exitDate ? { exitDate: new Date(exitDate).toISOString() } : {}),
        entryPrice: Number(entryPrice),
        ...(exitPrice ? { exitPrice: Number(exitPrice) } : {}),
        ...(stopLoss ? { stopLoss: Number(stopLoss) } : {}),
        ...(takeProfit ? { takeProfit: Number(takeProfit) } : {}),
        positionSize: Number(positionSize),
        riskAmount: calculations.risk,
        result: calculations.result,
        pnl: calculations.pnl ?? 0,
        ...(calculations.rMultiple !== undefined ? { rMultiple: Number(calculations.rMultiple.toFixed(2)) } : {}),
        setup,
        session: calculations.session || 'Asia',
        timeframe,
        emotion,
        notes: notes.trim(),
        ...(screenshotBeforeUrl.trim() ? { screenshotBeforeUrl: screenshotBeforeUrl.trim() } : {}),
        ...(screenshotAfterUrl.trim() ? { screenshotAfterUrl: screenshotAfterUrl.trim() } : {}),
      };

      if (tradeToEdit) {
        await updateTrade(tradeToEdit.id, tradeData);
        showToast('Trade mis à jour dans Firestore', 'success');
      } else {
        await addTrade(tradeData);
        showToast('Trade enregistré dans Firestore', 'success');
      }
      onClose();
    } catch (error: any) {
      showToast(`Erreur lors de la sauvegarde : ${error.message || 'Problème Firestore'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => setStep(current => Math.min(4, current + 1) as Step);
  const goBack = () => setStep(current => Math.max(1, current - 1) as Step);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tradeToEdit ? 'Modifier le trade' : 'Nouveau trade'} subtitle="Enregistrez votre opération avec des calculs automatiques" maxWidth="max-w-4xl">
      <form onSubmit={handleSubmit} className="text-[#10233a]">
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-5 border-b border-[#edf2f0]">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const active = step === item.id;
            const complete = step > item.id;
            return (
              <React.Fragment key={item.id}>
                <button type="button" onClick={() => setStep(item.id)} className={`flex min-w-fit items-center gap-2 rounded-xl px-3 py-2 transition ${active ? 'bg-[#e7faf3] text-[#008f63]' : 'text-[#8a9aab] hover:bg-[#f7fbf9]'}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${complete || active ? 'bg-[#08b77a] text-white' : 'bg-[#eef3f1] text-[#71839a]'}`}>{complete ? <Check className="w-3.5 h-3.5" /> : item.id}</span>
                  <span className="text-left"><span className="block text-[11px] font-bold">{item.label}</span><span className="hidden md:block text-[9px] opacity-70">{item.description}</span></span>
                </button>
                {index < steps.length - 1 && <div className="h-px w-5 bg-[#e5ece9] shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {step === 1 && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelClass}>Compte *</label><select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputClass} required><option value="">Sélectionner</option>{accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></div>
              <div>
                <label className={labelClass}>Instrument *</label>
                <select value={symbol} onChange={e => { setSymbol(e.target.value); setPositionSize(''); }} className={inputClass} required>
                  <option value="">Sélectionner un instrument</option>
                  {instruments.map(item => <option key={item.id} value={item.symbol}>{item.symbol} — {item.name}</option>)}
                </select>
                {!instruments.length && <p className="mt-1.5 text-[10px] text-amber-600">Ajoutez d’abord vos instruments dans Paramètres &gt; Journal.</p>}
              </div>
              <div><label className={labelClass}>Direction *</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setDirection('BUY')} className={`rounded-xl border py-2.5 text-xs font-bold ${direction === 'BUY' ? 'bg-[#e7faf3] text-[#008f63] border-[#9de2ca]' : 'bg-white text-[#71839a] border-[#dfe9e5]'}`}>Acheteur</button><button type="button" onClick={() => setDirection('SELL')} className={`rounded-xl border py-2.5 text-xs font-bold ${direction === 'SELL' ? 'bg-[#fff0f2] text-[#f04f63] border-[#ffd0d8]' : 'bg-white text-[#71839a] border-[#dfe9e5]'}`}>Vendeur</button></div></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className={labelClass}>Date & heure d'entrée *</label><input type="datetime-local" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputClass} required /></div>
              <div><label className={labelClass}>Date & heure de sortie</label><input type="datetime-local" value={exitDate} onChange={e => setExitDate(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Prix d'entrée *</label><input type="number" step="any" min="0" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} className={inputClass} required /></div>
              <div><label className={labelClass}>Prix de sortie</label><input type="number" step="any" min="0" value={exitPrice} onChange={e => setExitPrice(e.target.value)} className={inputClass} /></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className={labelClass}>Stop Loss *</label><input type="number" step="any" min="0" value={stopLoss} onChange={e => setStopLoss(e.target.value)} className={inputClass} required /></div>
              <div><label className={labelClass}>Take Profit</label><input type="number" step="any" min="0" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Taille *</label><input type="number" step="any" min="0" value={positionSize} onChange={e => setPositionSize(e.target.value)} className={inputClass} required /></div>
              <div><label className={labelClass}>Session</label><div className={`${inputClass} bg-slate-50 flex items-center justify-between`}><span>{calculations.session ? calculations.session : 'Automatique après la date'}</span><span className="text-[9px] text-slate-400">AUTO</span></div></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[#dfe9e5] bg-[#f7fbf9] px-3 py-2.5"><label className={labelClass}>Risque initial</label><div className="flex items-center gap-2"><Calculator className="w-3.5 h-3.5 text-[#08b77a]" /><span className="text-sm font-bold text-[#10233a]">{calculations.risk !== undefined ? calculations.risk.toFixed(2) : '—'}</span><span className="text-[10px] text-slate-400">AUTO</span></div></div>
              <div className="rounded-xl border border-[#dfe9e5] bg-[#f7fbf9] px-3 py-2.5"><label className={labelClass}>P&L net</label><div className={`text-sm font-bold ${calculations.pnl === undefined ? 'text-slate-400' : calculations.pnl >= 0 ? 'text-[#00a86b]' : 'text-[#f04f63]'}`}>{calculations.pnl !== undefined ? calculations.pnl.toFixed(2) : '—'}</div></div>
              <div className="rounded-xl border border-[#dfe9e5] bg-[#f7fbf9] px-3 py-2.5"><label className={labelClass}>Multiple R</label><div className="text-sm font-bold text-[#10233a]">{calculations.rMultiple !== undefined ? `${calculations.rMultiple >= 0 ? '+' : ''}${calculations.rMultiple.toFixed(2)}R` : '—'}</div></div>
              <div className="rounded-xl border border-[#dfe9e5] bg-[#f7fbf9] px-3 py-2.5"><label className={labelClass}>Résultat</label><div className="text-sm font-bold text-[#10233a]">{calculations.result === 'OPEN' ? 'Ouvert' : calculations.result === 'WIN' ? 'Gagnant' : calculations.result === 'LOSS' ? 'Perdant' : 'Break-even'}</div></div>
            </div>
            <p className="text-[10px] text-slate-500">Le risque, le P&L, le Multiple R, le résultat et la session sont calculés automatiquement. Aucun de ces champs n’est saisissable manuellement.</p>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-[#f7fbf9] border border-[#e5eeeb] p-4"><h3 className="text-sm font-bold text-[#10233a]">Contexte du trade</h3><p className="text-[11px] text-[#8a9aab] mt-1">Les setups proposés viennent de vos Paramètres du journal.</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelClass}>Setup / stratégie *</label><select value={setup} onChange={e => setSetup(e.target.value)} className={inputClass} required><option value="">Sélectionner</option>{setups.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select>{!setups.length && <p className="mt-1.5 text-[10px] text-amber-600">Ajoutez vos setups dans Paramètres &gt; Journal.</p>}</div>
              <div><label className={labelClass}>Session</label><div className={`${inputClass} bg-slate-50`}>{calculations.session || 'Automatique'}</div></div>
              <div><label className={labelClass}>Timeframe *</label><select value={timeframe} onChange={e => setTimeframe(e.target.value as TradingTimeframe)} className={inputClass} required><option value="">Sélectionner</option><option value="1m">1m</option><option value="5m">5m</option><option value="15m">15m</option><option value="1h">1h</option><option value="4h">4h</option><option value="1D">Daily</option></select></div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-[#f7fbf9] border border-[#e5eeeb] p-4"><h3 className="text-sm font-bold text-[#10233a]">État psychologique</h3><p className="text-[11px] text-[#8a9aab] mt-1">Choisissez votre état réel au moment de l’exécution.</p></div>
            <div><label className={labelClass}>État psychologique *</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{(['Disciplined','Calm','Focused','FOMO','Fear','Revenge','Overconfidence','Hesitation'] as EmotionalState[]).map(value => <button type="button" key={value} onClick={() => setEmotion(value)} className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${emotion === value ? 'bg-[#e7faf3] border-[#9de2ca] text-[#008f63]' : 'bg-white border-[#e5ece9] text-[#71839a] hover:bg-[#f8fbfa]'}`}>{value === 'Disciplined' ? 'Discipliné' : value === 'Calm' ? 'Calme' : value === 'Focused' ? 'Concentré' : value === 'FOMO' ? 'FOMO' : value === 'Fear' ? 'Peur' : value === 'Revenge' ? 'Revenge trading' : value === 'Overconfidence' ? 'Excès de confiance' : 'Hésitation'}</button>)}</div></div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div><label className={labelClass}>Notes & débriefing</label><textarea rows={7} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Pourquoi avez-vous pris ce trade ? Qu'avez-vous bien ou mal exécuté ?" className={`${inputClass} resize-none`} /></div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-[#f7fbf9] border border-[#e5eeeb] p-4"><div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-[#08b77a]" /><div><div className="text-xs font-bold text-[#10233a]">Liens du graphique</div><div className="text-[10px] text-[#8a9aab]">Conservez l’accès au contexte visuel du trade.</div></div></div></div>
                <div><label className={labelClass}>Lien avant le trade</label><input type="url" value={screenshotBeforeUrl} onChange={e => setScreenshotBeforeUrl(e.target.value)} placeholder="https://..." className={inputClass} /></div>
                <div><label className={labelClass}>Lien après le trade</label><input type="url" value={screenshotAfterUrl} onChange={e => setScreenshotAfterUrl(e.target.value)} placeholder="https://..." className={inputClass} /></div>
              </div>
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-[#edf2f0]">
          <button type="button" onClick={step === 1 ? onClose : goBack} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#5f748c] hover:bg-[#f5f9f7] cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /> {step === 1 ? 'Annuler' : 'Précédent'}</button>
          {step < 4 ? <button type="button" onClick={goNext} className="btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs cursor-pointer">Suivant <ArrowRight className="w-3.5 h-3.5" /></button> : <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-60">{isSubmitting ? 'Enregistrement...' : <><Save className="w-3.5 h-3.5" /> Enregistrer le trade</>}</button>}
        </div>
      </form>
    </Modal>
  );
}
