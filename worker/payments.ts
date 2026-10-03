import { firestoreCreate, firestoreGet, firestorePatch, PaymentEnv, verifyFirebaseIdToken } from './firebaseAdmin';

const LABYRINTHE_URL = 'https://api.labyrinthe-rdc.com/api/V1/payment/mobile';

const PLANS = {
  pro: { name: 'Plus', amount: 9.99, currency: 'USD', durationDays: 30 },
  community: { name: 'Community', amount: 89.99, currency: 'USD', durationDays: 180 }
} as const;

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

function normalizePhone(value: unknown) {
  const raw = String(value || '').trim().replace(/[\\s-]/g, '');
  if (/^\\+243\\d{9}$/.test(raw)) return '0' + raw.slice(4);
  if (/^243\\d{9}$/.test(raw)) return '0' + raw.slice(3);
  if (/^0\\d{9}$/.test(raw)) return raw;
  return null;
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

function simulationEnabled(env: PaymentEnv & { PAYMENT_SIMULATION_ENABLED?: string }) {
  return env.PAYMENT_SIMULATION_ENABLED === 'true';
}

function publicPayment(payment: Record<string, unknown>) {
  return {
    id: payment.id,
    plan: payment.plan,
    planName: payment.planName,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    reference: payment.reference,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt || null
  };
}

export async function handlePaymentRequest(request: Request, env: PaymentEnv & { LABYRINTHE_API_TOKEN?: string }) {
  if (request.method === 'POST') {
    const token = authHeader(request);
    if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);

    try {
      const user = await verifyFirebaseIdToken(env, token);
      const body = await request.json() as { plan?: keyof typeof PLANS; phone?: string };
      const planKey = body.plan;
      const plan = planKey ? PLANS[planKey] : undefined;
      const phone = normalizePhone(body.phone);

      if (!plan || !planKey) return json({ success: false, message: 'Formule invalide.' }, 400);
      if (!phone) return json({ success: false, message: 'Numéro Mobile Money invalide. Utilisez un numéro RDC à 10 chiffres.' }, 400);
      if (!env.LABYRINTHE_API_TOKEN) return json({ success: false, message: 'Le paiement n’est pas encore configuré côté serveur.' }, 503);

      const profile = await firestoreGet(env, `users/${encodeURIComponent(user.uid)}`);
      if (!profile) return json({ success: false, message: 'Profil utilisateur introuvable.' }, 404);
      if (profile.status === 'suspended') return json({ success: false, message: 'Ce compte est suspendu.' }, 403);

      const paymentId = randomId();
      const now = new Date().toISOString();
      await firestoreCreate(env, 'payments', paymentId, {
        id: paymentId,
        uid: user.uid,
        email: user.email || profile.email || '',
        plan: planKey,
        planName: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        phone,
        status: 'initiated',
        reference: paymentId,
        createdAt: now
      });

      const callback = new URL('/api/payments/callback', request.url).toString();
      const response = await fetch(LABYRINTHE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: env.LABYRINTHE_API_TOKEN,
          phone,
          amount: plan.amount,
          currency: plan.currency,
          country: 'CD',
          reference: paymentId,
          callback
        })
      });

      const result = await response.json() as any;
      if (!response.ok || !result.success) {
        await firestorePatch(env, `payments/${paymentId}`, {
          status: 'failed',
          failureMessage: result?.message || 'Labyrinthe a refusé la demande.',
          updatedAt: new Date().toISOString()
        }, ['status', 'failureMessage', 'updatedAt']);
        return json({ success: false, message: result?.message || 'Impossible d’initier le paiement.' }, 400);
      }

      const orderNumber = result.orderNumber || result.results?.orderNumber || '';
      await firestorePatch(env, `payments/${paymentId}`, {
        status: 'processing',
        labyrintheOrderNumber: orderNumber,
        labyrintheReference: result.reference || paymentId,
        updatedAt: new Date().toISOString()
      }, ['status', 'labyrintheOrderNumber', 'labyrintheReference', 'updatedAt']);

      return json({
        success: true,
        payment: {
          id: paymentId,
          plan: planKey,
          planName: plan.name,
          amount: plan.amount,
          currency: plan.currency,
          status: 'processing',
          reference: paymentId,
          message: result.message || 'Paiement initié. Validez la demande sur votre téléphone.'
        }
      });
    } catch (error) {
      console.error('Payment initiation error:', error);
      return json({ success: false, message: 'Impossible d’initier le paiement pour le moment.' }, 500);
    }
  }

  if (request.method === 'GET') {
    const token = authHeader(request);
    if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);
    try {
      const user = await verifyFirebaseIdToken(env, token);
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id || !/^[a-f0-9]{64}$/.test(id)) return json({ success: false, message: 'Référence de paiement invalide.' }, 400);
      const payment = await firestoreGet(env, `payments/${id}`);
      if (!payment || payment.uid !== user.uid) return json({ success: false, message: 'Paiement introuvable.' }, 404);
      return json({ success: true, payment: publicPayment(payment) });
    } catch {
      return json({ success: false, message: 'Impossible de consulter le paiement.' }, 500);
    }
  }

  return json({ success: false, message: 'Méthode non autorisée.' }, 405);
}

