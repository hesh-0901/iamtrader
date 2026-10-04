import { firestoreQueryByField, PaymentEnv, verifyFirebaseIdToken } from './firebaseAdmin';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function authHeader(request: Request) {
  const value = request.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : null;
}

export async function handlePaymentHistory(request: Request, env: PaymentEnv) {
  if (request.method !== 'GET') return json({ success: false, message: 'Méthode non autorisée.' }, 405);
  const token = authHeader(request);
  if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);

  try {
    const user = await verifyFirebaseIdToken(env, token);
    const payments = await firestoreQueryByField(env, 'payments', 'uid', user.uid, 100);

    return json({
      success: true,
      payments: payments.map(payment => ({
        id: payment.id,
        plan: payment.plan,
        planName: payment.planName,
        amount: Number(payment.amount || 0),
        baseAmount: Number(payment.baseAmount || 0),
        paymentFee: Number(payment.paymentFee || 0),
        currency: payment.currency || 'USD',
        status: payment.status || 'initiated',
        reference: payment.reference || payment.id,
        createdAt: payment.createdAt || null,
        paidAt: payment.paidAt || null,
        subscriptionAction: payment.subscriptionAction || 'initial',
        activationStartAt: payment.activationStartAt || null,
        activationExpiresAt: payment.activationExpiresAt || null,
        paymentProvider: payment.paymentProvider || null,
        paymentMethod: payment.paymentMethod || null
      }))
    });
  } catch (error) {
    console.error('Payment history error:', error);
    return json({ success: false, message: error instanceof Error ? error.message : 'Impossible de récupérer votre historique.' }, 500);
  }
}
