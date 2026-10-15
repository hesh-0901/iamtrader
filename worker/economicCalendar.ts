const SOURCE_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const ENRICH_URL = 'https://api.tradingeconomics.com/calendar';

type ForexFactoryEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  actual?: string | number | null;
  Actual?: string | number | null;
  result?: string | number | null;
  actual_value?: string | number | null;
  actualValue?: string | number | null;
  forecast?: string | number | null;
  Forecast?: string | number | null;
  consensus?: string | number | null;
  estimate?: string | number | null;
  previous?: string | number | null;
  Previous?: string | number | null;
  prior?: string | number | null;
};

type EnrichmentEvent = {
  Date?: string;
  Country?: string;
  Currency?: string;
  Event?: string;
  Actual?: string | number | null;
  Forecast?: string | number | null;
  Previous?: string | number | null;
};

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60',
      ...headers,
    },
  });
}

function normalizeImpact(value: unknown) {
  const impact = String(value ?? '').trim().toLowerCase();
  if (impact === 'high' || impact === '3') return 'high';
  if (impact === 'medium' || impact === '2') return 'medium';
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
    actual: optionalValue(raw.actual ?? raw.Actual ?? raw.result ?? raw.actual_value ?? raw.actualValue),
    forecast: optionalValue(raw.forecast ?? raw.Forecast ?? raw.consensus ?? raw.estimate),
    previous: optionalValue(raw.previous ?? raw.Previous ?? raw.prior),
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

function normalizeCurrency(value: unknown) {
  const country = String(value ?? '').trim().toUpperCase();
  const aliases: Record<string, string> = {
    'UNITED STATES': 'USD',
    'UNITED STATES OF AMERICA': 'USD',
    'US': 'USD',
    'U.S.': 'USD',
    'UNITED KINGDOM': 'GBP',
    'GREAT BRITAIN': 'GBP',
    'EURO ZONE': 'EUR',
    'EUROZONE': 'EUR',
    'EURO AREA': 'EUR',
    'EUROPEAN UNION': 'EUR',
    'JAPAN': 'JPY',
    'CANADA': 'CAD',
    'AUSTRALIA': 'AUD',
    'NEW ZEALAND': 'NZD',
    'SWITZERLAND': 'CHF',
  };
  return aliases[country] || country;
}

function eventKey(title: string, country: string, date: string) {
  return [normalizeEventTitle(title), normalizeCurrency(country), date].join('|');
}

function optionalValue(value: unknown) {
  const normalized = value == null ? '' : String(value).trim();
  return ['', '-', '—', 'n/a', 'na'].includes(normalized.toLowerCase()) ? '' : normalized;
}

function preserveOrEnrich(existing: string, supplemental: unknown) {
  return optionalValue(existing) || optionalValue(supplemental);
}

async function enrichActuals(events: ReturnType<typeof normalizeEvent>[], from: string, to: string) {
  if (!events.length) return events;

  const enriched = new Map<string, EnrichmentEvent[]>();

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
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      console.warn('[EconomicCalendar] Historical value enrichment HTTP', response.status);
      return events;
    }

    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) return events;

    for (const item of payload as EnrichmentEvent[]) {
      const datetime = String(item.Date || '');
      const date = normalizeDate(datetime);
      const title = String(item.Event || '').trim();
      const currency = normalizeCurrency(item.Currency || item.Country);

      if (!date || !title || !currency) continue;

      const key = eventKey(title, currency, date);
      const candidates = enriched.get(key) || [];
      candidates.push(item);
      enriched.set(key, candidates);
    }
  } catch (error) {
    console.warn(
      '[EconomicCalendar] Historical value enrichment unavailable:',
      error instanceof Error ? error.message : String(error),
    );
    return events;
  }

  return events.map((event) => {
    const key = eventKey(event.title, event.country, event.date);
    const candidates = enriched.get(key) || [];
    if (!candidates.length) return event;

    // Prefer an exact time match. If the provider uses a different timezone or
    // omits a time, only use the fallback when there is one unambiguous match.
    const exactTime = candidates.find((candidate) =>
      normalizeTime(String(candidate.Date || '')) === event.time && Boolean(event.time),
    );
    const match = exactTime || (candidates.length === 1 ? candidates[0] : undefined);
    if (!match) return event;

    return {
      ...event,
      actual: preserveOrEnrich(event.actual, match.Actual),
      forecast: preserveOrEnrich(event.forecast, match.Forecast),
      previous: preserveOrEnrich(event.previous, match.Previous),
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
      `/api/economic-calendar?source=date-range-v13&from=${from}&to=${to}`,
      request.url,
    ).toString(),
    { method: 'GET' },
  );

  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await cache.match(cacheKey);

  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set('X-IAMTRADER-Calendar-Cache', 'HIT');
    return response;
  }

  try {
    let scheduledEvents: ReturnType<typeof normalizeEvent>[] = [];
    let source = 'forex-factory';
    const providerDiagnostics: string[] = [];
    let primarySourceStatus = 'not checked';

    try {
      const upstream = await fetch(SOURCE_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'IAMTRADER Economic Calendar/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!upstream.ok) {
        primarySourceStatus = `HTTP ${upstream.status}`;
        throw new Error(`Forex Factory HTTP ${upstream.status}`);
      }
      primarySourceStatus = `HTTP ${upstream.status}`;
      const payload = await upstream.json() as unknown;
      const rawEvents = Array.isArray(payload) ? payload as ForexFactoryEvent[] : [];
      scheduledEvents = rawEvents.map(normalizeEvent).filter(event => event.title && event.date);
      if (!scheduledEvents.length) {
        primarySourceStatus = `HTTP ${upstream.status}; no valid events`;
        throw new Error('Forex Factory returned no events');
      }
      providerDiagnostics.push(`Forex Factory: ${primarySourceStatus}; ${scheduledEvents.length} events received`);
    } catch (primaryError) {
      if (primarySourceStatus === 'not checked') {
        primarySourceStatus = `fetch/parse error: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`;
      }
      providerDiagnostics.push(`Forex Factory: ${primarySourceStatus}`);
      console.warn('Forex Factory calendar unavailable; trying Trading Economics:', primaryError);
      // Trading Economics guest access may return HTTP 410. That must not abort
      // the handler: leave the schedule empty so the date-range Finnhub fallback runs.
      scheduledEvents = [];
      source = 'forex-factory';
      try {
        const fallbackUrl = new URL('https://api.tradingeconomics.com/calendar');
        fallbackUrl.searchParams.set('c', 'guest:guest');
        fallbackUrl.searchParams.set('f', 'json');
        if (from) fallbackUrl.searchParams.set('d1', from);
        if (to) fallbackUrl.searchParams.set('d2', to);

        const fallback = await fetch(fallbackUrl.toString(), {
          headers: { Accept: 'application/json', 'User-Agent': 'IAMTRADER Economic Calendar/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!fallback.ok) {
          console.warn('[EconomicCalendar] Trading Economics fallback HTTP', fallback.status);
        } else {
          const fallbackPayload = await fallback.json() as unknown;
          if (Array.isArray(fallbackPayload)) {
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
            if (scheduledEvents.length) source = 'trading-economics-fallback';
          } else {
            console.warn('[EconomicCalendar] Trading Economics fallback returned non-array JSON');
          }
        }
      } catch (fallbackError) {
        console.warn('[EconomicCalendar] Trading Economics fallback failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      }
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
                actual: optionalValue(item.actual ?? item.Actual ?? item.result ?? item.actual_value ?? item.actualValue),
                forecast: optionalValue(item.estimate ?? item.consensus ?? item.forecast ?? item.Forecast),
                previous: optionalValue(item.prev ?? item.previous ?? item.prior ?? item.Previous),
              };
            }).filter((event) => event.title && event.date && event.date >= from && event.date <= to);
            providerDiagnostics.push(`Finnhub events in requested range: ${dateRangeEvents.length}`);
            if (dateRangeEvents.length) dateRangeSource = 'finnhub';
          }
        } catch (providerError) {
          console.error('[EconomicCalendar] Finnhub request failed:', providerError instanceof Error ? providerError.message : String(providerError));
        }
      }

      // Finnhub may reject the account's plan (HTTP 403). Use Finance Calendar's
      // public date-range API as the final fallback; it requires visible attribution.
      if (!dateRangeEvents.length) {
        try {
          const financeUrl = new URL('https://www.financecalendar.com/wp-json/fc/v1/calendar');
          financeUrl.searchParams.set('from', from);
          financeUrl.searchParams.set('to', to);
          financeUrl.searchParams.set('limit', '500');
          const financeResponse = await fetch(financeUrl.toString(), {
            headers: { Accept: 'application/json', 'User-Agent': 'IAMTRADER Economic Calendar/1.0' },
            signal: AbortSignal.timeout(8000),
          });
          providerDiagnostics.push(`Finance Calendar HTTP ${financeResponse.status}`);
          if (!financeResponse.ok) {
            console.warn('[EconomicCalendar] Finance Calendar HTTP', financeResponse.status);
          } else {
            const financePayload = await financeResponse.json() as unknown;
            const financeRaw = Array.isArray(financePayload)
              ? financePayload as Array<Record<string, unknown>>
              : financePayload && typeof financePayload === 'object' && Array.isArray((financePayload as Record<string, unknown>).events)
                ? (financePayload as { events: Array<Record<string, unknown>> }).events
                : [];
            dateRangeEvents = financeRaw.map((item, index) => {
              const datetime = String(item.time_utc || item.datetime || item.date || '');
              const title = String(item.name || item.title || item.event || 'Economic Event').trim();
              const rawCountry = String(item.currency || item.country_code || item.country || item.currency_code || '');
              const aliases: Record<string, string> = {
                'UNITED STATES': 'USD', 'UNITED KINGDOM': 'GBP', 'EURO ZONE': 'EUR',
                'EUROZONE': 'EUR', 'EURO AREA': 'EUR', 'JAPAN': 'JPY', 'CANADA': 'CAD',
                'AUSTRALIA': 'AUD', 'NEW ZEALAND': 'NZD', 'SWITZERLAND': 'CHF',
              };
              const country = aliases[rawCountry.toUpperCase()] || rawCountry.toUpperCase();
              const impact = String(item.impact || 'low').toLowerCase();
              return {
                id: `fc-${normalizeDate(datetime)}-${country}-${String(item.slug || title || index)}`,
                title,
                country,
                date: normalizeDate(datetime),
                time: normalizeTime(datetime) || String(item.time_et || item.time || ''),
                datetime,
                impact: normalizeImpact(impact),
                actual: optionalValue(item.actual ?? item.Actual ?? item.result ?? item.actual_value ?? item.actualValue ?? item.actuals),
                forecast: optionalValue(item.consensus ?? item.forecast ?? item.Forecast ?? item.estimate ?? item.forecast_value ?? item.forecastValue),
                previous: optionalValue(item.prior ?? item.previous ?? item.Previous ?? item.prior_value ?? item.previous_value),
                url: String(item.url || ''),
              };
            }).filter(event => event.title && event.date && event.date >= from && event.date <= to);
            providerDiagnostics.push(`Finance Calendar events in requested range: ${dateRangeEvents.length}`);
            if (dateRangeEvents.length) dateRangeSource = 'financecalendar';
          }
        } catch (financeError) {
          console.warn('[EconomicCalendar] Finance Calendar request failed:', financeError instanceof Error ? financeError.message : String(financeError));
        }
      }

      // Keep Forex Factory as the authoritative schedule. Date-range providers
      // supplement missing events; they must never replace a non-empty FF feed.
      if (scheduledEvents.length && dateRangeEvents.length) {
        const merged = new Map<string, ReturnType<typeof normalizeEvent>>();
        const keyFor = (event: ReturnType<typeof normalizeEvent>) =>
          `${event.date}|${event.time}|${event.country.toUpperCase()}|${normalizeEventTitle(event.title)}`;

        // Insert supplemental events first, then Forex Factory so FF wins duplicates.
        for (const event of dateRangeEvents) merged.set(keyFor(event), event);
        for (const event of scheduledEvents) merged.set(keyFor(event), event);
        scheduledEvents = Array.from(merged.values())
          .filter((event) => (!from || event.date >= from) && (!to || event.date <= to))
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        source = dateRangeSource ? `forex-factory+${dateRangeSource}` : 'forex-factory+supplemental';
      } else {
        scheduledEvents = dateRangeEvents.length ? dateRangeEvents : scheduledEvents;
        source = dateRangeSource || (scheduledEvents.length ? 'forex-factory' : (env.FINNHUB_API_KEY ? 'calendar-providers-empty' : 'calendar-api-key-required'));
      }
    }

    // Never return events outside the requested date range, even when every
    // date-aware provider fails and Forex Factory only has the current week.
    const inRequestedRange = (event: ReturnType<typeof normalizeEvent>) =>
      (!from || event.date >= from) && (!to || event.date <= to);
    const rangeScheduledEvents = scheduledEvents.filter(inRequestedRange);
    // Historical values are supplemental and must be attempted for every provider,
    // not only when Forex Factory supplied the schedule.
    const events = from && to
      ? await enrichActuals(rangeScheduledEvents, from, to)
      : rangeScheduledEvents;

    if (from && to && events.length === 0 && source === 'forex-factory') {
      source = env.FINNHUB_API_KEY ? 'calendar-providers-empty' : 'calendar-api-key-required';
    }

    const response = json({
      events,
      source,
      // Safe provider diagnostics make source fallback observable without exposing credentials.
      diagnostics: providerDiagnostics.length ? providerDiagnostics : [`Forex Factory: ${primarySourceStatus}`],
      configuration: source === 'calendar-api-key-required' ? 'Configurez FINNHUB_API_KEY dans les secrets Cloudflare pour activer la source historique.' : undefined,
      enrichment: from && to ? 'trading-economics-optional' : null,
      fetchedAt: new Date().toISOString(),
    });

    response.headers.set('X-IAMTRADER-Calendar-Cache', 'MISS');
    response.headers.set('X-IAMTRADER-Calendar-Source', source);

    if (events.length === 0) {
      // Do not persist empty provider results; allow the next request to retry upstream.
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
      return response;
    }

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
