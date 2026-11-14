import { verifyFirebaseIdToken, firestoreGet, firestorePatch, firestoreSet } from '../../worker/firebaseAdmin';
interface Env {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
}
function json(data: unknown, status=200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' } });
}
function escapeHtml(value:string) {
  return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
export async function onRequestPost(context:{request:Request;env:Env}) {
  const authHeader=context.request.headers.get('Authorization')||'';
  if(!authHeader.startsWith('Bearer ')) return json({error:'Authentification requise.'},401);
  let body:{to?:string;subject?:string;reply?:string;originalMessage?:string;name?:string;inReplyTo?:string;references?:string;conversationId?:string};
  try { body=await context.request.json(); } catch { return json({error:'Requête invalide.'},400); }
  const to=String(body.to||'').trim(), subject=String(body.subject||'').trim(), reply=String(body.reply||'').trim();
  const inReplyTo=String(body.inReplyTo||'').trim();
  const references=String(body.references||'').trim();
  const conversationId=String(body.conversationId||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({error:'Adresse e-mail du destinataire invalide.'},400);
  if(!subject||!reply) return json({error:'Sujet et réponse obligatoires.'},400);
  if(reply.length>10000) return json({error:'La réponse est trop longue.'},400);
  const idToken=authHeader.slice(7);
  let identity:{uid:string;email?:string};
  let profile:Record<string, unknown>|null;
  try {
    identity=await verifyFirebaseIdToken(context.env as any, idToken);
    profile=await firestoreGet(context.env as any, `users/${encodeURIComponent(identity.uid)}`);
  } catch {
    return json({error:'Jeton Firebase invalide ou expiré.'},401);
  }
  if(!profile || profile.role!=='admin' || profile.status==='suspended') {
    return json({error:'Accès administrateur requis.'},403);
  }
  const resendApiKey = String(context.env.RESEND_API_KEY || '').trim();
  const configuredFrom = String(context.env.RESEND_FROM_EMAIL || '').trim();
  const resendFromEmail = (configuredFrom.match(/<([^<>]+)>/)?.[1] || configuredFrom).trim();
  const resendFromHeader = `Iamtrader team <${resendFromEmail}>`;
  const resendReplyTo = String(context.env.RESEND_REPLY_TO || '').trim();
  if(!resendApiKey || !resendFromEmail) {
    return json({
      error:'Configuration e-mail du serveur incomplète.',
      code: !resendApiKey ? 'RESEND_API_KEY_MISSING' : 'RESEND_FROM_EMAIL_MISSING'
    },500);
  }

  const safeReply=escapeHtml(reply);
  const logoUrl='https://iamtrader.trade/brand/logo-iamtrader-full.png';
  const linkStyle='color:#009d78;text-decoration:none;';
  const html=`<div style="margin:0;padding:28px 14px;background:#f1f7f5;font-family:Arial,Helvetica,sans-serif;color:#18352f">
  <div style="max-width:640px;margin:0 auto;overflow:hidden;background:#ffffff;border:1px solid #dcebe5;border-radius:14px">
    <div style="height:5px;background:#00b889;font-size:0;line-height:0">&nbsp;</div>
    <div style="padding:28px 34px 25px;background:#ffffff;border-bottom:1px solid #e4f0eb">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
        <tr>
          <td style="vertical-align:middle;width:1%;padding-right:15px">
            <img src="https://iamtrader.trade/brand/logo-iamtrader-full.png" alt="" width="112" style="display:block;width:112px;max-width:112px;height:auto;border:0;outline:none;text-decoration:none">
          </td>
          <td style="vertical-align:middle">
            <div style="font-size:21px;font-weight:800;letter-spacing:1.5px;line-height:1.2;color:#123f32">IAMTRADER</div>
            <div style="margin-top:5px;font-size:11px;font-weight:700;letter-spacing:1.15px;line-height:1.4;color:#07966f;text-transform:uppercase">TRADING JOURNAL &amp; PERFORMANCE</div>
          </td>
        </tr>
      </table>
      <div style="margin-top:25px;padding:17px 19px;background:#e9fbf3;border-left:4px solid #00b889;border-radius:5px">
        <div style="font-size:20px;font-weight:700;line-height:1.35;letter-spacing:-.25px;color:#174d3e">Le trader que vous devez être !</div>
      </div>
      <div style="margin-top:17px;font-size:10px;font-weight:700;letter-spacing:1.05px;line-height:1.8;color:#52786a;text-transform:uppercase">Journal de trading <span style="color:#00a77b">&nbsp;·&nbsp;</span> Outils de performance <span style="color:#00a77b">&nbsp;·&nbsp;</span> Communauté</div>
    </div>
    <div style="padding:30px 34px 30px;background:#ffffff">
      <div style="font-size:15px;line-height:1.85;color:#263f38;white-space:pre-wrap;overflow-wrap:anywhere">${safeReply}</div>
      <div style="margin-top:30px;padding-top:21px;border-top:1px solid #e3eee9">
        <div style="font-size:14px;font-weight:700;color:#087f63">Iamtrader team</div>
        <div style="margin-top:13px;font-size:12px;line-height:1.9;color:#647d73">
          <a href="mailto:hello@iamtrader.trade" style="color:#009d78;text-decoration:none">hello@iamtrader.trade</a>
          <span style="color:#a0b7ae">&nbsp; · &nbsp;</span>
          <a href="https://iamtrader.trade" style="color:#009d78;text-decoration:none">iamtrader.trade</a>
        </div>
      </div>
    </div>
    <div style="padding:15px 22px;background:#f4fbf8;border-top:1px solid #e3eee9;text-align:center;color:#789187;font-size:10px;line-height:1.7">IAMTRADER&nbsp; · &nbsp;Le trader que vous devez être !</div>
  </div>
</div>`;
  const text=`${reply}

---
Iamtrader team
IAMTRADER — Le trader que vous devez être !
hello@iamtrader.trade
iamtrader.trade`;
  let resendResponse: Response;
  let resendData: unknown = {};
  const threadReplyTo = resendReplyTo || resendFromEmail;

  try {
    resendResponse = await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:'Bearer '+resendApiKey,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:resendFromHeader,
        to:[to],
        subject:/^re:/i.test(subject)?subject:'Re: '+subject,
        html,
        text,
        ...(threadReplyTo?{reply_to:threadReplyTo}:{}),
        ...(inReplyTo||conversationId?{headers:{...(inReplyTo?{'In-Reply-To':inReplyTo,'References':references||inReplyTo}:{}),...(conversationId?{'X-IAMTRADER-Conversation-ID':conversationId}:{})}}:{})
      })
    });
    resendData = await resendResponse.json().catch(()=>({}));
  } catch (error) {
    console.error('IAMTRADER Resend request failed:', error);
    return json({error:'Impossible de joindre le service e-mail.',code:'RESEND_NETWORK_ERROR'},502);
  }
  if(!resendResponse.ok) return json({error:'Resend a refusé l’envoi.',details:resendData,code:'RESEND_API_ERROR'},502);

  const resendEmailId = String((resendData as {id?:string}).id || '').trim();
  let messageId = '';
  if (resendEmailId) {
    try {
      const emailResponse = await fetch(`https://api.resend.com/emails/${encodeURIComponent(resendEmailId)}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + resendApiKey }
      });
      if (emailResponse.ok) {
        const emailData = await emailResponse.json().catch(() => ({})) as { message_id?: string };
        messageId = String(emailData.message_id || '').trim();
      }
    } catch (error) {
      console.warn('IAMTRADER could not retrieve Resend Message-ID:', error);
    }
  }

  const sentAt = new Date().toISOString();
  let historySaved = false;
  try {
    const existing = await firestoreGet(context.env as any, `contactMessages/${encodeURIComponent(conversationId)}`);
    if (!existing || String(existing.email || '').trim().toLowerCase() !== to.toLowerCase()) {
      throw new Error('Support conversation not found or recipient mismatch.');
    }
    const previousConversation = Array.isArray(existing.conversation) && existing.conversation.length
      ? existing.conversation
      : [{
          id: 'legacy-inbound',
          direction: 'inbound',
          body: String(existing.message || ''),
          at: String(existing.createdAt || sentAt),
          from: to,
          to: resendFromEmail
        }];
    const outbound = {
      id: 'outbound-' + crypto.randomUUID(),
      direction: 'outbound',
      body: reply,
      at: sentAt,
      from: resendFromEmail,
      to,
      messageId: messageId || undefined,
      resendId: resendEmailId || undefined
    };
    await firestorePatch(context.env as any, `contactMessages/${encodeURIComponent(conversationId)}`, {
      status: 'resolved',
      handledBy: identity.uid,
      handledAt: sentAt,
      lastReply: reply,
      repliedAt: sentAt,
      repliedBy: identity.uid,
      updatedAt: sentAt,
      conversation: [...previousConversation, outbound]
    }, ['status','handledBy','handledAt','lastReply','repliedAt','repliedBy','updatedAt','conversation']);
    historySaved = true;
    const sentRecordId = (conversationId + '_sent_' + (resendEmailId || crypto.randomUUID())).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 140);
    await firestoreSet(context.env as any, `contactMessages/${encodeURIComponent(sentRecordId)}`, {
      id: sentRecordId,
      name: to,
      email: to,
      subject: /^re:/i.test(subject) ? subject : 'Re: ' + subject,
      message: reply,
      status: 'sent',
      folder: 'sent',
      source: 'admin-reply',
      createdAt: sentAt,
      updatedAt: sentAt,
      repliedAt: sentAt,
      repliedBy: identity.uid,
      conversation: [outbound],
      parentConversationId: conversationId
    });
  } catch (error) {
    console.error('IAMTRADER support reply history persistence failed:', error);
  }

  return json({success:true,sent:true,historySaved,id:resendEmailId||null,messageId:messageId||null,replyTo:threadReplyTo||null,warning:historySaved?undefined:'E-mail envoyé, mais l’historique n’a pas pu être enregistré.'});
}
