import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Trade, TradingAccount, TradeDirection, TradeResult, TradingSession, TradingTimeframe, EmotionalState } from '../../types';
import { addTrade, updateTrade } from '../../services/firestore';
import { useToast } from '../common/Toast';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  accounts: TradingAccount[];
  selectedAccountId?: string;
  tradeToEdit?: Trade | null;
  onSaveGuestTrade?: (trade: Trade) => void;
}

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

  // Form states
  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('NQ');
  const [direction, setDirection] = useState<TradeDirection>('BUY');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 16));
  const [exitDate, setExitDate] = useState('');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [exitPrice, setExitPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [positionSize, setPositionSize] = useState<string>('1');
  const [riskAmount, setRiskAmount] = useState<string>('500');
  const [pnl, setPnl] = useState<string>('');
  const [result, setResult] = useState<TradeResult>('WIN');
  const [rMultiple, setRMultiple] = useState<string>('');
  const [setup, setSetup] = useState('Order Block');
  const [session, setSession] = useState<TradingSession>('New York');
  const [timeframe, setTimeframe] = useState<TradingTimeframe>('5m');
  const [emotion, setEmotion] = useState<EmotionalState>('Disciplined');
  const [notes, setNotes] = useState('');
  const [screenshotBeforeUrl, setScreenshotBeforeUrl] = useState('');
  const [screenshotAfterUrl, setScreenshotAfterUrl] = useState('');

  useEffect(() => {
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
  }, [tradeToEdit, isOpen, accounts, selectedAccountId]);

  // Dynamic R Multiple and Result calculator
  const handlePnlChange = (val: string) => {
    setPnl(val);
    const numericPnl = parseFloat(val);
    const numericRisk = parseFloat(riskAmount);

    if (!isNaN(numericPnl)) {
      if (numericPnl > 0) setResult('WIN');
      else if (numericPnl < 0) setResult('LOSS');
      else setResult('BREAKEVEN');

      if (!isNaN(numericRisk) && numericRisk > 0) {
        setRMultiple((numericPnl / numericRisk).toFixed(2));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      showToast('Veuillez sélectionner un compte de trading', 'error');
      return;
    }
    if (!symbol.trim()) {
      showToast('Veuillez indiquer un symbole / instrument', 'error');
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
        if (onSaveGuestTrade) {
          onSaveGuestTrade({ id: tradeToEdit ? tradeToEdit.id : `guest-trade-${Date.now()}`, ...tradeData });
        }
        showToast(tradeToEdit ? 'Trade mis à jour (Mode Démo)' : 'Trade enregistré (Mode Démo)', 'success');
      } else {
        if (tradeToEdit) {
          await updateTrade(tradeToEdit.id, tradeData);
          showToast('Trade mis à jour dans Firestore avec succès', 'success');
        } else {
          await addTrade(tradeData);
          showToast('Trade enregistré dans Firestore avec succès', 'success');
        }
      }

      onClose();
    } catch (err: any) {
      console.warn('Notice saving trade:', err.message);
      showToast(`Erreur lors de la sauvegarde: ${err.message || 'Problème Firestore'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tradeToEdit ? 'Modifier la transaction' : 'Journaliser un nouveau trade'}
      subtitle="Enregistrement direct dans Firestore"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs text-neutral-300">
        {/* Row 1: Compte & Symbole & Direction */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Compte de trading *</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="">Sélectionner un compte</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.broker})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Symbole / Actif *</label>
            <input
              type="text"
              placeholder="ex: NQ, ES, EURUSD, XAUUSD"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 uppercase focus:outline-none focus:border-emerald-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Direction *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`py-2 text-center rounded-lg font-bold border transition-colors ${
                  direction === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                LONG / BUY
              </button>
              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`py-2 text-center rounded-lg font-bold border transition-colors ${
                  direction === 'SELL'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                SHORT / SELL
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Date & Heure d'entrée *</label>
            <input
              type="datetime-local"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Date & Heure de sortie</label>
            <input
              type="datetime-local"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Row 3: Prices & Risk */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Prix d'entrée</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Prix de sortie</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Stop Loss</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Take Profit</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Row 4: Size, Risk $, PnL $, R Multiple */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-850 p-3 rounded-lg border border-neutral-800">
          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Taille (Lots/Contrats)</label>
            <input
              type="number"
              step="any"
              value={positionSize}
              onChange={(e) => setPositionSize(e.target.value)}
              className="w-full bg-white border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Risque initial ($)</label>
            <input
              type="number"
              step="any"
              value={riskAmount}
              onChange={(e) => setRiskAmount(e.target.value)}
              className="w-full bg-white border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-200 mb-1.5">P&L Net ($) *</label>
            <input
              type="number"
              step="any"
              placeholder="+850 or -400"
              value={pnl}
              onChange={(e) => handlePnlChange(e.target.value)}
              className={`w-full bg-white border font-mono rounded-lg px-3 py-2 font-bold ${
                parseFloat(pnl) > 0 ? 'text-emerald-400 border-emerald-500/50' : parseFloat(pnl) < 0 ? 'text-rose-400 border-rose-500/50' : 'text-neutral-100 border-neutral-700'
              }`}
              required
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Multiple R</label>
            <input
              type="number"
              step="any"
              placeholder="ex: 2.1"
              value={rMultiple}
              onChange={(e) => setRMultiple(e.target.value)}
              className="w-full bg-white border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono"
            />
          </div>
        </div>

        {/* Row 5: Setup, Session, Timeframe, Emotion */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Setup / Stratégie</label>
            <select
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
            >
              <option value="Order Block">Order Block</option>
              <option value="Liquidity Sweep">Liquidity Sweep</option>
              <option value="FVG">Fair Value Gap (FVG)</option>
              <option value="Breakout">Breakout</option>
              <option value="Trend Following">Trend Following</option>
              <option value="Reversal">Reversal</option>
              <option value="Scalp Range">Scalp Range</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Session</label>
            <select
              value={session}
              onChange={(e) => setSession(e.target.value as TradingSession)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
            >
              <option value="Asia">Asie (Tokyo)</option>
              <option value="London">Londres</option>
              <option value="New York">New York</option>
              <option value="Overlap">Overlap London/NY</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as TradingTimeframe)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1D">Daily</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">État Psychologique</label>
            <select
              value={emotion}
              onChange={(e) => setEmotion(e.target.value as EmotionalState)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
            >
              <option value="Disciplined">Discipliné</option>
              <option value="Calm">Calme</option>
              <option value="Focused">Concentré</option>
              <option value="FOMO">FOMO (Impulsif)</option>
              <option value="Fear">Peur / Hésitation</option>
              <option value="Revenge">Revenge Trading</option>
              <option value="Overconfidence">Excès de confiance</option>
              <option value="Hesitation">Hésitation</option>
            </select>
          </div>
        </div>

        {/* Row 6: Screenshots links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Screenshot Avant (URL)</label>
            <input
              type="url"
              placeholder="https://..."
              value={screenshotBeforeUrl}
              onChange={(e) => setScreenshotBeforeUrl(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Screenshot Après (URL)</label>
            <input
              type="url"
              placeholder="https://..."
              value={screenshotAfterUrl}
              onChange={(e) => setScreenshotAfterUrl(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Row 7: Notes & Journaling */}
        <div>
          <label className="block font-medium text-neutral-400 mb-1.5">Notes, contexte & débriefing du trade</label>
          <textarea
            rows={3}
            placeholder="Pourquoi as-tu pris ce trade ? Les règles ont-elles été respectées ? Quel est ton ressenti d'exécution ?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500 leading-relaxed"
          />
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></div>}
            <span>{tradeToEdit ? 'Enregistrer les modifications' : 'Ajouter au Journal'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
