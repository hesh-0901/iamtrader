import { firestoreCreate, firestoreGet, firestorePatch, PaymentEnv, verifyFirebaseIdToken } from './firebaseAdmin';
import { decideSubscription, subscriptionFields, SubscriptionAction } from './subscription';

const LABYRINTHE_URL = 'https://api.labyrinthe-rdc.com/api/V1/payment/mobile';

const PLANS = {
  pro: { name: 'Plus', amount: 9.99, currency: 'USD', durationDays: 30 },
  community: { name: 'Community', amount: 89.99, currency: 'USD', durationDays: 180 }
} as const;

const PAYMENT_FEE_RATE = 0.03;

function calculatePaymentAmounts(baseAmount: number) {
  const fee = Math.round(baseAmount * PAYMENT_FEE_RATE * 100) / 100;
  const total = Math.round((baseAmount + fee) * 100) / 100;
  return { baseAmount, fee, total };
}

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
  const raw = String(value || '').trim().replace(/[\s-]/g, '');
  if (/^\+243\d{9}$/.test(raw)) return '0' + raw.slice(4);
  if (/^243\d{9}$/.test(raw)) return '0' + raw.slice(3);
  if (/^0\d{9}$/.test(raw)) return raw;
  return null;
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

function paymentReference(paymentId: string) {
  const code = paymentId.slice(-8).toUpperCase();
  return `IMAT-${code.slice(0, 4)} ${code.slice(4)}`;
}

function invoiceNumber(paymentId: string, createdAt: string) {
  const year = new Date(createdAt).getUTCFullYear().toString().slice(-2);
  return `INV-${year}-${paymentId.slice(-8).toUpperCase()}`;
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
    reference: payment.transactionReference || payment.reference,
    invoiceNumber: payment.invoiceNumber || null,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt || null
  };
}

