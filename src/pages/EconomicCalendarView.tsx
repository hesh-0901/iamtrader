import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Globe2, Clock3, AlertTriangle } from 'lucide-react';

type Impact = 'high' | 'medium' | 'low';
type EconomicEvent = {
  date: string;
  time: string;
  country: string;
  currency: string;
  event: string;
  impact: Impact;
  actual?: string;
  forecast?: string;
  previous?: string;
};

const DEMO_EVENTS: EconomicEvent[] = [
  { date: '2026-10-08', time: '13:30', country: 'United States', currency: 'USD', event: 'Initial Jobless Claims', impact: 'medium', forecast: '219K', previous: '213K' },
  { date: '2026-10-08', time: '15:00', country: 'United States', currency: 'USD', event: 'FOMC Statement', impact: 'high', forecast: '—', previous: '—' },
  { date: '2026-10-09', time: '13:30', country: 'United States', currency: 'USD', event: 'Nonfarm Payrolls', impact: 'high', forecast: '—', previous: '—' },
];

const impactConfig: Record<Impact, { label: string; className: string }> = {
  high: { label: 'Élevé', className: 'bg-rose-50 text-rose-600 border-rose-100' },
  medium: { label: 'Moyen', className: 'bg-amber-50 text-amber-600 border-amber-100' },
  low: { label: 'Faible', className: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export function EconomicCalendarView() {
  const [date, setDate] = useState('2026-10-08');
  const [impact, setImpact] = useState<'all' | Impact>('all');
  const [currency, setCurrency] = useState('all');

  const visibleEvents = useMemo(() => DEMO_EVENTS.filter(event =>
    event.date === date &&
    (impact === 'all' || event.impact === impact) &&
    (currency === 'all' || event.currency === currency)
  ), [date, impact, currency]);

  const moveDate = (amount: number) => {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + amount);
    setDate(d.toISOString().slice(0, 10));
  };

  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(date + 'T00:00:00Z'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#00a982]" />
            <h1 className="text-xl font-black tracking-tight text-[#0b1f35]">Calendrier économique</h1>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-amber-600">Préparation</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Les événements macroéconomiques qui peuvent influencer vos marchés.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button type="button" onClick={() => moveDate(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50" aria-label="Jour précédent"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setDate('2026-10-08')} className="px-3 text-xs font-bold text-[#0b1f35]">Aujourd'hui</button>
          <button type="button" onClick={() => moveDate(1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50" aria-label="Jour suivant"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Date
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-[#00a982]" />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Impact
          <select value={impact} onChange={e => setImpact(e.target.value as 'all' | Impact)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-[#00a982]">
            <option value="all">Tous les impacts</option>
            <option value="high">Élevé</option>
            <option value="medium">Moyen</option>
            <option value="low">Faible</option>
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Devise
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-[#00a982]">
            <option value="all">Toutes les devises</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black capitalize text-[#0b1f35]">{formattedDate}</h2>
            <p className="mt-0.5 text-[10px] text-slate-400">{visibleEvents.length} événement{visibleEvents.length > 1 ? 's' : ''} affiché{visibleEvents.length > 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-slate-400"><Filter className="h-3.5 w-3.5" /> Filtre actif</div>
        </div>

        {visibleEvents.length ? (
          <div className="divide-y divide-slate-100">
            {visibleEvents.map((event, index) => {
              const cfg = impactConfig[event.impact];
              return (
                <div key={event.event + index} className="grid gap-4 px-5 py-4 md:grid-cols-[82px_90px_minmax(0,1fr)_repeat(3,90px)] md:items-center">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><Clock3 className="h-3.5 w-3.5 text-slate-400" />{event.time}</div>
                  <div className="flex items-center gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{event.currency}</span></div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${cfg.className}`}>{cfg.label}</span>
                      <span className="text-sm font-bold text-[#0b1f35]">{event.event}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400"><Globe2 className="h-3 w-3" />{event.country}</div>
                  </div>
                  <div><span className="text-[9px] uppercase tracking-wider text-slate-400">Réel</span><div className="mt-0.5 text-xs font-bold text-slate-700">{event.actual || '—'}</div></div>
                  <div><span className="text-[9px] uppercase tracking-wider text-slate-400">Prévu</span><div className="mt-0.5 text-xs font-bold text-slate-700">{event.forecast || '—'}</div></div>
                  <div><span className="text-[9px] uppercase tracking-wider text-slate-400">Précédent</span><div className="mt-0.5 text-xs font-bold text-slate-700">{event.previous || '—'}</div></div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-500">Aucun événement pour ces filtres.</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[10px] leading-5 text-slate-500">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p>Cette première version prépare l’interface du calendrier. Les données affichées ici sont de démonstration et devront être reliées à une source économique en temps réel avant utilisation en production.</p>
      </div>
    </div>
  );
}
