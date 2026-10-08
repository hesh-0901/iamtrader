import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Clock3, AlertTriangle, Loader2, RefreshCw, TrendingUp, Bell, X } from 'lucide-react';

type Impact = 'high' | 'medium' | 'low';
type EconomicEvent = {
  id: string;
  date: string;
  time: string;
  currency: string;
  event: string;
  category?: string;
  impact: Impact;
  actual?: string;
  forecast?: string;
  previous?: string;
  url?: string;
};

type ApiEvent = Record<string, any>;

const API_BASE = 'https://www.financecalendar.com/wp-json/fc/v1/calendar';

const impactConfig: Record<Impact, { label: string; dot: string; badge: string; bar: string }> = {
  high: { label: 'Élevé', dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-600 border-rose-100', bar: 'bg-rose-500' },
  medium: { label: 'Moyen', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-600 border-amber-100', bar: 'bg-amber-400' },
  low: { label: 'Faible', dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-500 border-slate-200', bar: 'bg-slate-400' },
};

const currencyBySeries: Record<string, string> = {
  fomc: 'USD', cpi: 'USD', jobs: 'USD', nfp: 'USD', gdp: 'USD', pce: 'USD', ppi: 'USD',
  'retail-sales': 'USD', 'jobless-claims': 'USD', ism: 'USD', jolts: 'USD',
  ecb: 'EUR', boe: 'GBP', boj: 'JPY', boc: 'CAD', rba: 'AUD', rbnz: 'NZD', snb: 'CHF',
};

const currencyFlags: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭',
};

const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF'];

function localDateTime(value: unknown, fallbackDate?: string, fallbackTime?: string) {
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(parsed);
      const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
      return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
    }
  }
  return { date: fallbackDate || '', time: fallbackTime || '—' };
}

function normalizeEvent(raw: ApiEvent, index: number): EconomicEvent {
  const local = localDateTime(raw.time_utc || raw.datetime_utc || raw.timestamp || raw.date_time || raw.datetime, raw.date, raw.time || raw.time_et);
  const impactValue = String(raw.impact || 'low').toLowerCase();
  const impact: Impact = impactValue === 'high' || impactValue === 'medium' ? impactValue : 'low';
  const series = String(raw.series || '').toLowerCase();
  const title = String(raw.name || raw.title || raw.event || raw.event_name || 'Événement économique');
  const currency = String(raw.currency || raw.currency_code || raw.currencyCode || currencyBySeries[series] || '').toUpperCase();

  return {
    id: String(raw.id || raw.slug || raw.url || `${local.date}-${index}`),
    date: local.date,
    time: raw.all_day ? 'Toute la journée' : local.time,
    currency: currency || '—',
    event: title,
    category: String(raw.category || '').replace(/-/g, ' '),
    impact,
    actual: raw.actual ?? raw.result ?? undefined,
    forecast: raw.consensus ?? raw.forecast ?? undefined,
    previous: raw.prior ?? raw.previous ?? undefined,
    url: raw.url || undefined,
  };
}

function eventSummary(event: EconomicEvent) {
  const name = event.event.toLowerCase();
  if (name.includes('nonfarm') || name.includes('payroll')) return 'Mesure les créations d’emplois américaines et peut fortement déplacer le dollar.';
  if (name.includes('fomc') || name.includes('interest rate') || name.includes('rate decision')) return 'Donne le signal de politique monétaire et peut fortement influencer les taux et le dollar.';
  if (name.includes('cpi') || name.includes('consumer price')) return 'Mesure l’inflation et influence les anticipations de taux de la banque centrale.';
  if (name.includes('gdp') || name.includes('gross domestic')) return 'Mesure la croissance économique et donne une lecture de la vigueur de l’économie.';
  if (name.includes('jobless') || name.includes('unemployment') || name.includes('labour force')) return 'Donne une lecture du marché du travail et de la solidité de l’économie.';
  if (name.includes('retail sales')) return 'Mesure la consommation des ménages, un moteur important de l’activité économique.';
  if (name.includes('pmi') || name.includes('ism')) return 'Indique le rythme de l’activité économique et les perspectives de croissance.';
  if (name.includes('pce') || name.includes('ppi')) return 'Apporte une information clé sur les pressions inflationnistes.';
  return 'Indicateur économique à surveiller pour évaluer les perspectives de la devise.';
}

function localIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(value: string, amount: number) {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return localIsoDate(d);
}

function getWeekDates(selected: string) {
  const d = new Date(`${selected}T12:00:00`);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 5 }, (_, index) => {
    const item = new Date(monday);
    item.setDate(monday.getDate() + index);
    return localIsoDate(item);
  });
}

