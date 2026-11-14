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
  const from = `IAMTRADER Team <${senderAddress}>`;
  const replyTo = String(context.env.RESEND_REPLY_TO || senderAddress).trim();
  if (!apiKey || !senderAddress) return json({ error: 'Configuration e-mail du serveur incomplète.' }, 500);

  const html = `<div style="margin:0;padding:36px 16px;background:#f1f6f8;font-family:Arial,Helvetica,sans-serif;color:#14263a">
    <div style="max-width:680px;margin:0 auto;overflow:hidden;background:#ffffff;border:1px solid #dce7e9;border-radius:16px">
      <div style="height:5px;background:#00c99a;font-size:0;line-height:0">&nbsp;</div>
      <div style="padding:28px 34px;background:#10243b">
        <img src="https://iamtrader.trade/brand/logo-iamtrader-full-white.png" alt="IAMTRADER" width="166" style="display:block;width:166px;max-width:100%;height:auto;border:0">
        <div style="margin-top:22px;color:#68e6c4;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Trading Performance Management</div>
        <div style="margin-top:7px;color:#ffffff;font-size:20px;font-weight:700;line-height:1.35">Un message de l'équipe IAMTRADER</div>
      </div>
      <div style="padding:34px 34px 30px;background:#ffffff">
        <div style="font-size:15px;line-height:1.85;color:#26384b;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(message)}</div>
        <div style="margin-top:32px;padding-top:22px;border-top:1px solid #e6eef0">
          <div style="font-size:14px;font-weight:700;color:#10243b">IAMTRADER Team</div>
          <div style="margin-top:5px;font-size:12px;line-height:1.7;color:#718096">Trade. Measure. Improve.</div>
          <div style="margin-top:13px;font-size:12px;line-height:1.8">
            <a href="mailto:hello@iamtrader.trade" style="color:#009d78;text-decoration:none">hello@iamtrader.trade</a>
            <span style="color:#a0aec0"> · </span>
            <a href="https://iamtrader.trade" style="color:#009d78;text-decoration:none">iamtrader.trade</a>
          </div>
        </div>
      </div>
      <div style="padding:15px 24px;background:#f6faf9;border-top:1px solid #e6eef0;text-align:center;color:#91a0ad;font-size:10px;line-height:1.6">© IAMTRADER · Trading Journal &amp; Performance Analytics</div>
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
