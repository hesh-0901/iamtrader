interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
}

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

const SYSTEM_INSTRUCTIONS = `Tu es l’assistant officiel d’IAMTRADER, une plateforme SaaS de gestion et d’analyse de performance pour traders.

Ta mission est d’aider les visiteurs à comprendre IAMTRADER, son journal de trading, ses statistiques, son Trader Score, ses fonctionnalités, ses plans et son fonctionnement général.

Règles :
- Réponds en français, sauf si l’utilisateur demande explicitement une autre langue.
- Sois clair, professionnel, concis et utile.
- Ne prétends jamais avoir accès au compte, aux trades, aux paiements ou aux données privées d’un visiteur.
- Ne fabrique jamais une fonctionnalité, un prix ou une condition qui n’est pas connue.
- Pour les informations commerciales visibles sur le site, utilise le contexte fourni par la plateforme.
- Si une information n’est pas disponible, indique-le clairement et oriente l’utilisateur vers le support humain.
- Pour les questions de trading ou de finance, donne uniquement des informations générales et éducatives ; ne présente pas une réponse comme une recommandation financière personnalisée.
- Si la question concerne un problème de compte, de paiement ou de données personnelles, propose de contacter le support IAMTRADER.`;

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

  if (context.request.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405);
  }

  if (!context.env.GEMINI_API_KEY) {
    return json({ error: 'Assistant IA non configuré sur le serveur.' }, 500);
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];

  const safeMessages = messages
    .filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string'
    )
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 4000),
    }))
    .filter((message) => message.content);

  // Gemini conversation history must start with a user turn.
  // The landing page displays an initial assistant greeting, so discard
  // leading assistant messages before sending the conversation upstream.
  while (safeMessages.length && safeMessages[0].role === 'assistant') {
    safeMessages.shift();
  }

  if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') {
    return json({ error: 'Message utilisateur requis.' }, 400);
  }

  const model = context.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': context.env.GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTIONS }],
        },
        contents: safeMessages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          maxOutputTokens: 700,
        },
      }),
    }
  );

  const responseText = await response.text();

  let data: unknown = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const providerError =
      typeof data === 'object' && data && 'error' in data
        ? (data as { error?: { code?: unknown; status?: unknown; message?: unknown } }).error
        : undefined;

    console.error('Gemini API error:', {
      status: response.status,
      code: providerError?.code,
      providerStatus: providerError?.status,
      message: providerError?.message,
      rawResponse: responseText.slice(0, 4000),
    });

    return json(
      {
        error: 'Le service IA n’a pas pu répondre pour le moment.',
        details: {
          httpStatus: response.status,
          code: providerError?.code,
          status: providerError?.status,
          message: providerError?.message,
          rawResponse: responseText.slice(0, 4000),
        },
      },
      502
    );
  }

  const outputText =
    typeof (data as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }).candidates?.[0]?.content?.parts?.[0]?.text === 'string'
      ? (data as {
          candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
        }).candidates[0].content.parts.map((part) => part.text).join('\n')
      : '';

  if (!outputText.trim()) {
    return json({ error: 'La réponse de l’assistant est vide.' }, 502);
  }

  return json({ reply: outputText.trim() });
}
