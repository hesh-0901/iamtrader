import React from 'react';
import { TradeResult, TradeDirection, EmotionalState, SubscriptionPlan } from '../../types';
import { ArrowUpRight, ArrowDownRight, Sparkles, Zap } from 'lucide-react';

export function ResultBadge({result,pnl}:{result:TradeResult;pnl?:number}) {
  if(result==='WIN') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#007F60] bg-[#DFFBF3] border border-[#A8EBD9] tabular-nums"><span className="w-1.5 h-1.5 rounded-full bg-[#45d391]"/>WIN{pnl!==undefined&&<span className="font-mono font-medium">(+${Math.abs(pnl).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:1})})</span>}</span>;
  if(result==='LOSS') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#D9345B] bg-[#FFF0F4] border border-[#FFC5D3] tabular-nums"><span className="w-1.5 h-1.5 rounded-full bg-[#ff5d72]"/>LOSS{pnl!==undefined&&<span className="font-mono font-medium">(-${Math.abs(pnl).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:1})})</span>}</span>;
  if(result==='BREAKEVEN') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#60758D] bg-[#EEF3F7] border border-[#CBD6DF] tabular-nums"><span className="w-1.5 h-1.5 rounded-full bg-[#8b9992]"/>BE</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#9A6700] bg-[#FFF5DD] border border-[#F0D28A]"><span className="w-2 h-2 rounded-full bg-[#e7b765] animate-pulse"/>EN COURS</span>;
}
export function DirectionBadge({direction}:{direction:TradeDirection}) {
  const isBuy=direction==='BUY';
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight uppercase tabular-nums ${isBuy?'text-[#007F60] bg-[#DFFBF3] border border-[#A8EBD9]':'text-[#D9345B] bg-[#FFF0F4] border border-[#FFC5D3]'}`}>{isBuy?<ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]"/>:<ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]"/>}{direction}</span>;
}
export function EmotionTag({emotion}:{emotion:EmotionalState}) {
  const positive=['Disciplined','Calm','Focused'].includes(emotion), negative=['FOMO','Revenge'].includes(emotion), warning=['Fear','Hesitation'].includes(emotion);
  const style=positive?'text-[#007F60] bg-[#DFFBF3] border-[#A8EBD9]':negative?'text-[#D9345B] bg-[#FFF0F4] border-[#FFC5D3]':warning?'text-[#9A6700] bg-[#FFF5DD] border-[#F0D28A]':'text-[#5E52D5] bg-[#EFEDFF] border-[#CFC9FF]';
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${style}`}><span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"/>{emotion}</span>;
}
export function PlanBadge({plan}:{plan:SubscriptionPlan}) {
  if(plan==='pro') return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#9A6700] bg-[#FFF5DD] border border-[#F0D28A] rounded-lg"><Sparkles className="w-3 h-3"/>PRO</span>;
  if(plan==='community') return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#007F60] bg-[#DFFBF3] border border-[#A8EBD9] rounded-lg"><Zap className="w-3 h-3"/>COMMUNITY</span>;
  return <span className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#60758D] bg-[#EEF3F7] border border-[#CBD6DF] rounded-md">FREE</span>;
}
