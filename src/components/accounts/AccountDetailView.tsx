import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, BadgeDollarSign, CalendarDays,
  Check, Clock3, Edit3, History, Landmark, Loader2, Plus, Save, Wallet, X
} from 'lucide-react';
import { TradingAccount, Trade } from '../types';
import { formatCurrency } from '../utils/calculations';
import {
  AccountMovement, AccountMovementType, addAccountMovement,
  subscribeAccountMovements, updateAccount
} from '../services/firestore';
import { useToast } from '../components/common/Toast';

interface AccountDetailViewProps {
  account: TradingAccount;
  trades: Trade[];
  onBack: () => void;
}

const movementLabels: Record<AccountMovementType, string> = {
  deposit: 'Ajout de fonds',
  withdrawal: 'Retrait de fonds',
  fee: 'Frais',
  payout: 'Payout reçu',
  adjustment: 'Ajustement du solde'
};

export function AccountDetailView({ account, trades, onBack }: AccountDetailViewProps) {
  const { showToast } = useToast();
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [movementType, setMovementType] = useState<AccountMovementType>('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [broker, setBroker] = useState(account.broker);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => subscribeAccountMovements(account.id, setMovements), [account.id]);

  const accountTrades = useMemo(() => trades.filter(trade => trade.accountId === account.id), [trades, account.id]);
  const tradingPnl = accountTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  const capitalBase = Number(account.currentBalance ?? account.initialBalance ?? 0);
  const currentBalance = capitalBase + tradingPnl;
  const deposits = movements.filter(item => item.type === 'deposit').reduce((sum, item) => sum + item.amount, 0);
  const withdrawals = movements.filter(item => item.type === 'withdrawal').reduce((sum, item) => sum + item.amount, 0);
  const fees = movements.filter(item => item.type === 'fee').reduce((sum, item) => sum + item.amount, 0);
  const payouts = movements.filter(item => item.type === 'payout').reduce((sum, item) => sum + item.amount, 0);

  const submitMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast('Saisissez un montant valide.', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      await addAccountMovement(account.id, movementType, parsedAmount, note);
      setAmount('');
      setNote('');
      showToast('Mouvement enregistré et solde actualisé.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Impossible d’enregistrer le mouvement.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      showToast('Le nom du compte est obligatoire.', 'error');
      return;
    }
    try {
      setIsSaving(true);
      await updateAccount(account.id, { name: name.trim(), broker: broker.trim() });
      setIsEditing(false);
      showToast('Informations du compte mises à jour.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Impossible de modifier le compte.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const movementTone = (type: AccountMovementType) => {
    if (type === 'deposit' || type === 'payout') return 'text-emerald-700 bg-emerald-50';
    if (type === 'withdrawal' || type === 'fee') return 'text-rose-700 bg-rose-50';
    return 'text-blue-700 bg-blue-50';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" aria-label="Retour aux comptes">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Fiche du compte</p>
            <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{account.name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Landmark className="h-3.5 w-3.5" />{account.broker || 'Broker non renseigné'} · {account.type} · {account.currency}</p>
          </div>
        </div>
        <button type="button" onClick={() => setIsEditing(value => !value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
          <Edit3 className="h-3.5 w-3.5" /> Modifier
        </button>
      </div>

      {isEditing && (
        <form onSubmit={saveAccount} className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-xs font-semibold text-slate-600">Nom du compte
            <input value={name} onChange={event => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" required />
          </label>
          <label className="block text-xs font-semibold text-slate-600">Broker / Prop Firm
            <input value={broker} onChange={event => setBroker(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setName(account.name); setBroker(account.broker); setIsEditing(false); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600"><X className="h-4 w-4" /></button>
            <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-[#102b43] to-[#0b1f35] p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-300">Solde estimé du compte</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">{formatCurrency(currentBalance, account.currency)}</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">{account.status}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:grid-cols-4">
          <div><p className="text-[10px] text-slate-400">Capital initial</p><p className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(account.initialBalance, account.currency)}</p></div>
          <div><p className="text-[10px] text-slate-400">P&L trading</p><p className={`mt-1 text-sm font-bold tabular-nums ${tradingPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(tradingPnl, account.currency)}</p></div>
          <div><p className="text-[10px] text-slate-400">Dépôts cumulés</p><p className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(deposits, account.currency)}</p></div>
          <div><p className="text-[10px] text-slate-400">Retraits cumulés</p><p className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(withdrawals, account.currency)}</p></div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2"><BadgeDollarSign className="h-5 w-5 text-emerald-600" /><div><h2 className="text-base font-extrabold text-slate-900">Mouvement de fonds</h2><p className="text-xs text-slate-500">Enregistrez une opération sur ce compte.</p></div></div>
          <form onSubmit={submitMovement} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">Type d’opération
              <select value={movementType} onChange={event => setMovementType(event.target.value as AccountMovementType)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500">
                <option value="deposit">Ajout de fonds</option><option value="withdrawal">Retrait de fonds</option><option value="payout">Payout reçu</option><option value="fee">Frais</option><option value="adjustment">Ajustement du solde</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">{movementType === 'adjustment' ? 'Nouveau solde souhaité' : 'Montant'} ({account.currency})
              <input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-emerald-500" required />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Note / Référence <span className="font-normal text-slate-400">(facultatif)</span>
              <input value={note} onChange={event => setNote(event.target.value)} maxLength={240} placeholder="Ex. dépôt bancaire, payout phase 1…" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
            </label>
            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer le mouvement
            </button>
          </form>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /><div><h2 className="text-base font-extrabold text-slate-900">Historique des mouvements</h2><p className="text-xs text-slate-500">Dépôts, retraits, frais et payouts.</p></div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{movements.length}</span></div>
          {movements.length ? (
            <div className="divide-y divide-slate-100">
              {movements.map(item => (
                <div key={item.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-1">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${movementTone(item.type)}`}>
                    {item.signedAmount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{movementLabels[item.type]}</p><p className="truncate text-[11px] text-slate-500">{item.note || new Date(item.createdAt).toLocaleString('fr-FR')}</p></div>
                  <div className={`shrink-0 text-right text-sm font-extrabold tabular-nums ${item.signedAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{item.signedAmount > 0 ? '+' : ''}{formatCurrency(item.signedAmount, account.currency)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center"><Clock3 className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-600">Aucun mouvement enregistré</p><p className="mt-1 text-xs text-slate-400">Les opérations apparaîtront ici.</p></div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2"><Wallet className="h-5 w-5 text-slate-500" /><h2 className="text-base font-extrabold text-slate-900">Synthèse financière</h2></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><p className="text-xs text-slate-500">Payouts reçus</p><p className="mt-1 text-sm font-bold text-emerald-700">{formatCurrency(payouts, account.currency)}</p></div>
          <div><p className="text-xs text-slate-500">Frais enregistrés</p><p className="mt-1 text-sm font-bold text-rose-700">{formatCurrency(fees, account.currency)}</p></div>
          <div><p className="text-xs text-slate-500">Nombre de trades</p><p className="mt-1 text-sm font-bold text-slate-900">{accountTrades.length}</p></div>
          <div><p className="text-xs text-slate-500">Mouvements</p><p className="mt-1 text-sm font-bold text-slate-900">{movements.length}</p></div>
        </div>
      </section>
    </div>
  );
}
