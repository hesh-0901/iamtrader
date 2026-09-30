import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Trade, TradingAccount, TradeDirection, TradeResult, TradingSession, TradingTimeframe, EmotionalState } from '../../types';
import { addTrade, updateTrade } from '../../services/firestore';
import { useToast } from '../common/Toast';
import { ArrowLeft, ArrowRight, Check, Link2, Save, BarChart3, BrainCircuit, FileText, Activity } from 'lucide-react';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  accounts: TradingAccount[];
  selectedAccountId?: string;
  tradeToEdit?: Trade | null;
  onSaveGuestTrade?: (trade: Trade) => void;
}

type Step = 1 | 2 | 3 | 4;

const steps = [
  { id: 1 as Step, label: 'Données', icon: Activity, description: 'Instrument, prix et résultat' },
  { id: 2 as Step, label: 'Contexte', icon: BarChart3, description: 'Setup et environnement' },
  { id: 3 as Step, label: 'Psychologie', icon: BrainCircuit, description: 'État mental et discipline' },
  { id: 4 as Step, label: 'Notes & liens', icon: FileText, description: 'Débriefing et graphique' },
];

export function TradeModal({
  isOpen,
  onClose,
  userId,
  accounts,
  selectedAccountId,
  tradeToEdit,
  onSaveGuestTrade
}: TradeModalProps) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>(1);

  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('NQ');
  const [direction, setDirection] = useState<TradeDirection>('BUY');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 16));
  const [exitDate, setExitDate] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [positionSize, setPositionSize] = useState('1');
  const [riskAmount, setRiskAmount] = useState('500');
  const [pnl, setPnl] = useState('');
  const [result, setResult] = useState<TradeResult>('WIN');
  const [rMultiple, setRMultiple] = useState('');
  const [setup, setSetup] = useState('Order Block');
  const [session, setSession] = useState<TradingSession>('New York');
  const [timeframe, setTimeframe] = useState<TradingTimeframe>('5m');
  const [emotion, setEmotion] = useState<EmotionalState>('Disciplined');
  const [notes, setNotes] = useState('');
  const [screenshotBeforeUrl, setScreenshotBeforeUrl] = useState('');
  const [screenshotAfterUrl, setScreenshotAfterUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    if (tradeToEdit) {
      setAccountId(tradeToEdit.accountId);
      setSymbol(tradeToEdit.symbol);
      setDirection(tradeToEdit.direction);
      setEntryDate(tradeToEdit.entryDate ? tradeToEdit.entryDate.slice(0, 16) : '');
      setExitDate(tradeToEdit.exitDate ? tradeToEdit.exitDate.slice(0, 16) : '');
      setEntryPrice(tradeToEdit.entryPrice?.toString() || '');
      setExitPrice(tradeToEdit.exitPrice?.toString() || '');
      setStopLoss(tradeToEdit.stopLoss?.toString() || '');
      setTakeProfit(tradeToEdit.takeProfit?.toString() || '');
      setPositionSize(tradeToEdit.positionSize?.toString() || '1');
      setRiskAmount(tradeToEdit.riskAmount?.toString() || '');
      setPnl(tradeToEdit.pnl?.toString() || '');
      setResult(tradeToEdit.result || 'WIN');
      setRMultiple(tradeToEdit.rMultiple?.toString() || '');
      setSetup(tradeToEdit.setup || '');
      setSession(tradeToEdit.session || 'New York');
      setTimeframe(tradeToEdit.timeframe || '5m');
      setEmotion(tradeToEdit.emotion || 'Disciplined');
      setNotes(tradeToEdit.notes || '');
      setScreenshotBeforeUrl(tradeToEdit.screenshotBeforeUrl || '');
      setScreenshotAfterUrl(tradeToEdit.screenshotAfterUrl || '');
    } else {
      setAccountId(selectedAccountId && selectedAccountId !== 'all' ? selectedAccountId : accounts[0]?.id || '');
      setSymbol('NQ');
      setDirection('BUY');
      setEntryDate(new Date().toISOString().slice(0, 16));
      setExitDate('');
      setEntryPrice('');
      setExitPrice('');
      setStopLoss('');
      setTakeProfit('');
      setPositionSize('1');
      setRiskAmount('500');
      setPnl('');
      setResult('WIN');
      setRMultiple('');
      setSetup('Order Block');
      setSession('New York');
      setTimeframe('5m');
      setEmotion('Disciplined');
      setNotes('');
      setScreenshotBeforeUrl('');
      setScreenshotAfterUrl('');
    }
  }, [isOpen, tradeToEdit, accounts, selectedAccountId]);

  const handlePnlChange = (value: string) => {
    setPnl(value);
    const numericPnl = parseFloat(value);
    const numericRisk = parseFloat(riskAmount);
    if (!Number.isNaN(numericPnl)) {
      setResult(numericPnl > 0 ? 'WIN' : numericPnl < 0 ? 'LOSS' : 'BREAKEVEN');
      if (!Number.isNaN(numericRisk) && numericRisk > 0) {
        setRMultiple((numericPnl / numericRisk).toFixed(2));
      }
    }
  };

  const inputClass = 'w-full rounded-xl border border-[#dfe9e5] bg-white px-3 py-2.5 text-sm text-[#10233a] outline-none transition focus:border-[#08b77a] focus:ring-4 focus:ring-[#08b77a]/10';
  const labelClass = 'block mb-1.5 text-[11px] font-semibold text-[#5f748c]';

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!accountId) {
      showToast('Veuillez sélectionner un compte de trading', 'error');
      setStep(1);
      return;
    }
    if (!symbol.trim()) {
      showToast('Veuillez indiquer un instrument', 'error');
      setStep(1);
      return;
    }

    try {
      setIsSubmitting(true);
      const parsedPnl = parseFloat(pnl) || 0;
      const parsedRisk = parseFloat(riskAmount) || 0;
      const parsedR = rMultiple ? parseFloat(rMultiple) : (parsedRisk > 0 ? parsedPnl / parsedRisk : 0);

      const tradeData: Omit<Trade, 'id'> = {
        userId,
        accountId,
        symbol: symbol.toUpperCase().trim(),
        direction,
        entryDate: new Date(entryDate).toISOString(),
        exitDate: exitDate ? new Date(exitDate).toISOString() : undefined,
        entryPrice: parseFloat(entryPrice) || 0,
        exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        positionSize: parseFloat(positionSize) || 1,
        riskAmount: parsedRisk,
        pnl: parsedPnl,
        result,
        rMultiple: parseFloat(parsedR.toFixed(2)),
        setup,
        session,
        timeframe,
        emotion,
        notes: notes.trim(),
        screenshotBeforeUrl: screenshotBeforeUrl.trim() || undefined,
        screenshotAfterUrl: screenshotAfterUrl.trim() || undefined,
      };

      if (userId === 'guest-trader-id') {
        onSaveGuestTrade?.({ id: tradeToEdit ? tradeToEdit.id : `guest-trade-${Date.now()}`, ...tradeData });
        showToast(tradeToEdit ? 'Trade mis à jour' : 'Trade enregistré', 'success');
      } else if (tradeToEdit) {
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

  const goNext = () => setStep(current => (Math.min(4, current + 1) as Step));
  const goBack = () => setStep(current => (Math.max(1, current - 1) as Step));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tradeToEdit ? 'Modifier le trade' : 'Nouveau trade'}
      subtitle="Enregistrez votre opération en quelques étapes"
      maxWidth="max-w-4xl"
    >
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
              <div><label className={labelClass}>Instrument *</label><input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="XAUUSD, EURUSD, NQ..." className={inputClass} required /></div>
              <div><label className={labelClass}>Direction</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setDirection('BUY')} className={`rounded-xl border py-2.5 text-xs font-bold ${direction === 'BUY' ? 'bg-[#e7faf3] text-[#008f63] border-[#9de2ca]' : 'bg-white text-[#71839a] border-[#dfe9e5]'}`}>Acheteur</button><button type="button" onClick={() => setDirection('SELL')} className={`rounded-xl border py-2.5 text-xs font-bold ${direction === 'SELL' ? 'bg-[#fff0f2] text-[#f04f63] border-[#ffd0d8]' : 'bg-white text-[#71839a] border-[#dfe9e5]'}`}>Vendeur</button></div></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className={labelClass}>Date & heure d'entrée *</label><input type="datetime-local" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputClass} required /></div>
              <div><label className={labelClass}>Date & heure de sortie</label><input type="datetime-local" value={exitDate} onChange={e => setExitDate(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Prix d'entrée</label><input type="number" step="any" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Prix de sortie</label><input type="number" step="any" value={exitPrice} onChange={e => setExitPrice(e.target.value)} className={inputClass} /></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className={labelClass}>Stop Loss</label><input type="number" step="any" value={stopLoss} onChange={e => setStopLoss(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Take Profit</label><input type="number" step="any" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Taille</label><input type="number" step="any" value={positionSize} onChange={e => setPositionSize(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Risque initial</label><input type="number" step="any" value={riskAmount} onChange={e => setRiskAmount(e.target.value)} className={inputClass} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>P&L net *</label><input type="number" step="any" placeholder="+850 ou -400" value={pnl} onChange={e => handlePnlChange(e.target.value)} className={`${inputClass} font-mono font-bold ${parseFloat(pnl) > 0 ? 'text-[#00a86b] border-[#bdeedc]' : parseFloat(pnl) < 0 ? 'text-[#f04f63] border-[#ffd0d8]' : ''}`} required /></div>
              <div><label className={labelClass}>Multiple R</label><input type="number" step="any" value={rMultiple} onChange={e => setRMultiple(e.target.value)} className={inputClass} /></div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-[#f7fbf9] border border-[#e5eeeb] p-4"><h3 className="text-sm font-bold text-[#10233a]">Contexte du trade</h3><p className="text-[11px] text-[#8a9aab] mt-1">Gardez uniquement les éléments utiles à votre analyse.</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelClass}>Setup / stratégie</label><select value={setup} onChange={e => setSetup(e.target.value)} className={inputClass}><option value="Order Block">Order Block</option><option value="Liquidity Sweep">Liquidity Sweep</option><option value="FVG">Fair Value Gap</option><option value="Breakout">Breakout</option><option value="Trend Following">Trend Following</option><option value="Reversal">Reversal</option><option value="Scalp Range">Scalp Range</option><option value="Autre">Autre</option></select></div>
              <div><label className={labelClass}>Session</label><select value={session} onChange={e => setSession(e.target.value as TradingSession)} className={inputClass}><option value="Asia">Asie</option><option value="London">Londres</option><option value="New York">New York</option><option value="Overlap">Overlap</option></select></div>
              <div><label className={labelClass}>Timeframe</label><select value={timeframe} onChange={e => setTimeframe(e.target.value as TradingTimeframe)} className={inputClass}><option value="1m">1m</option><option value="5m">5m</option><option value="15m">15m</option><option value="1h">1h</option><option value="4h">4h</option><option value="1D">Daily</option></select></div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-[#f7fbf9] border border-[#e5eeeb] p-4"><h3 className="text-sm font-bold text-[#10233a]">Comment étiez-vous avant et pendant le trade ?</h3><p className="text-[11px] text-[#8a9aab] mt-1">Cette partie alimente l'analyse de votre discipline et de vos biais.</p></div>
            <div><label className={labelClass}>État psychologique</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{(['Disciplined','Calm','Focused','FOMO','Fear','Revenge','Overconfidence','Hesitation'] as EmotionalState[]).map(value => <button type="button" key={value} onClick={() => setEmotion(value)} className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${emotion === value ? 'bg-[#e7faf3] border-[#9de2ca] text-[#008f63]' : 'bg-white border-[#e5ece9] text-[#71839a] hover:bg-[#f8fbfa]'}`}>{value === 'Disciplined' ? 'Discipliné' : value === 'Calm' ? 'Calme' : value === 'Focused' ? 'Concentré' : value === 'FOMO' ? 'FOMO' : value === 'Fear' ? 'Peur' : value === 'Revenge' ? 'Revenge trading' : value === 'Overconfidence' ? 'Excès de confiance' : 'Hésitation'}</button>)}</div></div>
            <div className="rounded-2xl border border-[#e5ece9] p-4 bg-white"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-[#314861]">Résultat enregistré</span><span className={`font-mono font-bold ${result === 'WIN' ? 'text-[#00a86b]' : result === 'LOSS' ? 'text-[#f04f63]' : 'text-[#71839a]}`}>{result === 'WIN' ? 'Trade gagnant' : result === 'LOSS' ? 'Trade perdant' : 'Break-even'}</span></div></div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div><label className={labelClass}>Notes & débriefing</label><textarea rows={7} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Pourquoi avez-vous pris ce trade ? Qu'avez-vous bien ou mal exécuté ?" className={`${inputClass} resize-none`} /></div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-[#f7fbf9] border border-[#e5eeeb] p-4"><div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-[#08b77a]" /><div><div className="text-xs font-bold text-[#10233a]">Liens du graphique</div><div className="text-[10px] text-[#8a9aab]">Conservez l'accès au contexte visuel du trade.</div></div></div></div>
                <div><label className={labelClass}>Lien avant le trade</label><input type="url" value={screenshotBeforeUrl} onChange={e => setScreenshotBeforeUrl(e.target.value)} placeholder="https://..." className={inputClass} /></div>
                <div><label className={labelClass}>Lien après le trade</label><input type="url" value={screenshotAfterUrl} onChange={e => setScreenshotAfterUrl(e.target.value)} placeholder="https://..." className={inputClass} /></div>
              </div>
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-[#edf2f0]">
          <button type="button" onClick={step === 1 ? onClose : goBack} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#5f748c] hover:bg-[#f5f9f7] cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> {step === 1 ? 'Annuler' : 'Précédent'}
          </button>
          {step < 4 ? (
            <button type="button" onClick={goNext} className="btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs cursor-pointer">Suivant <ArrowRight className="w-3.5 h-3.5" /></button>
          ) : (
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-60">
              {isSubmitting ? 'Enregistrement...' : <><Save className="w-3.5 h-3.5" /> Enregistrer le trade</>}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
