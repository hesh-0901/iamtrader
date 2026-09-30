import React, { useState, useMemo } from 'react';
import { Trade, TradingAccount, TradeDirection, TradeResult, TradingSession } from '../types';
import { DirectionBadge, ResultBadge, EmotionTag } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../utils/calculations';
import { 
  Search, 
  Filter, 
  Plus, 
  ArrowUpDown, 
  Calendar, 
  Download, 
  Layers, 
  ChevronDown, 
  X, 
  FileSpreadsheet, 
  BookOpen, 
  FilterX,
  SlidersHorizontal
} from 'lucide-react';

interface JournalProps {
  trades: Trade[];
  accounts: TradingAccount[];
  selectedAccountId: string;
  onOpenNewTrade: () => void;
  onSelectTrade: (trade: Trade) => void;
  onEditTrade: (trade: Trade) => void;
}

export function Journal({
  trades,
  accounts,
  selectedAccountId,
  onOpenNewTrade,
  onSelectTrade,
  onEditTrade
}: JournalProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [filterSession, setFilterSession] = useState<string>('all');
  const [filterSetup, setFilterSetup] = useState<string>('all');

  // Sorting
  const [sortBy, setSortBy] = useState<'date' | 'pnl' | 'rMultiple'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Distinct setups from trades
  const uniqueSetups = useMemo(() => {
    const set = new Set<string>();
    trades.forEach(t => { if (t.setup) set.add(t.setup); });
    return Array.from(set);
  }, [trades]);

  // Filtered & Sorted trades
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      // Account filter
      if (filterAccount !== 'all' && trade.accountId !== filterAccount) return false;
      // Direction filter
      if (filterDirection !== 'all' && trade.direction !== filterDirection) return false;
      // Result filter
      if (filterResult !== 'all' && trade.result !== filterResult) return false;
      // Session filter
      if (filterSession !== 'all' && trade.session !== filterSession) return false;
      // Setup filter
      if (filterSetup !== 'all' && trade.setup !== filterSetup) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSymbol = trade.symbol.toLowerCase().includes(q);
        const matchSetup = trade.setup?.toLowerCase().includes(q);
        const matchNotes = trade.notes?.toLowerCase().includes(q);
        const matchEmotion = trade.emotion?.toLowerCase().includes(q);
        if (!matchSymbol && !matchSetup && !matchNotes && !matchEmotion) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === 'date') {
        valA = new Date(a.entryDate).getTime();
        valB = new Date(b.entryDate).getTime();
      } else if (sortBy === 'pnl') {
        valA = Number(a.pnl) || 0;
        valB = Number(b.pnl) || 0;
      } else if (sortBy === 'rMultiple') {
        valA = Number(a.rMultiple) || 0;
        valB = Number(b.rMultiple) || 0;
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [trades, filterAccount, filterDirection, filterResult, filterSession, filterSetup, searchQuery, sortBy, sortOrder]);

  // Aggregate stats of filtered trades
  const filterStats = useMemo(() => {
    const totalCount = filteredTrades.length;
    let netPnl = 0;
    let wins = 0;
    filteredTrades.forEach(t => {
      netPnl += Number(t.pnl) || 0;
      if (t.result === 'WIN') wins++;
    });
    const winRate = totalCount > 0 ? (wins / totalCount) * 100 : 0;
    return { totalCount, netPnl, winRate, wins };
  }, [filteredTrades]);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterAccount('all');
    setFilterDirection('all');
    setFilterResult('all');
    setFilterSession('all');
    setFilterSetup('all');
  };

  const hasActiveFilters = searchQuery || filterAccount !== 'all' || filterDirection !== 'all' || filterResult !== 'all' || filterSession !== 'all' || filterSetup !== 'all';

  // Export CSV
  const exportCsv = () => {
    if (filteredTrades.length === 0) return;
    const headers = ['Date', 'Symbol', 'Direction', 'Result', 'PnL', 'R_Multiple', 'EntryPrice', 'ExitPrice', 'Setup', 'Session', 'Emotion', 'Notes'];
    const rows = filteredTrades.map(t => [
      t.entryDate,
      t.symbol,
      t.direction,
      t.result,
      t.pnl,
      t.rMultiple ?? '',
      t.entryPrice ?? '',
      t.exitPrice ?? '',
      `"${t.setup.replace(/"/g, '""')}"`,
      t.session,
      t.emotion,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `iamtrader_journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
              Journal Institutionnel
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-[11px] text-slate-500 font-mono">Synchronisé en direct</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Journal de Trading
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Historique complet, vérification des règles et audit des transactions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {filteredTrades.length > 0 && (
            <button
              onClick={exportCsv}
              className="btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs cursor-pointer"
              title="Exporter au format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exporter CSV</span>
            </button>
          )}

          <button
            onClick={onOpenNewTrade}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nouveau Trade</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="p-4 rounded-xl card-premium space-y-3.5">
        {/* Row 1: Search + Quick stats */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par symbole (NQ, XAUUSD...), setup ou mot-clé..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 hover:border-slate-700 focus:border-blue-500 rounded-lg pl-10 pr-9 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter summary strip */}
          <div className="flex items-center gap-3 text-xs font-mono px-3 py-1.5 rounded-lg bg-white border border-slate-200">
            <div>
              <span className="text-slate-500">Total :</span>{' '}
              <span className="text-slate-900 font-bold">{filterStats.totalCount}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div>
              <span className="text-slate-500">P&L :</span>{' '}
              <span className={`font-bold tabular-nums ${
                filterStats.netPnl > 0 ? 'text-emerald-400' : filterStats.netPnl < 0 ? 'text-rose-400' : 'text-slate-600'
              }`}>
                {formatCurrency(filterStats.netPnl)}
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div>
              <span className="text-slate-500">Win Rate :</span>{' '}
              <span className="text-emerald-400 font-bold">{filterStats.winRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Row 2: Dropdown Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {/* Compte */}
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="bg-white border border-slate-200 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-blue-500 truncate cursor-pointer transition-colors"
          >
            <option value="all">Tous les comptes</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>

          {/* Direction */}
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="bg-white border border-slate-200 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
          >
            <option value="all">Direction : Toutes</option>
            <option value="BUY">LONG (Achat)</option>
            <option value="SELL">SHORT (Vente)</option>
          </select>

          {/* Résultat */}
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="bg-white border border-slate-200 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
          >
            <option value="all">Résultat : Tous</option>
            <option value="WIN">WIN (Gagnant)</option>
            <option value="LOSS">LOSS (Perdant)</option>
            <option value="BREAKEVEN">BE (Breakeven)</option>
            <option value="OPEN">EN COURS</option>
          </select>

          {/* Session */}
          <select
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            className="bg-white border border-slate-200 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
          >
            <option value="all">Session : Toutes</option>
            <option value="London">Londres</option>
            <option value="New York">New York</option>
            <option value="Asia">Asie</option>
            <option value="Overlap">Overlap London/NY</option>
          </select>

          {/* Setup */}
          <select
            value={filterSetup}
            onChange={(e) => setFilterSetup(e.target.value)}
            className="bg-white border border-slate-200 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
          >
            <option value="all">Setup : Tous</option>
            {uniqueSetups.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-[11px]">
            <span className="text-slate-500">Filtres personnalisés actifs</span>
            <button
              onClick={resetFilters}
              className="text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* High-Density Clean FinTech Table: Symbol, Direction, Entry, Exit, Lot, Risk, P&L, R:R, Date, Status */}
      <div className="rounded-xl card-premium overflow-hidden">
        {filteredTrades.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-[10px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3">Entry</th>
                    <th className="py-2.5 px-3">Exit</th>
                    <th className="py-2.5 px-3">Lot</th>
                    <th className="py-2.5 px-3">Risk ($)</th>
                    <th 
                      onClick={() => { setSortBy('pnl'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-600 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>P&L ($)</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th 
                      onClick={() => { setSortBy('rMultiple'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-600 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>R:R</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th 
                      onClick={() => { setSortBy('date'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTrades.map((trade) => {
                    const account = accounts.find(a => a.id === trade.accountId);
                    return (
                      <tr
                        key={trade.id}
                        onClick={() => onSelectTrade(trade)}
                        className="hover:bg-slate-100/35 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-xs">{trade.symbol}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({trade.setup || 'Standard'})</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <DirectionBadge direction={trade.direction} />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums text-[11px]">
                          {trade.entryPrice ? trade.entryPrice.toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums text-[11px]">
                          {trade.exitPrice ? trade.exitPrice.toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums text-[11px]">
                          {trade.positionSize || '1'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums text-[11px]">
                          {trade.riskAmount ? `$${trade.riskAmount}` : '—'}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap text-xs ${
                          trade.pnl > 0 ? 'text-emerald-400' : trade.pnl < 0 ? 'text-rose-400' : 'text-slate-500'
                        }`}>
                          {formatCurrency(trade.pnl)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400 tabular-nums font-medium text-[11px]">
                          {trade.rMultiple !== undefined ? `${trade.rMultiple > 0 ? `+${trade.rMultiple}R` : `${trade.rMultiple}R`}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                          {new Date(trade.entryDate).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <ResultBadge result={trade.result} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards View */}
            <div className="lg:hidden divide-y divide-slate-800/60">
              {filteredTrades.map((trade) => (
                <div
                  key={trade.id}
                  onClick={() => onSelectTrade(trade)}
                  className="p-3.5 hover:bg-slate-100/35 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-xs">{trade.symbol}</span>
                      <DirectionBadge direction={trade.direction} />
                      <ResultBadge result={trade.result} />
                    </div>
                    <div className={`font-mono font-bold text-xs tabular-nums ${
                      trade.pnl > 0 ? 'text-emerald-400' : trade.pnl < 0 ? 'text-rose-400' : 'text-slate-500'
                    }`}>
                      {formatCurrency(trade.pnl)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{trade.setup} · {trade.session}</span>
                    <span>{trade.rMultiple !== undefined ? `${trade.rMultiple}R` : ''}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 font-mono">
                    <span>{new Date(trade.entryDate).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <EmotionTag emotion={trade.emotion} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          trades.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Aucun trade dans votre journal"
              description="Commencez à bâtir votre historique de performance en enregistrant votre toute première opération financière."
              actionLabel="+ Enregistrer un trade"
              onAction={onOpenNewTrade}
              accentColor="emerald"
            />
          ) : (
            <EmptyState
              icon={FilterX}
              title="Aucun résultat pour cette recherche"
              description="Vos filtres actuels ne correspondent à aucune transaction enregistrée. Modifiez vos critères ou réinitialisez les filtres."
              actionLabel="Réinitialiser les filtres"
              onAction={resetFilters}
              accentColor="sky"
            />
          )
        )}
      </div>
    </div>
  );
}
