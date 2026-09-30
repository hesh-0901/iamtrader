import React, { useState, useMemo } from 'react';
import { Trade, TradingAccount } from '../types';
import { groupTradesByDay, formatCurrency } from '../utils/calculations';
import { DirectionBadge, ResultBadge } from '../components/common/Badge';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';

interface CalendarViewProps {
  trades: Trade[];
  accounts: TradingAccount[];
  onSelectTrade: (trade: Trade) => void;
}

export function CalendarView({ trades, accounts, onSelectTrade }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Group trades by day: YYYY-MM-DD
  const tradesByDay = useMemo(() => {
    return groupTradesByDay(trades);
  }, [trades]);

  // Calendar math
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  
  // Starting day index (0: Monday, ..., 6: Sunday for European format)
  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay === -1) startDay = 6; // Sunday is index 6

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayKey(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayKey(null);
  };

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const weekDayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Monthly summary metrics
  const monthStats = useMemo(() => {
    let monthlyPnl = 0;
    let monthlyTrades = 0;
    let greenDays = 0;
    let redDays = 0;

    Object.entries(tradesByDay).forEach(([dayStr, data]) => {
      const d = new Date(dayStr);
      if (d.getFullYear() === year && d.getMonth() === month) {
        monthlyPnl += data.netPnl;
        monthlyTrades += data.trades.length;
        if (data.netPnl > 0) greenDays++;
        else if (data.netPnl < 0) redDays++;
      }
    });

    return { monthlyPnl, monthlyTrades, greenDays, redDays };
  }, [tradesByDay, year, month]);

  const selectedDayTrades = selectedDayKey && tradesByDay[selectedDayKey] ? tradesByDay[selectedDayKey].trades : [];

  return (
    <div className="space-y-4">
      {/* Month Navigation & Stats Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl card-premium border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {monthNames[month]} {year}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Rentabilité quotidienne & constance</p>
          </div>
        </div>

        {/* Monthly Summary Badges */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200">
            <span className="text-slate-500 font-sans">P&L Mois : </span>
            <span className={`font-bold tabular-nums ${
              monthStats.monthlyPnl > 0 ? 'text-emerald-400' : monthStats.monthlyPnl < 0 ? 'text-rose-400' : 'text-slate-600'
            }`}>
              {formatCurrency(monthStats.monthlyPnl)}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hidden sm:flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">Séances : </span>
            <span className="font-semibold text-emerald-400">{monthStats.greenDays} Vertes</span>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-rose-400">{monthStats.redDays} Rouges</span>
          </div>

          {/* Month buttons */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
            <button
              onClick={prevMonth}
              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid Card */}
      <div className="rounded-2xl card-premium overflow-hidden border-slate-200">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-white text-center text-[9px] font-semibold text-slate-500 uppercase tracking-wider py-2">
          {weekDayLabels.map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/60">
          {/* Empty cells before start day */}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[72px] p-1.5 bg-white/40"></div>
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayData = tradesByDay[dayStr];
            const isSelected = selectedDayKey === dayStr;
            const hasTrades = !!dayData;
            const isProfitable = hasTrades && dayData.netPnl > 0;
            const isLoss = hasTrades && dayData.netPnl < 0;

            return (
              <div
                key={dayStr}
                onClick={() => hasTrades && setSelectedDayKey(dayStr)}
                className={`min-h-[72px] p-1.5 flex flex-col justify-between transition-all ${
                  hasTrades 
                    ? isProfitable
                      ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] cursor-pointer'
                      : isLoss
                      ? 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08] cursor-pointer'
                      : 'hover:bg-slate-100 cursor-pointer'
                    : 'bg-white/20'
                } ${isSelected ? 'ring-1 ring-blue-500 bg-white' : ''}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-mono text-xs ${hasTrades ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                    {dayNum}
                  </span>
                  {hasTrades && (
                    <span className="text-[8px] font-mono text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-200">
                      {dayData.trades.length}T
                    </span>
                  )}
                </div>

                {hasTrades ? (
                  <div className="mt-1 space-y-0.5">
                    <div className={`text-[11px] font-mono font-bold tabular-nums ${
                      isProfitable ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'
                    }`}>
                      {formatCurrency(dayData.netPnl)}
                    </div>
                    <div className="text-[8px] text-slate-500 font-mono">
                      <span className="text-emerald-400">{dayData.winCount}W</span>
                      <span className="text-slate-400"> / </span>
                      <span className="text-rose-400">{dayData.lossCount}L</span>
                    </div>
                  </div>
                ) : (
                  <div></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Modal */}
      {selectedDayKey && tradesByDay[selectedDayKey] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10233a]/20 backdrop-blur-[3px] p-4" onClick={() => setSelectedDayKey(null)}>
          <div className="w-full max-w-4xl max-h-[82vh] overflow-hidden rounded-2xl bg-white border border-[#dce7e3] shadow-[0_24px_70px_rgba(16,35,58,0.18)]" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e7efec]">
              <div>
                <h3 className="text-sm font-bold text-[#10233a] tracking-tight">
                  {new Date(selectedDayKey).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-[10px] text-[#8798a8] mt-0.5">
                  {selectedDayTrades.length} trade{selectedDayTrades.length > 1 ? 's' : ''} clôturé{selectedDayTrades.length > 1 ? 's' : ''} · P&L journalier
                  <span className={tradesByDay[selectedDayKey].netPnl >= 0 ? 'text-[#008f63] font-bold ml-1' : 'text-[#e14d5d] font-bold ml-1'}>{formatCurrency(tradesByDay[selectedDayKey].netPnl)}</span>
                </p>
              </div>
              <button onClick={() => setSelectedDayKey(null)} className="w-8 h-8 rounded-lg border border-[#dce7e3] text-[#71839a] hover:bg-[#f3f7f5] hover:text-[#10233a] flex items-center justify-center transition-colors cursor-pointer" aria-label="Fermer les détails du jour">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(82vh-76px)]">
              <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-200 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Heure</th><th className="py-2.5 px-4">Symbol</th><th className="py-2.5 px-4">Direction</th><th className="py-2.5 px-4">Entrée</th><th className="py-2.5 px-4">Sortie</th><th className="py-2.5 px-4 text-right">P&L</th><th className="py-2.5 px-4 text-right">R:R</th><th className="py-2.5 px-4 text-right">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDayTrades.map(trade => (
                    <tr key={trade.id} onClick={() => onSelectTrade(trade)} className="hover:bg-[#f7fbf9] transition-colors cursor-pointer">
                      <td className="py-2.5 px-4 font-mono text-[#71839a] text-[10px]">{new Date(trade.entryDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-[#10233a] text-xs">{trade.symbol}</td>
                      <td className="py-2.5 px-4"><DirectionBadge direction={trade.direction} /></td>
                      <td className="py-2.5 px-4 font-mono text-[#5f748c] tabular-nums text-[10px]">{trade.entryPrice ? trade.entryPrice.toLocaleString() : '—'}</td>
                      <td className="py-2.5 px-4 font-mono text-[#5f748c] tabular-nums text-[10px]">{trade.exitPrice ? trade.exitPrice.toLocaleString() : '—'}</td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums text-xs ${trade.pnl > 0 ? 'text-[#008f63]' : trade.pnl < 0 ? 'text-[#e14d5d]' : 'text-[#71839a]'}`}>{formatCurrency(trade.pnl)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#5f748c] tabular-nums text-[10px]">{trade.rMultiple !== undefined ? `${trade.rMultiple > 0 ? '+' : ''}${trade.rMultiple}R` : '—'}</td>
                      <td className="py-2.5 px-4 text-right"><ResultBadge result={trade.result} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
