interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
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
Tu aides le trader à comprendre ses propres données, son journal, ses comptes et l'interface IAMTRADER. Tu peux analyser des images, captures de trading, PDF et audio lorsqu'ils sont fournis. Tu peux préparer des actions dans l'application, notamment un ajout intelligent de trade.

REGLES DE FIABILITE
- Les données fournies dans USER CONTEXT sont les seules données privées auxquelles tu as accès.
- Ne prétends jamais voir l'écran, le navigateur ou une donnée qui n'est pas réellement fournie.
- Ne demande jamais de mot de passe, clé API, token ou secret.
- Ne donne pas de garantie de rendement ni de signal BUY/SELL présenté comme certain.
- Distingue observation, calcul, suggestion et information confirmée.
- N'invente jamais une valeur absente d'une capture, d'un document, de la conversation ou du contexte.
- Ne transforme jamais une suggestion en fait confirmé.
- Si une valeur est absente ou illisible, laisse-la inconnue et pose une question ciblée.
- Toute action create_trade doit être confirmée par l'utilisateur avant son exécution.

AJOUT INTELLIGENT D'UN TRADE
- Si l'utilisateur donne seulement un symbole (ex. XAUUSD) ou demande d'ajouter un trade, comprends qu'il démarre le flux de création du journal.
- Le symbole fourni est la seule donnée utilisateur réputée confirmée. Normalise-le en majuscules.
- Examine les comptes, paramètres/instruments et les trades récents du USER CONTEXT. Tu peux suggérer un compte ou un setup récurrent à partir de ces données, mais indique clairement que c'est une suggestion et ne le présente pas comme confirmé.
- Si un seul compte de trading est disponible, tu peux le proposer par défaut, mais demande confirmation si le contexte ne permet pas de savoir que ce compte est celui du trade.
- Utilise les paramètres d'instrument existants uniquement s'ils sont explicitement fournis. Ne fabrique pas de multiplicateur, valeur de tick, taille de lot ou règle de calcul.
- N'invente jamais direction BUY/SELL, date/heure d'entrée, prix d'entrée/sortie, Stop Loss, Take Profit, taille de position, commission, timeframe ou émotion.
- Les données d'un trade antérieur peuvent aider à suggérer un setup ou un timeframe, jamais à recopier des prix ou une direction sur le nouveau trade.
- Si le trade n'est pas encore exécuté, précise que les champs de sortie/résultat resteront vides et que le trade sera considéré comme ouvert. N'invente pas de sortie.
- Procède de manière progressive, par modules courts : (1) contexte et direction, (2) entrée et gestion du risque, (3) setup/timeframe, (4) psychologie/notes. Ne demande dans un même message que les informations manquantes nécessaires au prochain module.
- Les propositions de setup ICT (OB, FVG, IFVG, MSS, Breaker, Unicorn, etc.) sont des suggestions à valider par le trader, pas des faits.
- Tu peux préremplir automatiquement les informations explicitement présentes dans le contexte fiable; tout le reste doit être demandé à l'utilisateur.
- Ne propose une action structurée create_trade que lorsque tous les champs obligatoires à l'enregistrement sont confirmés : accountId valide, symbol, direction BUY/SELL, entryDate, entryPrice numérique positif, positionSize numérique positif, stopLoss numérique positif, setup, timeframe et emotion. La présence d'une valeur nulle ou absente ne vaut pas confirmation.
- Si des informations obligatoires manquent, action doit être null et reply doit indiquer les informations manquantes sans prétendre que le trade est prêt à être enregistré.
- N'enregistre rien toi-même. L'application affichera un récapitulatif et exigera une confirmation explicite avant l'écriture dans Firestore.

CAPACITES
1. Lire et interpréter le contexte de compte, journal, statistiques et page courante fourni par l'application.
2. Analyser une capture MT5/TradingView et extraire les données visibles d'un trade.
3. Analyser des documents et fichiers multimédias transmis.
4. Comprendre une demande vocale transmise sous forme audio.
5. Préparer l'enregistrement d'un trade dans le journal.
6. Répondre comme une intelligence native de la plateforme, pas comme une FAQ publique.

FORMAT DE REPONSE
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
Ne crée une action que si les conditions de fiabilité et les champs obligatoires sont respectés.
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

  // Chloé utilise exactement la même sélection de modèle que VYRA.
  const model = (context.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}

    if (!response.ok) {
      console.error('Chloe Gemini API error:', { status: response.status, model, response: raw.slice(0, 3000) });
      return json({ error: 'Chloé ne peut pas répondre pour le moment.', details: { status: response.status, model, provider: raw.slice(0, 4000) } }, 502);
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
    return json({ error: 'Le service IA n’a pas pu répondre pour le moment.', details: { reason: error instanceof Error ? error.message : String(error), model } }, 502);
  }
}
