import { verifyFirebaseIdToken, firestoreGet, firestorePatch, firestoreSet } from '../../worker/firebaseAdmin';
import { buildIamtraderEmail } from '../_shared/iamtraderEmail';
interface Env {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
}
function json(data: unknown, status=200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' } });
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

  const html = buildIamtraderEmail(reply, 'support-reply');
  const text=`${reply}

---
Iamtrader team
iamtrader — le trader que vous devez être !
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
