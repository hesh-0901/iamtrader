import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Trade, TradingAccount } from '../../types';
import { ResultBadge, DirectionBadge, EmotionTag } from '../common/Badge';
import { formatCurrency } from '../../utils/calculations';
import { Edit2, Trash2, ExternalLink, Calendar, Clock, DollarSign, Target, Shield } from 'lucide-react';
import { deleteTrade } from '../../services/firestore';
import { useToast } from '../common/Toast';

interface TradeDetailModalProps {
  trade: Trade | null;
  accounts: TradingAccount[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onDeleteGuestTrade?: (tradeId: string) => void;
}

export function TradeDetailModal({ trade, accounts, isOpen, onClose, onEdit, onDeleteGuestTrade }: TradeDetailModalProps) {
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!trade) return null;

  const account = accounts.find(a => a.id === trade.accountId);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setIsDeleting(true);
      if (trade.userId === 'guest-trader-id') {
        if (onDeleteGuestTrade) onDeleteGuestTrade(trade.id);
        showToast('Trade supprimé (Mode Démo)', 'success');
      } else {
        await deleteTrade(trade.id);
        showToast('Trade supprimé de Firestore', 'success');
      }
      onClose();
    } catch (err: any) {
      showToast(`Erreur de suppression: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${trade.symbol} — ${trade.direction} (${trade.setup})`}
      subtitle={`Exécuté sur ${account?.name || 'Compte de trading'}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 text-xs text-neutral-300">
        {/* Primary Banner */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-850 border border-neutral-800">
          <div className="flex items-center gap-3">
            <DirectionBadge direction={trade.direction} />
            <ResultBadge result={trade.result} pnl={trade.pnl} />
            <span className="text-neutral-400 font-mono">
              {trade.timeframe} · {trade.session} Session
            </span>
          </div>

          <div className="text-right">
            <div className={`text-xl font-bold font-mono tabular-nums ${
              trade.pnl > 0 ? 'text-emerald-400' : trade.pnl < 0 ? 'text-rose-400' : 'text-neutral-300'
            }`}>
              {formatCurrency(trade.pnl)}
            </div>
            {trade.rMultiple !== undefined && (
              <div className="text-[11px] text-neutral-400 font-mono">
                {trade.rMultiple > 0 ? `+${trade.rMultiple}R` : `${trade.rMultiple}R`}
              </div>
            )}
          </div>
        </div>

        {/* Pricing & Execution Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/60 p-4 rounded-xl border border-neutral-800/80 font-mono">
          <div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Prix d'entrée</div>
            <div className="text-sm font-semibold text-neutral-100 tabular-nums">
              {trade.entryPrice ? trade.entryPrice.toLocaleString() : '—'}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Prix de sortie</div>
            <div className="text-sm font-semibold text-neutral-100 tabular-nums">
              {trade.exitPrice ? trade.exitPrice.toLocaleString() : '—'}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Stop Loss</div>
            <div className="text-sm font-semibold text-rose-400 tabular-nums">
              {trade.stopLoss ? trade.stopLoss.toLocaleString() : '—'}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Take Profit</div>
            <div className="text-sm font-semibold text-emerald-400 tabular-nums">
              {trade.takeProfit ? trade.takeProfit.toLocaleString() : '—'}
            </div>
          </div>
        </div>

        {/* Metadata stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-neutral-300">
          <div className="bg-neutral-850/60 p-3 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 block text-[10px] uppercase mb-1">Date & Heure d'entrée</span>
            <span className="font-mono text-neutral-200">
              {new Date(trade.entryDate).toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          <div className="bg-neutral-850/60 p-3 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 block text-[10px] uppercase mb-1">Taille & Risque</span>
            <span className="font-mono text-neutral-200">
              {trade.positionSize} lots · {trade.riskAmount ? `$${trade.riskAmount}` : 'Non spécifié'}
            </span>
          </div>

          <div className="bg-neutral-850/60 p-3 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 block text-[10px] uppercase mb-1">Psychologie / Émotion</span>
            <EmotionTag emotion={trade.emotion} />
          </div>
        </div>

        {/* Notes */}
        {trade.notes && (
          <div className="bg-neutral-850/80 p-4 rounded-xl border border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Débriefing & Réflexions
            </div>
            <p className="text-neutral-200 whitespace-pre-wrap leading-relaxed text-xs">
              {trade.notes}
            </p>
          </div>
        )}

        {/* Screenshots */}
        {(trade.screenshotBeforeUrl || trade.screenshotAfterUrl) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trade.screenshotBeforeUrl && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-neutral-400 font-medium">Capture Avant Trade</span>
                <a
                  href={trade.screenshotBeforeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative rounded-lg overflow-hidden border border-neutral-800 group hover:border-neutral-600 transition-colors"
                >
                  <img
                    src={trade.screenshotBeforeUrl}
                    alt="Graphique Avant Trade"
                    className="w-full h-40 object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-slate-50/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-5 h-5 text-neutral-100" />
                  </div>
                </a>
              </div>
            )}

            {trade.screenshotAfterUrl && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-neutral-400 font-medium">Capture Après Sortie</span>
                <a
                  href={trade.screenshotAfterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative rounded-lg overflow-hidden border border-neutral-800 group hover:border-neutral-600 transition-colors"
                >
                  <img
                    src={trade.screenshotAfterUrl}
                    alt="Graphique Après Trade"
                    className="w-full h-40 object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-slate-50/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-5 h-5 text-neutral-100" />
                  </div>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                confirmDelete 
                  ? 'bg-rose-500 text-slate-900 font-bold shadow-md shadow-rose-950/40'
                  : 'text-rose-400 hover:bg-rose-500/10 border border-rose-500/25'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{confirmDelete ? 'Confirmer la suppression' : 'Supprimer'}</span>
            </button>
            {confirmDelete && (
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-neutral-400 hover:text-slate-900 underline cursor-pointer"
              >
                Annuler
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(trade);
              }}
              className="btn-secondary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
