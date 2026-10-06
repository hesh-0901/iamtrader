import { firestoreCreate, firestorePatch, firestoreQueryCollection } from './firebaseAdmin';

interface InboundEmailEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_API_KEY?: string;
}

function decodeQuotedPrintable(value: string, charset = 'utf-8'): string {
  try {
    const softWrapped = value.replace(/=\r?\n/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < softWrapped.length; i += 1) {
      if (softWrapped[i] === '=' && /^[0-9A-F]{2}$/i.test(softWrapped.slice(i + 1, i + 3))) {
        bytes.push(parseInt(softWrapped.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        const code = softWrapped.charCodeAt(i);
        if (code <= 0x7f) bytes.push(code);
        else bytes.push(...new TextEncoder().encode(softWrapped[i]));
      }
    }
    return new TextDecoder(charset || 'utf-8').decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

function decodeTransferEncoding(value: string, encoding: string, charset = 'utf-8'): string {
  const normalized = encoding.toLowerCase().trim();
  if (normalized === 'base64') {
    try {
      return new TextDecoder(charset || 'utf-8').decode(Uint8Array.from(atob(value.replace(/\s+/g, '')), c => c.charCodeAt(0)));
    } catch {
      return value;
    }
  }
  if (normalized === 'quoted-printable') return decodeQuotedPrintable(value, charset);
  return value;
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&#039;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeMimeHeader(value: string): string {
  return value.replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_, charset, encoding, encoded) => {
    try {
      if (String(encoding).toLowerCase() === 'b') {
        const bytes = Uint8Array.from(atob(String(encoded).replace(/\s+/g, '')), c => c.charCodeAt(0));
        return new TextDecoder(String(charset || 'utf-8')).decode(bytes);
      }
      const bytes = String(encoded).replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      return new TextDecoder(String(charset || 'utf-8')).decode(new Uint8Array([...bytes].map(char => char.charCodeAt(0))));
    } catch {
      return String(encoded);
    }
  });
}

function headerValue(headers: string, name: string): string {
  const match = headers.match(new RegExp('^' + name + ':\\s*(.*(?:\\r?\\n[ \\t]+.*)*)$', 'im'));
  return match ? decodeMimeHeader(match[1].replace(/\r?\n[ \t]+/g, ' ').trim()) : '';
}

function cleanReplyBody(value: string): string {
  let text = value.replace(/\r/g, '').trim();
  text = text.replace(/\n(?:On .+?wrote:|Le .+?(?:a écrit\s*:|\na écrit\s*:))[\s\S]*$/i, '');
  text = text.split('\n').filter(line => !/^\s*>/.test(line)).join('\n');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function extractBody(raw: string): string {
  const separator = raw.search(/\r?\n\r?\n/);
  if (separator < 0) return raw.trim();
  const headerBlock = raw.slice(0, separator);
  const body = raw.slice(separator).replace(/^\r?\n\r?\n/, '');

  const contentType = headerValue(headerBlock, 'Content-Type');
  const charsetMatch = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i);
  const charset = charsetMatch?.[1] || 'utf-8';
  const transferEncoding = headerValue(headerBlock, 'Content-Transfer-Encoding');
  const boundaryMatch = contentType.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);

  if (!boundaryMatch) {
    if (/text\/html/i.test(contentType)) return stripHtml(decodeTransferEncoding(body, transferEncoding, charset));
    return decodeTransferEncoding(body, transferEncoding, charset).trim();
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const escapedBoundary = boundary.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const parts = body.split(new RegExp('--' + escapedBoundary + '(?:--)?\\r?\\n?'));
  let htmlPart = '';

  for (const part of parts) {
    const partSeparator = part.search(/\r?\n\r?\n/);
    if (partSeparator < 0) continue;
    const partHeaders = part.slice(0, partSeparator);
    const partBody = part.slice(partSeparator).replace(/^\r?\n\r?\n/, '');
    const partType = headerValue(partHeaders, 'Content-Type');
    const partEncoding = headerValue(partHeaders, 'Content-Transfer-Encoding');
    const partCharsetMatch = partType.match(/charset\s*=\s*["']?([^;"'\s]+)/i);
    const partCharset = partCharsetMatch?.[1] || 'utf-8';
    const decoded = decodeTransferEncoding(partBody, partEncoding, partCharset).trim();

    if (/text\/plain/i.test(partType) && decoded) return decoded;
    if (/text\/html/i.test(partType) && decoded) htmlPart = decoded;
  }

  return stripHtml(htmlPart);
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/gi, '').trim().toLowerCase();
}

function extractEmail(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim().toLowerCase();
}

export async function handleInboundEmail(
  message: { from: string; to: string; headers: Headers; raw: ReadableStream; forward: (recipient: string) => Promise<unknown> },
  env: InboundEmailEnv,
): Promise<void> {
  const subject = message.headers.get('subject') || '(Sans objet)';
  const messageId = message.headers.get('message-id') || '';
  const inReplyTo = message.headers.get('in-reply-to') || '';
  const references = message.headers.get('references') || '';
  const receivedAt = new Date().toISOString();
  const senderEmail = extractEmail(message.from);
  const raw = await new Response(message.raw).text();
  const messageText = cleanReplyBody(extractBody(raw)).slice(0, 30000);

  try {
    const existing = await firestoreQueryCollection(env, 'contactMessages', 200, 'createdAt');
    const matching = existing.find(item => {
      const itemEmail = String(item.email || '').trim().toLowerCase();
      if (itemEmail !== senderEmail) return false;
      const itemSubject = normalizeSubject(String(item.subject || ''));
      const sameSubject = itemSubject === normalizeSubject(subject);
      const ids = Array.isArray(item.conversation)
        ? item.conversation.flatMap((entry: any) => [entry?.messageId, entry?.id]).filter(Boolean).map(String)
        : [];
      const referencesMatch = [messageId, inReplyTo, ...references.split(/\s+/).filter(Boolean)].some(id => ids.includes(id));
      return referencesMatch || sameSubject;
    });

    const inboundEntry = {
      id: 'inbound-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8),
      direction: 'inbound',
      body: messageText || '(Message sans contenu textuel)',
      at: receivedAt,
      from: senderEmail,
      to: message.to,
      messageId,
      inReplyTo,
      references,
    };

    if (matching?.id) {
      const existingConversation = Array.isArray(matching.conversation) && matching.conversation.length
        ? matching.conversation
        : [{
            id: 'legacy-inbound',
            direction: 'inbound',
            body: String(matching.message || ''),
            at: String(matching.createdAt || receivedAt),
            from: String(matching.email || senderEmail),
            to: message.to,
          }, ...(matching.lastReply ? [{
            id: 'legacy-last-reply',
            direction: matching.repliedBy ? 'outbound' : 'inbound',
            body: String(matching.lastReply),
            at: String(matching.repliedAt || matching.updatedAt || receivedAt),
            from: matching.repliedBy ? 'hello@iamtrader.trade' : String(matching.email || senderEmail),
            to: matching.repliedBy ? String(matching.email || senderEmail) : message.to,
          }] : [])];

      const conversation = [...existingConversation, inboundEntry];
      await firestorePatch(env, 'contactMessages/' + encodeURIComponent(String(matching.id)), {
        status: 'new',
        updatedAt: receivedAt,
        lastReply: messageText,
        repliedAt: receivedAt,
        conversation,
        inboundMessageId: messageId,
        inboundInReplyTo: inReplyTo,
        inboundReferences: references,
        lastInboundFrom: message.from,
      }, ['status','updatedAt','lastReply','repliedAt','conversation','inboundMessageId','inboundInReplyTo','inboundReferences','lastInboundFrom']);
    } else {
      const id = 'inbound-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8);
      await firestoreCreate(env, 'contactMessages', id, {
        id,
        name: decodeMimeHeader(message.from.replace(/\s*<[^>]+>/, '').trim()) || senderEmail,
        email: senderEmail,
        subject,
        message: messageText || '(Message sans contenu textuel)',
        status: 'new',
        createdAt: receivedAt,
        updatedAt: receivedAt,
        conversation: [inboundEntry],
        inboundMessageId: messageId,
        inboundInReplyTo: inReplyTo,
        inboundReferences: references,
        source: 'inbound-email',
      });
    }
  } catch (error) {
    console.error('IAMTRADER inbound email storage failed:', error);
  }

  await message.forward('henochshungu@gmail.com');
}
