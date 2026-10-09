const SOURCE_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const ENRICH_URL = 'https://api.tradingeconomics.com/calendar/country/united%20states';

type ForexFactoryEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
};

type EnrichmentEvent = {
  Date?: string;
  Country?: string;
  Event?: string;
  Actual?: string;
  Forecast?: string;
  Previous?: string;
};

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=600',
      ...headers,
    },
  });
}

function normalizeImpact(value: unknown) {
  const impact = String(value || '').trim().toLowerCase();
  if (impact === 'high') return 'high';
  if (impact === 'medium') return 'medium';
  return 'low';
}

function normalizeDate(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '';
}

function normalizeTime(value: string) {
  const match = value.match(/T(\d{2}:\d{2})/);
  return match?.[1] || '';
}

function normalizeEvent(raw: ForexFactoryEvent, index: number) {
  const rawDate = String(raw.date || '').trim();

  return {
    id: `${rawDate || 'unknown'}-${raw.country || 'unknown'}-${raw.title || 'event'}-${index}`,
    title: String(raw.title || 'Economic Event').trim(),
    country: String(raw.country || '').trim().toUpperCase(),
    date: normalizeDate(rawDate),
    time: normalizeTime(rawDate),
    datetime: rawDate,
    impact: normalizeImpact(raw.impact),
    actual: String(raw.actual ?? '').trim(),
    forecast: String(raw.forecast ?? '').trim(),
    previous: String(raw.previous ?? '').trim(),
  };
}

function normalizeEventTitle(title: string) {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const aliases: Array<[RegExp, string]> = [
    [/^unemployment claims$/, 'initial jobless claims'],
    [/^final wholesale inventories m m$/, 'wholesale inventories'],
    [/^natural gas storage$/, 'natural gas storage'],
    [/^30 y bond auction$/, '30 y bond auction'],
  ];

  for (const [pattern, replacement] of aliases) {
    if (pattern.test(normalized)) return replacement;
  }

  return normalized;
}

function eventKey(title: string, country: string, date: string, time: string) {
  return [
    normalizeEventTitle(title),
    country.toUpperCase(),
    date,
    time,
  ].join('|');
}

async function enrichActuals(events: ReturnType<typeof normalizeEvent>[], from: string, to: string) {
  const countries = ['united states'];
  const enriched = new Map<string, EnrichmentEvent>();

  for (const country of countries) {
    try {
      const url = new URL(ENRICH_URL);
      url.searchParams.set('d1', from);
      url.searchParams.set('d2', to);
      url.searchParams.set('c', 'guest:guest');
      url.searchParams.set('f', 'json');

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'IAMTRADER Economic Calendar/1.0',
        },
      });

      if (!response.ok) continue;

      const payload = await response.json() as unknown;
      if (!Array.isArray(payload)) continue;

      for (const item of payload as EnrichmentEvent[]) {
        const datetime = String(item.Date || '');
        const date = normalizeDate(datetime);
        const time = normalizeTime(datetime);
        const title = String(item.Event || '').trim();

        if (!date || !title) continue;

        enriched.set(eventKey(title, 'USD', date, time), item);
      }
    } catch {
      // The enrichment source is optional. Forex Factory remains authoritative for the schedule.
    }
  }

  return events.map((event) => {
    if (event.country !== 'USD') return event;

    const match = enriched.get(eventKey(event.title, event.country, event.date, event.time));
    if (!match) return event;

    return {
      ...event,
      actual: event.actual || String(match.Actual ?? '').trim(),
      forecast: event.forecast || String(match.Forecast ?? '').trim(),
      previous: event.previous || String(match.Previous ?? '').trim(),
    };
  });
}

type CalendarEnv = { FINNHUB_API_KEY?: string };

