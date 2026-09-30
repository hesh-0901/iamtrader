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

  const calendarCells = useMemo(() => {
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - startDay + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return { dayNumber: null as number | null, dayStr: null as string | null, weekIndex: Math.floor(index / 7) };
      return {
        dayNumber,
        dayStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`,
        weekIndex: Math.floor(index / 7),
      };
    });
  }, [startDay, daysInMonth, year, month]);

  const weekStats = useMemo(() => {
    const stats: Record<number, { pnl: number; trades: number; green: number; red: number }> = {};
    calendarCells.forEach(cell => {
      if (!cell.dayStr) return;
      const data = tradesByDay[cell.dayStr];
      if (!data) return;
      if (!stats[cell.weekIndex]) stats[cell.weekIndex] = { pnl: 0, trades: 0, green: 0, red: 0 };
      stats[cell.weekIndex].pnl += data.netPnl;
      stats[cell.weekIndex].trades += data.trades.length;
      if (data.netPnl > 0) stats[cell.weekIndex].green++;
      if (data.netPnl < 0) stats[cell.weekIndex].red++;
    });
    return stats;
  }, [calendarCells, tradesByDay]);


  return (
    <div className="space-y-4">
      {/* Compact trading calendar */}
      <div className="rounded-2xl overflow-hidden border border-[#25364f] bg-[#101d30] text-white shadow-[0_14px_35px_rgba(16,35,58,0.12)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1d3150] border border-white/[0.08] flex items-center justify-center text-[#68a7ff]">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">{monthNames[month]} {year}</h2>
                <button onClick={() => setCurrentDate(new Date())} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.07] text-slate-300 hover:bg-white/[0.12] transition-colors cursor-pointer">Today</button>
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5">Calendrier de rentabilité quotidienne</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[9px] font-mono">
              <span className="text-slate-400 font-sans">Mois </span>
              <span className={`font-bold ${monthStats.monthlyPnl > 0 ? 'text-[#42d3a1]' : monthStats.monthlyPnl < 0 ? 'text-[#ff7180]' : 'text-slate-300'}`}>{formatCurrency(monthStats.monthlyPnl)}</span>
            </div>
            <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-lg border border-white/[0.07]">
              <button onClick={prevMonth} className="w-7 h-7 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer" aria-label="Mois précédent"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button onClick={nextMonth} className="w-7 h-7 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer" aria-label="Mois suivant"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-white/[0.07] bg-[#14243a] text-center">
          {weekDayLabels.map(day => <div key={day} className="py-2 text-[8px] font-semibold uppercase tracking-wider text-slate-400">{day}</div>)}
        </div>

        <div className="grid grid-cols-7">
          {calendarCells.map((cell, index) => {
            const dayData = cell.dayStr ? tradesByDay[cell.dayStr] : undefined;
            const hasTrades = !!dayData;
            const isProfitable = hasTrades && dayData.netPnl > 0;
            const isLoss = hasTrades && dayData.netPnl < 0;
            const isSelected = cell.dayStr === selectedDayKey;
            const isSunday = index % 7 === 6;
            const stats = weekStats[cell.weekIndex];
            const weekHasTrades = !!stats && stats.trades > 0;
            const cellTone = isProfitable ? 'bg-[#123c3d] hover:bg-[#16504d]' : isLoss ? 'bg-[#3b293b] hover:bg-[#4a3045]' : 'bg-[#132239] hover:bg-[#172a43]';

            return (
              <div
                key={cell.dayStr || `empty-${index}`}
                onClick={() => cell.dayStr && hasTrades && setSelectedDayKey(cell.dayStr)}
                className={`relative min-h-[74px] sm:min-h-[82px] p-1.5 border-r border-b border-white/[0.07] transition-colors ${cell.dayStr ? cellTone : 'bg-[#0f1c2d]'} ${hasTrades ? 'cursor-pointer' : ''} ${isSelected ? 'ring-1 ring-inset ring-[#69a9ff] z-10' : ''}`}
              >
                {cell.dayNumber && (
                  <>
                    <div className="flex items-start justify-between gap-1">
                      <span className={`text-[9px] font-mono ${hasTrades ? 'text-white font-semibold' : 'text-slate-500'}`}>{cell.dayNumber}</span>
                      {hasTrades && <span className="text-[7px] font-mono text-slate-300 bg-black/15 px-1 py-0.5 rounded">{dayData.trades.length}T</span>}
                    </div>
                    {hasTrades && (
                      <div className="mt-3">
                        <div className={`text-[11px] font-mono font-bold tabular-nums ${isProfitable ? 'text-[#42d3a1]' : isLoss ? 'text-[#ff7180]' : 'text-slate-300'}`}>{formatCurrency(dayData.netPnl)}</div>
                        <div className="text-[7px] text-slate-500 font-mono mt-0.5"><span className="text-[#42d3a1]">{dayData.winCount}W</span><span> / </span><span className="text-[#ff7180]">{dayData.lossCount}L</span></div>
                      </div>
                    )}
                    {isSunday && (
                      <div className="absolute right-1 bottom-1 text-right">
                        <div className="text-[7px] text-slate-500 uppercase tracking-wide">Week {cell.weekIndex + 1}</div>
                        <div className={`text-[8px] font-mono font-semibold ${weekHasTrades ? (stats.pnl >= 0 ? 'text-[#42d3a1]' : 'text-[#ff7180]') : 'text-slate-600'}`}>{weekHasTrades ? formatCurrency(stats.pnl) : '$0.00'}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-3 py-2 bg-[#0d1929] border-t border-white/[0.06]">
          <div className="flex items-center gap-3 text-[8px] text-slate-500">
            <span><i className="inline-block w-2 h-2 rounded-sm bg-[#123c3d] mr-1" />Jour positif</span>
            <span><i className="inline-block w-2 h-2 rounded-sm bg-[#3b293b] mr-1" />Jour négatif</span>
          </div>
          <span className="text-[8px] text-slate-600">{monthStats.monthlyTrades} trade{monthStats.monthlyTrades > 1 ? 's' : ''} · {monthStats.greenDays} vertes · {monthStats.redDays} rouges</span>
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
