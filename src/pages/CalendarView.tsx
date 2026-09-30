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
      if (dayNumber < 1 || dayNumber > daysInMonth) return { dayNumber: null as number | null, dayStr: null as string | null };
      return {
        dayNumber,
        dayStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`,
      };
    });
  }, [startDay, daysInMonth, year, month]);


  return (
    <div className="space-y-4">
      {/* Compact trading calendar */}
      <div className="mx-auto w-full max-w-[980px] rounded-xl overflow-hidden border border-[#dfe8e4] bg-white text-[#10233a] shadow-[0_8px_28px_rgba(16,35,58,0.06)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 px-3 py-2.5 border-b border-[#edf2f0]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#eef5ff] border border-[#d9e7ff] flex items-center justify-center text-[#3b82f6]">
              <CalendarDays className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">{monthNames[month]} {year}</h2>
                <button onClick={() => setCurrentDate(new Date())} className="text-[8px] px-1.5 py-0.5 rounded-md bg-[#f3f6f5] text-[#6f8090] border border-[#e3ebe8] hover:bg-[#eaf0ee] transition-colors cursor-pointer">Today</button>
              </div>
              <p className="text-[8px] text-[#91a0ad] mt-0.5">Calendrier de rentabilité quotidienne</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block px-2 py-1 rounded-md bg-[#f8faf9] border border-[#e4ece9] text-[8px] font-mono">
              <span className="text-[#8a99a6] font-sans">Mois </span>
              <span className={`text-[11px] font-black ${monthStats.monthlyPnl > 0 ? 'text-[#008f63]' : monthStats.monthlyPnl < 0 ? 'text-[#d83f50]' : 'text-[#60758d]'}`}>{formatCurrency(monthStats.monthlyPnl)}</span>
            </div>
            <div className="flex items-center gap-1 bg-[#f8faf9] p-0.5 rounded-md border border-[#e4ece9]">
              <button onClick={prevMonth} className="w-6 h-6 rounded-md text-[#71839a] hover:text-[#10233a] hover:bg-[#edf2f0] flex items-center justify-center transition-colors cursor-pointer" aria-label="Mois précédent"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button onClick={nextMonth} className="w-6 h-6 rounded-md text-[#71839a] hover:text-[#10233a] hover:bg-[#edf2f0] flex items-center justify-center transition-colors cursor-pointer" aria-label="Mois suivant"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[#e7eeeb] bg-[#fbfcfc] text-center">
          {weekDayLabels.map(day => <div key={day} className="py-1.5 text-[7px] font-semibold uppercase tracking-wider text-[#8796a3]">{day}</div>)}
        </div>

        <div className="grid grid-cols-7">
          {calendarCells.map((cell, index) => {
            const dayData = cell.dayStr ? tradesByDay[cell.dayStr] : undefined;
            const hasTrades = !!dayData;
            const isProfitable = hasTrades && dayData.netPnl > 0;
            const isLoss = hasTrades && dayData.netPnl < 0;
            const isSelected = cell.dayStr === selectedDayKey;
            const cellTone = isProfitable ? 'bg-[#dcf8ed] hover:bg-[#cef3e2]' : isLoss ? 'bg-[#ffe3e7] hover:bg-[#ffd7dc]' : 'bg-white hover:bg-[#f8faf9]';

            return (
              <div
                key={cell.dayStr || `empty-${index}`}
                onClick={() => cell.dayStr && hasTrades && setSelectedDayKey(cell.dayStr)}
                className={`relative min-h-[88px] sm:min-h-[96px] p-1 border-r border-b border-[#e8eeec] transition-colors ${cell.dayStr ? cellTone : 'bg-[#fbfcfc]'} ${hasTrades ? 'cursor-pointer' : ''} ${isSelected ? 'ring-1 ring-inset ring-[#3b82f6] z-10' : ''}`}
              >
                {cell.dayNumber && (
                  <>
                    <div className="flex items-start justify-between gap-1">
                      <span className={`text-[8px] font-mono ${hasTrades ? 'text-[#10233a] font-semibold' : 'text-[#a0adb7]'}`}>{cell.dayNumber}</span>
                      {hasTrades && <span className="text-[6px] font-mono text-[#7d8d99] bg-white px-1 py-0.5 rounded border border-[#e1e9e6]">{dayData.trades.length}T</span>}
                    </div>
                    {hasTrades && (
                      <div className="mt-2">
                        <div className={`mt-3 inline-block text-[20px] sm:text-[22px] leading-none font-mono font-black tabular-nums tracking-tight ${isProfitable ? 'text-[#007a56]' : isLoss ? 'text-[#c72f43]' : 'text-[#60758d]'}`}>{formatCurrency(dayData.netPnl)}</div>
                        <div className="text-[6px] text-[#8796a3] font-mono mt-1"><span className="text-[#008f63] font-semibold">{dayData.winCount}W</span><span> / </span><span className="text-[#d83f50] font-semibold">{dayData.lossCount}L</span></div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#fbfcfc] border-t border-[#e7eeeb]">
          <div className="flex items-center gap-3 text-[7px] text-[#8796a3]">
            <span><i className="inline-block w-2 h-2 rounded-sm bg-[#32b58a] mr-1" />Gain</span>
            <span><i className="inline-block w-2 h-2 rounded-sm bg-[#e35b68] mr-1" />Perte</span>
          </div>
          <span className="text-[7px] text-[#9aa7b0]">{monthStats.monthlyTrades} trade{monthStats.monthlyTrades > 1 ? 's' : ''} · {monthStats.greenDays} gains · {monthStats.redDays} pertes</span>
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
                    <th className="py-2.5 px-4">Heure</th><th className="py-2.5 px-4">Symbol</th><th className="py-2.5 px-4">Direction</th><th className="py-2.5 px-4">Entrée</th><th className="py-2.5 px-4">Sortie</th><th className="py-2.5 px-4 text-right text-[#10233a]">P&L</th><th className="py-2.5 px-4 text-right">R:R</th><th className="py-2.5 px-4 text-right">Résultat</th>
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
                      <td className={`py-2.5 px-4 text-right font-mono font-extrabold tabular-nums text-sm tracking-tight ${trade.pnl > 0 ? 'text-[#008f63] bg-[#ecfbf5]' : trade.pnl < 0 ? 'text-[#d83f50] bg-[#fff1f2]' : 'text-[#71839a]'}`}>{formatCurrency(trade.pnl)}</td>
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
