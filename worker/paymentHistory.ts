import { firestoreGet, firestoreQueryByField, PaymentEnv, verifyFirebaseIdToken } from './firebaseAdmin';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function legacyTransactionReference(payment: Record<string, unknown>) {
  const id = String(payment.id || payment.reference || 'UNKNOWN');
  const code = id.slice(-8).toUpperCase();
  return `IMAT-${code.slice(0, 4)} ${code.slice(4)}`;
}

function legacyInvoiceNumber(payment: Record<string, unknown>) {
  const id = String(payment.id || payment.reference || 'UNKNOWN');
  const year = new Date(String(payment.createdAt || new Date().toISOString())).getUTCFullYear().toString().slice(-2);
  return `INV-${year}-${id.slice(-8).toUpperCase()}`;
}

function profileFullName(profile: Record<string, any> | null) {
  if (!profile) return null;
  const firstName = String(profile.traderProfile?.firstName || profile.firstName || '').trim();
  const lastName = String(profile.traderProfile?.lastName || profile.lastName || '').trim();
  return [firstName, lastName].filter(Boolean).join(' ') || null;
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
    const profile = await firestoreGet(env, `users/${encodeURIComponent(user.uid)}`);
    const payments = await firestoreQueryByField(env, 'payments', 'uid', user.uid, 100, 'uid');

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
        reference: payment.transactionReference || legacyTransactionReference(payment),
        invoiceNumber: payment.invoiceNumber || legacyInvoiceNumber(payment),
        buyerUid: payment.uid || user.uid,
        buyerEmail: payment.email || user.email || null,
        displayName: payment.displayName || profile?.displayName || null,
        fullName: profileFullName(profile) || payment.fullName || null,
        payerName: payment.payerName || null,
        payerPhone: payment.phone || null,
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
    return json({ success: false, message: 'Impossible de récupérer votre historique pour le moment.' }, 500);
  }
}
