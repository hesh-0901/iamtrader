import { firestoreCreate, firestoreGet, firestorePatch, firestoreQueryByField, verifyFirebaseIdToken, type PaymentEnv } from './firebaseAdmin';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
const CODE_PATTERN = /^IMT[A-Z0-9]{4}0[0-9]$/;

async function authenticatedUid(request: Request, env: PaymentEnv) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('UNAUTHORIZED');
  return (await verifyFirebaseIdToken(env, token)).uid;
}
async function ensureCode(env: PaymentEnv, uid: string, profile: Record<string, any>) {
  if (typeof profile.referralCode === 'string' && CODE_PATTERN.test(profile.referralCode)) return profile.referralCode;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const random = new Uint8Array(5); crypto.getRandomValues(random);
    const code = 'IMT' + Array.from(random.slice(0,4), n => chars[n % chars.length]).join('') + '0' + String(random[4] % 10);
    if (await firestoreGet(env, 'referralCodes/' + code)) continue;
    await firestoreCreate(env, 'referralCodes', code, { uid, code, createdAt: new Date().toISOString(), active: true });
    await firestorePatch(env, 'users/' + encodeURIComponent(uid), { referralCode: code, referralCodeCreatedAt: new Date().toISOString() }, ['referralCode', 'referralCodeCreatedAt']);
    return code;
  }
  throw new Error('CODE_GENERATION_FAILED');
}
export async function handleReferralRequest(request: Request, env: PaymentEnv) {
  try {
    const uid = await authenticatedUid(request, env);
    const profile = await firestoreGet(env, 'users/' + encodeURIComponent(uid));
    if (!profile) return json({ success: false, message: 'Profil introuvable.' }, 404);
    if (request.method === 'GET') {
      const code = await ensureCode(env, uid, profile);
      const referrals = await firestoreQueryByField(env, 'referrals', 'referrerUid', uid, 500);
      const paid = referrals.filter((r: any) => r.firstPaidAt).length;
      const credit = Number(profile.referralCreditAvailable || 0);
      return json({ success: true, code, link: 'https://iamtrader.trade/?ref=' + code, invited: referrals.length, paid, target: 7, credit, currency: 'USD', rewardStatus: paid >= 7 ? 'eligible' : 'in_progress' });
    }
    if (request.method === 'POST') {
      const body = await request.json() as { code?: string };
      const code = String(body.code || '').trim().toUpperCase();
      if (!CODE_PATTERN.test(code)) return json({ success: false, message: 'Code de parrainage invalide.' }, 400);
      if (profile.referredByUid) return json({ success: true, alreadyAssigned: true });
      const owner = await firestoreGet(env, 'referralCodes/' + code);
      if (!owner?.uid || owner.uid === uid || owner.active !== true) return json({ success: false, message: 'Code inconnu ou non applicable.' }, 400);
      const referrerUid = String(owner.uid);
      const now = new Date().toISOString();
      await firestorePatch(env, 'users/' + encodeURIComponent(uid), { referredByUid: referrerUid, referredByCode: code, referralAttachedAt: now }, ['referredByUid', 'referredByCode', 'referralAttachedAt']);
      await firestoreCreate(env, 'referrals', uid, { referredUid: uid, referrerUid, code, createdAt: now, status: 'registered', firstPaidAt: null });
      return json({ success: true, attached: true });
    }
    return json({ success: false, message: 'Méthode non autorisée.' }, 405);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ success: false, message: 'Authentification requise.' }, 401);
    console.error('Referral request failed:', error);
    return json({ success: false, message: 'Service de parrainage indisponible.' }, 500);
  }
}
