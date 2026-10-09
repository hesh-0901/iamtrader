import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
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

const currencyFlagPaths: Record<string, string> = {
  USD: '/flags/us.svg',
  EUR: '/flags/eu.svg',
  GBP: '/flags/gb.svg',
  JPY: '/flags/jp.svg',
  CAD: '/flags/ca.svg',
  AUD: '/flags/au.svg',
  NZD: '/flags/nz.svg',
  CHF: '/flags/ch.svg',
};

const currencyOptions = Object.keys(currencyFlagPaths);

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

type EventEducation = { description: string; importance: string; interpretation: string };

function getEventEducation(title: string, currency: string): EventEducation {
  const name = title.toLowerCase();
  const descriptions: Array<[RegExp, EventEducation]> = [
    [/non.?farm|payrolls|employment change|employment report/, { description: "Mesure l’évolution de l’emploi, généralement hors secteur agricole, et aide à évaluer la vigueur du marché du travail.", importance: "L’emploi influence les anticipations de croissance et de politique monétaire, notamment aux États-Unis.", interpretation: "Une création d’emplois supérieure aux attentes peut soutenir le dollar, mais les salaires, le chômage et les révisions comptent aussi." }],
    [/consumer price|cpi|inflation rate|harmonised index|harmonized index/, { description: "Mesure l’évolution des prix payés par les consommateurs et sert à suivre l’inflation.", importance: "L’inflation influence les décisions de taux des banques centrales et donc les devises, les obligations et l’or.", interpretation: "Une inflation plus élevée que prévu peut renforcer les anticipations de taux élevés ; la réaction dépend du contexte et des autres composantes." }],
    [/producer price|ppi/, { description: "Suit l’évolution des prix reçus par les producteurs et peut signaler des pressions de coûts.", importance: "Il aide les marchés à anticiper la trajectoire de l’inflation.", interpretation: "Comparez la valeur publiée aux prévisions et vérifiez les composantes ainsi que les révisions." }],
    [/gross domestic product|\\bgdp\\b|\\bpib\\b/, { description: "Le produit intérieur brut mesure la valeur de la production de biens et services d’une économie.", importance: "Il renseigne sur la croissance et peut modifier les attentes concernant les taux d’intérêt.", interpretation: "Une croissance supérieure aux attentes peut soutenir la devise concernée, mais l’inflation et les perspectives de taux restent déterminantes." }],
    [/federal funds|interest rate decision|rate decision|policy rate|cash rate|bank rate|refinancing rate/, { description: "Annonce la décision de taux directeur de la banque centrale concernée.", importance: "Les taux influencent le coût du crédit, les rendements et l’attrait relatif d’une devise.", interpretation: "La décision compte, mais l’écart avec les attentes et le ton du communiqué sont souvent tout aussi importants." }],
    [/fomc minutes|minutes of the federal open market committee|fed minutes/, { description: "Compte rendu détaillé de la réunion du Comité fédéral de l’open market (FOMC), qui expose les discussions des responsables de la Réserve fédérale sur l’économie et la politique monétaire.", importance: "Les minutes peuvent révéler les divergences entre responsables et préciser les conditions qui pourraient conduire à une baisse ou à une hausse future des taux. Elles peuvent influencer le dollar, les rendements obligataires et l’or.", interpretation: "Repérez les passages sur l’inflation, le marché du travail et le calendrier des taux. Un ton plus restrictif que prévu peut soutenir le dollar et peser sur l’or ; un ton plus accommodant peut produire l’effet inverse. La réaction dépend des attentes déjà intégrées dans les prix." }],
    [/fomc|monetary policy statement|fed chair|press conference/, { description: "Publication ou communication liée à la politique monétaire de la Réserve fédérale américaine.", importance: "Les indications sur les futurs taux américains peuvent provoquer des mouvements du dollar, des rendements et de l’or.", interpretation: "Lisez le communiqué et les propos dans leur ensemble ; le marché réagit surtout aux éléments qui diffèrent des attentes." }],
    [/initial jobless|unemployment claims|jobless claims/, { description: "Compte les nouvelles demandes d’allocations chômage, un indicateur fréquent de l’évolution du marché du travail.", importance: "Une hausse persistante peut signaler un ralentissement de l’emploi et modifier les attentes de politique monétaire.", interpretation: "Une valeur plus basse qu’attendu indique généralement moins de demandes, mais il faut tenir compte de la tendance et des révisions." }],
    [/retail sales/, { description: "Mesure l’évolution des ventes des détaillants et donne une indication sur les dépenses des ménages.", importance: "La consommation est un moteur important de l’activité économique.", interpretation: "Des ventes plus fortes qu’attendu peuvent signaler une demande robuste ; vérifiez aussi les ventes hors automobiles et les révisions." }],
    [/personal consumption expenditures|\\bpce\\b/, { description: "L’indice des prix PCE mesure l’évolution des prix des dépenses de consommation personnelle aux États-Unis.", importance: "La Réserve fédérale le suit de près pour évaluer l’inflation.", interpretation: "La composante de base et l’écart aux attentes sont importants pour les anticipations de taux." }],
    [/ism manufacturing|manufacturing pmi|pmi manufacturing/, { description: "Enquête auprès des entreprises manufacturières sur les nouvelles commandes, la production, l’emploi et les délais de livraison.", importance: "Il fournit rapidement une indication sur la santé du secteur industriel.", interpretation: "Un indice au-dessus de 50 indique généralement une expansion du secteur ; comparez toujours au consensus." }],
    [/ism services|services pmi|non-manufacturing/, { description: "Enquête sur l’activité du secteur des services, notamment les nouvelles commandes et l’emploi.", importance: "Les services occupent une place majeure dans l’économie américaine.", interpretation: "Un chiffre supérieur aux attentes peut signaler une activité plus solide, mais les sous-indices apportent du contexte." }],
    [/jolts|job openings/, { description: "Estime le nombre de postes vacants et renseigne sur la demande de main-d’œuvre.", importance: "Il aide à évaluer l’équilibre entre offres d’emploi et travailleurs disponibles.", interpretation: "Une baisse des postes vacants peut indiquer un refroidissement du marché du travail, sans suffire à elle seule pour conclure." }],
    [/consumer confidence|consumer sentiment/, { description: "Sondage mesurant la perception des ménages concernant leur situation financière et l’économie.", importance: "Le moral des consommateurs peut influencer les perspectives de dépenses.", interpretation: "Comparez le résultat aux attentes et observez les composantes relatives aux conditions actuelles et aux anticipations." }],
    [/crude oil inventories|eia petroleum|oil inventories/, { description: "Rapport sur les stocks de pétrole brut, qui donne une indication sur l’équilibre entre offre et demande.", importance: "Il peut influencer les prix du pétrole et les actifs liés à l’énergie.", interpretation: "Une hausse des stocks peut peser sur le pétrole, toutes choses égales par ailleurs ; la production et les importations comptent également." }],
    [/unemployment rate/, { description: "Indique la part de la population active au chômage qui recherche un emploi.", importance: "C’est un indicateur clé de la santé du marché du travail et des décisions de politique monétaire.", interpretation: "Une baisse peut signaler une amélioration de l’emploi, mais le taux de participation et les créations d’emplois apportent un contexte essentiel." }],
    [/average hourly earnings|wage growth|employment cost index/, { description: "Mesure l’évolution des rémunérations ou du coût du travail.", importance: "La croissance des salaires peut influencer les dépenses des ménages et les pressions inflationnistes.", interpretation: "Une progression plus forte qu’attendu peut alimenter les anticipations d’inflation, selon la productivité et les autres données." }],
    [/industrial production/, { description: "Mesure l’évolution de la production des secteurs industriels concernés.", importance: "Il aide à évaluer la dynamique de l’activité réelle.", interpretation: "Comparez la variation publiée aux attentes et aux mois précédents." }],
    [/housing starts|building permits|existing home sales|new home sales/, { description: "Indicateur de l’activité immobilière à travers les constructions, permis ou ventes de logements.", importance: "Le logement est sensible aux taux d’intérêt et renseigne sur la demande intérieure.", interpretation: "Les taux hypothécaires, les stocks de logements et les révisions peuvent influencer la lecture du chiffre." }],
  ];
  const match = descriptions.find(([pattern]) => pattern.test(name))?.[1];
  if (match) return match;
  const currencyLabel = currency === '—' ? "l’économie concernée" : "l’économie associée à " + currency;
  return {
    description: "Cet événement publie une donnée économique intitulée « " + title + " ». Sa définition précise dépend de l’indicateur et de l’organisme qui le publie.",
    importance: "Les marchés peuvent utiliser cette publication pour réévaluer leurs perspectives sur " + currencyLabel + ", la croissance et la politique monétaire.",
    interpretation: "Comparez la valeur publiée au consensus, vérifiez la période mesurée et les éventuelles révisions. L’effet sur les prix n’est pas automatique."
  };
}

