type Env = { TWELVE_DATA_API_KEY?: string };
type Context = { request: Request; env: Env };

const intervals: Record<string, string> = {
  M1: "1min",
  M5: "5min",
  M15: "15min",
  M30: "30min",
  H1: "1h",
  H4: "4h",
  D1: "1day",
};
const secondsByInterval: Record<string, number> = {
  M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function onRequestGet({ request, env }: Context): Promise<Response> {
  const apiKey = env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return json({ error: "Le service d’historique n’est pas configuré : la clé Twelve Data doit être ajoutée aux secrets de déploiement." }, 503);
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start") || "";
  const end = url.searchParams.get("end") || "";
  const interval = url.searchParams.get("interval") || "M15";
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(start) || !datePattern.test(end) || start > end) {
    return json({ error: "Dates invalides : indique une période du format AAAA-MM-JJ." }, 400);
  }
  if (!intervals[interval]) {
    return json({ error: "Unité de temps non prise en charge." }, 400);
  }

  const startMs = Date.parse(start + "T00:00:00Z");
  const endMs = Date.parse(end + "T23:59:59Z");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return json({ error: "La période sélectionnée est invalide." }, 400);
  }
  if (endMs > Date.now() + 86400000) {
    return json({ error: "La date de fin ne peut pas être dans le futur." }, 400);
  }

  // Twelve Data limits the number of points returned per request.
  // Reject overlong ranges instead of silently returning incomplete backtests.
  const estimatedBars = Math.ceil((endMs - startMs) / 1000 / secondsByInterval[interval]);
  if (estimatedBars > 4500) {
    return json({
      error: "Cette période est trop longue pour une seule requête (" + estimatedBars.toLocaleString("fr-FR") +
        " bougies estimées). Réduis la période ou choisis une unité de temps supérieure ; le chargement par lots sera ajouté séparément.",
    }, 413);
  }

  const providerUrl = new URL("https://api.twelvedata.com/time_series");
  providerUrl.searchParams.set("symbol", "XAU/USD");
  providerUrl.searchParams.set("interval", intervals[interval]);
  providerUrl.searchParams.set("start_date", start + " 00:00:00");
  providerUrl.searchParams.set("end_date", end + " 23:59:59");
  providerUrl.searchParams.set("timezone", "UTC");
  providerUrl.searchParams.set("order", "ASC");
  providerUrl.searchParams.set("outputsize", "5000");
  providerUrl.searchParams.set("apikey", apiKey);

  try {
    const upstream = await fetch(providerUrl.toString(), {
      headers: { accept: "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    const payload = await upstream.json() as {
      status?: string; message?: string; code?: number;
      values?: Array<{ datetime?: string; open?: string; high?: string; low?: string; close?: string }>;
    };
    if (!upstream.ok || payload.status === "error" || !Array.isArray(payload.values)) {
      const providerMessage = payload.message || "Le fournisseur n’a pas retourné de données OHLC.";
      return json({ error: "Twelve Data : " + providerMessage }, upstream.status === 429 ? 429 : 502);
    }

    const candles = payload.values.map((row) => {
      const time = row.datetime ? Date.parse(row.datetime.replace(" ", "T") + "Z") : NaN;
      return {
        time: Math.floor(time / 1000),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
      };
    }).filter((candle) =>
      Number.isFinite(candle.time) &&
      [candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(value) && value > 0) &&
      candle.high >= candle.low
    ).sort((a, b) => a.time - b.time);

    if (candles.length > 4500) {
      return json({ error: "Le fournisseur a retourné trop de bougies pour cette requête. Réduis la période." }, 413);
    }
    return json({ symbol: "XAU/USD", interval, source: "Twelve Data", candles });
  } catch {
    return json({ error: "Impossible de joindre Twelve Data pour le moment. Réessaie plus tard." }, 502);
  }
}
