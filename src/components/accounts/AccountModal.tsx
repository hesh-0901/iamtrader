import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { TradingAccount, AccountType, CurrencyCode } from '../../types';
import { addAccount } from '../../services/firestore';
import { useToast } from '../common/Toast';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function AccountModal({ isOpen, onClose, userId }: AccountModalProps) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [broker, setBroker] = useState('');
  const [type, setType] = useState<AccountType>('Prop Firm Funded');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [initialBalance, setInitialBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [targetProfit, setTargetProfit] = useState('');
  const [maxDrawdownLimit, setMaxDrawdownLimit] = useState('');
  const [riskPerTradePercent, setRiskPerTradePercent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Veuillez entrer un nom de compte', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const accData: Omit<TradingAccount, 'id'> = {
        userId,
        name: name.trim(),
        broker: broker.trim(),
        type,
        currency,
        initialBalance: initialBalance ? parseFloat(initialBalance) : 0,
        currentBalance: currentBalance ? parseFloat(currentBalance) : 0,
        status: 'Active',
        createdAt: new Date().toISOString(),
        ...(targetProfit ? { targetProfit: parseFloat(targetProfit) } : {}),
        ...(maxDrawdownLimit ? { maxDrawdownLimit: parseFloat(maxDrawdownLimit) } : {}),
        ...(riskPerTradePercent ? { riskPerTradePercent: parseFloat(riskPerTradePercent) } : {})
      };

      await addAccount(accData);
      showToast('Compte de trading ajouté avec succès à Firestore', 'success');

      onClose();
    } catch (err: any) {
      showToast(`Erreur lors de la création du compte: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nouveau compte de trading"
      subtitle="Centralisez vos comptes Prop Firm ou Brokers personnels"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-neutral-300">
        <div>
          <label className="block font-medium text-neutral-400 mb-1">Nom du compte *</label>
          <input
            type="text"
            placeholder="ex: FTMO $100K Swing, Apex $50k #1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-neutral-400 mb-1">Broker / Prop Firm</label>
            <input
              type="text"
              placeholder="ex: FTMO, Apex, Topstep, IBKR"
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1">Type de compte</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
            >
              <option value="Prop Firm Funded">Prop Firm Funded</option>
              <option value="Prop Firm Challenge">Prop Firm Challenge</option>
              <option value="Personal Live">Compte Réel Personnel</option>
              <option value="Demo / Simulation">Démo / Entraînement</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-neutral-400 mb-1">Capital Initial ($)</label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => {
                setInitialBalance(e.target.value);
                setCurrentBalance(e.target.value);
              }}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1">Devise</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-neutral-400 mb-1">Max Drawdown ($)</label>
            <input
              type="number"
              placeholder="ex: 2500"
              value={maxDrawdownLimit}
              onChange={(e) => setMaxDrawdownLimit(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-400 mb-1">Profit Target ($)</label>
            <input
              type="number"
              placeholder="ex: 5000"
              value={targetProfit}
              onChange={(e) => setTargetProfit(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono"
            />
          </div>
        </div>

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
            className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-md disabled:opacity-50"
          >
            {isSubmitting ? 'Création...' : 'Créer le compte'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
