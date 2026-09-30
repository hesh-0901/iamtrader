import React from 'react';

export function CardSkeleton() {
  return (
    <div className="p-5 rounded-2xl bg-white/60 border border-white/[0.06] animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-24 bg-white/10 rounded-full" />
        <div className="w-8 h-8 rounded-xl bg-white/10" />
      </div>
      <div className="h-7 w-32 bg-white/10 rounded-lg mb-2" />
      <div className="h-3 w-20 bg-white/5 rounded-full" />
      <div className="mt-4 pt-3 border-t border-white/[0.04] flex justify-between">
        <div className="h-2.5 w-16 bg-white/5 rounded-full" />
        <div className="h-2.5 w-12 bg-white/5 rounded-full" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b border-white/[0.04] animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-20 bg-white/10 rounded-full" />
          <div className="h-2.5 w-14 bg-white/5 rounded-full" />
        </div>
      </div>
      <div className="h-5 w-16 bg-white/10 rounded-full" />
      <div className="h-5 w-20 bg-white/10 rounded-lg" />
      <div className="h-4 w-12 bg-white/5 rounded-full" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="p-6 rounded-3xl bg-white/60 border border-white/[0.06] animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-white/10 rounded-full" />
          <div className="h-3 w-56 bg-white/5 rounded-full" />
        </div>
        <div className="h-6 w-20 bg-white/10 rounded-full" />
      </div>
      <div className="h-52 w-full bg-white/[0.03] rounded-2xl flex items-end p-4 gap-3">
        <div className="h-20 w-full bg-white/5 rounded-t-lg" />
        <div className="h-32 w-full bg-white/5 rounded-t-lg" />
        <div className="h-44 w-full bg-white/10 rounded-t-lg" />
        <div className="h-28 w-full bg-white/5 rounded-t-lg" />
        <div className="h-36 w-full bg-white/10 rounded-t-lg" />
      </div>
    </div>
  );
}
