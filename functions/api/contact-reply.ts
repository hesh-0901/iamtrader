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
  const originalMessage=String(body.originalMessage||'').trim(), name=String(body.name||'').trim();
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
  const safeName=escapeHtml(name||'Trader'), safeReply=escapeHtml(reply), safeOriginal=escapeHtml(originalMessage||'—');
  const html='<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:680px;margin:auto"><h2 style="color:#0b1f35">IAMTRADER</h2><p>Bonjour '+safeName+',</p><div style="white-space:pre-wrap">'+safeReply+'</div><hr style="margin:28px 0;border:0;border-top:1px solid #e5e7eb"><p style="font-size:12px;color:#64748b">Votre message initial :<br>'+safeOriginal+'</p></div>';
  const text='Bonjour '+(name||'Trader')+',\n\n'+reply+'\n\n---\nVotre message initial :\n'+(originalMessage||'—');
  const resendResponse=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+context.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:context.env.RESEND_FROM_EMAIL,to:[to],subject:/^re:/i.test(subject)?subject:'Re: '+subject,html,text,...(context.env.RESEND_REPLY_TO?{reply_to:context.env.RESEND_REPLY_TO}:{})})});
  const resendData=await resendResponse.json().catch(()=>({}));
  if(!resendResponse.ok) return json({error:'Resend a refusé l’envoi.',details:resendData},502);
  return json({success:true,id:(resendData as {id?:string}).id||null});
}