export async function handlePaymentCallback(request: Request, env: PaymentEnv) {
  if (request.method !== 'POST') return json({ received: false }, 405);

  try {
    const payload = await request.json() as any;
    const reference = String(payload.reference || payload.results?.reference || '').trim();
    if (!reference || !/^[a-f0-9]{64}$/.test(reference)) return json({ received: false }, 400);

    const payment = await firestoreGet(env, `payments/${reference}`);
    if (!payment) return json({ received: false }, 404);
    if (payment.status === 'paid') return json({ received: true });

    const details = payload.results?.details || {};
    const callbackAmount = Number(details.amount);
    const callbackCurrency = String(details.currency || '');
    const statusCode = Number(payload.results?.status?.code ?? payload.results?.status?.id);

    if (callbackAmount && callbackAmount !== Number(payment.amount)) {
      await firestorePatch(env, `payments/${reference}`, {
        status: 'failed',
        failureMessage: 'Montant de callback différent du montant de la commande.',
        updatedAt: new Date().toISOString()
      }, ['status', 'failureMessage', 'updatedAt']);
      return json({ received: true });
    }

    if (callbackCurrency && callbackCurrency !== payment.currency) return json({ received: true });

    if (statusCode === 2) {
      const planKey = payment.plan as keyof typeof PLANS;
      const plan = PLANS[planKey];
      if (!plan) return json({ received: false }, 400);

      const now = new Date();
      const start = now.toISOString();
      const expires = new Date(now.getTime() + plan.durationDays * 86400000).toISOString();
      const paidAt = String(payload.time || start);

      await firestorePatch(env, `payments/${reference}`, {
        status: 'paid',
        paidAt,
        provider: details.provider?.name || 'Labyrinthe',
        labyrintheOrderNumber: payload.orderNumber || payment.labyrintheOrderNumber || '',
        updatedAt: start
      }, ['status', 'paidAt', 'provider', 'labyrintheOrderNumber', 'updatedAt']);

      await firestorePatch(env, `users/${encodeURIComponent(String(payment.uid))}`, {
        plan: planKey,
        paymentDate: paidAt,
        subscriptionStartAt: start,
        subscriptionExpiresAt: expires,
        subscriptionStatus: 'active',
        paymentStatus: 'paid',
        planChangeConfirmedAt: start,
        updatedAt: start
      }, [
        'plan',
        'paymentDate',
        'subscriptionStartAt',
        'subscriptionExpiresAt',
        'subscriptionStatus',
        'paymentStatus',
        'planChangeConfirmedAt',
        'pendingPlan',
        'planChangeRequestedAt',
        'updatedAt'
      ]);

      return json({ received: true });
    }

    if (statusCode === 3) {
      await firestorePatch(env, `payments/${reference}`, {
        status: 'failed',
        failureMessage: payload.message || 'Paiement annulé ou refusé.',
        updatedAt: new Date().toISOString()
      }, ['status', 'failureMessage', 'updatedAt']);
      return json({ received: true });
    }

    return json({ received: true });
  } catch (error) {
    console.error('Payment callback error:', error);
    return json({ received: false }, 500);
  }
}


/**
 * Test-only checkout. It mirrors the lifecycle of a real payment provider:
 * create transaction -> processing -> server confirmation -> activate entitlement.
 * It never calls a PSP and is disabled unless PAYMENT_SIMULATION_ENABLED=true.
 */
