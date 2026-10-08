interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  GEMINI_CHLOE_MODEL?: string;
}

type Message = { role: 'user' | 'assistant'; content: string };
type Attachment = { name?: string; mimeType: string; data: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const SYSTEM_INSTRUCTIONS = `
IDENTITE
Tu es Chloé, l'intelligence opérationnelle privée d'IAMTRADER dans l'application authentifiée.

MISSION
Tu aides le trader à comprendre ses propres données, son journal, ses comptes et l'interface IAMTRADER. Tu peux analyser des images, captures de trading, PDF et audio lorsqu'ils sont fournis. Tu peux préparer des actions dans l'application.

IMPORTANT
- Les données fournies dans USER CONTEXT sont les seules données privées auxquelles tu as accès.
- Ne prétends jamais voir l'écran, le navigateur ou une donnée qui n'est pas réellement fournie.
- Ne demande jamais de mot de passe, clé API, token ou secret.
- Ne donne pas de garantie de rendement ni de signal BUY/SELL présenté comme certain.
- Distingue toujours observation, calcul, interprétation et incertitude.
- Pour une action d'écriture, prépare une action structurée uniquement lorsque les informations sont suffisamment fiables.
- Une action create_trade doit être confirmée par l'utilisateur avant son exécution.
- N'invente jamais une valeur absente d'une capture ou d'un document. Si une valeur est illisible, demande-la.

CAPACITES
1. Lire et interpréter le contexte de compte, journal, statistiques et page courante fourni par l'application.
2. Analyser une capture MT5/TradingView et extraire les données visibles d'un trade.
3. Analyser des documents et fichiers multimédias transmis.
4. Comprendre une demande vocale transmise sous forme audio.
5. Préparer l'enregistrement d'un trade dans le journal.
6. Répondre comme une intelligence native de la plateforme, pas comme une FAQ publique.

ACTION FORMAT
Réponds TOUJOURS avec un JSON valide, sans markdown autour :
{
  "reply": "réponse destinée à l'utilisateur",
  "action": null | {
    "type": "create_trade",
    "confidence": 0.0,
    "reason": "courte justification",
    "trade": {
      "accountId": "",
      "symbol": "",
      "direction": "BUY" | "SELL",
      "entryDate": "",
      "exitDate": "",
      "entryPrice": null,
      "exitPrice": null,
      "stopLoss": null,
      "takeProfit": null,
      "commission": null,
      "positionSize": null,
      "setup": "",
      "timeframe": "",
      "emotion": "",
      "notes": ""
    }
  }
}
Si aucune action n'est nécessaire, action doit être null.
Ne crée une action que si les données nécessaires sont réellement présentes.
`;

export async function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'POST, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (context.request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const apiKey = context.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return json({ error: 'Assistant IA non configuré sur le serveur.' }, 500);

  let body: {
    messages?: Message[];
    userContext?: unknown;
    attachments?: Attachment[];
  };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-16)
        .map(m => ({ role: m.role, content: m.content.trim().slice(0, 6000) }))
        .filter(m => m.content)
    : [];

  while (messages.length && messages[0].role === 'assistant') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return json({ error: 'Message utilisateur requis.' }, 400);
  }

  const contextText = JSON.stringify(body.userContext ?? {}, null, 2).slice(0, 60000);
  const parts: Array<Record<string, unknown>> = [
    { text: `USER CONTEXT\n${contextText}\n\nCONVERSATION\n` },
  ];

  for (const message of messages) {
    parts.push({ text: `${message.role === 'user' ? 'USER' : 'ASSISTANT'}: ${message.content}` });
  }

  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 5) : [];
  for (const file of attachments) {
    if (!file?.mimeType || typeof file.data !== 'string') continue;
    const cleanData = file.data.includes(',') ? file.data.split(',').pop() : file.data;
    if (!cleanData) continue;
    parts.push({ text: `FICHIER FOURNI: ${file.name || 'fichier'} (${file.mimeType})` });
    parts.push({ inlineData: { mimeType: file.mimeType, data: cleanData } });
  }

  const model = (context.env.GEMINI_CHLOE_MODEL || context.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      }
    );

    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}

    if (!response.ok) {
      console.error('Chloe Gemini API error:', { status: response.status, model, response: raw.slice(0, 3000) });
      return json({ error: 'Chloé ne peut pas répondre pour le moment.', details: { status: response.status, model } }, 502);
    }

    const output = data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text || '')
      .filter(Boolean)
      .join('\n') || '';

    if (!output.trim()) return json({ error: 'La réponse de Chloé est vide.' }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(output);
    } catch {
      parsed = { reply: output.trim(), action: null };
    }

    return json({
      reply: typeof parsed.reply === 'string' ? parsed.reply : 'Je n’ai pas pu formuler une réponse exploitable.',
      action: parsed.action ?? null,
    });
  } catch (error) {
    console.error('Chloe fetch failed:', error);
    return json({ error: 'Le service IA n’a pas pu répondre pour le moment.' }, 502);
  }
}
