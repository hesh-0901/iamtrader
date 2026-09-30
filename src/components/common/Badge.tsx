import React from 'react';
import { TradeResult, TradeDirection, EmotionalState, SubscriptionPlan } from '../../types';
import { ArrowUpRight, ArrowDownRight, Sparkles, Zap } from 'lucide-react';

export function ResultBadge({result,pnl}:{result:TradeResult;pnl?:number}) {
  if(result==='WIN') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#55e09c] bg-[#103322] border border-[#2d6c4d] tabular-nums"><span className="w-1.5 h-1.5 rounded-full bg-[#45d391]"/>WIN{pnl!==undefined&&<span className="font-mono font-medium">(+${Math.abs(pnl).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:1})})</span>}</span>;
  if(result==='LOSS') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#ff7888] bg-[#34151b] border border-[#6d2b36] tabular-nums"><span className="w-1.5 h-1.5 rounded-full bg-[#ff5d72]"/>LOSS{pnl!==undefined&&<span className="font-mono font-medium">(-${Math.abs(pnl).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:1})})</span>}</span>;
  if(result==='BREAKEVEN') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#aab7b0] bg-[#1a231e] border border-[#34443b] tabular-nums"><span className="w-1.5 h-1.5 rounded-full bg-[#8b9992]"/>BE</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#e7b765] bg-[#302515] border border-[#6a4f24]"><span className="w-2 h-2 rounded-full bg-[#e7b765] animate-pulse"/>EN COURS</span>;
}
export function DirectionBadge({direction}:{direction:TradeDirection}) {
  const isBuy=direction==='BUY';
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight uppercase tabular-nums ${isBuy?'text-[#55e09c] bg-[#103322] border border-[#2d6c4d]':'text-[#ff7888] bg-[#34151b] border border-[#6d2b36]'}`}>{isBuy?<ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]"/>:<ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]"/>}{direction}</span>;
}
export function EmotionTag({emotion}:{emotion:EmotionalState}) {
  const positive=['Disciplined','Calm','Focused'].includes(emotion), negative=['FOMO','Revenge'].includes(emotion), warning=['Fear','Hesitation'].includes(emotion);
  const style=positive?'text-[#55e09c] bg-[#103322] border-[#2d6c4d]':negative?'text-[#ff7888] bg-[#34151b] border-[#6d2b36]':warning?'text-[#e7b765] bg-[#302515] border-[#6a4f24]':'text-[#b8a7e8] bg-[#211a31] border-[#493c65]';
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${style}`}><span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"/>{emotion}</span>;
}
export function PlanBadge({plan}:{plan:SubscriptionPlan}) {
  if(plan==='pro') return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#e7b765] bg-[#302515] border border-[#6a4f24] rounded-lg"><Sparkles className="w-3 h-3"/>PRO</span>;
  if(plan==='community') return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#8ecdb0] bg-[#153128] border border-[#2c6350] rounded-lg"><Zap className="w-3 h-3"/>COMMUNITY</span>;
  return <span className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#89968f] bg-[#18201b] border border-[#2a372f] rounded-md">FREE</span>;
}
