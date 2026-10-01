interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
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

  const model = (context.env.OPENAI_MODEL || 'gpt-5.6-luna').trim();
  const apiKey = context.env.OPENAI_API_KEY.trim();

  const input = safeMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: SYSTEM_INSTRUCTIONS,
        input,
        max_output_tokens: 700,
      }),
    });
  } catch (error) {
    console.error('OpenAI fetch failed:', error);
    return json(
      {
        error: 'Le service IA n’a pas pu répondre pour le moment.',
        details: {
          reason: 'fetch_failed',
          model,
          keyPresent: Boolean(apiKey),
        },
      },
      502
    );
  }

  const responseText = await response.text();

  let data: unknown = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    let providerError: {
      message?: unknown;
      type?: unknown;
      code?: unknown;
      param?: unknown;
    } | undefined;

    try {
      const parsed = JSON.parse(responseText) as { error?: typeof providerError };
      providerError = parsed.error;
    } catch {
      // Keep the raw provider response when it is not JSON.
    }

    console.error('OpenAI API error:', {
      status: response.status,
      model,
      code: providerError?.code,
      type: providerError?.type,
      message: providerError?.message,
      param: providerError?.param,
      rawResponse: responseText.slice(0, 4000),
    });

    return json(
      {
        error: 'Le service IA n’a pas pu répondre pour le moment.',
        details: {
          httpStatus: response.status,
          model,
          code: providerError?.code,
          type: providerError?.type,
          message: providerError?.message,
          param: providerError?.param,
          rawResponse: responseText.slice(0, 4000),
        },
      },
      502
    );
  }

  const parsed = JSON.parse(responseText) as {
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const outputText =
    parsed.output
      ?.filter((item) => item.type === 'message')
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n') || '';

  if (!outputText.trim()) {
    return json({ error: 'La réponse de l’assistant est vide.' }, 502);
  }

  return json({ reply: outputText.trim() });
}