export async function handlePaymentRequest(request: Request, env: PaymentEnv & { CINETPAY_API_KEY?: string; CINETPAY_SITE_ID?: string }) {
  if (request.method === 'GET') {
    const token = authHeader(request);
    if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);
    try {
      const user = await verifyFirebaseIdToken(env, token);
      const id = new URL(request.url).searchParams.get('id');
      if (!id || !/^[a-f0-9]{64}$/.test(id)) return json({ success: false, message: 'Référence de paiement invalide.' }, 400);
      const payment = await firestoreGet(env, `payments/${id}`);
      if (!payment || payment.uid !== user.uid) return json({ success: false, message: 'Paiement introuvable.' }, 404);
      return json({ success: true, payment: publicPayment(payment) });
    } catch { return json({ success: false, message: 'Impossible de consulter le paiement.' }, 500); }
  }
  if (request.method !== 'POST') return json({ success: false, message: 'Méthode non autorisée.' }, 405);
  const token = authHeader(request);
  if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);
  try {
    const user = await verifyFirebaseIdToken(env, token);
    const body = await request.json() as { plan?: keyof typeof PLANS; phone?: string; paymentMethod?: string; paymentProvider?: string; payerName?: string };
    const planKey = body.plan;
    const plan = planKey ? PLANS[planKey] : undefined;
    const phone = normalizePhone(body.phone);
    const amounts = plan ? calculatePaymentAmounts(plan.amount) : undefined;
    if (!plan || !planKey) return json({ success: false, message: 'Formule invalide.' }, 400);
    if (!phone) return json({ success: false, message: 'Numéro Mobile Money invalide. Utilisez un numéro RDC à 10 chiffres.' }, 400);
    if (!env.CINETPAY_API_KEY || !env.CINETPAY_SITE_ID) return json({ success: false, message: 'CinetPay n’est pas encore configuré côté serveur.' }, 503);
    const profile = await firestoreGet(env, `users/${encodeURIComponent(user.uid)}`);
    if (!profile) return json({ success: false, message: 'Profil utilisateur introuvable.' }, 404);
    if (profile.status === 'suspended') return json({ success: false, message: 'Ce compte est suspendu.' }, 403);
    const decision = decideSubscription(profile, planKey, new Date());
    if ('error' in decision) return json({ success: false, message: decision.error }, 409);
    const payerName = String(body.payerName || profile.displayName || user.email || '').trim();
    if (!payerName || !amounts) return json({ success: false, message: 'Données de paiement invalides.' }, 400);
    const paymentId = randomId();
    const now = new Date().toISOString();
    await firestoreCreate(env, 'payments', paymentId, {
      id: paymentId, uid: user.uid, email: user.email || profile.email || '',
      displayName: profile.displayName || user.email || '',
      fullName: [profile.traderProfile?.firstName, profile.traderProfile?.lastName].filter(Boolean).join(' ') || '',
      plan: planKey, planName: plan.name, amount: amounts.total, baseAmount: amounts.baseAmount,
      paymentFee: amounts.fee, paymentFeeRate: PAYMENT_FEE_RATE, currency: plan.currency, phone, payerName,
      paymentMethod: String(body.paymentMethod || 'mobile_money'), paymentProvider: String(body.paymentProvider || 'CinetPay'),
      provider: 'CINETPAY', subscriptionAction: decision.action, currentPlanAtPurchase: decision.currentPlan,
      activationStartAt: decision.start.toISOString(), activationExpiresAt: decision.expires.toISOString(),
      status: 'initiated', reference: paymentId, transactionReference: paymentReference(paymentId),
      invoiceNumber: invoiceNumber(paymentId, now), createdAt: now
    });
    const origin = new URL(request.url).origin;
    const notifyUrl = new URL('/api/payments/cinetpay/notify', origin).toString();
    const returnUrl = new URL('/?payment=' + encodeURIComponent(paymentId), origin).toString();
    const parts = payerName.split(/\s+/).filter(Boolean);
    const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: env.CINETPAY_API_KEY, site_id: env.CINETPAY_SITE_ID, transaction_id: paymentId,
        amount: amounts.total, currency: plan.currency, description: `IAMTRADER ${plan.name} - abonnement`,
        customer_id: user.uid, customer_name: parts[0] || 'Trader',
        customer_surname: parts.slice(1).join(' ') || 'Trader',
        customer_email: user.email || profile.email || '',
        customer_phone_number: '+243' + phone.slice(1), customer_country: 'CD',
        notify_url: notifyUrl, return_url: returnUrl, channels: 'ALL', lang: 'FR',
        metadata: paymentId, invoice_data: { Formule: plan.name, Reference: paymentReference(paymentId), Client: payerName }
      })
    });
    const result = await response.json() as any;
    const paymentUrl = result?.data?.payment_url;
    if (!response.ok || String(result?.code) !== '201' || !paymentUrl) {
      await firestorePatch(env, `payments/${paymentId}`, { status:'failed', failureMessage:result?.description || result?.message || 'CinetPay a refusé la transaction.', updatedAt:new Date().toISOString() }, ['status','failureMessage','updatedAt']);
      return json({ success:false, message:result?.description || result?.message || 'Impossible d’initier le paiement CinetPay.' },400);
    }
    await firestorePatch(env, `payments/${paymentId}`, { status:'processing', provider:'CINETPAY', paymentUrl, cinetpayPaymentToken:result.data.payment_token || '', updatedAt:new Date().toISOString() }, ['status','provider','paymentUrl','cinetpayPaymentToken','updatedAt']);
    return json({ success:true, payment:{ id:paymentId, plan:planKey, planName:plan.name, amount:amounts.total, baseAmount:amounts.baseAmount, paymentFee:amounts.fee, currency:plan.currency, status:'processing', reference:paymentReference(paymentId), paymentUrl, subscriptionAction:decision.action, activationStartAt:decision.start.toISOString(), activationExpiresAt:decision.expires.toISOString(), message:'Paiement initialisé. Ouvrez le guichet CinetPay pour finaliser la transaction.' }});
  } catch (error) {
    console.error('CinetPay payment initiation error:', error);
    return json({ success:false, message:error instanceof Error ? error.message : 'Impossible d’initier le paiement.' },500);
  }
}

