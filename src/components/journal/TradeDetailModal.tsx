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
      <section className={`rounded-2xl p-5 border ${positive?'bg-[#0e2418] border-[#275d42]':negative?'bg-[#251216] border-[#5a2731]':'bg-[#141b17] border-[#2a3931]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div><div className="flex items-center gap-2 mb-3"><DirectionBadge direction={trade.direction}/><ResultBadge result={trade.result}/><span className="text-[10px] font-mono text-[#68776f]">{trade.timeframe} · {trade.session}</span></div>
            <div className={`text-4xl font-bold font-mono tracking-[-.04em] ${positive?'text-[#55e09c]':negative?'text-[#ff7888]':'text-[#d8e2dc]'}`}>{formatCurrency(trade.pnl)}</div>
            {trade.rMultiple!==undefined&&<div className={`text-sm font-mono mt-1 ${positive?'text-[#45d391]':negative?'text-[#ff7182]':'text-[#82918a]'}`}>{trade.rMultiple>0?`+${trade.rMultiple}R`:`${trade.rMultiple}R`}</div>}
          </div>
          <div className="text-right"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#607067]">Compte</div><div className="text-xs font-semibold text-[#d9e3dd] mt-1">{account?.name||'—'}</div></div>
        </div>
      </section>
      <section className="rounded-2xl border border-[#26352c] bg-[#0d1410] overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#26352c]">
          {[['Prix d’entrée',trade.entryPrice?trade.entryPrice.toLocaleString():'—','text-[#dce6e0]'],['Prix de sortie',trade.exitPrice?trade.exitPrice.toLocaleString():'—','text-[#dce6e0]'],['Stop Loss',trade.stopLoss?trade.stopLoss.toLocaleString():'—','text-[#ff7182]'],['Take Profit',trade.takeProfit?trade.takeProfit.toLocaleString():'—','text-[#55e09c]']].map(([label,value,cls])=><div key={label} className="p-4"><div className="text-[9px] uppercase tracking-[.13em] text-[#65736c] mb-1.5">{label}</div><div className={`text-sm font-semibold font-mono tabular-nums ${cls}`}>{value}</div></div>)}
        </div>
      </section>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#26352c] bg-[#0d1410] p-4"><div className="text-[9px] uppercase tracking-[.13em] text-[#65736c] mb-2">Date & heure</div><div className="text-xs font-mono text-[#cbd7d0]">{new Date(trade.entryDate).toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div>
        <div className="rounded-xl border border-[#26352c] bg-[#0d1410] p-4"><div className="text-[9px] uppercase tracking-[.13em] text-[#65736c] mb-2">Taille & risque</div><div className="text-xs font-mono text-[#cbd7d0]">{trade.positionSize} lots · {trade.riskAmount?`$${trade.riskAmount}`:'Non spécifié'}</div></div>
        <div className="rounded-xl border border-[#26352c] bg-[#0d1410] p-4"><div className="text-[9px] uppercase tracking-[.13em] text-[#65736c] mb-2">Psychologie</div><EmotionTag emotion={trade.emotion}/></div>
      </section>
      {trade.notes&&<section className="rounded-2xl border border-[#26352c] bg-[#0d1410] p-5"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#65736c] mb-2">Débriefing & réflexions</div><p className="text-sm text-[#cbd7d0] leading-relaxed whitespace-pre-wrap">{trade.notes}</p></section>}
      {(trade.screenshotBeforeUrl||trade.screenshotAfterUrl)&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {trade.screenshotBeforeUrl&&<a href={trade.screenshotBeforeUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-[#26352c] group"><div className="px-3 py-2 text-[9px] uppercase tracking-wider text-[#65736c] bg-[#111914]">Capture avant trade</div><img src={trade.screenshotBeforeUrl} alt="Graphique Avant Trade" className="w-full h-44 object-cover group-hover:scale-[1.02] transition-transform" onError={e=>{(e.target as HTMLElement).style.display='none'}}/></a>}
        {trade.screenshotAfterUrl&&<a href={trade.screenshotAfterUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-[#26352c] group"><div className="px-3 py-2 text-[9px] uppercase tracking-wider text-[#65736c] bg-[#111914]">Capture après sortie</div><img src={trade.screenshotAfterUrl} alt="Graphique Après Trade" className="w-full h-44 object-cover group-hover:scale-[1.02] transition-transform" onError={e=>{(e.target as HTMLElement).style.display='none'}}/></a>}
      </div>}
      <div className="flex items-center justify-between pt-4 border-t border-[#223129]">
        <div className="flex items-center gap-2"><button onClick={handleDelete} disabled={isDeleting} className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${confirmDelete?'bg-[#8f2436] text-white':'text-[#ff7182] border border-[#6d2b36] hover:bg-[#34151b]'}`}><Trash2 className="w-3.5 h-3.5"/>{confirmDelete?'Confirmer la suppression':'Supprimer'}</button>{confirmDelete&&<button onClick={()=>setConfirmDelete(false)} className="text-xs text-[#718078] hover:text-white underline cursor-pointer">Annuler</button>}</div>
        <button onClick={()=>{onClose();onEdit(trade)}} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#eaf5ef] text-[#0a1710] hover:bg-white transition-colors cursor-pointer"><Edit2 className="w-3.5 h-3.5"/>Modifier</button>
      </div>
    </div>
  </Modal>;
}