export function EconomicCalendarView() {
  const [date, setDate] = useState(() => localIsoDate());
  const [impact, setImpact] = useState<'all' | Impact>('all');
  const [currency, setCurrency] = useState('all');
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async (selectedDate = date) => {
    setLoading(true);
    setError(null);
    try {
      const from = addDays(selectedDate, -1);
      const to = addDays(selectedDate, 1);
      const response = await fetch(`${API_BASE}?from=${from}&to=${to}&limit=500`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const rawEvents: ApiEvent[] = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : Array.isArray(payload?.data) ? payload.data : [];
      setEvents(rawEvents.map(normalizeEvent));
    } catch (err: any) {
      setEvents([]);
      setError(err?.message || 'Impossible de charger le calendrier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadEvents(date); }, [date]);

  const currencies = useMemo(() => Array.from(new Set([...currencyOptions, ...events.map(e => e.currency).filter(Boolean)])).sort(), [events]);
  const visibleEvents = useMemo(() => events
    .filter(e => e.date === date)
    .filter(e => impact === 'all' || e.impact === impact)
    .filter(e => currency === 'all' || e.currency === currency)
    .sort((a, b) => a.time.localeCompare(b.time)), [events, date, impact, currency]);

  const weekDates = getWeekDates(date);
  const today = localIsoDate();
  const highImpactCount = visibleEvents.filter(e => e.impact === 'high').length;
  const formattedDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#00a982]" />
            <h1 className="text-xl font-black tracking-tight text-[#0b1f35]">Calendrier économique</h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Les événements qui peuvent faire bouger les marchés.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDate(addDays(date, -1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setDate(today)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#0b1f35] hover:bg-slate-50">Aujourd'hui</button>
          <button type="button" onClick={() => setDate(addDays(date, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        {weekDates.map(day => {
          const active = day === date;
          const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(`${day}T12:00:00`));
          const dayNumber = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' }).format(new Date(`${day}T12:00:00`));
          return (
            <button key={day} onClick={() => setDate(day)} className={`min-w-[110px] flex-1 rounded-xl px-3 py-2.5 text-left transition-all ${active ? 'bg-[#0b1f35] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">{dayLabel}</div>
              <div className="mt-0.5 text-sm font-black">{dayNumber}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <select value={impact} onChange={e => setImpact(e.target.value as 'all' | Impact)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-[#00a982]">
          <option value="all">Tous les impacts</option>
          <option value="high">🔴 Impact élevé</option>
          <option value="medium">🟠 Impact moyen</option>
          <option value="low">⚪ Impact faible</option>
        </select>
        <select value={currency} onChange={e => setCurrency(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-[#00a982]">
          <option value="all">Toutes les devises</option>
          {currencies.map(value => <option key={value} value={value}>{currencyFlags[value] || '🌐'} {value}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500">
          <TrendingUp className="h-4 w-4 text-[#00a982]" />
          <span><strong className="text-[#0b1f35]">{highImpactCount}</strong> événement{highImpactCount > 1 ? 's' : ''} à fort impact</span>
        </div>
        <button type="button" onClick={() => void loadEvents(date)} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-black capitalize text-[#0b1f35]">{formattedDate}</div>
            <div className="mt-1 text-[10px] text-slate-400">{visibleEvents.length} événement{visibleEvents.length > 1 ? 's' : ''} · fuseau local</div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400"><Bell className="h-3.5 w-3.5" /> Surveillez surtout les événements à fort impact</div>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Chargement du calendrier…</div>
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
                <div key={event.id} className="group grid gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80 md:grid-cols-[90px_100px_minmax(0,1fr)_minmax(250px,360px)] md:items-center">
                  <div className="flex items-center gap-2 text-sm font-black text-[#0b1f35]"><Clock3 className="h-4 w-4 text-slate-300" />{event.time}</div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-600">
                      <span>{currencyFlags[event.currency] || '🌐'}</span>{event.currency}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                      <span className="text-sm font-black text-[#0b1f35]">{event.event}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-500">{eventSummary(event)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      <span className="capitalize">{event.category || 'Indicateur économique'}</span>
                      {event.url && <a href={event.url} target="_blank" rel="noreferrer" className="font-semibold text-[#00a982] hover:underline">Détails</a>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div><div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Actuel</div><div className="mt-1 text-xs font-black text-[#0b1f35]">{event.actual || (event.date > today ? 'À venir' : 'Non publié')}</div></div>
                    <div><div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Prévision</div><div className="mt-1 text-xs font-black text-[#0b1f35]">{event.forecast || 'Non communiqué'}</div></div>
                    <div><div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Précédent</div><div className="mt-1 text-xs font-black text-[#0b1f35]">{event.previous || 'Non communiqué'}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-16 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-slate-200" />
            <p className="mt-3 text-sm font-bold text-slate-500">Aucun événement avec ces filtres.</p>
            <button type="button" onClick={() => { setImpact('all'); setCurrency('all'); }} className="mt-3 text-xs font-bold text-[#00a982] hover:underline">Réinitialiser les filtres</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Devises</span>
        <button type="button" onClick={() => setCurrency('all')} className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black transition ${currency === 'all' ? 'bg-[#0b1f35] text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>Toutes</button>
        {currencyOptions.map(value => (
          <button key={value} type="button" onClick={() => setCurrency(value)} className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black transition ${currency === value ? 'bg-[#0b1f35] text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
            {currencyFlags[value]} {value}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-1 text-[9px] text-slate-400">
        <span>Calendrier économique · données mises à jour automatiquement</span>
        <a href="https://www.financecalendar.com" target="_blank" rel="noreferrer" className="font-semibold text-slate-400 hover:text-[#00a982]">Données économiques</a>
      </div>
    </div>
  );
}
