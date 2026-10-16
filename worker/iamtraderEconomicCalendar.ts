import { callGeminiUnified } from '../functions/api/common/gemini-client';
import { firestoreQueryCollection, firestoreSet, type PaymentEnv } from './firebaseAdmin';

type CalendarEnv = PaymentEnv & { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };
type OfficialSource = { name: string; url: string; text: string };
let lastGenerationDiagnostic = 'not-run';
type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  timezone: string;
  currency: string;
  event: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  actual: string;
  forecast: string;
  previous: string;
  status: 'scheduled' | 'released' | 'time-unconfirmed';
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  aiSummary: string;
};

const COLLECTION = 'iamtraderEconomicCalendar';
const META_PATH = 'iamtraderEconomicCalendarMeta/refresh';
const MAX_SOURCE_CHARS = 40000;
const OFFICIAL_SOURCES = [
  { name: 'US Bureau of Labor Statistics', url: 'https://www.bls.gov/schedule/news_release/' },
  { name: 'US Bureau of Economic Analysis', url: 'https://www.bea.gov/news/schedule' },
  { name: 'US Census Bureau economic indicators', url: 'https://www.census.gov/economic-indicators/' },
  { name: 'US Department of Labor weekly unemployment claims', url: 'https://www.dol.gov/ui/data.pdf' },
  { name: 'Eurostat release calendar', url: 'https://ec.europa.eu/eurostat/news/release-calendar' },
  { name: 'Federal Reserve FOMC calendars', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' },
  { name: 'European Central Bank press calendar', url: 'https://www.ecb.europa.eu/press/calendars/html/index.en.html' },
  { name: 'Bank of England monetary policy dates', url: 'https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes' },
  { name: 'Statistics Canada release dates', url: 'https://www.statcan.gc.ca/en/subjects-start/economic_accounts' },
];

function json(data: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

function stripHtml(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readOfficialSource(source: { name: string; url: string }): Promise<OfficialSource | null> {
  try {
    const response = await fetch(source.url, {
      headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'User-Agent': 'IAMTRADER Economic Calendar/1.0 (+https://iamtrader.trade)' },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) {
      console.warn('[IAMTRADERCalendar] Official source unavailable', source.name, response.status);
      return null;
    }
    const text = stripHtml(await response.text()).slice(0, MAX_SOURCE_CHARS);
    return text.length > 100 ? { ...source, text } : null;
  } catch (error) {
    console.warn('[IAMTRADERCalendar] Official source request failed', source.name, error instanceof Error ? error.message : String(error));
    return null;
  }
}

function normalizeEvent(raw: Record<string, unknown>, sources: OfficialSource[], now: string): CalendarEvent | null {
  const date = String(raw.date || '').trim();
  const event = String(raw.event || raw.title || '').trim().slice(0, 180);
  const sourceUrl = String(raw.sourceUrl || '').trim();
  const source = sources.find(item => item.url === sourceUrl);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !event || !source) return null;
  const parsedDate = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
  // Require date evidence in the exact official page used as the event citation.
  // Gemini may organize source material, but it may not invent a release date.
  const sourceEvidence = source.text.toLowerCase().replace(/\s+/g, ' ');
  const monthLong = parsedDate.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }).toLowerCase();
  const monthShort = parsedDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toLowerCase();
  const day = String(parsedDate.getUTCDate());
  const year = String(parsedDate.getUTCFullYear());
  const monthNumber = String(parsedDate.getUTCMonth() + 1);
  const paddedMonth = monthNumber.padStart(2, '0');
  const paddedDay = day.padStart(2, '0');
  const dateFormats = [
    date,
    `${monthLong} ${day}, ${year}`,
    `${monthShort} ${day}, ${year}`,
    `${day} ${monthLong} ${year}`,
    `${monthNumber}/${day}/${year}`,
    `${paddedMonth}/${paddedDay}/${year}`,
    `${year}-${paddedMonth}-${paddedDay}`,
  ];
  const explicitDate = dateFormats.some(format => sourceEvidence.includes(format.toLowerCase()));
  // Many official release calendars group dates under a year heading and show
  // only “October 16” in each row. Accept that format only when the same source
  // also explicitly contains the event year.
  const monthDay = [`${monthLong} ${day}`, `${monthShort} ${day}`, `${monthLong} ${day},`, `${monthShort} ${day},`];
  const dayMonth = [`${day} ${monthLong}`, `${day} ${monthShort}`, `${day} ${monthLong},`, `${day} ${monthShort},`];
  const yearIsPresent = sourceEvidence.includes(year);
  if (!explicitDate && !(yearIsPresent && [...monthDay, ...dayMonth].some(format => sourceEvidence.includes(format)))) return null;
  const nowDate = new Date(now.slice(0, 10) + 'T00:00:00Z');
  const maxDate = new Date(nowDate);
  maxDate.setUTCDate(maxDate.getUTCDate() + 60);
  const minDate = new Date(nowDate);
  minDate.setUTCDate(minDate.getUTCDate() - 7);
  if (parsedDate < minDate || parsedDate > maxDate) return null;

  const currencyRaw = String(raw.currency || '').toUpperCase().trim();
  const allowedCurrencies = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF', 'CNY', 'INR', 'ZAR']);
  const currency = allowedCurrencies.has(currencyRaw) ? currencyRaw : '—';
  const timeRaw = String(raw.time || '').trim();
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeRaw) ? timeRaw : '—';
  const impactRaw = String(raw.impact || '').toLowerCase();
  const impact: CalendarEvent['impact'] = impactRaw === 'high' ? 'high' : impactRaw === 'medium' ? 'medium' : 'low';
  const slug = event.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  // Never publish an AI-generated numeric value unless the cited source text
  // contains that value verbatim. Missing or ambiguous values remain blank.
  const sourceBackedValue = (value: unknown) => {
    const candidate = String(value ?? '').trim();
    return candidate && sourceEvidence.includes(candidate.toLowerCase()) ? candidate : '';
  };
  const actual = sourceBackedValue(raw.actual);
  const forecast = sourceBackedValue(raw.forecast);
  const previous = sourceBackedValue(raw.previous);
  const status: CalendarEvent['status'] = actual ? 'released' : time === '—' ? 'time-unconfirmed' : 'scheduled';

  return {
    id: String(raw.id || [date, currency, slug].join('-')),
    date,
    time,
    timezone: String(raw.timezone || 'source-local').slice(0, 40),
    currency,
    event,
    category: String(raw.category || 'macroéconomie').slice(0, 80),
    impact,
    actual,
    forecast,
    previous,
    status,
    sourceName: source.name,
    sourceUrl,
    verifiedAt: now,
    aiSummary: String(raw.aiSummary || '').trim().slice(0, 500),
  };
}

