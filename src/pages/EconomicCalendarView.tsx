import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

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
  timezone?: string;
};

type ApiEvent = Record<string, any>;

const API_BASE = '/api/economic-calendar';

const currencyFlags: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
  NZD: '🇳🇿',
  CHF: '🇨🇭',
};

const currencyOptions = Object.keys(currencyFlags);

const currencyBySeries: Record<string, string> = {
  fomc: 'USD',
  fed: 'USD',
  adp: 'USD',
  cpi: 'USD',
  jobs: 'USD',
  nfp: 'USD',
  payroll: 'USD',
  gdp: 'USD',
  pce: 'USD',
  ppi: 'USD',
  'retail-sales': 'USD',
  'jobless-claims': 'USD',
  ism: 'USD',
  jolts: 'USD',
  eia: 'USD',
  'consumer-credit': 'USD',
  ecb: 'EUR',
  eurozone: 'EUR',
  'euro-area': 'EUR',
  boe: 'GBP',
  uk: 'GBP',
  'bank-of-england': 'GBP',
  boj: 'JPY',
  japan: 'JPY',
  'bank-of-japan': 'JPY',
  boc: 'CAD',
  canada: 'CAD',
  'bank-of-canada': 'CAD',
  rba: 'AUD',
  australia: 'AUD',
  rbnz: 'NZD',
  'new-zealand': 'NZD',
  snb: 'CHF',
  switzerland: 'CHF',
};

const countryCurrency: Array<[string, string[]]> = [
  ['USD', ['us', 'usa', 'united states', 'united states of america', 'america', 'american']],
  ['EUR', ['eurozone', 'euro area', 'european union', 'eu', 'germany', 'france', 'italy', 'spain', 'netherlands', 'belgium', 'austria', 'ireland', 'portugal', 'greece']],
  ['GBP', ['uk', 'gb', 'united kingdom', 'great britain', 'england']],
  ['JPY', ['jp', 'japan', 'japanese']],
  ['CAD', ['ca', 'canada', 'canadian']],
  ['AUD', ['au', 'australia', 'australian']],
  ['NZD', ['nz', 'new zealand']],
  ['CHF', ['ch', 'switzerland', 'swiss']],
];

function localIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localIsoDate(date);
}

function getWeekDates(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));

  return Array.from({ length: 5 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return localIsoDate(current);
  });
}

function localDateTime(value: unknown, fallbackDate?: string, fallbackTime?: string) {
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(parsed);

      const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return {
        date: `${map.year}-${map.month}-${map.day}`,
        time: `${map.hour}:${map.minute}`,
      };
    }
  }

  return {
    date: fallbackDate || '',
    time: fallbackTime || fallbackTime || '—',
  };
}

