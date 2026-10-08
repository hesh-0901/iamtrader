import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Globe2, Clock3, AlertTriangle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

type Impact = 'high' | 'medium' | 'low';
type EconomicEvent = {
  id: string;
  date: string;
  time: string;
  country: string;
  currency: string;
  event: string;
  impact: Impact;
  actual?: string;
  forecast?: string;
  previous?: string;
  url?: string;
};

type ApiEvent = Record<string, any>;

const API_BASE = 'https://www.financecalendar.com/wp-json/fc/v1/calendar';

const impactConfig: Record<Impact, { label: string; className: string }> = {
  high: { label: 'Élevé', className: 'bg-rose-50 text-rose-600 border-rose-100' },
  medium: { label: 'Moyen', className: 'bg-amber-50 text-amber-600 border-amber-100' },
  low: { label: 'Faible', className: 'bg-slate-50 text-slate-500 border-slate-200' },
};

function getLocalDateTime(value: unknown, fallbackDate?: string, fallbackTime?: string) {
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(parsed);
      const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
      return {
        date: `${map.year}-${map.month}-${map.day}`,
        time: `${map.hour}:${map.minute}`,
      };
    }
  }
  return { date: fallbackDate || '', time: fallbackTime || '—' };
}

function normalizeEvent(raw: ApiEvent, index: number): EconomicEvent {
  const rawTime = raw.time_utc || raw.datetime_utc || raw.timestamp || raw.date_time || raw.datetime;
  const local = getLocalDateTime(rawTime, raw.date, raw.time || raw.time_et);
  const impactValue = String(raw.impact || 'low').toLowerCase();
  const impact: Impact = impactValue === 'high' || impactValue === 'medium' ? impactValue : 'low';

  return {
    id: String(raw.id || raw.slug || raw.url || `${local.date}-${index}`),
    date: local.date,
    time: raw.all_day ? 'Toute la journée' : local.time,
    country: String(raw.country_name || raw.country || raw.countryName || raw.region || '—'),
    currency: String(raw.currency || raw.currency_code || raw.currencyCode || '—').toUpperCase(),
    event: String(raw.name || raw.title || raw.event || raw.event_name || 'Événement économique'),
    impact,
    actual: raw.actual ?? raw.result ?? undefined,
    forecast: raw.consensus ?? raw.forecast ?? undefined,
    previous: raw.prior ?? raw.previous ?? undefined,
    url: raw.url || undefined,
  };
}

function localIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(value: string, amount: number) {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return localIsoDate(d);
}

export function EconomicCalendarView() {
  const [date, setDate] = useState(() => localIsoDate());
  const [impact, setImpact] = useState<'all' | Impact>('all');
  const [currency, setCurrency] = useState('all');
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadEvents = async (selectedDate = date) => {
    setLoading(true);
    setError(null);
    try {
      const from = addDays(selectedDate, -1);
      const to = addDays(selectedDate, 1);
      const response = await fetch(`${API_BASE}?from=${from}&to=${to}&limit=500`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const rawEvents: ApiEvent[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.events)
          ? payload.events
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      setEvents(rawEvents.map(normalizeEvent));
      setLastUpdated(new Date());
    } catch (err: any) {
      setEvents([]);
      setError(err?.message || 'Impossible de charger le calendrier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents(date);
  }, [date]);

  const currencies = useMemo(() => {
    return Array.from(new Set(events.map(event => event.currency).filter(Boolean))).sort();
  }, [events]);

  const visibleEvents = useMemo(() => events
    .filter(event => event.date === date)
    .filter(event => impact === 'all' || event.impact === impact)
    .filter(event => currency === 'all' || event.currency === currency)
    .sort((a, b) => a.time.localeCompare(b.time)), [events, date, impact, currency]);

  const moveDate = (amount: number) => setDate(current => addDays(current, amount));
  const today = localIsoDate();
  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#00a982]" />
            <h1 className="text-xl font-black tracking-tight text-[#0b1f35]">Calendrier économique</h1>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-600">Live</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Données économiques réelles, mises à jour depuis FinanceCalendar.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button type="button" onClick={() => moveDate(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50" aria-label="Jour précédent"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setDate(today)} className="px-3 text-xs font-bold text-[#0b1f35]">Aujourd'hui</button>
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
            {currencies.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black capitalize text-[#0b1f35]">{formattedDate}</h2>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {loading ? 'Chargement…' : `${visibleEvents.length} événement${visibleEvents.length > 1 ? 's' : ''} affiché${visibleEvents.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <button type="button" onClick={() => void loadEvents(date)} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 sm:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement du calendrier…
          </div>
        ) : error ? (
          <div className="px-5 py-14 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-rose-400" />
            <p className="mt-3 text-sm font-bold text-slate-600">Impossible de charger les données.</p>
            <p className="mt-1 text-xs text-slate-400">{error}</p>
            <button type="button" onClick={() => void loadEvents(date)} className="mt-4 rounded-xl bg-[#0b1f35] px-4 py-2 text-xs font-bold text-white">Réessayer</button>
          </div>
        ) : visibleEvents.length ? (
          <div className="divide-y divide-slate-100">
            {visibleEvents.map(event => {
              const cfg = impactConfig[event.impact];
              return (
                <div key={event.id} className="grid gap-4 px-5 py-4 md:grid-cols-[120px_90px_minmax(0,1fr)_repeat(3,90px)] md:items-center">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><Clock3 className="h-3.5 w-3.5 text-slate-400" />{event.time}</div>
                  <div className="flex items-center gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{event.currency}</span></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${cfg.className}`}>{cfg.label}</span>
                      {event.url ? <a href={event.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-[#0b1f35] hover:text-[#00a982]">{event.event}<ExternalLink className="h-3 w-3 shrink-0" /></a> : <span className="text-sm font-bold text-[#0b1f35]">{event.event}</span>}
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

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[10px] leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>Données fournies par FinanceCalendar. Les heures sont affichées selon le fuseau local de votre navigateur.</p>
        </div>
        <a href="https://www.financecalendar.com" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-bold text-[#00a982] hover:underline">
          Source FinanceCalendar <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
