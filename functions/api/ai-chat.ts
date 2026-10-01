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

export async function onRequestPost(context: { request: Request; env: Env }) {
  if (!context.env.OPENAI_API_KEY) {
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

  if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') {
    return json({ error: 'Message utilisateur requis.' }, 400);
  }

  const model = context.env.OPENAI_MODEL || 'gpt-5.6-luna';

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${context.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input: safeMessages.map((message) => ({
        role: message.role,
        content: [{ type: 'input_text', text: message.content }],
      })),
      max_output_tokens: 700,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return json(
      {
        error: 'Le service IA n’a pas pu répondre pour le moment.',
        details: typeof data === 'object' && data && 'error' in data ? (data as { error?: unknown }).error : undefined,
      },
      502
    );
  }

  const outputText =
    typeof (data as { output_text?: unknown }).output_text === 'string'
      ? (data as { output_text: string }).output_text
      : Array.isArray((data as { output?: unknown[] }).output)
        ? (data as { output: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output
            .flatMap((item) => item.content || [])
            .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
            .map((item) => item.text)
            .join('\n')
        : '';

  if (!outputText.trim()) {
    return json({ error: 'La réponse de l’assistant est vide.' }, 502);
  }

  return json({ reply: outputText.trim() });
}