function inferCurrency(raw: ApiEvent, title: string, series: string) {
  const country = String(
    raw.country || raw.country_name || raw.country_code || raw.countryCode || '',
  )
    .trim()
    .toUpperCase();

  if (currencyOptions.includes(country)) {
    return country;
  }

  if (country) {
    const countrySearch = country.toLowerCase();
    for (const [currency, values] of countryCurrency) {
      if (values.some((value) => countrySearch === value || countrySearch.includes(value))) {
        return currency;
      }
    }
  }

  const explicit = String(raw.currency || raw.currency_code || raw.currencyCode || '')
    .trim()
    .toUpperCase();

  if (currencyOptions.includes(explicit)) {
    return explicit;
  }

  const seriesKey = series.replace(/_/g, '-').replace(/\s+/g, '-');

  if (currencyBySeries[seriesKey]) {
    return currencyBySeries[seriesKey];
  }

  const searchableText = [title, series, raw.region, raw.source, raw.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const rules: Array<[string, string[]]> = [
    ['USD', ['fomc', 'fed ', 'federal reserve', 'adp', 'nonfarm', 'non-farm', 'payroll', 'jobless claims', 'initial jobless claims', 'united states', 'u.s.', 'us ', 'american', 'eia', 'crude oil inventories', 'consumer credit']],
    ['EUR', ['ecb', 'eurozone', 'euro area', 'germany', 'german', 'france', 'french', 'italy', 'italian', 'spain', 'spanish']],
    ['GBP', ['boe', 'bank of england', 'united kingdom', 'uk ', 'britain', 'british']],
    ['JPY', ['boj', 'bank of japan', 'japan', 'japanese']],
    ['CAD', ['boc', 'bank of canada', 'canada', 'canadian']],
    ['AUD', ['rba', 'reserve bank of australia', 'australia', 'australian']],
    ['NZD', ['rbnz', 'reserve bank of new zealand', 'new zealand']],
    ['CHF', ['snb', 'switzerland', 'swiss']],
  ];

  for (const [currency, words] of rules) {
    if (words.some((word) => searchableText.includes(word))) {
      return currency;
    }
  }

  return '—';
}

function normalizeEvent(raw: ApiEvent, index: number): EconomicEvent {
  const dateTime = localDateTime(
    raw.datetime || raw.date || raw.time_utc || raw.datetime_utc || raw.timestamp || raw.date_time,
    raw.date,
    raw.time || raw.time_et,
  );

  const rawImpact = String(raw.impact || 'low').toLowerCase();
  const impact: Impact =
    rawImpact === 'high' || rawImpact === 'medium' ? rawImpact : 'low';

  const series = String(raw.series || '').toLowerCase();
  const title = String(
    raw.name || raw.title || raw.event || raw.event_name || 'Événement économique',
  );

  return {
    id: String(raw.id || raw.slug || raw.url || `${dateTime.date}-${index}`),
    date: raw.all_day ? dateTime.date : dateTime.date,
    time: raw.all_day ? '—' : dateTime.time,
    currency: inferCurrency(raw, title, series),
    event: title,
    category: String(raw.category || '').replace(/-/g, ' '),
    impact,
    actual: raw.actual ?? raw.result ?? undefined,
    forecast: raw.consensus ?? raw.forecast ?? undefined,
    previous: raw.prior ?? raw.previous ?? undefined,
    url: raw.url || undefined,
  };
}

const impactLabel = (impact: Impact) =>
  impact === 'high'
    ? 'Impact élevé'
    : impact === 'medium'
      ? 'Impact moyen'
      : 'Impact faible';

const impactStars = (impact: Impact) => {
  if (impact === 'high') {
    return (
      <span className="font-bold tracking-[-2px] text-red-500" aria-hidden="true">
        ★★★
      </span>
    );
  }

  if (impact === 'medium') {
    return (
      <span className="font-bold tracking-[-2px] text-amber-500" aria-hidden="true">
        ★★<span className="text-slate-300 dark:text-slate-700">★</span>
      </span>
    );
  }

  return (
    <span className="font-bold tracking-[-2px] text-amber-400" aria-hidden="true">
      ★<span className="text-slate-300 dark:text-slate-700">★</span>
      <span className="text-slate-300 dark:text-slate-700">★</span>
    </span>
  );
};

const value = (raw?: string) => String(raw ?? '').trim() || '-';

function formatActualClass(actual?: string) {
  if (!actual?.trim()) {
    return 'text-slate-400';
  }

  return /(^|\s)-/.test(actual.trim()) ? 'text-red-500' : 'font-bold text-emerald-600 dark:text-emerald-400';
}

export function EconomicCalendarView() {
  const [date, setDate] = useState(localIsoDate);
  const [impact, setImpact] = useState<'all' | Impact>('all');
  const [currency, setCurrency] = useState('all');
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async (selectedDate = date) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}?from=${addDays(selectedDate, -1)}&to=${addDays(selectedDate, 1)}&limit=500`,
        { headers: { Accept: 'application/json' } },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const rawEvents: ApiEvent[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.events)
          ? payload.events
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      setEvents(rawEvents.map(normalizeEvent));
    } catch (loadError: any) {
      setEvents([]);
      setError(loadError?.message || 'Impossible de charger le calendrier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents(date);
  }, [date]);

  const currencies = useMemo(
    () => currencyOptions.filter((item) => events.some((event) => event.currency === item)),
    [events],
  );

  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) => event.date === date)
        .filter((event) => impact === 'all' || event.impact === impact)
        .filter((event) => currency === 'all' || event.currency === currency)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [events, date, impact, currency],
  );

  const weekDates = getWeekDates(date);
  const today = localIsoDate();
  const highImpactCount = visibleEvents.filter((event) => event.impact === 'high').length;

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: userTimeZone,
  }).format(new Date(`${date}T12:00:00`));

  return (
    <div className="space-y-3 text-slate-900 dark:text-white">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#00a982]" />
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            Calendrier économique
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDate(addDays(date, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            aria-label="Jour précédent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-[#0b1f35] hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => setDate(addDays(date, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            aria-label="Jour suivant"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex gap-0.5 overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
        {weekDates.map((day) => {
          const active = day === date;
          const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(
            new Date(`${day}T12:00:00`),
          );
          const number = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' }).format(
            new Date(`${day}T12:00:00`),
          );

          return (
            <button
              key={day}
              type="button"
              onClick={() => setDate(day)}
              className={`min-w-[90px] flex-1 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                active
                  ? 'bg-[#0b1f35] text-white'
                  : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                {label}
              </div>
              <div className="text-xs font-black">{number}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-1.5 md:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto_auto]">
        <select
          value={impact}
          onChange={(event) => setImpact(event.target.value as 'all' | Impact)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#00a982] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="all">Tous les impacts</option>
          <option value="high">★★★ Impact élevé</option>
          <option value="medium">★★☆ Impact moyen</option>
          <option value="low">★☆☆ Impact faible</option>
        </select>

        <select
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#00a982] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="all">Toutes les devises</option>
          {currencies.map((item) => (
            <option key={item} value={item}>
              {currencyFlags[item]} {item}
            </option>
          ))}
        </select>

        <div className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <TrendingUp className="h-3.5 w-3.5 text-[#00a982]" />
          <span>
            <strong className="text-[#0b1f35] dark:text-white">{highImpactCount}</strong> fort
            {highImpactCount > 1 ? 's' : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void loadEvents(date)}
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement du calendrier…
          </div>
        ) : error ? (
          <div className="px-4 py-10 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-rose-400" />
            <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              Impossible de charger les données.
            </p>
            <p className="mt-1 text-[10px] text-slate-400">{error}</p>
            <button
              type="button"
              onClick={() => void loadEvents(date)}
              className="mt-3 rounded-lg bg-[#0b1f35] px-3 py-1.5 text-[10px] font-bold text-white"
            >
              Réessayer
            </button>
          </div>
        ) : visibleEvents.length ? (
          <div className="max-h-[calc(100vh-330px)] overflow-auto">
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-2 dark:border-slate-800 dark:bg-slate-800/95">
              <div className="text-[11px] font-semibold uppercase text-slate-700 dark:text-slate-300">
                {formattedDate}
              </div>
              <div className="mt-0.5 text-[9px] font-medium text-slate-500 dark:text-slate-400">
                {visibleEvents.length} événement{visibleEvents.length > 1 ? 's' : ''} · {userTimeZone}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
                  <tr className="h-8">
                    <th className="w-[76px] px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Heure</th>
                    <th className="w-[82px] px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Devise</th>
                    <th className="px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Événement</th>
                    <th className="w-[88px] px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Impact</th>
                    <th className="w-[92px] px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actuel</th>
                    <th className="w-[92px] px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prévision</th>
                    <th className="w-[92px] px-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Précédent</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="h-[43px] border-b border-gray-100 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="whitespace-nowrap px-3 text-left font-mono text-xs text-gray-500 dark:text-slate-400">
                        {event.time}
                      </td>

                      <td className="px-2 text-left">
                        {event.currency === '—' ? (
                          <span className="text-xs text-gray-400">-</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <span className="inline-flex h-4 w-5 items-center justify-center text-[14px] leading-none" aria-hidden="true">
                              {currencyFlags[event.currency]}
                            </span>
                            {event.currency}
                          </span>
                        )}
                      </td>

                      <td className="max-w-0 px-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div
                              className="truncate text-xs font-medium text-slate-900 dark:text-white"
                              title={event.event}
                            >
                              {event.event}
                            </div>
                            <div className="truncate text-[11px] text-gray-400 dark:text-slate-500">
                              {event.category || 'Indicateur économique'}
                            </div>
                          </div>
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-[9px] font-semibold text-[#00a982] hover:underline"
                            >
                              Détails
                            </a>
                          )}
                        </div>
                      </td>

                      <td
                        className="px-2 text-center text-sm"
                        title={impactLabel(event.impact)}
                        aria-label={impactLabel(event.impact)}
                      >
                        {impactStars(event.impact)}
                      </td>

                      <td
                        className={`px-2 text-center text-xs ${formatActualClass(event.actual)}`}
                      >
                        {value(event.actual)}
                      </td>

                      <td className="px-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        {value(event.forecast)}
                      </td>

                      <td className="px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                        {value(event.previous)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <CalendarDays className="mx-auto h-6 w-6 text-slate-200 dark:text-slate-700" />
            <p className="mt-2 text-xs font-bold text-slate-500">
              Aucun événement avec ces filtres.
            </p>
            <button
              type="button"
              onClick={() => {
                setImpact('all');
                setCurrency('all');
              }}
              className="mt-2 text-[10px] font-bold text-[#00a982] hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-0.5 text-[9px] text-slate-400">
        <span>Calendrier économique · heures adaptées à votre fuseau ({userTimeZone})</span>
        <a
          href="https://www.forexfactory.com/calendar"
          target="_blank"
          rel="noreferrer"
          className="font-semibold hover:text-[#00a982]"
        >
          Source Forex Factory
        </a>
      </div>
    </div>
  );
}