async function handleCinetPayNotification(request: Request, env: PaymentEnv & { CINETPAY_API_KEY?: string; CINETPAY_SITE_ID?: string }) {
  if (request.method === 'GET') return json({ received:true });
  if (request.method !== 'POST') return json({ received:false },405);
  try {
    const type=request.headers.get('content-type') || '';
    const payload=type.includes('application/json') ? await request.json() as any : Object.fromEntries((await request.formData()).entries()) as any;
    const transactionId=String(payload.cpm_trans_id || payload.transaction_id || '').trim();
    if (!transactionId) return json({ received:true });
    const payment=await firestoreGet(env,`payments/${transactionId}`);
    if (!payment) return json({ received:false },404);
    if (payment.status==='paid') return json({ received:true });
    if (!env.CINETPAY_API_KEY || !env.CINETPAY_SITE_ID) return json({ received:false },503);
    const check=await fetch('https://api-checkout.cinetpay.com/v2/payment/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apikey:env.CINETPAY_API_KEY,site_id:env.CINETPAY_SITE_ID,transaction_id:transactionId})});
    const result=await check.json() as any;
    const data=result?.data || {};
    const status=String(data.status || '').toUpperCase();
    if (Number(data.amount) && Number(data.amount)!==Number(payment.amount)) {
      await firestorePatch(env,`payments/${transactionId}`,{status:'failed',failureMessage:'Montant CinetPay différent de la commande.',updatedAt:new Date().toISOString()},['status','failureMessage','updatedAt']);
      return json({received:true});
    }
    if (data.currency && String(data.currency)!==String(payment.currency)) {
      await firestorePatch(env,`payments/${transactionId}`,{status:'failed',failureMessage:'Devise CinetPay différente de la commande.',updatedAt:new Date().toISOString()},['status','failureMessage','updatedAt']);
      return json({received:true});
    }
    if (String(result?.code)==='00' && status==='ACCEPTED') {
      const planKey=payment.plan as keyof typeof PLANS;
      const profile=await firestoreGet(env,`users/${encodeURIComponent(String(payment.uid))}`);
      if (!PLANS[planKey] || !profile) return json({received:false},404);
      const decision=decideSubscription(profile,planKey,new Date());
      if ('error' in decision) return json({received:false},409);
      const paidAt=String(data.payment_date || new Date().toISOString());
      await firestorePatch(env,`payments/${transactionId}`,{status:'paid',paidAt,provider:'CINETPAY',cinetpayStatus:status,cinetpayOperatorId:data.operator_id || '',cinetpayPaymentMethod:data.payment_method || '',updatedAt:paidAt},['status','paidAt','provider','cinetpayStatus','cinetpayOperatorId','cinetpayPaymentMethod','updatedAt']);
      await firestorePatch(env,`users/${encodeURIComponent(String(payment.uid))}`,subscriptionFields(profile,planKey,(payment.subscriptionAction as SubscriptionAction)||decision.action,decision.start.toISOString(),decision.expires.toISOString(),paidAt),['plan','paymentDate','subscriptionStartAt','subscriptionExpiresAt','subscriptionStatus','paymentStatus','planChangeConfirmedAt','pendingPlan','planChangeRequestedAt','scheduledPlan','scheduledStartAt','scheduledExpiresAt','updatedAt']);
      return json({received:true});
    }
    if (['REFUSED','CANCELLED','CANCELED'].includes(status) || String(result?.code)==='627') {
      await firestorePatch(env,`payments/${transactionId}`,{status:'failed',failureMessage:result?.message || 'Paiement CinetPay refusé ou annulé.',cinetpayStatus:status,updatedAt:new Date().toISOString()},['status','failureMessage','cinetpayStatus','updatedAt']);
    } else {
      await firestorePatch(env,`payments/${transactionId}`,{status:'processing',cinetpayStatus:status || 'PENDING',updatedAt:new Date().toISOString()},['status','cinetpayStatus','updatedAt']);
    }
    return json({received:true});
  } catch(error) {
    console.error('CinetPay notification error:',error);
    return json({received:false},500);
  }
}

export async function handlePaymentCallback(request: Request, env: PaymentEnv & { CINETPAY_API_KEY?: string; CINETPAY_SITE_ID?: string }) {
  return handleCinetPayNotification(request,env);
}

export async function handleSimulatedPaymentRequest(request: Request, env: PaymentEnv & { PAYMENT_SIMULATION_ENABLED?: string }) {
  if (!simulationEnabled(env)) return json({ success: false, message: 'La simulation de paiement est désactivée.' }, 404);
  if (request.method !== 'POST') return json({ success: false, message: 'Méthode non autorisée.' }, 405);

  const token = authHeader(request);
  if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);

  try {
    const user = await verifyFirebaseIdToken(env, token);
    const body = await request.json() as { plan?: keyof typeof PLANS; phone?: string; idempotencyKey?: string; paymentMethod?: string; paymentProvider?: string; payerName?: string };
    const planKey = body.plan;
    const plan = planKey ? PLANS[planKey] : undefined;
    const phone = normalizePhone(body.phone);
    const paymentAmounts = plan ? calculatePaymentAmounts(plan.amount) : undefined;
    const idempotencyKey = String(body.idempotencyKey || '').replace(/[^a-f0-9]/gi, '').toLowerCase();

    if (!plan || !planKey) return json({ success: false, message: 'Formule invalide.' }, 400);
    if (!phone) return json({ success: false, message: 'Numéro Mobile Money invalide.' }, 400);
    if (idempotencyKey.length !== 64) return json({ success: false, message: 'Clé de paiement invalide.' }, 400);
    if (!paymentAmounts) return json({ success: false, message: 'Montant de paiement invalide.' }, 400);

    const profile = await firestoreGet(env, `users/${encodeURIComponent(user.uid)}`);
    if (!profile) return json({ success: false, message: 'Profil utilisateur introuvable.' }, 404);
    if (profile.status === 'suspended') return json({ success: false, message: 'Ce compte est suspendu.' }, 403);

    const decision = decideSubscription(profile, planKey, new Date());
    if ('error' in decision) return json({ success: false, message: decision.error }, 409);
    const payerName = String(body.payerName || profile.displayName || user.email || '').trim();
    if (!payerName) return json({ success: false, message: 'Le nom du titulaire du paiement est requis.' }, 400);
    const paymentMethod = String(body.paymentMethod || 'mobile_money');
    const paymentProvider = String(body.paymentProvider || '');

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
      fullName: [profile.traderProfile?.firstName, profile.traderProfile?.lastName].filter(Boolean).join(' ') || '',
      plan: planKey,
      planName: plan.name,
      amount: paymentAmounts.total,
      baseAmount: paymentAmounts.baseAmount,
      paymentFee: paymentAmounts.fee,
      paymentFeeRate: PAYMENT_FEE_RATE,
      currency: plan.currency,
      phone,
      payerName,
      paymentMethod,
      paymentProvider,
      provider: 'SIMULATOR',
      subscriptionAction: decision.action,
      currentPlanAtPurchase: decision.currentPlan,
      activationStartAt: decision.start.toISOString(),
      activationExpiresAt: decision.expires.toISOString(),
      mode: 'simulation',
      status: 'processing',
      reference: idempotencyKey,
      transactionReference: paymentReference(idempotencyKey, now),
      invoiceNumber: invoiceNumber(idempotencyKey, now),
      createdAt: now,
      updatedAt: now
    });

    return json({
      success: true,
      payment: {
        id: idempotencyKey,
        plan: planKey,
        planName: plan.name,
        amount: paymentAmounts.total,
        baseAmount: paymentAmounts.baseAmount,
        paymentFee: paymentAmounts.fee,
        currency: plan.currency,
        status: 'processing',
        reference: paymentReference(idempotencyKey, now),
        subscriptionAction: decision.action,
        activationStartAt: decision.start.toISOString(),
        activationExpiresAt: decision.expires.toISOString(),
        message: 'Paiement simulé créé. Confirmez pour déclencher le webhook de succès.'
      }
    });
  } catch (error) {
    const details = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { error: String(error) };
    console.error('Simulated payment initiation error:', JSON.stringify(details));
    return json({ success: false, message: error instanceof Error ? error.message : 'Impossible de créer la simulation.' }, 500);
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
    if (!plan || Number(payment.amount) !== calculatePaymentAmounts(plan.amount).total || payment.currency !== plan.currency) {
      return json({ success: false, message: 'Le montant de la transaction ne correspond pas au tarif du plan.' }, 409);
    }

    const now = new Date();
    const paidAt = now.toISOString();
    const profile = await firestoreGet(env, `users/${encodeURIComponent(String(payment.uid))}`);
    if (!profile) return json({ success: false, message: 'Profil utilisateur introuvable.' }, 404);
    const decision = decideSubscription(profile, planKey, now);
    if ('error' in decision) return json({ success: false, message: decision.error }, 409);
    const start = decision.start.toISOString();
    const expires = decision.expires.toISOString();

    await firestorePatch(env, `payments/${id}`, {
      status: 'paid',
      paidAt,
      updatedAt: paidAt,
      provider: 'SIMULATOR',
      confirmationSource: 'simulated_webhook'
    }, ['status', 'paidAt', 'updatedAt', 'provider', 'confirmationSource']);

    await firestorePatch(env, `users/${encodeURIComponent(String(payment.uid))}`, subscriptionFields(profile, planKey, (payment.subscriptionAction as SubscriptionAction) || decision.action, start, expires, paidAt), [
      'plan', 'paymentDate', 'subscriptionStartAt', 'subscriptionExpiresAt', 'subscriptionStatus', 'paymentStatus',
      'planChangeConfirmedAt', 'pendingPlan', 'planChangeRequestedAt', 'scheduledPlan', 'scheduledStartAt', 'scheduledExpiresAt', 'updatedAt'
    ]);

    const finalPayment = await firestoreGet(env, `payments/${id}`);
    return json({ success: true, payment: publicPayment(finalPayment || { ...payment, status: 'paid', paidAt }) });
  } catch (error) {
    console.error('Simulated payment confirmation error:', error);
    return json({ success: false, message: error instanceof Error ? error.message : 'Impossible de confirmer la simulation.' }, 500);
  }
}
