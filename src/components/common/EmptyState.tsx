import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  accentColor?: 'emerald' | 'amber' | 'sky' | 'violet';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  accentColor = 'sky'
}: EmptyStateProps) {
  return (
    <div className="py-12 px-6 text-center max-w-lg mx-auto flex flex-col items-center justify-center animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3.5">
        <Icon className="w-6 h-6 stroke-[1.75]" />
      </div>

      <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1.5">
        {title}
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed mb-5 max-w-sm">
        {description}
      </p>

      {/* Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <span>{actionLabel}</span>
          </button>
        )}
        {secondaryLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="btn-secondary px-3.5 py-2 rounded-lg text-xs cursor-pointer font-medium"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
