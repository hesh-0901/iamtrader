import { firestoreGet, firestorePatch, PaymentEnv, verifyFirebaseIdToken } from './firebaseAdmin';
import { lifecycleFields } from './subscription';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function authHeader(request: Request) {
  const value = request.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : null;
}

export async function handleSubscriptionStatus(request: Request, env: PaymentEnv) {
  if (request.method !== 'GET') return json({ success: false, message: 'Méthode non autorisée.' }, 405);
  const token = authHeader(request);
  if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);
  try {
    const user = await verifyFirebaseIdToken(env, token);
    const path = `users/${encodeURIComponent(user.uid)}`;
    const profile = await firestoreGet(env, path);
    if (!profile) return json({ success: false, message: 'Profil utilisateur introuvable.' }, 404);
    const fields = lifecycleFields(profile, new Date());
    if (fields) await firestorePatch(env, path, fields, Object.keys(fields));
    const finalProfile = fields ? { ...profile, ...fields } : profile;
    return json({ success: true, subscription: {
      plan: finalProfile.plan || 'free',
      subscriptionStatus: finalProfile.subscriptionStatus || 'expired',
      subscriptionStartAt: finalProfile.subscriptionStartAt || null,
      subscriptionExpiresAt: finalProfile.subscriptionExpiresAt || null,
      scheduledPlan: finalProfile.scheduledPlan || null,
      scheduledStartAt: finalProfile.scheduledStartAt || null,
      scheduledExpiresAt: finalProfile.scheduledExpiresAt || null
    }});
  } catch (error) {
    console.error('Subscription lifecycle error:', error);
    return json({ success: false, message: error instanceof Error ? error.message : 'Impossible de synchroniser l’abonnement.' }, 500);
  }
}