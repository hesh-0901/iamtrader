import { verifyFirebaseIdToken, firestoreGet, firestoreSet } from '../../worker/firebaseAdmin';
import { buildIamtraderEmail, sanitizeRichHtml } from '../_shared/iamtraderEmail';

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const authorization = context.request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Authentification requise.' }, 401);

  let identity: { uid: string };
  let profile: Record<string, unknown> | null;
  try {
    identity = await verifyFirebaseIdToken(context.env as any, authorization.slice(7));
    profile = await firestoreGet(context.env as any, `users/${encodeURIComponent(identity.uid)}`);
  } catch {
    return json({ error: 'Jeton Firebase invalide ou expiré.' }, 401);
  }
  if (!profile || profile.role !== 'admin' || profile.status === 'suspended') return json({ error: 'Accès administrateur requis.' }, 403);

  let body: { action?: string; id?: string; to?: string; subject?: string; message?: string; messageHtml?: string; cc?: string; attachments?: Array<{ filename?: string; content?: string }> };
  try { body = await context.request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const action = body.action === 'draft' ? 'draft' : body.action === 'send' ? 'send' : '';
  const id = String(body.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  const toList = String(body.to || '').split(/[;,\\s]+/).map(value => value.trim().toLowerCase()).filter(Boolean);
  const ccList = String(body.cc || '').split(/[;,\\s]+/).map(value => value.trim().toLowerCase()).filter(Boolean);
  const to = toList[0] || '';
  const subject = String(body.subject || '').trim().slice(0, 200);
  const message = String(body.message || '').trim();
  const messageHtml = String(body.messageHtml || '');
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!action || !id) return json({ error: 'Action ou identifiant invalide.' }, 400);
  const existing = await firestoreGet(context.env as any, `contactMessages/${encodeURIComponent(id)}`);
  if (existing && (existing.source !== 'admin-compose' || existing.status !== 'draft')) {
    return json({ error: 'Ce message ne peut pas être modifié depuis la composition.' }, 403);
  }
  if (action === 'draft') {
    if (to && !validEmail(to)) return json({ error: 'Adresse e-mail invalide.' }, 400);
    if (message.length > 30000) return json({ error: 'Le brouillon est trop long.' }, 400);
    const now = new Date().toISOString();
    const record = {
      id, name: to, email: to, to, cc: String(body.cc || '').trim(), subject, message, messageHtml: sanitizeRichHtml(messageHtml), status: 'draft', folder: 'drafts',
      source: 'admin-compose', updatedAt: now, createdAt: String(existing?.createdAt || now),
      conversation: Array.isArray(existing?.conversation) ? existing.conversation : []
    };
    await firestoreSet(context.env as any, `contactMessages/${encodeURIComponent(id)}`, record);
    return json({ success: true, id, savedAt: now });
  }

  if (!toList.length || toList.some(value => !validEmail(value)) || ccList.some(value => !validEmail(value)) || new Set([...toList,...ccList]).size !== toList.length + ccList.length || !subject || !message) return json({ error: 'Destinataire, sujet et message sont obligatoires.' }, 400);
  if (message.length > 10000) return json({ error: 'Le message dépasse 10 000 caractères.' }, 400);
  const attachmentBytes = attachments.reduce((sum, file) => sum + Math.floor(String(file.content || '').length * 0.75), 0);
  if (attachments.length > 10 || attachmentBytes > 8 * 1024 * 1024 || attachments.some(file => !file.filename || !/^[a-zA-Z0-9._ -]{1,120}$/.test(file.filename) || !file.content || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.content))) return json({ error: 'Pièces jointes invalides ou trop volumineuses (10 fichiers, 8 Mo au total maximum).' }, 400);

  const apiKey = String(context.env.RESEND_API_KEY || '').trim();
  const configuredFrom = String(context.env.RESEND_FROM_EMAIL || '').trim();
  const senderAddress = (configuredFrom.match(/<([^<>]+)>/)?.[1] || configuredFrom).trim();
  const from = `Iamtrader team <${senderAddress}>`;
  const replyTo = String(context.env.RESEND_REPLY_TO || senderAddress).trim();
  if (!apiKey || !senderAddress) return json({ error: 'Configuration e-mail du serveur incomplète.' }, 500);

  const safeMessageHtml = sanitizeRichHtml(messageHtml);
  const html = buildIamtraderEmail(message, 'new-message', safeMessageHtml);
  const text = `${message}\n\n—\nIamtrader team\nle trader que vous devez être !\nhello@iamtrader.trade\niamtrader.trade`;
  let sent: Response;
  let payload: { id?: string } = {};
  try {
    sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: toList, ...(ccList.length ? { cc: ccList } : {}), subject, html, text, ...(attachments.length ? { attachments } : {}), ...(replyTo ? { reply_to: replyTo } : {}) })
    });
    payload = await sent.json().catch(() => ({}));
  } catch {
    return json({ error: 'Impossible de joindre le service e-mail.' }, 502);
  }
  if (!sent.ok) return json({ error: 'Resend a refusé l’envoi.', details: payload }, 502);

  const now = new Date().toISOString();
  const sentId = String(payload.id || id);
  const entry = { id: 'outbound-' + crypto.randomUUID(), direction: 'outbound', body: message, bodyHtml: safeMessageHtml, at: now, from: senderAddress, to: toList.join(', '), cc: ccList.join(', '), resendId: sentId };
  try {
    await firestoreSet(context.env as any, `contactMessages/${encodeURIComponent(id)}`, {
      id, name: toList.join(', '), email: toList.join(', '), to: toList.join(', '), cc: ccList.join(', '), subject, message, messageHtml: safeMessageHtml, status: 'resolved', folder: 'sent',
      source: 'admin-compose', createdAt: now, updatedAt: now, repliedAt: now, repliedBy: identity.uid,
      conversation: [entry], resendId: sentId
    });
  } catch (error) {
    console.error('IAMTRADER sent email history persistence failed:', error);
    return json({ success: true, sent: true, historySaved: false, id, warning: 'E-mail envoyé, mais son archivage dans la boîte a échoué.' });
  }
  return json({ success: true, sent: true, historySaved: true, id, resendId: sentId });
}
