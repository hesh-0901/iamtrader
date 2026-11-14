import { verifyFirebaseIdToken, firestoreGet, firestoreSet } from '../../worker/firebaseAdmin';

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
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

  let body: { action?: string; id?: string; to?: string; subject?: string; message?: string };
  try { body = await context.request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const action = body.action === 'draft' ? 'draft' : body.action === 'send' ? 'send' : '';
  const id = String(body.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  const to = String(body.to || '').trim().toLowerCase();
  const subject = String(body.subject || '').trim().slice(0, 200);
  const message = String(body.message || '').trim();

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
      id, name: to, email: to, subject, message, status: 'draft', folder: 'drafts',
      source: 'admin-compose', updatedAt: now, createdAt: String(existing?.createdAt || now),
      conversation: Array.isArray(existing?.conversation) ? existing.conversation : []
    };
    await firestoreSet(context.env as any, `contactMessages/${encodeURIComponent(id)}`, record);
    return json({ success: true, id, savedAt: now });
  }

  if (!validEmail(to) || !subject || !message) return json({ error: 'Destinataire, sujet et message sont obligatoires.' }, 400);
  if (message.length > 10000) return json({ error: 'Le message dépasse 10 000 caractères.' }, 400);

  const apiKey = String(context.env.RESEND_API_KEY || '').trim();
  const configuredFrom = String(context.env.RESEND_FROM_EMAIL || '').trim();
  const senderAddress = (configuredFrom.match(/<([^<>]+)>/)?.[1] || configuredFrom).trim();
  const from = `Iamtrader team <${senderAddress}>`;
  const replyTo = String(context.env.RESEND_REPLY_TO || senderAddress).trim();
  if (!apiKey || !senderAddress) return json({ error: 'Configuration e-mail du serveur incomplète.' }, 500);

  const html = `<div style="margin:0;padding:28px 14px;background:#f1f7f5;font-family:Arial,Helvetica,sans-serif;color:#18352f">
  <div style="max-width:640px;margin:0 auto;overflow:hidden;background:#ffffff;border:1px solid #dcebe5;border-radius:14px">
    <div style="height:5px;background:linear-gradient(90deg,#00b889 0%,#42d6aa 55%,#dffaf0 100%);font-size:0;line-height:0">&nbsp;</div>
    <div style="padding:30px 34px 25px;background:linear-gradient(120deg,#e6fff5 0%,#ffffff 76%,#f4fcf8 100%)">
      <img src="https://iamtrader.trade/brand/logo-iamtrader-full.png" alt="IAMTRADER" width="196" style="display:block;width:196px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;filter:contrast(1.18) saturate(1.12)">
      <div style="margin-top:19px;color:#008d6c;font-size:11px;font-weight:700;letter-spacing:1.35px;line-height:1.7;text-transform:uppercase">Journal de trading&nbsp; · &nbsp;Outils de performance&nbsp; · &nbsp;Communauté</div>
    </div>
    <div style="padding:30px 34px 30px;background:#ffffff">
      <div style="font-size:15px;line-height:1.85;color:#263f38;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(message)}</div>
      <div style="margin-top:30px;padding-top:21px;border-top:1px solid #e3eee9">
        <div style="font-size:14px;font-weight:700;color:#087f63">Iamtrader team</div>
        <div style="margin-top:8px;font-size:15px;font-weight:700;line-height:1.5;color:#174d3e">Le trader que vous devez être !</div>
        <div style="margin-top:13px;font-size:12px;line-height:1.9;color:#647d73">
          <a href="mailto:hello@iamtrader.trade" style="color:#009d78;text-decoration:none">hello@iamtrader.trade</a>
          <span style="color:#a0b7ae">&nbsp; · &nbsp;</span>
          <a href="https://iamtrader.trade" style="color:#009d78;text-decoration:none">iamtrader.trade</a>
        </div>
      </div>
    </div>
    <div style="padding:15px 22px;background:#f4fbf8;border-top:1px solid #e3eee9;text-align:center;color:#789187;font-size:10px;line-height:1.7">Journal de trading · Outils de performance · Communauté</div>
  </div>
</div>`;
  let sent: Response;
  let payload: { id?: string } = {};
  try {
    sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text: message, ...(replyTo ? { reply_to: replyTo } : {}) })
    });
    payload = await sent.json().catch(() => ({}));
  } catch {
    return json({ error: 'Impossible de joindre le service e-mail.' }, 502);
  }
  if (!sent.ok) return json({ error: 'Resend a refusé l’envoi.', details: payload }, 502);

  const now = new Date().toISOString();
  const sentId = String(payload.id || id);
  const entry = { id: 'outbound-' + crypto.randomUUID(), direction: 'outbound', body: message, at: now, from: senderAddress, to, resendId: sentId };
  try {
    await firestoreSet(context.env as any, `contactMessages/${encodeURIComponent(id)}`, {
      id, name: to, email: to, subject, message, status: 'resolved', folder: 'sent',
      source: 'admin-compose', createdAt: now, updatedAt: now, repliedAt: now, repliedBy: identity.uid,
      conversation: [entry], resendId: sentId
    });
  } catch (error) {
    console.error('IAMTRADER sent email history persistence failed:', error);
    return json({ success: true, sent: true, historySaved: false, id, warning: 'E-mail envoyé, mais son archivage dans la boîte a échoué.' });
  }
  return json({ success: true, sent: true, historySaved: true, id, resendId: sentId });
}
