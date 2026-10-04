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

  const tradesByDay = useMemo(() => {
    return groupTradesByDay(trades);
  }, [trades]);

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Calendar week starts on Sunday (0) and ends on Saturday (6).
  const startDay = firstDayOfMonth.getDay();

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

  const weekDayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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

  // Each weekly statistic maps exactly to one Sunday -> Saturday calendar row.
  const weeklyStats = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const firstSundayOffset = first.getDay();
    const weekCount = Math.ceil((firstSundayOffset + last.getDate()) / 7);

    return Array.from({ length: weekCount }, (_, weekIndex) => {
      const startDayNumber = weekIndex * 7 - firstSundayOffset + 1;
      const endDayNumber = Math.min(startDayNumber + 6, last.getDate());
      const from = Math.max(1, startDayNumber);
      const to = Math.min(last.getDate(), endDayNumber);
      let pnl = 0;
      let realizedR = 0;
      let tradeCount = 0;
      let activeDays = 0;

      for (let dayNumber = from; dayNumber <= to; dayNumber++) {
        const key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(dayNumber).padStart(2, '0');
        const day = tradesByDay[key];
        if (day) {
          pnl += day.netPnl;
          realizedR += day.trades.reduce((sum, trade) => sum + (typeof trade.rMultiple === 'number' ? trade.rMultiple : 0), 0);
          tradeCount += day.trades.length;
          activeDays++;
        }
      }

      return { week: weekIndex + 1, pnl, realizedR, tradeCount, activeDays };
    });
  }, [tradesByDay, year, month]);

  const selectedDayTrades = selectedDayKey && tradesByDay[selectedDayKey] ? tradesByDay[selectedDayKey].trades : [];

  const calendarCells = useMemo(() => {
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - startDay + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return { dayNumber: null as number | null, dayStr: null as string | null };
      }
      return {
        dayNumber,
        dayStr: year + '-' + String(month + 1).padStart(2, '0') + '-' + String(dayNumber).padStart(2, '0'),
      };
    });
  }, [startDay, daysInMonth, year, month]);

  const calendarWeekCount = calendarCells.length / 7;

  return (
    <div className="space-y-4">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 overflow-hidden rounded-[20px] border border-[#DCE7EE] bg-white text-[#0B1F35] shadow-[0_14px_40px_rgba(11,31,53,0.055)] xl:grid-cols-[minmax(0,1fr)_220px]">
        <section className="min-w-0 overflow-hidden bg-white">
          <div className="border-b border-[#E8EEF2] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#B7EBDD] bg-[#E7FAF3] text-[#00A982]">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold tracking-[-0.02em] sm:text-xl">{monthNames[month]} {year}</h2>
                    <button onClick={() => setCurrentDate(new Date())} className="rounded-full border border-[#DCE7EE] bg-[#F5F8FB] px-3 py-1.5 text-[10px] font-bold text-[#60758D] transition-colors hover:bg-[#E7FAF3] hover:text-[#00A982] cursor-pointer">Aujourd’hui</button>
                  </div>
                  <p className="mt-1 text-[11px] text-[#8A9AAF]">Performance quotidienne · cliquez sur une journée pour voir les trades</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                <div className="rounded-xl border border-[#E3EBF0] bg-[#F8FAFC] px-3 py-2">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8A9AAF]">P&L mensuel</div>
                  <div className={`mt-0.5 text-base font-black tabular-nums tracking-tight ${monthStats.monthlyPnl > 0 ? 'text-[#00A982]' : monthStats.monthlyPnl < 0 ? 'text-[#EF476F]' : 'text-[#60758D]'}`}>{formatCurrency(monthStats.monthlyPnl)}</div>
                </div>
                <div className="rounded-xl border border-[#E3EBF0] bg-[#F8FAFC] px-3 py-2">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8A9AAF]">Trades</div>
                  <div className="mt-0.5 text-base font-black tabular-nums text-[#0B1F35]">{monthStats.monthlyTrades}</div>
                </div>
                <div className="rounded-xl border border-[#E3EBF0] bg-[#F8FAFC] px-3 py-2">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8A9AAF]">Jours</div>
                  <div className="mt-0.5 text-base font-black tabular-nums"><span className="text-[#00A982]">{monthStats.greenDays}</span><span className="mx-1 text-[#B2BEC8]">/</span><span className="text-[#EF476F]">{monthStats.redDays}</span></div>
                </div>
                <div className="col-span-3 flex items-center justify-center rounded-xl border border-[#E3EBF0] bg-[#F8FAFC] p-1 sm:col-span-1 sm:ml-1">
                  <button onClick={prevMonth} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#60758D] transition-colors hover:bg-white hover:text-[#0B1F35] cursor-pointer" aria-label="Mois précédent"><ChevronLeft className="h-5 w-5" /></button>
                  <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#60758D] transition-colors hover:bg-white hover:text-[#0B1F35] cursor-pointer" aria-label="Mois suivant"><ChevronRight className="h-5 w-5" /></button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-[#E5EDF1] bg-[#F8FAFC]">
            {weekDayLabels.map(day => <div key={day} className="py-3 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7F91A4]">{day}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-px bg-[#EAF0F4]">
            {calendarCells.map((cell, index) => {
              const isOutsideMonth = !cell.dayStr;
              const dayData = cell.dayStr ? tradesByDay[cell.dayStr] : undefined;
              const hasTrades = !!dayData;
              const isProfitable = hasTrades && dayData.netPnl > 0;
              const isLoss = hasTrades && dayData.netPnl < 0;
              const isSelected = cell.dayStr === selectedDayKey;
              const cellTone = isProfitable
                ? 'bg-[#E7FAF3] hover:bg-[#DFF7EF]'
                : isLoss
                  ? 'bg-[#FFF0F4] hover:bg-[#FFE7EE]'
                  : 'bg-white hover:bg-[#F8FAFC]';

              return (
                <div
                  key={cell.dayStr || `empty-${index}`}
                  onClick={() => cell.dayStr && hasTrades && setSelectedDayKey(cell.dayStr)}
                  className={`relative min-h-[108px] p-3 transition-colors sm:min-h-[124px] sm:p-3.5 ${isOutsideMonth ? 'bg-transparent' : cellTone} ${hasTrades ? 'cursor-pointer' : ''} ${isSelected ? 'z-10 ring-2 ring-inset ring-[#2F6BFF]' : ''} ${isOutsideMonth ? 'border-0 outline-none ring-0' : ''}`}
                  aria-hidden={isOutsideMonth}
                >
                  {!isOutsideMonth && (
                    <>
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-[12px] font-bold tabular-nums ${hasTrades ? 'text-[#0B1F35]' : 'text-[#8798A8]'}`}>{cell.dayNumber}</span>
                        {hasTrades && <span className="rounded-full border border-[#DCE7EE] bg-white/80 px-2 py-1 text-[8px] font-bold text-[#71839A]">{dayData.trades.length} trade{dayData.trades.length > 1 ? 's' : ''}</span>}
                      </div>
                      {hasTrades && (
                        <div className="mt-5 sm:mt-7">
                          <div className={`text-[19px] font-black leading-none tracking-[-0.03em] tabular-nums sm:text-[23px] ${isProfitable ? 'text-[#00A982]' : isLoss ? 'text-[#EF476F]' : 'text-[#60758D]'}`}>{formatCurrency(dayData.netPnl)}</div>
                          <div className="mt-2.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8A9AAF]"><span className="text-[#00A982]">{dayData.winCount}W</span><span className="text-[#B7C2CB]">/</span><span className="text-[#EF476F]">{dayData.lossCount}L</span></div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-[#E5EDF1] bg-[#F8FAFC] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 text-[10px] font-semibold text-[#71839A]">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#00A982]" />Gain</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#EF476F]" />Perte</span>
              <span className="hidden sm:inline text-[#A0ADBA]">Cliquez sur une journée pour les détails</span>
            </div>
            <span className="text-[10px] font-semibold text-[#8A9AAF]">{monthStats.monthlyTrades} trade{monthStats.monthlyTrades > 1 ? 's' : ''} · {monthStats.greenDays} jour{monthStats.greenDays > 1 ? 's' : ''} positif{monthStats.greenDays > 1 ? 's' : ''} · {monthStats.redDays} négatif{monthStats.redDays > 1 ? 's' : ''}</span>
          </div>
        </section>

        {/* Weekly P&L uses the exact same vertical structure as the calendar:
            header + weekday row + one card per Sunday -> Saturday row + footer. */}
        <section className="min-w-0 border-l border-[#DCE7EE] bg-white text-[#0B1F35] xl:h-full">
          <div
            className="grid h-full gap-0"
            style={{
              gridTemplateRows:
                '120px repeat(' + calendarWeekCount + ', minmax(124px, 1fr)) 34px',
            }}
          >
            <div className="flex flex-col justify-center border-b border-[#E5EDF1] bg-[#F8FAFC] px-4">
              <h3 className="text-sm font-extrabold tracking-[-0.01em]">P&L par semaine</h3>
              <p className="mt-1 text-[10px] text-[#8A9AAF]">Performance de {monthNames[month]} {year}</p>
            </div>

            {weeklyStats.map(item => {
              const profitable = item.pnl > 0;
              const loss = item.pnl < 0;
              const tone = profitable ? 'border-[#B7EBDD] bg-[#F2FCF8]' : loss ? 'border-[#FFD0D9] bg-[#FFF6F8]' : 'border-[#E3EBF0] bg-[#F8FAFC]';
              const amountTone = profitable ? 'text-[#00A982]' : loss ? 'text-[#EF476F]' : 'text-[#60758D]';
              const badgeTone = profitable ? 'bg-[#DDF7EE] text-[#008F63]' : loss ? 'bg-[#FFE5EB] text-[#D83F50]' : 'bg-[#E9EFF4] text-[#71839A]';

              return (
                <div key={item.week} className="flex min-h-0 items-center px-1">
                  <div className={'flex h-full w-full flex-col justify-center border-b p-3 ' + tone}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-[#60758D]">Semaine {item.week}</span>
                      <span className={'rounded-full px-2 py-1 text-[8px] font-bold ' + badgeTone}>{item.activeDays}j</span>
                    </div>
                    <div className={'mt-1.5 text-[21px] font-black tracking-[-0.03em] tabular-nums ' + amountTone}>{formatCurrency(item.pnl)}</div>
                    <div className="mt-2.5 flex items-center justify-between gap-2 text-[9px] font-semibold text-[#8A9AAF]">
                      <span>{item.tradeCount} trade{item.tradeCount > 1 ? 's' : ''}</span>
                      <span className={item.realizedR > 0 ? 'text-[#00A982]' : item.realizedR < 0 ? 'text-[#EF476F]' : 'text-[#71839A]'}>{item.realizedR >= 0 ? '+' : ''}{item.realizedR.toFixed(2)}R réalisés</span>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </section>
      </div>

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
              <button onClick={() => setSelectedDayKey(null)} className="w-9 h-9 rounded-lg border border-[#dce7e3] text-[#71839a] hover:bg-[#f3f7f5] hover:text-[#10233a] flex items-center justify-center transition-colors cursor-pointer" aria-label="Fermer les détails du jour">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(82vh-76px)]">
              <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Heure</th><th className="py-3 px-4">Symbol</th><th className="py-3 px-4">Direction</th><th className="py-3 px-4">Entrée</th><th className="py-3 px-4">Sortie</th><th className="py-3 px-4 text-right text-[#10233a]">P&L</th><th className="py-3 px-4 text-right">R:R</th><th className="py-3 px-4 text-right">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDayTrades.map(trade => (
                    <tr key={trade.id} onClick={() => onSelectTrade(trade)} className="hover:bg-[#f7fbf9] transition-colors cursor-pointer">
                      <td className="py-3 px-4 font-mono text-[#71839a] text-[11px]">{new Date(trade.entryDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#10233a] text-sm">{trade.symbol}</td>
                      <td className="py-3 px-4"><DirectionBadge direction={trade.direction} /></td>
                      <td className="py-3 px-4 font-mono text-[#5f748c] tabular-nums text-[11px]">{trade.entryPrice ? trade.entryPrice.toLocaleString() : '—'}</td>
                      <td className="py-3 px-4 font-mono text-[#5f748c] tabular-nums text-[11px]">{trade.exitPrice ? trade.exitPrice.toLocaleString() : '—'}</td>
                      <td className={`py-3 px-4 text-right font-mono font-extrabold tabular-nums text-base tracking-tight ${trade.pnl > 0 ? 'text-[#008f63] bg-[#ecfbf5]' : trade.pnl < 0 ? 'text-[#d83f50] bg-[#fff1f2]' : 'text-[#71839a]'}`}>{formatCurrency(trade.pnl)}</td>
                      <td className="py-3 px-4 text-right font-mono text-[#5f748c] tabular-nums text-[11px]">{trade.rMultiple !== undefined ? `${trade.rMultiple > 0 ? '+' : ''}${trade.rMultiple}R` : '—'}</td>
                      <td className="py-3 px-4 text-right"><ResultBadge result={trade.result} /></td>
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
