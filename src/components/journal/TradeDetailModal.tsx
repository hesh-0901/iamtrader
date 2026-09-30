import React,{useState} from 'react';
import { Modal } from '../common/Modal';
import { Trade, TradingAccount } from '../../types';
import { ResultBadge, DirectionBadge, EmotionTag } from '../common/Badge';
import { formatCurrency } from '../../utils/calculations';
import { Edit2, Trash2 } from 'lucide-react';
import { deleteTrade } from '../../services/firestore';
import { useToast } from '../common/Toast';

interface TradeDetailModalProps { trade:Trade|null; accounts:TradingAccount[]; isOpen:boolean; onClose:()=>void; onEdit:(trade:Trade)=>void; onDeleteGuestTrade?:(tradeId:string)=>void; }

export function TradeDetailModal({trade,accounts,isOpen,onClose,onEdit,onDeleteGuestTrade}:TradeDetailModalProps) {
  const {showToast}=useToast(); const [isDeleting,setIsDeleting]=useState(false); const [confirmDelete,setConfirmDelete]=useState(false);
  if(!trade)return null;
  const account=accounts.find(a=>a.id===trade.accountId);
  const handleDelete=async()=>{if(!confirmDelete){setConfirmDelete(true);return}try{setIsDeleting(true);if(trade.userId==='guest-trader-id'){if(onDeleteGuestTrade)onDeleteGuestTrade(trade.id);showToast('Trade supprimé (Mode Démo)','success')}else{await deleteTrade(trade.id);showToast('Trade supprimé de Firestore','success')}onClose()}catch(err:any){showToast(`Erreur de suppression: ${err.message}`,'error')}finally{setIsDeleting(false);setConfirmDelete(false)}};
  const positive=trade.pnl>0, negative=trade.pnl<0;
  return <Modal isOpen={isOpen} onClose={onClose} title={`${trade.symbol} · ${trade.direction}`} subtitle={`${trade.setup} · ${account?.name||'Compte de trading'}`} maxWidth="max-w-3xl">
    <div className="space-y-5">
      <section className={`rounded-2xl p-5 border ${positive?'bg-[#eaf9f3] border-[#c9eee1]':negative?'bg-[#fff0f2] border-[#ffd0d8]':'bg-[#f7fbf9] border-[#e2ece8]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div><div className="flex items-center gap-2 mb-3"><DirectionBadge direction={trade.direction}/><ResultBadge result={trade.result}/><span className="text-[10px] font-mono text-[#71839a]">{trade.timeframe} · {trade.session}</span></div>
            <div className={`text-4xl font-bold font-mono tracking-[-.04em] ${positive?'text-[#00a86b]':negative?'text-[#f04f63]':'text-[#10233a]'}`}>{formatCurrency(trade.pnl)}</div>
            {trade.rMultiple!==undefined&&<div className={`text-sm font-mono mt-1 ${positive?'text-[#00a86b]':negative?'text-[#f04f63]':'text-[#71839a]'}`}>{trade.rMultiple>0?`+${trade.rMultiple}R`:`${trade.rMultiple}R`}</div>}
          </div>
          <div className="text-right"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#8a9aab]">Compte</div><div className="text-xs font-semibold text-[#314861] mt-1">{account?.name||'—'}</div></div>
        </div>
      </section>
      <section className="rounded-2xl border border-[#e5ece9] bg-white overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#edf2f0]">
          {[['Prix d’entrée',trade.entryPrice?trade.entryPrice.toLocaleString():'—','text-[#203a53]'],['Prix de sortie',trade.exitPrice?trade.exitPrice.toLocaleString():'—','text-[#203a53]'],['Stop Loss',trade.stopLoss?trade.stopLoss.toLocaleString():'—','text-[#f04f63]'],['Take Profit',trade.takeProfit?trade.takeProfit.toLocaleString():'—','text-[#00a86b]']].map(([label,value,cls])=><div key={label} className="p-4"><div className="text-[9px] uppercase tracking-[.13em] text-[#8a9aab] mb-1.5">{label}</div><div className={`text-sm font-semibold font-mono tabular-nums ${cls}`}>{value}</div></div>)}
        </div>
      </section>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#e5ece9] bg-white p-4"><div className="text-[9px] uppercase tracking-[.13em] text-[#8a9aab] mb-2">Date & heure</div><div className="text-xs font-mono text-[#3b536d]">{new Date(trade.entryDate).toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div>
        <div className="rounded-xl border border-[#e5ece9] bg-white p-4"><div className="text-[9px] uppercase tracking-[.13em] text-[#8a9aab] mb-2">Taille & risque</div><div className="text-xs font-mono text-[#3b536d]">{trade.positionSize} lots · {trade.riskAmount?`$${trade.riskAmount}`:'Non spécifié'}</div></div>
        <div className="rounded-xl border border-[#e5ece9] bg-white p-4"><div className="text-[9px] uppercase tracking-[.13em] text-[#8a9aab] mb-2">Psychologie</div><EmotionTag emotion={trade.emotion}/></div>
      </section>
      {trade.notes&&<section className="rounded-2xl border border-[#e5ece9] bg-white p-5"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#8a9aab] mb-2">Débriefing & réflexions</div><p className="text-sm text-[#3b536d] leading-relaxed whitespace-pre-wrap">{trade.notes}</p></section>}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          ['Avant le trade', trade.screenshotBeforeUrl],
          ['Après la sortie', trade.screenshotAfterUrl]
        ].map(([label, url]) => (
          <div key={String(label)} className="rounded-2xl border border-[#e5ece9] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#edf2f0] flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#8a9aab]">Lien graphique · {label}</span>
              {url && <a href={String(url)} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-[#008f63] hover:underline">Ouvrir</a>}
            </div>
            {url ? <a href={String(url)} target="_blank" rel="noopener noreferrer" className="block">
              <img src={String(url)} alt={String(label)} className="w-full h-44 object-cover" onError={e=>{(e.target as HTMLElement).style.display='none'}}/>
            </a> : <div className="h-28 flex items-center justify-center text-xs text-[#9aa9b8]">Aucun lien ajouté</div>}
          </div>
        ))}
      </section>
      <div className="flex items-center justify-between pt-4 border-t border-[#edf2f0]">
        <div className="flex items-center gap-2"><button onClick={handleDelete} disabled={isDeleting} className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${confirmDelete?'bg-[#f04f63] text-white':'text-[#f04f63] border border-[#ffd0d8] hover:bg-[#fff0f2]'}`}><Trash2 className="w-3.5 h-3.5"/>{confirmDelete?'Confirmer la suppression':'Supprimer'}</button>{confirmDelete&&<button onClick={()=>setConfirmDelete(false)} className="text-xs text-[#71839a] hover:text-[#10233a] underline cursor-pointer">Annuler</button>}</div>
        <button onClick={()=>{onClose();onEdit(trade)}} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#e7faf3] text-[#008f63] hover:bg-[#f7fbf9] transition-colors cursor-pointer"><Edit2 className="w-3.5 h-3.5"/>Modifier</button>
      </div>
    </div>
  </Modal>;
}
