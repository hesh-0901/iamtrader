import { getMarketQuote } from './common/market-data';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
    },
  });
}

export async function onRequest({ request }: { request: Request }) {
  if (request.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || '').trim().toUpperCase();
  if (!symbol || symbol.length > 24 || !/^[A-Z0-9._-]+$/.test(symbol)) {
    return json({ error: 'Symbole invalide.' }, 400);
  }
  const quote = await getMarketQuote(symbol);
  if (!quote) {
    return json({
      quote: null,
      unavailable: true,
      message: 'Aucune cotation publique exploitable trouvée pour ce symbole. Vérifiez le symbole ou consultez votre broker.',
    }, 200);
  }
  return json({ quote, unavailable: false });
}
