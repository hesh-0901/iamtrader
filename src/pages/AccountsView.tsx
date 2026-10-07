import React, { useState } from 'react';
import { TradingAccount, Trade } from '../types';
import { formatCurrency } from '../utils/calculations';
import { EmptyState } from '../components/common/EmptyState';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  Target, 
  CheckCircle2, 
  Landmark,
  ShieldCheck
} from 'lucide-react';
import { deleteAccount } from '../services/firestore';
import { useToast } from '../components/common/Toast';

interface AccountsViewProps {
  accounts: TradingAccount[];
  trades: Trade[];
  onOpenNewAccount: () => void;
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
}

export function AccountsView({
  accounts,
  trades,
  onOpenNewAccount,
  selectedAccountId,
  onSelectAccount
}: AccountsViewProps) {
  const { showToast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Confirmez-vous la suppression de ce compte de trading ?')) {
      try {
        await deleteAccount(accountId);
        // The deleted account can no longer remain selected in the global app state.
        if (selectedAccountId === accountId) {
          onSelectAccount('all');
        }
        showToast('Compte supprimé avec succès', 'success');
      } catch (err: any) {
        showToast(`Erreur: ${err.message}`, 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
              Gestion Multi-Comptes
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Portefeuilles & Comptes Financés
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Suivez séparément vos challenges, évaluations Prop Firm, comptes funded et portefeuilles personnels.
          </p>
        </div>

        <button
          onClick={onOpenNewAccount}
          className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs cursor-pointer shadow-md self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Ajouter un Compte</span>
        </button>
      </div>

      {/* Accounts Grid */}
      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => {
            const accTrades = trades.filter(t => t.accountId === acc.id);
            const totalPnl = accTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
            const currentBal = acc.initialBalance + totalPnl;
            const isSelected = selectedAccountId === acc.id;

            const progressTarget = acc.targetProfit ? Math.min(100, Math.max(0, (totalPnl / acc.targetProfit) * 100)) : null;

            return (
              <div
                key={acc.id}
                onClick={() => onSelectAccount(acc.id)}
                className={`p-5 rounded-xl card-premium cursor-pointer flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all ${
                  isSelected ? 'border-blue-500/70 ring-1 ring-blue-500/40 bg-white/80' : ''
                }`}
              >
                <div>
                  {/* Account Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                          {acc.type}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Sélectionné
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-2 tracking-tight">{acc.name}</h3>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Landmark className="w-3.5 h-3.5 text-slate-500" />
                        <span>{acc.broker}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-400">{acc.currency}</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(acc.id, e)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer ce compte"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Balance Display */}
                  <div className="mt-3.5 p-3 rounded-lg bg-white border border-slate-200 font-mono">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-sans">Solde Actuel :</span>
                      <span className="font-bold text-slate-900 text-sm tabular-nums">
                        {formatCurrency(currentBal, acc.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80">
                      <span className="text-slate-500 font-sans">P&L Réalisé :</span>
                      <span className={`font-bold tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totalPnl >= 0 ? `+${formatCurrency(totalPnl, acc.currency)}` : formatCurrency(totalPnl, acc.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-sans">
                      <span>Capital Initial :</span>
                      <span className="font-mono text-slate-500">{formatCurrency(acc.initialBalance, acc.currency)}</span>
                    </div>
                  </div>

                  {/* Profit Target Progress (if defined) */}
                  {acc.targetProfit && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1 font-medium">
                          <Target className="w-3.5 h-3.5 text-blue-400" />
                          <span>Objectif Profit :</span>
                        </span>
                        <span className="font-mono font-bold text-blue-400">
                          {formatCurrency(acc.targetProfit, acc.currency)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${progressTarget}%` }}
                          className="bg-blue-500 h-full rounded transition-all duration-500"
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 text-right font-mono">
                        {progressTarget ? `${progressTarget.toFixed(0)}% atteint` : '0%'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer specs */}
                <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>{accTrades.length} trade{accTrades.length > 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Synchronisé</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl card-premium overflow-hidden p-6 border-slate-200">
          <EmptyState
            icon={Wallet}
            title="Aucun portefeuille configuré"
            description="Créez votre premier compte de trading (Compte personnel, Challenge Prop Firm ou Broker) pour commencer à isoler vos statistiques."
            actionLabel="+ Ajouter un compte de trading"
            onAction={onOpenNewAccount}
            accentColor="sky"
          />
        </div>
      )}
    </div>
  );
}