const impactLabel = (impact: Impact) =>
  impact === 'high'
    ? 'Impact élevé'
    : impact === 'medium'
      ? 'Impact moyen'
      : 'Impact faible';

const CowHead = ({ color }: { color: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 512 512"
    className="h-[26px] w-[26px] shrink-0"
    fill={color}
    fillRule="evenodd"
    clipRule="evenodd"
  >
    <path d="M 98,13 L 76,32 L 65,47 L 57,64 L 53,83 L 54,110 L 59,130 L 72,159 L 83,176 L 60,178 L 34,185 L 20,193 L 14,199 L 13,204 L 15,210 L 24,219 L 34,226 L 51,233 L 66,236 L 92,236 L 104,233 L 108,234 L 111,258 L 121,289 L 136,320 L 157,353 L 149,357 L 144,363 L 140,371 L 135,390 L 133,409 L 133,432 L 136,445 L 141,455 L 156,471 L 179,484 L 208,493 L 232,497 L 269,498 L 293,495 L 327,486 L 346,477 L 355,471 L 367,459 L 374,447 L 377,438 L 378,409 L 373,377 L 364,359 L 354,353 L 376,318 L 392,284 L 400,258 L 403,234 L 407,233 L 419,236 L 445,236 L 460,233 L 477,226 L 487,219 L 496,210 L 498,204 L 496,198 L 491,193 L 477,185 L 451,178 L 428,176 L 446,145 L 452,130 L 457,110 L 457,76 L 454,64 L 446,47 L 427,24 L 413,13 L 409,13 L 408,19 L 412,34 L 412,57 L 406,78 L 393,99 L 377,115 L 355,130 L 157,130 L 134,115 L 118,99 L 109,86 L 103,73 L 99,57 L 99,34 L 103,14 Z" />
    <path d="M 299,400 L 311,400 L 320,404 L 327,412 L 330,421 L 329,432 L 325,440 L 317,447 L 309,450 L 300,450 L 291,446 L 283,438 L 280,431 L 280,418 L 283,411 L 291,403 Z" />
    <path d="M 200,400 L 211,400 L 219,403 L 226,409 L 231,419 L 231,431 L 228,438 L 220,446 L 210,450 L 202,450 L 191,445 L 184,437 L 181,428 L 182,417 L 186,409 L 191,404 Z" />
    <path d="M 351,204 L 354,207 L 354,212 L 351,222 L 344,234 L 329,247 L 317,252 L 309,253 L 305,249 L 305,242 L 308,232 L 314,222 L 324,212 L 335,206 L 347,203 Z" />
    <path d="M 160,204 L 164,203 L 176,206 L 187,212 L 198,223 L 206,241 L 206,249 L 204,252 L 198,253 L 187,250 L 175,243 L 167,235 L 160,223 L 157,213 L 157,207 Z" />
  </svg>
);

const impactCows = (impact: Impact) => {
  const colors =
    impact === 'high'
      ? ['#ef4444', '#ef4444', '#ef4444']
      : impact === 'medium'
        ? ['#f59e0b', '#f59e0b', '#94a3b8']
        : ['#f59e0b', '#cbd5e1', '#cbd5e1'];

  return (
    <span className="inline-flex items-center justify-center gap-0.5" aria-label={impactLabel(impact)}>
      {colors.map((color, index) => (
        <CowHead key={index} color={color} />
      ))}
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
  const [impact, setImpact] = useState<Impact[]>(() => {
    try {
      const saved = localStorage.getItem('iamtrader-calendar-impact');
      return saved === 'high' || saved === 'medium' || saved === 'low' ? [saved] : saved ? JSON.parse(saved).filter((item: string) => ['high', 'medium', 'low'].includes(item)) : [];
    } catch {
      return [];
    }
  });
  const [currency, setCurrency] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('iamtrader-calendar-currency');
      if (!saved || saved === 'all') return [];
      try { const parsed = JSON.parse(saved); return Array.isArray(parsed) ? parsed : [saved]; } catch { return [saved]; }
    } catch {
      return [];
    }
  });
  const [draftImpact, setDraftImpact] = useState<Impact[]>(impact);
  const [draftCurrency, setDraftCurrency] = useState<string[]>(currency);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [onlineAnalysis, setOnlineAnalysis] = useState<{ summary: string; sources: Array<{ title: string; url: string; date?: string }>; fetchedAt: string } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async (selectedDate = date) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}?from=${addDays(selectedDate, -1)}&to=${addDays(selectedDate, 1)}&limit=500&calendarVersion=20261009b`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' },
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

  useEffect(() => {
    if (!selectedEvent) return;
    let cancelled = false;
    const event = selectedEvent;
    setAnalysisLoading(true);
    setAnalysisError(null);
    setOnlineAnalysis(null);

    const params = new URLSearchParams({
      event: event.event,
      currency: event.currency,
      date: event.date,
      time: event.time,
      impact: event.impact,
      actual: event.actual || '',
      forecast: event.forecast || '',
      previous: event.previous || '',
    });
    fetch(`/api/economic-calendar/analysis?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Analyse indisponible pour le moment.');
        if (!cancelled) setOnlineAnalysis(data);
      })
      .catch((error) => {
        if (!cancelled) setAnalysisError(error?.message || 'Analyse indisponible pour le moment.');
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedEvent?.id]);

  const currencies = useMemo(
    () => currencyOptions.filter((item) => events.some((event) => event.currency === item)),
    [events],
  );

  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) => event.date === date)
        .filter((event) => impact.length === 0 || impact.includes(event.impact))
        .filter((event) => currency.length === 0 || currency.includes(event.currency))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [events, date, impact, currency],
  );

  const today = localIsoDate();
  const eventsForDate = events.filter((event) => event.date === date);
  const highImpactCount = visibleEvents.filter((event) => event.impact === 'high').length;
  const hasActiveFilters = impact.length > 0 || currency.length > 0;

  useEffect(() => {
    try {
      localStorage.setItem('iamtrader-calendar-impact', JSON.stringify(impact));
      localStorage.setItem('iamtrader-calendar-currency', JSON.stringify(currency));
    } catch {
      // Keep filters usable when browser storage is unavailable.
    }
  }, [impact, currency]);

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: userTimeZone,
  }).format(new Date(`${date}T12:00:00`));

  return (
    <div className="space-y-2 text-slate-900 dark:text-white">
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
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold !text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:!text-slate-200 dark:hover:bg-slate-800"
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

      <div className="flex items-center justify-end gap-1.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setDatePickerOpen((open) => !open)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border bg-white transition-colors dark:bg-slate-900 ${datePickerOpen ? 'border-[#00a982] text-[#00a982]' : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'}`}
            aria-label="Ouvrir le calendrier de dates"
            title="Choisir une date"
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </button>
          {datePickerOpen && (
            <div className="absolute right-0 top-10 z-30 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <label className="mb-1 block text-[10px] font-semibold text-slate-500" htmlFor="economic-calendar-date">Choisir une date</label>
              <input
                id="economic-calendar-date"
                type="date"
                value={date}
                onChange={(event) => {
                  if (event.target.value) setDate(event.target.value);
                  setDatePickerOpen(false);
                }}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#00a982] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setDraftImpact(impact); setDraftCurrency(currency); setFiltersOpen((open) => !open); }}
          aria-expanded={filtersOpen}
          aria-controls="economic-calendar-filters"
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-bold transition-colors ${filtersOpen ? 'border-[#00a982] bg-emerald-50 text-[#008b6c] dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtres
          {(impact.length > 0 || currency.length > 0) && <span className="h-1.5 w-1.5 rounded-full bg-[#00a982]" />}
        </button>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFiltersOpen(false); }}>
          <section id="economic-calendar-filters" role="dialog" aria-modal="true" aria-labelledby="economic-filter-title" className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div><h2 id="economic-filter-title" className="text-base font-bold text-slate-900 dark:text-white">Filtres du calendrier</h2><p className="mt-1 text-xs text-slate-500">Sélectionnez plusieurs impacts et devises si nécessaire.</p></div>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fermer les filtres" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-lg text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">×</button>
            </header>
            <div className="max-h-[calc(90vh-150px)] space-y-6 overflow-y-auto px-5 py-5">
              <div>
                <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Niveau d’impact</h3><button type="button" onClick={() => setDraftImpact([])} className="text-[11px] font-semibold text-[#00a982] hover:underline">Tous les impacts</button></div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {([{value:'high',label:'Élevé',stars:'★★★',dot:'bg-red-500'},{value:'medium',label:'Moyen',stars:'★★☆',dot:'bg-amber-500'},{value:'low',label:'Faible',stars:'★☆☆',dot:'bg-slate-400'}] as const).map((item) => (
                    <label key={item.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 text-sm transition ${draftImpact.includes(item.value) ? 'border-[#00a982] bg-emerald-50 text-slate-900 dark:bg-emerald-950/30 dark:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900'}`}>
                      <input type="checkbox" checked={draftImpact.includes(item.value)} onChange={(event) => setDraftImpact((current) => event.target.checked ? [...current, item.value] : current.filter((value) => value !== item.value))} className="accent-[#00a982]" />
                      <span className={`h-2 w-2 rounded-full ${item.dot}`} /><span className="font-semibold">{item.label}</span><span className="ml-auto text-[10px] text-slate-400">{item.stars}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Aucune sélection signifie afficher tous les niveaux.</p>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Devises</h3><button type="button" onClick={() => setDraftCurrency([])} className="text-[11px] font-semibold text-[#00a982] hover:underline">Toutes les devises</button></div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {currencyOptions.filter((item) => currencies.includes(item)).map((item) => (
                    <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${draftCurrency.includes(item) ? 'border-[#00a982] bg-emerald-50 text-slate-900 dark:bg-emerald-950/30 dark:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900'}`}>
                      <input type="checkbox" checked={draftCurrency.includes(item)} onChange={(event) => setDraftCurrency((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} className="accent-[#00a982]" />
                      {currencyFlagPaths[item] && <img src={currencyFlagPaths[item]} alt="" aria-hidden="true" className="h-3.5 w-5 rounded-[2px] border border-slate-200 object-cover" />}
                      {item}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Sélectionnez une ou plusieurs devises. Aucune sélection affiche toutes les devises.</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"><TrendingUp className="h-4 w-4 text-[#00a982]" /><span><strong className="text-slate-900 dark:text-white">{highImpactCount}</strong> événement(s) à impact élevé correspondent actuellement aux filtres actifs.</span></div>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <button type="button" onClick={() => { setDraftImpact([]); setDraftCurrency([]); }} className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white">Réinitialiser</button>
              <div className="flex gap-2"><button type="button" onClick={() => setFiltersOpen(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">Annuler</button><button type="button" onClick={() => { setImpact(draftImpact); setCurrency(draftCurrency); setFiltersOpen(false); }} className="rounded-lg bg-[#00a982] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#008f6e]">Appliquer les filtres</button></div>
            </footer>
          </section>
        </div>
      )}


      <div className="mx-auto w-full max-w-[1000px] overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
          <div className="max-h-[calc(100vh-285px)] overflow-auto">
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/95">
              <div className="text-[11px] font-semibold uppercase text-slate-700 dark:text-slate-300">
                {formattedDate}
              </div>
              <div className="mt-0.5 text-[9px] font-medium text-slate-500 dark:text-slate-400">
                {visibleEvents.length} événement{visibleEvents.length > 1 ? 's' : ''} · {userTimeZone}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] table-fixed border-collapse">
                <thead className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
                  <tr className="h-7">
                    <th className="w-[72px] px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Heure</th>
                    <th className="w-[76px] px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Devise</th>
                    <th className="w-[300px] px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Événement</th>
                    <th className="w-[92px] px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Impact</th>
                    <th className="w-[88px] px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actuel</th>
                    <th className="w-[88px] px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prévision</th>
                    <th className="w-[88px] px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Précédent</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleEvents.map((event) => (
                    <React.Fragment key={event.id}>
                    <tr
                      key={event.id}
                      onClick={() => { setSelectedEvent(event); setOnlineAnalysis(null); setAnalysisError(null); }}
                      className="h-[52px] cursor-pointer border-b border-gray-100 align-middle transition-colors last:border-b-0 hover:bg-emerald-50/60 focus-within:bg-emerald-50/60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                      title="Ouvrir l’analyse économique"
                    >
                      <td className="whitespace-nowrap px-2 text-center font-mono text-xs text-gray-500 dark:text-slate-400">
                        {event.time}
                      </td>

                      <td className="px-2 text-left">
                        {event.currency === '—' ? (
                          <span className="text-xs text-gray-400">-</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <img
                              src={currencyFlagPaths[event.currency]}
                              alt=""
                              aria-hidden="true"
                              width={20}
                              height={14}
                              className="inline-block h-3.5 w-5 shrink-0 rounded-[2px] border border-slate-200 object-cover dark:border-slate-700"
                            />
                            {event.currency}
                          </span>
                        )}
                      </td>

                      <td className="max-w-0 px-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelectedEvent(event); setOnlineAnalysis(null); setAnalysisError(null); }}
                              className="block w-full truncate text-left text-xs font-semibold text-slate-900 hover:text-[#00a982] dark:text-white"
                              title="Afficher le commentaire et le contexte économique"
                            >
                              {event.event}
                            </button>
                            <div className="truncate text-[11px] text-gray-400 dark:text-slate-500">
                              {event.category || 'Indicateur économique'}
                            </div>
                          </div>
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(clickEvent) => clickEvent.stopPropagation()}
                              className="shrink-0 text-[9px] font-semibold text-[#00a982] hover:underline"
                            >
                              Détails
                            </a>
                          )}
                        </div>
                      </td>

                      <td
                        className="px-1 text-center text-sm"
                        title={impactLabel(event.impact)}
                        aria-label={impactLabel(event.impact)}
                      >
                        {impactCows(event.impact)}
                      </td>

                      <td
                        className={`px-1.5 text-center text-xs ${formatActualClass(event.actual)}`}
                      >
                        {value(event.actual)}
                      </td>

                      <td className="px-1.5 text-center text-xs text-slate-500 dark:text-slate-400">
                        {value(event.forecast)}
                      </td>

                      <td className="px-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        {value(event.previous)}
                      </td>
                    </tr>

                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden bg-white px-5 py-10 sm:px-8 sm:py-12 dark:bg-slate-950">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#00a982] via-emerald-300 to-transparent" />
            <div className="relative mx-auto flex max-w-xl flex-col items-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${loading ? 'border-emerald-100 bg-emerald-50 text-[#00a982] dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900'}`}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarDays className="h-5 w-5" />}
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-white">
                {loading ? 'Chargement du calendrier…' : eventsForDate.length > 0 && hasActiveFilters ? 'Aucun résultat avec cette sélection' : 'Aucune publication prévue pour cette date'}
              </p>
              <p className="mt-2 max-w-lg text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
                {loading
                  ? 'Nous récupérons les dernières publications économiques.'
                  : eventsForDate.length > 0 && hasActiveFilters
                    ? `${eventsForDate.length} publications sont disponibles à cette date, mais aucune ne correspond à vos filtres.`
                    : events.length > 0
                      ? `Le flux a renvoyé ${events.length} publications, mais aucune ne correspond à la date sélectionnée (${date}). Les horaires peuvent être convertis selon votre fuseau local.`
                      : 'Aucune donnée exploitable n’a été renvoyée par la source. Actualisez le calendrier ou réessayez un peu plus tard.'}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {hasActiveFilters && <button type="button" onClick={() => { setImpact([]); setCurrency([]); setDraftImpact([]); setDraftCurrency([]); }} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-[#008b6c] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Effacer les filtres</button>}
                <button type="button" onClick={() => void loadEvents(date)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-[#00a982] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#008f6e] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser</button>
              </div>
            </div>
          </div>
        )}
      </div>


      {selectedEvent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEvent(null); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="economic-event-modal-title"
            className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_100px_rgba(2,6,23,0.35)] dark:border-slate-700 dark:bg-slate-950"
          >
            <header className="relative flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-6 text-slate-900 sm:px-8 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#00a982]">
                  {selectedEvent.currency} <span className="text-slate-300">·</span> {impactLabel(selectedEvent.impact)}
                </div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">IAMTRADER · Briefing économique</div>
                <h2 id="economic-event-modal-title" className="max-w-3xl text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl dark:text-white">{selectedEvent.event}</h2>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"><span>{selectedEvent.date}</span><span className="text-slate-300">/</span><span>{selectedEvent.time} · heure locale</span><span className="text-slate-300">/</span><span>Calendrier macroéconomique</span></p>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} aria-label="Fermer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">×</button>
            </header>
            <div className="max-h-[calc(92vh-150px)] space-y-6 overflow-y-auto bg-white px-6 py-6 sm:px-8 sm:py-8 dark:bg-slate-950">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,0.8fr)]"> 
                <div className="space-y-4"> 
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400"><span className="h-px w-6 bg-emerald-500"></span>Décryptage de l’indicateur</div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{getEventEducation(selectedEvent.event, selectedEvent.currency).description}</p>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{getEventEducation(selectedEvent.event, selectedEvent.currency).importance}</p>
                <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{getEventEducation(selectedEvent.event, selectedEvent.currency).interpretation}</p>
                </div>
                <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Lecture du marché</div>
                  <div className="mt-3 space-y-3">
                    {[['Publié', selectedEvent.actual], ['Consensus', selectedEvent.forecast], ['Précédent', selectedEvent.previous]].map(([label, number]) => (
                      <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 last:border-0 last:pb-0 dark:border-slate-700">
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{value(number)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-slate-500">La surprise par rapport au consensus compte souvent davantage que le chiffre isolé.</p>
                </aside>
              </div>
              <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><TrendingUp className="h-4 w-4" /></div>
                    <div><div className="text-sm font-semibold text-slate-900 dark:text-white">Chloé</div><div className="mt-0.5 text-[11px] text-slate-500">Analyse économique · IAMTRADER</div></div>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Sources publiques</span>
                </div>
                {analysisLoading ? (
                  <div className="flex items-center gap-3 px-5 py-7 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /><div><div className="font-semibold text-slate-700 dark:text-slate-200">Chloé prépare son briefing</div><div className="mt-1 text-xs">Vérification du contexte public et synthèse des éléments disponibles…</div></div></div>
                ) : onlineAnalysis ? (
                  <>
                    <div className="whitespace-pre-line px-5 py-5 text-sm leading-7 text-slate-700 dark:text-slate-300">{onlineAnalysis.summary}</div>
                    {onlineAnalysis.sources.length > 0 && <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/50">
                      {onlineAnalysis.sources.map((source, index) => <a key={source.url + index} href={source.url} target="_blank" rel="noreferrer" className="text-xs font-medium leading-relaxed text-emerald-700 hover:underline dark:text-emerald-300">{source.title}{source.date ? ` · ${source.date}` : ''}</a>)}
                    </div>}
                    <p className="border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400 dark:border-slate-700">Mis à jour le {new Date(onlineAnalysis.fetchedAt).toLocaleString('fr-FR')} · Synthèse informative, pas un signal de trading.</p>
                  </>
                ) : (
                  <div className="px-5 py-5">
                    <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{analysisError || "Le contexte récent n’est pas disponible pour le moment."}</p>
                    <button type="button" onClick={() => {
                      const event = selectedEvent;
                      setAnalysisLoading(true);
                      setAnalysisError(null);
                      const params = new URLSearchParams({
                        event: event.event,
                        currency: event.currency,
                        date: event.date,
                        time: event.time,
                        impact: event.impact,
                        actual: event.actual || '',
                        forecast: event.forecast || '',
                        previous: event.previous || '',
                      });
                      fetch(`/api/economic-calendar/analysis?${params.toString()}`, {
                        method: 'GET',
                        headers: { Accept: 'application/json' },
                      }).then(async (response) => {
                        const data = await response.json();
                        if (!response.ok) throw new Error(data?.error || 'Analyse indisponible pour le moment.');
                        setOnlineAnalysis(data);
                      }).catch((error) => setAnalysisError(error?.message || 'Analyse indisponible pour le moment.')).finally(() => setAnalysisLoading(false));
                    }} disabled={analysisLoading} className="mt-4 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Réessayer</button>
                  </div>
                )}
              </section>
              <p className="text-[11px] leading-relaxed text-slate-400">Les publications peuvent influencer les marchés différemment selon les attentes déjà intégrées dans les prix. Vérifiez les sources avant toute décision. Cette analyse est informative et ne constitue pas un signal de trading.</p>
            </div>
          </section>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-0.5 text-[9px] text-slate-400">
        <span>Calendrier économique · heures adaptées à votre fuseau ({userTimeZone})</span>
        <a
          href="https://www.forexfactory.com/calendar"
          target="_blank"
          rel="noreferrer"
          className="font-semibold hover:text-[#00a982]"
        >
          Source <a href="https://www.financecalendar.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2">Finance Calendar</a> · données économiques
        </a>
      </div>
    </div>
  );
}
