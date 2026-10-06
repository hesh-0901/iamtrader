import { verifyFirebaseIdToken, firestoreGet } from '../../worker/firebaseAdmin';
interface Env {
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
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
  let body:{to?:string;subject?:string;reply?:string;originalMessage?:string;name?:string};
  try { body=await context.request.json(); } catch { return json({error:'Requête invalide.'},400); }
  const to=String(body.to||'').trim(), subject=String(body.subject||'').trim(), reply=String(body.reply||'').trim();
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
  if(!context.env.RESEND_API_KEY||!context.env.RESEND_FROM_EMAIL) return json({error:'Configuration e-mail du serveur incomplète.'},500);

  const safeReply=escapeHtml(reply);
  const logoUrl='https://iamtrader.trade/brand/logo-iamtrader-full.png';
  const linkStyle='color:#2563eb;text-decoration:underline;text-decoration-color:#93c5fd;text-underline-offset:2px;';
  const html=`<div style="margin:0;padding:32px 20px;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;color:#172033">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e6ebf0">
      <div style="padding:30px 34px 28px">
        <div style="margin:0 0 28px">
          <img src="${logoUrl}" alt="IAMTRADER" width="170" style="display:block;width:170px;max-width:100%;height:auto;border:0">
        </div>
        <div style="font-size:15px;line-height:1.75;color:#172033;white-space:pre-wrap">${safeReply}</div>
        <div style="margin-top:34px;padding-top:20px;border-top:1px solid #e5e7eb">
          <div style="font-size:13px;font-weight:700;color:#0b1f35">Équipe Support IAMTRADER</div>
          <div style="margin-top:3px;font-size:11px;color:#64748b">Trading Performance Management</div>
          <div style="margin-top:13px;font-size:11px;line-height:1.8;color:#475569">
            <a href="mailto:hello@iamtrader.trade" style="${linkStyle}">hello@iamtrader.trade</a><br>
            <a href="https://iamtrader.trade" style="${linkStyle}">iamtrader.trade</a>
          </div>
          <div style="margin-top:14px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#94a3b8">TRADE. MEASURE. IMPROVE.</div>
        </div>
      </div>
    </div>
  </div>`;
  const text=`${reply}

---
Équipe Support IAMTRADER
Trading Performance Management
hello@iamtrader.trade
iamtrader.trade
Trade. Measure. Improve.`;
  const resendResponse=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+context.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:context.env.RESEND_FROM_EMAIL,to:[to],subject:/^re:/i.test(subject)?subject:'Re: '+subject,html,text,...(context.env.RESEND_REPLY_TO?{reply_to:context.env.RESEND_REPLY_TO}:{})})});
  const resendData=await resendResponse.json().catch(()=>({}));
  if(!resendResponse.ok) return json({error:'Resend a refusé l’envoi.',details:resendData},502);
  return json({success:true,id:(resendData as {id?:string}).id||null});
}