async function generateCalendar(eventsFrom: OfficialSource[], env: CalendarEnv): Promise<CalendarEvent[]> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) { lastGenerationDiagnostic = 'missing-GEMINI_API_KEY'; return []; }
  if (eventsFrom.length === 0) { lastGenerationDiagnostic = 'no-official-sources-fetched'; return []; }
  const today = new Date().toISOString().slice(0, 10);
  const sourcePack = eventsFrom.map(source => ({
    sourceName: source.name,
    sourceUrl: source.url,
    content: source.text,
  }));
  const result = await callGeminiUnified(JSON.stringify({
    today,
    horizonDays: 60,
    sources: sourcePack,
  }), {
    apiKey,
    preferredModel: env.GEMINI_MODEL || 'gemini-3.8-flash',
    fallbackModels: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
    temperature: 0.1,
    maxTokens: 7000,
    timeoutMs: 18000,
    responseJson: true,
    systemInstruction: [
      'You are the research and structuring engine for IAMTRADER, an independent economic calendar.',
      'Extract only economic events and publication dates explicitly supported by the supplied official-source text.',
      'Never mirror any single third-party calendar and never invent a date, time, actual, forecast, previous value, or source URL.',
      'Every event must cite exactly one sourceUrl copied from the supplied sources. If the text does not explicitly support a date, omit the event.',
      'Use ISO dates YYYY-MM-DD. Use HH:mm only if the source explicitly states a time; otherwise time="—" and timezone="source-local".',
      'Set actual/forecast/previous to empty strings unless that exact value is present in the supplied source text. Do not calculate or infer these values.',
      'Impact is an editorial estimate based on typical market relevance, not a source fact. Use high/medium/low.',
      'currency must be a currency code if clear from the source; otherwise "—".',
      'Return JSON only in this schema: {"events":[{"date":"YYYY-MM-DD","time":"HH:mm or —","timezone":"IANA zone or source-local","currency":"USD or —","event":"name","category":"inflation|employment|growth|central-bank|trade|energy|other","impact":"high|medium|low","actual":"","forecast":"","previous":"","sourceName":"source name","sourceUrl":"exact supplied URL","aiSummary":"short factual description"}]}.',
      'PRIORITY: extract every relevant event dated from today through the next 10 calendar days first. Do not skip nearer dates in favor of events later in the month. Then include events from days 11–60 if explicitly listed in the source text.',
      'Return events sorted chronologically by date and then time. Include multiple events on the same day when supported by the sources; do not return only central-bank meetings or only a few headline events.',
      'Include recent releases from the last 7 days only when their exact dates are visible in source text. Deduplicate events.',
    ].join('\n'),
  });
  if (!result.success || !result.text) {
    lastGenerationDiagnostic = `gemini-error: ${String(result.error || 'empty response').slice(0, 180)}`;
    console.warn('[IAMTRADERCalendar] AI generation unavailable', result.error || 'empty response');
    return [];
  }
  try {
    const parsed = JSON.parse(result.text) as { events?: Array<Record<string, unknown>> };
    const now = new Date().toISOString();
    const rawEvents = Array.isArray(parsed.events) ? parsed.events : [];
    const normalizedEvents = rawEvents.map(item => normalizeEvent(item, eventsFrom, now)).filter((item): item is CalendarEvent => Boolean(item));
    const seen = new Set<string>();
    const acceptedEvents = normalizedEvents.filter(item => {
        const key = [item.date, item.currency, item.event.toLowerCase()].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    lastGenerationDiagnostic = `gemini-ok; sources=${eventsFrom.length}; raw=${rawEvents.length}; normalized=${normalizedEvents.length}; accepted=${acceptedEvents.length}; rejected=${rawEvents.length - normalizedEvents.length}`;
    return acceptedEvents;
  } catch (error) {
    lastGenerationDiagnostic = `gemini-invalid-json: ${error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160)}`;
    console.warn('[IAMTRADERCalendar] AI returned invalid calendar JSON');
    return [];
  }
}

export async function refreshIamtraderEconomicCalendar(env: CalendarEnv, force = false) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON || !env.GEMINI_API_KEY) {
    return { refreshed: false, reason: 'missing-server-configuration', count: 0 };
  }
  try {
    if (!force) {
      const meta = await firestoreQueryCollection(env, 'iamtraderEconomicCalendarMeta', 5, 'updatedAt');
      const last = meta.find(item => item.id === 'refresh');
      const lastUpdated = String(last?.updatedAt || '');
      const lastCount = Number(last?.count || 0);
      const lastStatus = String(last?.status || '');
      // A previous successful refresh with stored events is throttled for six hours.
      // Empty/failed refreshes must not block retries, otherwise the calendar can
      // remain empty for six hours after a temporary Gemini/source failure.
      if (lastUpdated && lastCount > 0 && lastStatus === 'ok' && Date.now() - new Date(lastUpdated).getTime() < 6 * 60 * 60 * 1000) {
        return { refreshed: false, reason: 'recent-refresh', count: 0 };
      }
    }

    const sources = (await Promise.all(OFFICIAL_SOURCES.map(readOfficialSource)))
      .filter((item): item is OfficialSource => Boolean(item));
    if (!sources.length) return { refreshed: false, reason: 'official-sources-unavailable', count: 0, sourceCount: 0, diagnostic: 'No official source page could be fetched.' };
    const events = await generateCalendar(sources, env);
    if (!events.length) return { refreshed: false, reason: 'no-verified-events-generated', count: 0, sourceCount: sources.length, diagnostic: lastGenerationDiagnostic };

    for (const event of events) {
      await firestoreSet(env, COLLECTION + '/' + encodeURIComponent(event.id), event as unknown as Record<string, unknown>);
    }
    const now = new Date().toISOString();
    await firestoreSet(env, META_PATH, {
      updatedAt: now,
      count: events.length,
      sourceCount: sources.length,
      status: 'ok',
      engine: 'iamtrader-ai-calendar-v1',
    });
    return { refreshed: true, reason: 'ok', count: events.length, sourceCount: sources.length, updatedAt: now };
  } catch (error) {
    console.error('[IAMTRADERCalendar] Refresh failed', error instanceof Error ? error.message : String(error));
    return { refreshed: false, reason: 'persistence-failed', count: 0, diagnostic: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180) };
  }
}

export async function getIamtraderEconomicCalendar(env: CalendarEnv, from: string, to: string) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) return [];
  try {
    const stored = await firestoreQueryCollection(env, COLLECTION, 500, 'date');
    return stored
      .filter(event => {
        const date = String(event.date || '');
        return (!from || date >= from) && (!to || date <= to);
      })
      .map(event => ({
        ...event,
        title: String(event.event || ''),
        name: String(event.event || ''),
        url: String(event.sourceUrl || ''),
      }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)));
  } catch (error) {
    console.warn('[IAMTRADERCalendar] Stored calendar unavailable', error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function handleIamtraderCalendarRefresh(request: Request, env: CalendarEnv) {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== undefined) return json({ error: 'Utilisez le déclencheur planifié interne.' }, 403);
  const result = await refreshIamtraderEconomicCalendar(env, true);
  return json({ success: result.refreshed, ...result }, result.refreshed ? 200 : 503);
}