export async function handleEconomicCalendar(request: Request, env: CalendarEnv = {}): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return json({ error: 'Méthode non autorisée.' }, 405);
  }

  const requestUrl = new URL(request.url);
  const from = requestUrl.searchParams.get('from') || '';
  const to = requestUrl.searchParams.get('to') || '';

  const cacheKey = new Request(
    new URL(
      `/api/economic-calendar?source=date-range-v7&from=${from}&to=${to}`,
      request.url,
    ).toString(),
    { method: 'GET' },
  );

  const cache = caches.default;
  const cached = await cache.match(cacheKey);

  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set('X-IAMTRADER-Calendar-Cache', 'HIT');
    return response;
  }

  try {
    let scheduledEvents: ReturnType<typeof normalizeEvent>[] = [];
    let source = 'forex-factory';

    try {
      const upstream = await fetch(SOURCE_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'IAMTRADER Economic Calendar/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!upstream.ok) throw new Error(`Forex Factory HTTP ${upstream.status}`);
      const payload = await upstream.json() as unknown;
      const rawEvents = Array.isArray(payload) ? payload as ForexFactoryEvent[] : [];
      scheduledEvents = rawEvents.map(normalizeEvent).filter(event => event.title && event.date);
      if (!scheduledEvents.length) throw new Error('Forex Factory returned no events');
    } catch (primaryError) {
      console.warn('Forex Factory calendar unavailable; trying Trading Economics:', primaryError);
      const fallbackUrl = new URL('https://api.tradingeconomics.com/calendar');
      fallbackUrl.searchParams.set('c', 'guest:guest');
      fallbackUrl.searchParams.set('f', 'json');
      if (from) fallbackUrl.searchParams.set('d1', from);
      if (to) fallbackUrl.searchParams.set('d2', to);

      const fallback = await fetch(fallbackUrl.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'IAMTRADER Economic Calendar/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!fallback.ok) throw new Error(`Calendar sources unavailable (Forex Factory failed; Trading Economics HTTP ${fallback.status})`);
      const fallbackPayload = await fallback.json() as unknown;
      if (!Array.isArray(fallbackPayload)) throw new Error('Trading Economics returned an invalid calendar');
      scheduledEvents = (fallbackPayload as Array<Record<string, unknown>>).map((item, index) => {
        const datetime = String(item.Date || item.date || '');
        const rawCountry = String(item.Currency || item.Country || item.country || '');
        const impactValue = String(item.Importance || item.impact || '').toLowerCase();
        return {
          id: `te-${datetime}-${rawCountry}-${String(item.Event || item.event || index)}`,
          title: String(item.Event || item.event || 'Economic Event').trim(),
          country: rawCountry.toUpperCase() === 'UNITED STATES' ? 'USD' : rawCountry.toUpperCase(),
          date: normalizeDate(datetime),
          time: normalizeTime(datetime),
          datetime,
          impact: normalizeImpact(impactValue === '3' || impactValue === 'high' ? 'high' : impactValue === '2' || impactValue === 'medium' ? 'medium' : 'low'),
          actual: String(item.Actual ?? item.actual ?? '').trim(),
          forecast: String(item.Forecast ?? item.forecast ?? '').trim(),
          previous: String(item.Previous ?? item.previous ?? '').trim(),
        };
      }).filter(event => event.title && event.date);
      source = 'trading-economics-fallback';
    }

    // Forex Factory's "thisweek" feed ignores requested dates. If it does not
    // cover the requested range, ask the date-aware provider instead of returning
    // a successful response full of events from the wrong week.
    const utcToday = new Date().toISOString().slice(0, 10);
    const utcDay = new Date(`${utcToday}T00:00:00Z`);
    const weekStart = new Date(utcDay);
    weekStart.setUTCDate(utcDay.getUTCDate() - ((utcDay.getUTCDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const currentWeekStart = weekStart.toISOString().slice(0, 10);
    const currentWeekEnd = weekEnd.toISOString().slice(0, 10);
    const requestedRangeHasEvents = (!from || !to) || scheduledEvents.some((event) => event.date >= from && event.date <= to);
    const requestedRangeOutsideWeeklyFeed = Boolean(from && to && (from < currentWeekStart || to > currentWeekEnd));
    if (source === 'forex-factory' && from && to && (!requestedRangeHasEvents || requestedRangeOutsideWeeklyFeed)) {
      let dateRangeEvents: ReturnType<typeof normalizeEvent>[] = [];
      let dateRangeSource = '';
      const providerDiagnostics: string[] = [];

      // Trading Economics guest access is not reliable in production; treat it as
      // an optional provider and continue to Finnhub when it is unavailable.
      try {
        const rangeUrl = new URL('https://api.tradingeconomics.com/calendar');
        rangeUrl.searchParams.set('c', 'guest:guest');
        rangeUrl.searchParams.set('f', 'json');
        rangeUrl.searchParams.set('d1', from);
        rangeUrl.searchParams.set('d2', to);
        const rangeResponse = await fetch(rangeUrl.toString(), {
          headers: { Accept: 'application/json', 'User-Agent': 'IAMTRADER Economic Calendar/1.0' },
          signal: AbortSignal.timeout(6000),
        });
        providerDiagnostics.push(`Trading Economics HTTP ${rangeResponse.status}`);
        if (rangeResponse.ok) {
          const rangePayload = await rangeResponse.json() as unknown;
          if (Array.isArray(rangePayload)) {
            dateRangeEvents = (rangePayload as Array<Record<string, unknown>>).map((item, index) => {
              const datetime = String(item.Date || item.date || item.datetime || '');
              const rawCountry = String(item.Currency || item.Country || item.country || '');
              const impactValue = String(item.Importance || item.impact || '').toLowerCase();
              const country = rawCountry.toUpperCase() === 'UNITED STATES' ? 'USD' : rawCountry.toUpperCase();
              return {
                id: `te-range-${datetime}-${country}-${String(item.Event || item.event || index)}`,
                title: String(item.Event || item.event || 'Economic Event').trim(),
                country,
                date: normalizeDate(datetime),
                time: normalizeTime(datetime),
                datetime,
                impact: normalizeImpact(impactValue === '3' || impactValue === 'high' ? 'high' : impactValue === '2' || impactValue === 'medium' ? 'medium' : 'low'),
                actual: String(item.Actual ?? item.actual ?? '').trim(),
                forecast: String(item.Forecast ?? item.forecast ?? '').trim(),
                previous: String(item.Previous ?? item.previous ?? '').trim(),
              };
            }).filter((event) => event.title && event.date && event.date >= from && event.date <= to);
            providerDiagnostics.push(`Trading Economics events: ${dateRangeEvents.length}`);
            if (dateRangeEvents.length) dateRangeSource = 'trading-economics-date-range';
          } else {
            console.warn('[EconomicCalendar] Trading Economics returned non-array JSON');
          }
        } else {
          console.warn('[EconomicCalendar] Trading Economics HTTP', rangeResponse.status);
        }
      } catch (providerError) {
        console.warn('[EconomicCalendar] Trading Economics request failed:', providerError instanceof Error ? providerError.message : String(providerError));
      }

      if (!dateRangeEvents.length && env.FINNHUB_API_KEY) {
        try {
          const finnhubUrl = new URL('https://finnhub.io/api/v1/calendar/economic');
          finnhubUrl.searchParams.set('from', from);
          finnhubUrl.searchParams.set('to', to);
          finnhubUrl.searchParams.set('token', env.FINNHUB_API_KEY);
          const finnhubResponse = await fetch(finnhubUrl.toString(), {
            headers: { Accept: 'application/json', 'User-Agent': 'IAMTRADER Economic Calendar/1.0' },
            signal: AbortSignal.timeout(8000),
          });
          providerDiagnostics.push(`Finnhub HTTP ${finnhubResponse.status}`);
          if (!finnhubResponse.ok) {
            const errorBody = (await finnhubResponse.text()).slice(0, 180).replace(/[\r\n]+/g, ' ');
            if (errorBody) providerDiagnostics.push(`Finnhub error: ${errorBody}`);
            console.warn('[EconomicCalendar] Finnhub HTTP', finnhubResponse.status);
          } else {
            const payload = await finnhubResponse.json() as { economicCalendar?: unknown; economicCalendarData?: unknown; [key: string]: unknown };
            const raw = Array.isArray(payload.economicCalendar)
              ? payload.economicCalendar as Array<Record<string, unknown>>
              : Array.isArray(payload.economicCalendarData)
                ? payload.economicCalendarData as Array<Record<string, unknown>>
                : Array.isArray(payload as unknown)
                  ? payload as unknown as Array<Record<string, unknown>>
                  : [];
            if (!raw.length) providerDiagnostics.push(`Finnhub response keys: ${Object.keys(payload).join(', ') || 'none'}`);
            dateRangeEvents = raw.map((item, index) => {
              const datetime = String(item.time || item.date || '');
              const rawCountry = String(item.currency || item.country || '');
              const countryAliases: Record<string, string> = { 'UNITED STATES': 'USD', 'UNITED KINGDOM': 'GBP', 'EURO ZONE': 'EUR', 'EUROZONE': 'EUR', 'JAPAN': 'JPY', 'CANADA': 'CAD', 'AUSTRALIA': 'AUD', 'NEW ZEALAND': 'NZD', 'SWITZERLAND': 'CHF' };
              const currency = countryAliases[rawCountry.toUpperCase()] || rawCountry.toUpperCase();
              const impactValue = String(item.impact || '').toLowerCase();
              const date = normalizeDate(datetime);
              return {
                id: `fh-${date}-${currency}-${String(item.event || index)}`,
                title: String(item.event || 'Economic Event').trim(),
                country: currency,
                date,
                time: normalizeTime(datetime),
                datetime,
                impact: normalizeImpact(impactValue),
                actual: item.actual == null ? '' : String(item.actual),
                forecast: item.estimate == null ? '' : String(item.estimate),
                previous: item.prev == null ? '' : String(item.prev),
              };
            }).filter((event) => event.title && event.date && event.date >= from && event.date <= to);
            providerDiagnostics.push(`Finnhub events in requested range: ${dateRangeEvents.length}`);
            if (dateRangeEvents.length) dateRangeSource = 'finnhub';
          }
        } catch (providerError) {
          console.error('[EconomicCalendar] Finnhub request failed:', providerError instanceof Error ? providerError.message : String(providerError));
        }
      }

      scheduledEvents = dateRangeEvents;
      source = dateRangeSource || (env.FINNHUB_API_KEY ? 'calendar-providers-empty' : 'calendar-api-key-required');
    }

    const events = from && to && source === 'forex-factory'
      ? await enrichActuals(scheduledEvents, from, to)
      : scheduledEvents;

    const response = json({
      events,
      source,
      diagnostics: source === 'calendar-providers-empty' ? providerDiagnostics : undefined,
      configuration: source === 'calendar-api-key-required' ? 'Configurez FINNHUB_API_KEY dans les secrets Cloudflare pour activer la source historique.' : undefined,
      enrichment: source === 'forex-factory' ? 'trading-economics' : null,
      fetchedAt: new Date().toISOString(),
    });

    response.headers.set('X-IAMTRADER-Calendar-Cache', 'MISS');
    response.headers.set('X-IAMTRADER-Calendar-Source', source);

    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Never expose provider URLs or API tokens in a public response.
    const safeMessage = message
      .replace(/([?&]token=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/(FINNHUB_API_KEY=)[^&\s]+/gi, '$1[REDACTED]')
      .slice(0, 300);
    console.error('Economic calendar upstream failed:', safeMessage);
    const statusMatch = message.match(/HTTP (\d{3})/i);
    return json({
      error: 'Le calendrier économique est temporairement indisponible.',
      source: 'calendar-providers',
      providerStatus: statusMatch ? Number(statusMatch[1]) : null,
      diagnostic: safeMessage || 'Erreur inconnue du calendrier économique.',
    }, 502);
  }
}
