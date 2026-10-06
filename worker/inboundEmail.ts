import { firestoreCreate, firestorePatch, firestoreQueryCollection } from './firebaseAdmin';

interface InboundEmailEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_API_KEY?: string;
}

function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeTransferEncoding(value: string, encoding: string): string {
  const normalized = encoding.toLowerCase().trim();
  if (normalized === 'base64') {
    try {
      return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s+/g, '')), c => c.charCodeAt(0)));
    } catch {
      return value;
    }
  }
  if (normalized === 'quoted-printable') return decodeQuotedPrintable(value);
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
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function headerValue(headers: string, name: string): string {
  const match = headers.match(new RegExp('^' + name + ':\\s*(.*(?:\\r?\\n[ \\t]+.*)*)$', 'im'));
  return match ? match[1].replace(/\r?\n[ \t]+/g, ' ').trim() : '';
}

function extractBody(raw: string): string {
  const separator = raw.search(/\r?\n\r?\n/);
  if (separator < 0) return raw.trim();
  const headerBlock = raw.slice(0, separator);
  const body = raw.slice(separator).replace(/^\r?\n\r?\n/, '');

  const contentType = headerValue(headerBlock, 'Content-Type');
  const transferEncoding = headerValue(headerBlock, 'Content-Transfer-Encoding');
  const boundaryMatch = contentType.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);

  if (!boundaryMatch) {
    if (/text\/html/i.test(contentType)) return stripHtml(decodeTransferEncoding(body, transferEncoding));
    return decodeTransferEncoding(body, transferEncoding).trim();
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
    const decoded = decodeTransferEncoding(partBody, partEncoding).trim();

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
  message: ForwardableEmailMessage,
  env: InboundEmailEnv,
): Promise<void> {
  const subject = message.headers.get('subject') || '(Sans objet)';
  const messageId = message.headers.get('message-id') || '';
  const inReplyTo = message.headers.get('in-reply-to') || '';
  const references = message.headers.get('references') || '';
  const receivedAt = new Date().toISOString();
  const senderEmail = extractEmail(message.from);
  const raw = await new Response(message.raw).text();
  const messageText = extractBody(raw).slice(0, 30000);

  try {
    const existing = await firestoreQueryCollection(env, 'contactMessages', 200, 'createdAt');
    const matching = existing.find(item => {
      const itemEmail = String(item.email || '').trim().toLowerCase();
      const itemSubject = normalizeSubject(String(item.subject || ''));
      return itemEmail === senderEmail && itemSubject === normalizeSubject(subject);
    });

    if (matching?.id) {
      await firestorePatch(env, 'contactMessages/' + encodeURIComponent(String(matching.id)), {
        status: 'new',
        updatedAt: receivedAt,
        lastReply: messageText,
        repliedAt: receivedAt,
        inboundMessageId: messageId,
        inboundInReplyTo: inReplyTo,
        inboundReferences: references,
        lastInboundFrom: message.from,
      }, ['status','updatedAt','lastReply','repliedAt','inboundMessageId','inboundInReplyTo','inboundReferences','lastInboundFrom']);
    } else {
      const id = 'inbound-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8);
      await firestoreCreate(env, 'contactMessages', id, {
        id,
        name: message.from.replace(/\s*<[^>]+>/, '').trim() || senderEmail,
        email: senderEmail,
        subject,
        message: messageText || '(Message sans contenu textuel)',
        status: 'new',
        createdAt: receivedAt,
        updatedAt: receivedAt,
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
