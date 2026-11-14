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

  const html = `<style>
    @keyframes iamtraderGlow { 0% { opacity:.55; transform:translateX(-35%); } 50% { opacity:1; } 100% { opacity:.55; transform:translateX(35%); } }
    .iamtrader-glow { animation:iamtraderGlow 4s ease-in-out infinite alternate; }
    @media (prefers-reduced-motion:reduce) { .iamtrader-glow { animation:none !important; } }
  </style>
  <div style="margin:0;padding:32px 16px;background:#f2f8f6;font-family:Arial,Helvetica,sans-serif;color:#18352f">
    <div style="max-width:680px;margin:0 auto;overflow:hidden;background:#ffffff;border:1px solid #dceee7;border-radius:16px">
      <div style="height:6px;background:linear-gradient(90deg,#00b889 0%,#55dfb5 48%,#f4fffa 100%);font-size:0;line-height:0"><span class="iamtrader-glow" style="display:block;width:34%;height:6px;background:rgba(255,255,255,.75);filter:blur(5px)">&nbsp;</span></div>
      <div style="padding:30px 34px 25px;background:linear-gradient(115deg,#e4fff4 0%,#ffffff 72%,#f5fffa 100%)">
        <img src="https://iamtrader.trade/brand/logo-iamtrader-full.png" alt="IAMTRADER" width="174" style="display:block;width:174px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none">
        <div style="margin-top:22px;color:#009d78;font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase">Journal de trading · Outils de performance · Communauté</div>
      </div>
      <div style="padding:30px 34px 28px;background:#ffffff">
        <div style="font-size:15px;line-height:1.85;color:#263f38;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(message)}</div>
        <div style="margin-top:30px;padding-top:21px;border-top:1px solid #e3eee9">
          <div style="font-size:14px;font-weight:700;color:#087f63">Iamtrader team</div>
          <div style="margin-top:7px;font-size:13px;font-weight:600;line-height:1.6;color:#245b4b">Ce que tu ne mesures pas, tu ne le maîtrises pas.</div>
          <div style="margin-top:13px;font-size:12px;line-height:1.8">
            <a href="mailto:hello@iamtrader.trade" style="color:#009d78;text-decoration:none">hello@iamtrader.trade</a>
            <span style="color:#a0b7ae"> · </span>
            <a href="https://iamtrader.trade" style="color:#009d78;text-decoration:none">iamtrader.trade</a>
          </div>
        </div>
      </div>
      <div style="padding:14px 22px;background:#f4fbf8;border-top:1px solid #e3eee9;text-align:center;color:#829b91;font-size:10px;line-height:1.6">Trading Journal &amp; Performance Analytics</div>
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
