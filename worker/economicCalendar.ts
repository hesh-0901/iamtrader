const SOURCE_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
type ForexFactoryEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
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

function normalizeEvent(raw: ForexFactoryEvent, index: number) {
  const rawDate = String(raw.date || '').trim();
  const dateMatch = rawDate.match(/^(\\d{4}-\\d{2}-\\d{2})/);
  const timeMatch = rawDate.match(/T(\\d{2}:\\d{2})/);

  return {
    id: `${rawDate || 'unknown'}-${raw.country || 'unknown'}-${raw.title || 'event'}-${index}`,
    title: String(raw.title || 'Economic Event').trim(),
    country: String(raw.country || '').trim().toUpperCase(),
    date,
    time,
    impact: normalizeImpact(raw.impact),
    actual: raw.actual ?? '',
    forecast: raw.forecast ?? '',
    previous: raw.previous ?? '',
  };
}

export async function handleEconomicCalendar(request: Request): Promise<Response> {
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

  const cacheKey = new Request(new URL('/api/economic-calendar?source=forex-factory-week', request.url).toString(), {
    method: 'GET',
  });

  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set('X-IAMTRADER-Calendar-Cache', 'HIT');
    return response;
  }

  try {
    const upstream = await fetch(SOURCE_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'IAMTRADER Economic Calendar/1.0',
      },
    });

    if (!upstream.ok) {
      throw new Error(`Source calendar HTTP ${upstream.status}`);
    }

    const payload = await upstream.json() as unknown;
    const rawEvents = Array.isArray(payload) ? payload as ForexFactoryEvent[] : [];

    const events = rawEvents
      .map(normalizeEvent)
      .filter(event => event.title && event.date);

    const response = json({
      events,
      source: 'forex-factory',
      fetchedAt: new Date().toISOString(),
    });

    response.headers.set('X-IAMTRADER-Calendar-Cache', 'MISS');
    response.headers.set('X-IAMTRADER-Calendar-Source', 'forex-factory');

    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    console.error('Economic calendar upstream failed:', error);
    return json({
      error: 'Le calendrier économique est temporairement indisponible.',
      source: 'forex-factory',
    }, 502);
  }
}