export async function handleSimulatedPaymentRequest(request: Request, env: PaymentEnv & { PAYMENT_SIMULATION_ENABLED?: string }) {
  if (!simulationEnabled(env)) return json({ success: false, message: 'La simulation de paiement est désactivée.' }, 404);
  if (request.method !== 'POST') return json({ success: false, message: 'Méthode non autorisée.' }, 405);

  const token = authHeader(request);
  if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);

  try {
    const user = await verifyFirebaseIdToken(env, token);
    const body = await request.json() as { plan?: keyof typeof PLANS; phone?: string; idempotencyKey?: string };
    const planKey = body.plan;
    const plan = planKey ? PLANS[planKey] : undefined;
    const phone = normalizePhone(body.phone);
    const idempotencyKey = String(body.idempotencyKey || '').replace(/[^a-f0-9]/gi, '').toLowerCase();

    if (!plan || !planKey) return json({ success: false, message: 'Formule invalide.' }, 400);
    if (!phone) return json({ success: false, message: 'Numéro Mobile Money invalide.' }, 400);
    if (idempotencyKey.length !== 64) return json({ success: false, message: 'Clé de paiement invalide.' }, 400);

    const profile = await firestoreGet(env, `users/${encodeURIComponent(user.uid)}`);
    if (!profile) return json({ success: false, message: 'Profil utilisateur introuvable.' }, 404);
    if (profile.status === 'suspended') return json({ success: false, message: 'Ce compte est suspendu.' }, 403);

    const existing = await firestoreGet(env, `payments/${idempotencyKey}`);
    if (existing && existing.uid === user.uid) {
      return json({ success: true, payment: publicPayment(existing) });
    }
    if (existing) return json({ success: false, message: 'Référence de paiement déjà utilisée.' }, 409);

    const now = new Date().toISOString();
    await firestoreCreate(env, 'payments', idempotencyKey, {
      id: idempotencyKey,
      uid: user.uid,
      email: user.email || profile.email || '',
      displayName: profile.displayName || user.email || '',
      plan: planKey,
      planName: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      phone,
      provider: 'SIMULATOR',
      paymentMethod: 'Mobile Money — simulation',
      mode: 'simulation',
      status: 'processing',
      reference: idempotencyKey,
      createdAt: now,
      updatedAt: now
    });

    return json({
      success: true,
      payment: {
        id: idempotencyKey,
        plan: planKey,
        planName: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        status: 'processing',
        reference: idempotencyKey,
        message: 'Paiement simulé créé. Confirmez pour déclencher le webhook de succès.'
      }
    });
  } catch (error) {
    console.error('Simulated payment initiation error:', error);
    return json({ success: false, message: 'Impossible de créer la simulation.' }, 500);
  }
}

export async function handleSimulatedPaymentConfirm(request: Request, env: PaymentEnv & { PAYMENT_SIMULATION_ENABLED?: string }) {
  if (!simulationEnabled(env)) return json({ success: false, message: 'La simulation de paiement est désactivée.' }, 404);
  if (request.method !== 'POST') return json({ success: false, message: 'Méthode non autorisée.' }, 405);

  const token = authHeader(request);
  if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);

  try {
    const user = await verifyFirebaseIdToken(env, token);
    const body = await request.json() as { id?: string };
    const id = String(body.id || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(id)) return json({ success: false, message: 'Référence de paiement invalide.' }, 400);

    const payment = await firestoreGet(env, `payments/${id}`);
    if (!payment || payment.uid !== user.uid) return json({ success: false, message: 'Paiement introuvable.' }, 404);
    if (payment.status === 'paid') return json({ success: true, payment: publicPayment(payment) });
    if (payment.status !== 'processing') return json({ success: false, message: 'Ce paiement ne peut plus être confirmé.' }, 409);
    if (payment.mode !== 'simulation' || payment.provider !== 'SIMULATOR') return json({ success: false, message: 'Transaction de simulation invalide.' }, 400);

    const planKey = payment.plan as keyof typeof PLANS;
    const plan = PLANS[planKey];
    if (!plan || Number(payment.amount) !== plan.amount || payment.currency !== plan.currency) {
      return json({ success: false, message: 'Le montant de la transaction ne correspond pas au tarif du plan.' }, 409);
    }

    const now = new Date();
    const paidAt = now.toISOString();
    const expires = new Date(now.getTime() + plan.durationDays * 86400000).toISOString();

    await firestorePatch(env, `payments/${id}`, {
      status: 'paid',
      paidAt,
      updatedAt: paidAt,
      provider: 'SIMULATOR',
      confirmationSource: 'simulated_webhook'
    }, ['status', 'paidAt', 'updatedAt', 'provider', 'confirmationSource']);

    await firestorePatch(env, `users/${encodeURIComponent(String(payment.uid))}`, {
      plan: planKey,
      paymentDate: paidAt,
      subscriptionStartAt: paidAt,
      subscriptionExpiresAt: expires,
      subscriptionStatus: 'active',
      paymentStatus: 'paid',
      planChangeConfirmedAt: paidAt,
      updatedAt: paidAt
    }, [
      'plan',
      'paymentDate',
      'subscriptionStartAt',
      'subscriptionExpiresAt',
      'subscriptionStatus',
      'paymentStatus',
      'planChangeConfirmedAt',
      'updatedAt'
    ]);

    const finalPayment = await firestoreGet(env, `payments/${id}`);
    return json({ success: true, payment: publicPayment(finalPayment || { ...payment, status: 'paid', paidAt }) });
  } catch (error) {
    console.error('Simulated payment confirmation error:', error);
    return json({ success: false, message: 'Impossible de confirmer la simulation.' }, 500);
  }
}
