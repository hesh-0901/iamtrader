import React from 'react';
import { TradeResult, TradeDirection, EmotionalState, SubscriptionPlan } from '../../types';
import { ArrowUpRight, ArrowDownRight, Check, Minus, Sparkles, Zap, ShieldCheck } from 'lucide-react';

export function ResultBadge({ result, pnl }: { result: TradeResult; pnl?: number }) {
  if (result === 'WIN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 shadow-xs shadow-emerald-950/20 tabular-nums">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>WIN</span>
        {pnl !== undefined && (
          <span className="text-emerald-300 font-mono font-medium">
            (+${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })})
          </span>
        )}
      </span>
    );
  }
  if (result === 'LOSS') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/25 shadow-xs shadow-rose-950/20 tabular-nums">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        <span>LOSS</span>
        {pnl !== undefined && (
          <span className="text-rose-300 font-mono font-medium">
            (-${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })})
          </span>
        )}
      </span>
    );
  }
  if (result === 'BREAKEVEN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-neutral-300 bg-neutral-800/80 border border-white/10 tabular-nums">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
        <span>BE</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      <span>EN COURS</span>
    </span>
  );
}

export function DirectionBadge({ direction }: { direction: TradeDirection }) {
  const isBuy = direction === 'BUY';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-tight uppercase tabular-nums ${
      isBuy 
        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25' 
        : 'text-rose-400 bg-rose-500/10 border border-rose-500/25'
    }`}>
      {isBuy ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
      <span>{direction}</span>
    </span>
  );
}

export function EmotionTag({ emotion }: { emotion: EmotionalState }) {
  const getStyle = () => {
    switch (emotion) {
      case 'Disciplined':
      case 'Calm':
      case 'Focused':
        return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
      case 'FOMO':
      case 'Revenge':
        return 'text-rose-300 bg-rose-500/10 border-rose-500/20';
      case 'Fear':
      case 'Hesitation':
        return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
      case 'Overconfidence':
        return 'text-violet-300 bg-violet-500/10 border-violet-500/20';
      default:
        return 'text-neutral-400 bg-neutral-800/60 border-neutral-700/60';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStyle()} backdrop-blur-xs`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      <span>{emotion}</span>
    </span>
  );
}

export function PlanBadge({ plan }: { plan: SubscriptionPlan }) {
  if (plan === 'pro') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 bg-gradient-to-r from-amber-500/20 to-amber-600/15 border border-amber-500/35 rounded-lg shadow-xs shadow-amber-950/20">
        <Sparkles className="w-3 h-3 text-amber-300 fill-amber-400/20" />
        PRO
      </span>
    );
  }
  if (plan === 'community') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-300 bg-sky-500/15 border border-sky-500/35 rounded-lg shadow-xs">
        <Zap className="w-3 h-3 text-sky-300 fill-sky-400/20" />
        COMMUNITY
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 bg-neutral-800/80 border border-neutral-700/80 rounded-md">
      FREE
    </span>
  );
}
