import { firestorePatch, firestoreQueryByField } from './firebaseAdmin';

interface InviteEnv {
  FIREBASE_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function handlePipTalkInviteJoin(request: Request, env: InviteEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ success: false, message: 'Méthode non autorisée.' }, 405);
  const authorization = request.headers.get('Authorization') || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!idToken) return json({ success: false, message: 'Connectez-vous à IAMTRADER pour rejoindre ce groupe.' }, 401);
  if (!env.FIREBASE_API_KEY || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error('PipTalk invite join: Firebase Worker credentials are missing.');
    return json({ success: false, message: 'Service d’invitation temporairement indisponible.' }, 503);
  }

  try {
    const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (!identityResponse.ok) return json({ success: false, message: 'Votre session a expiré. Reconnectez-vous.' }, 401);
    const identity = await identityResponse.json() as { users?: Array<{ localId?: string; displayName?: string }> };
    const uid = identity.users?.[0]?.localId;
    if (!uid) return json({ success: false, message: 'Compte IAMTRADER introuvable.' }, 401);

    const body = await request.json() as { code?: string; displayName?: string };
    const code = String(body.code || '').trim();
    const displayName = String(body.displayName || identity.users?.[0]?.displayName || 'Trader').trim().slice(0, 80) || 'Trader';
    if (!/^[A-Za-z0-9]{10}$/.test(code)) return json({ success: false, message: 'Ce lien d’invitation est invalide.' }, 400);

    const matches = await firestoreQueryByField(env as any, 'conversations', 'inviteCode', code, 2, 'updatedAt');
    const group = matches[0] as Record<string, unknown> & { id?: string } | undefined;
    if (!group?.id || group.group !== true || group.systemGroup === true || group.inviteEnabled !== true || group.inviteCode !== code) {
      return json({ success: false, message: 'Ce lien est invalide, désactivé ou a été actualisé.' }, 404);
    }

    const members = Array.isArray(group.members) ? group.members.map(String) : [];
    if (members.includes(uid)) {
      return json({ success: true, groupId: group.id, groupTitle: String(group.title || 'Groupe'), alreadyMember: true });
    }
    if (members.length >= 500) return json({ success: false, message: 'Ce groupe a atteint sa capacité maximale.' }, 409);

    const nextMembers = [...members, uid];
    const memberNames = group.memberNames && typeof group.memberNames === 'object'
      ? { ...(group.memberNames as Record<string, unknown>), [uid]: displayName }
      : { [uid]: displayName };
    await firestorePatch(env as any, `conversations/${group.id}`, {
      members: nextMembers,
      memberNames,
    }, ['members', 'memberNames']);

    return json({ success: true, groupId: group.id, groupTitle: String(group.title || 'Groupe'), alreadyMember: false });
  } catch (error) {
    console.error('PipTalk invite join failed:', error);
    return json({ success: false, message: 'Impossible de rejoindre ce groupe pour le moment.' }, 500);
  }
}
