import { firestoreCreate, firestoreGet, firestorePatch, PaymentEnv, verifyFirebaseIdToken } from './firebaseAdmin';
import { decideSubscription, subscriptionFields, SubscriptionAction } from './subscription';


const PLANS = {
  pro: { name: 'Plus', amount: 9.99, currency: 'USD', durationDays: 30 },
  community: { name: 'Community', amount: 89.99, currency: 'USD', durationDays: 180 }
} as const;

const PAYMENT_FEE_RATE = 0.03;

export function calculatePaymentAmounts(baseAmount: number) {
  const fee = Math.round(baseAmount * PAYMENT_FEE_RATE * 100) / 100;
  const total = Math.round((baseAmount + fee) * 100) / 100;
  return { baseAmount, fee, total };
}

function amountsMatchToCents(actual: number, expected: number) {
  return Number.isFinite(actual) && Math.round(actual * 100) === Math.round(expected * 100);
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
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

function traderFullName(profile: Record<string, unknown>) {
  const traderProfile = profile.traderProfile as { firstName?: unknown; lastName?: unknown } | undefined;
  return [traderProfile?.firstName, traderProfile?.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
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

type SasPayEnv = PaymentEnv & {
  SASPAY_API_KEY?: string;
  SASPAY_WEBHOOK_SECRET?: string;
  SASPAY_COUNTRY?: string;
};

type CinetPayEnv = SasPayEnv & {
  CINETPAY_API_KEY?: string;
  CINETPAY_API_PASSWORD?: string;
  CINETPAY_COUNTRY?: string;
  CINETPAY_PLUS_AMOUNT_CDF?: string;
  CINETPAY_COMMUNITY_AMOUNT_CDF?: string;
};

function cinetPayBaseUrl(apiKey: string) {
  return apiKey.startsWith('sk_test_') ? 'https://api.cinetpay.net' : 'https://api.cinetpay.co';
}

function cinetPayCurrency(country: string) {
  return country === 'CD' ? 'CDF' : 'USD';
}

function cinetPayAmount(env: CinetPayEnv, planKey: keyof typeof PLANS) {
  const configured = planKey === 'pro' ? env.CINETPAY_PLUS_AMOUNT_CDF : env.CINETPAY_COMMUNITY_AMOUNT_CDF;
  const amount = Number(configured);
  if (Number.isInteger(amount) && amount >= 100 && amount <= 2500000) return amount;
  return planKey === 'pro' ? 23335 : 210196;
}

function cinetPayPaymentMethod(provider: string) {
  const normalized = provider.trim().toLowerCase();
  if (normalized.includes('airtel')) return 'AIRTEL_CD';
  if (normalized.includes('m-pesa') || normalized.includes('mpesa')) return 'MPESA_CD';
  if (normalized.includes('orange')) return 'OM_CD';
  if (normalized.includes('africell')) return 'AFRICELL_CD';
  return undefined;
}

async function cinetPayAccessToken(env: CinetPayEnv) {
  if (!env.CINETPAY_API_KEY || !env.CINETPAY_API_PASSWORD) {
    throw new Error('CinetPay n’est pas configuré côté serveur.');
  }
  const response = await fetch(`${cinetPayBaseUrl(env.CINETPAY_API_KEY)}/v1/oauth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.CINETPAY_API_KEY,
      api_password: env.CINETPAY_API_PASSWORD
    })
  });
  const raw = await response.text();
  let result: any = {};
  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    result = {};
  }
  const token = result?.access_token || result?.data?.access_token;
  if (!response.ok || !token) {
    const detail = result?.description || result?.message || result?.error || raw.slice(0, 300);
    throw new Error(`Authentification CinetPay impossible (HTTP ${response.status}). ${detail}`);
  }
  return String(token);
}

async function cinetPayRequest(env: CinetPayEnv, path: string, init: RequestInit = {}) {
  if (!env.CINETPAY_API_KEY || !env.CINETPAY_API_PASSWORD) {
    throw new Error('CinetPay n’est pas configuré côté serveur.');
  }
  const token = await cinetPayAccessToken(env);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(`${cinetPayBaseUrl(env.CINETPAY_API_KEY)}${path}`, { ...init, headers });
}


async function createSasPayCheckout(
  request: Request,
  env: SasPayEnv,
  user: any,
  body: any,
  profile: any,
  planKey: keyof typeof PLANS,
  plan: (typeof PLANS)[keyof typeof PLANS],
  phone: string | null,
  amounts: ReturnType<typeof calculatePaymentAmounts>,
  decision: any,
  payerName: string
) {
  if (!env.SASPAY_API_KEY || !env.SASPAY_WEBHOOK_SECRET) {
    return json({ success: false, message: 'SasPay n’est pas entièrement configuré côté serveur. Ajoutez les secrets SASPAY_API_KEY et SASPAY_WEBHOOK_SECRET au Worker avant d’accepter des paiements.' }, 503);
  }

  const customerEmail = String(user.email || profile.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return json({ success: false, message: 'Une adresse e-mail valide est nécessaire pour créer une session SasPay.' }, 400);
  }

  const paymentId = randomId();
  const now = new Date().toISOString();
  const amount = amounts.total.toFixed(2);
  const currency = 'USD';
  const country = String(env.SASPAY_COUNTRY || 'XC').trim().toUpperCase();
  if (!['XC', 'XX'].includes(country)) {
    return json({ success: false, message: 'Pour un paiement IAMTRADER en USD depuis la RDC, SASPAY_COUNTRY doit être XC (RDC/USD) ou XX (International/USD).' }, 503);
  }

  await firestoreCreate(env, 'payments', paymentId, {
    id: paymentId,
    uid: user.uid,
    email: user.email || profile.email || '',
    displayName: profile.displayName || user.email || '',
    fullName: traderFullName(profile),
    plan: planKey,
    planName: plan.name,
    amount: Number(amount),
    amountUsd: Number(amount),
    baseAmount: amounts.baseAmount,
    paymentFee: amounts.fee,
    paymentFeeRate: PAYMENT_FEE_RATE,
    currency,
    phone,
    payerName,
    paymentMethod: String(body.paymentMethod || 'mobile_money'),
    paymentProvider: 'SasPay',
    provider: 'SASPAY',
    subscriptionAction: decision.action,
    currentPlanAtPurchase: decision.currentPlan,
    activationStartAt: decision.start.toISOString(),
    activationExpiresAt: decision.expires.toISOString(),
    status: 'initiated',
    reference: paymentId,
    transactionReference: paymentReference(paymentId),
    invoiceNumber: invoiceNumber(paymentId, now),
    createdAt: now
  });

  const origin = new URL(request.url).origin;
  const returnUrl = new URL('/?payment=' + encodeURIComponent(paymentId), origin).toString();
  const description = 'IAMTRADER-' + paymentId + '-' + plan.name + ' subscription';
  const providerLabel = String(body.network || (String(body.paymentProvider || '').trim().toLowerCase() === 'saspay' ? body.paymentMethod : body.paymentProvider) || 'Airtel Money').trim().toLowerCase();
  const networkMap: Record<string, string> = {
    'vodacom m-pesa': 'vodacom_cd',
    'vodacom mpesa': 'vodacom_cd',
    'm-pesa': 'vodacom_cd',
    'mpesa': 'vodacom_cd',
    'airtel money': 'airtel_cd',
    'orange money': 'orange_cd',
    'visa / mastercard': 'card',
    'card': 'card'
  };
  const network = networkMap[providerLabel];
  if (!network) {
    await firestorePatch(env, 'payments/' + paymentId, {
      status: 'failed',
      failureMessage: 'Réseau SasPay non pris en charge.',
      updatedAt: new Date().toISOString()
    }, ['status', 'failureMessage', 'updatedAt']);
    return json({ success: false, message: 'Choisissez Vodacom M-Pesa, Airtel Money, Orange Money ou Visa/Mastercard.' }, 400);
  }
  const e164Phone = phone ? (phone.startsWith('+') ? phone : '+243' + phone.replace(/^0/, '')) : '';
  const idempotencyKey = crypto.randomUUID();
  const requestPayload: Record<string, unknown> = {
    amount: Number(amount),
    currency,
    network,
    customer_email: customerEmail,
    reference: 'IAM-SUB-' + paymentId,
    description
  };
  if (network !== 'card') requestPayload.phone_number = e164Phone;
  else requestPayload.return_url = returnUrl;

  const response = await fetch('https://api.saspay.me/api/v1/payments/softpay/initialize/', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.SASPAY_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(requestPayload)
  });

  const raw = await response.text();
  let result: any = {};
  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    result = {};
  }
  const data = result?.data || result;
  const saspayPaymentId = data?.payment_id || data?.paymentId || data?.id;
  const status = String(data?.status || '').toUpperCase();
  if (!response.ok || result?.success === false || !saspayPaymentId || !['PENDING', 'PROCESSING', 'SUCCESS'].includes(status)) {
    await firestorePatch(env, 'payments/' + paymentId, {
      status: 'failed',
      failureMessage: result?.message || result?.detail || 'SasPay a refusé l’initialisation du paiement.',
      saspayHttpStatus: response.status,
      updatedAt: new Date().toISOString()
    }, ['status', 'failureMessage', 'saspayHttpStatus', 'updatedAt']);
    console.error('SasPay Softpay initialization failed:', response.status, raw.slice(0, 500));
    return json({
      success: false,
      message: result?.message || result?.detail || 'Impossible d’initier le paiement direct SasPay. Vérifiez la configuration de votre compte marchand.'
    }, 502);
  }

  await firestorePatch(env, 'payments/' + paymentId, {
    status: status === 'SUCCESS' ? 'processing' : 'processing',
    provider: 'SASPAY',
    saspayPaymentId: String(saspayPaymentId),
    saspayNetwork: network,
    saspayIdempotencyKey: idempotencyKey,
    saspayStatus: status,
    saspayUserInstructions: String(data?.user_instructions || ''),
    saspayReference: String(data?.reference || requestPayload.reference),
    updatedAt: new Date().toISOString()
  }, ['status', 'provider', 'saspayPaymentId', 'saspayNetwork', 'saspayIdempotencyKey', 'saspayStatus', 'saspayUserInstructions', 'saspayReference', 'updatedAt']);

  return json({
    success: true,
    payment: {
      id: paymentId,
      plan: planKey,
      planName: plan.name,
      amount: Number(amount),
      amountUsd: Number(amount),
      baseAmount: amounts.baseAmount,
      paymentFee: amounts.fee,
      currency,
      status: 'processing',
      reference: paymentReference(paymentId),
      paymentUrl: network === 'card' ? (data?.payment_url || data?.checkout_url || null) : null,
      subscriptionAction: decision.action,
      activationStartAt: decision.start.toISOString(),
      activationExpiresAt: decision.expires.toISOString(),
      message: String(data?.user_instructions || 'Demande envoyée. Validez le paiement sur votre téléphone, puis attendez la confirmation.')
    }
  });
}

export async function handlePaymentRequest(request: Request, env: CinetPayEnv) {
  let paymentStage = 'start';
  if (request.method === 'GET') {
    const token = authHeader(request);
    if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);
    try {
      paymentStage = 'firebase-auth';
    const user = await verifyFirebaseIdToken(env, token);
      const id = new URL(request.url).searchParams.get('id');
      if (!id || !/^(?:[a-f0-9]{24}|[a-f0-9]{64})$/.test(id)) {
        return json({ success: false, message: 'Référence de paiement invalide.' }, 400);
      }
      let payment = await firestoreGet(env, `payments/${id}`);
      if (!payment || payment.uid !== user.uid) return json({ success: false, message: 'Paiement introuvable.' }, 404);

      // Reconcile Softpay status during frontend polling, in case the webhook is delayed.
      if (payment.provider === 'SASPAY' && payment.status === 'processing' && payment.saspayPaymentId && env.SASPAY_API_KEY) {
        const verifyResponse = await fetch('https://api.saspay.me/api/v1/payments/' + encodeURIComponent(String(payment.saspayPaymentId)) + '/verify/', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + env.SASPAY_API_KEY }
        });
        const verifyRaw = await verifyResponse.text();
        let verifyResult: any = {};
        try { verifyResult = verifyRaw ? JSON.parse(verifyRaw) : {}; } catch { verifyResult = {}; }
        const canonical = verifyResult?.data || verifyResult;
        if (verifyResponse.ok && String(canonical?.payment_id || '') === String(payment.saspayPaymentId)) {
          const canonicalStatus = String(canonical?.status || '').toUpperCase();
          if (canonicalStatus === 'SUCCESS') {
            const amountMatches = amountsMatchToCents(Number(canonical?.amount), Number(payment.amount));
            const currencyMatches = String(canonical?.currency || '').toUpperCase() === String(payment.currency || '').toUpperCase();
            const expectedReference = 'IAM-SUB-' + id;
            if (!amountMatches || !currencyMatches || String(canonical?.reference || '') !== expectedReference) {
              await firestorePatch(env, 'payments/' + id, {
                status: 'failed',
                failureMessage: !amountMatches ? 'Montant SasPay différent du montant attendu.' : !currencyMatches ? 'Devise SasPay différente de la commande.' : 'Référence SasPay différente de la commande.',
                saspayStatus: canonicalStatus,
                updatedAt: new Date().toISOString()
              }, ['status', 'failureMessage', 'saspayStatus', 'updatedAt']);
            } else {
              const profile = await firestoreGet(env, `users/${encodeURIComponent(String(payment.uid))}`);
              const planKey = payment.plan as keyof typeof PLANS;
              if (profile && PLANS[planKey]) {
                const paidAt = String(canonical?.paid_at || new Date().toISOString());
                const action = payment.subscriptionAction as SubscriptionAction;
                const startAt = String(payment.activationStartAt || '');
                const expiresAt = String(payment.activationExpiresAt || '');
                const validActivation = ['initial', 'renewal', 'upgrade'].includes(String(action)) && Number.isFinite(new Date(startAt).getTime()) && Number.isFinite(new Date(expiresAt).getTime());
                const decision = validActivation ? null : decideSubscription(profile, planKey, new Date(paidAt));
                if (!decision || !('error' in decision)) {
                  await firestorePatch(env, 'payments/' + id, {
                    status: 'paid', paidAt, saspayStatus: 'SUCCESS',
                    saspayTransactionId: String(canonical?.transaction_id || ''),
                    updatedAt: paidAt
                  }, ['status', 'paidAt', 'saspayStatus', 'saspayTransactionId', 'updatedAt']);
                  await firestorePatch(env, 'users/' + encodeURIComponent(String(payment.uid)), subscriptionFields(
                    profile, planKey, validActivation ? action : decision!.action,
                    validActivation ? new Date(startAt).toISOString() : decision!.start.toISOString(),
                    validActivation ? new Date(expiresAt).toISOString() : decision!.expires.toISOString(),
                    paidAt
                  ), ['plan', 'paymentDate', 'subscriptionStartAt', 'subscriptionExpiresAt', 'subscriptionStatus', 'paymentStatus', 'planChangeConfirmedAt', 'pendingPlan', 'planChangeRequestedAt', 'scheduledPlan', 'scheduledStartAt', 'scheduledExpiresAt', 'updatedAt']);
                }
              }
            }
          } else if (['FAILED', 'EXPIRED'].includes(canonicalStatus)) {
            await firestorePatch(env, 'payments/' + id, {
              status: 'failed',
              failureMessage: 'Paiement SasPay ' + canonicalStatus + '.',
              saspayStatus: canonicalStatus,
              updatedAt: new Date().toISOString()
            }, ['status', 'failureMessage', 'saspayStatus', 'updatedAt']);
          }
          payment = await firestoreGet(env, `payments/${id}`) || payment;
        }
      }
      return json({ success: true, payment: publicPayment(payment) });
    } catch {
      return json({ success: false, message: 'Impossible de consulter le paiement.' }, 500);
    }
  }

  if (request.method !== 'POST') return json({ success: false, message: 'Méthode non autorisée.' }, 405);

  const token = authHeader(request);
  if (!token) return json({ success: false, message: 'Authentification requise.' }, 401);

  try {
    const user = await verifyFirebaseIdToken(env, token);
    const body = await request.json() as {
      plan?: keyof typeof PLANS;
      phone?: string;
      paymentMethod?: string;
      paymentProvider?: string;
      payerName?: string;
    };
    const planKey = body.plan;
    const plan = planKey ? PLANS[planKey] : undefined;
    const phone = normalizePhone(body.phone);
    const amounts = plan ? calculatePaymentAmounts(plan.amount) : undefined;
    const isSasPay = String(body.paymentProvider || '').trim().toLowerCase() === 'saspay';

    if (!plan || !planKey) return json({ success: false, message: 'Formule invalide.' }, 400);
    if (!isSasPay && !phone) return json({ success: false, message: 'Numéro Mobile Money invalide. Utilisez un numéro RDC à 10 chiffres.' }, 400);
    if (!isSasPay && (!env.CINETPAY_API_KEY || !env.CINETPAY_API_PASSWORD)) {
      const configState = [
        'API_KEY=' + (env.CINETPAY_API_KEY ? 'OK' : 'MISSING'),
        'API_PASSWORD=' + (env.CINETPAY_API_PASSWORD ? 'OK' : 'MISSING'),
        'COUNTRY=' + (env.CINETPAY_COUNTRY || 'CD')
      ].join(', ');
      console.error('CinetPay runtime configuration incomplete:', configState);
      return json({
        success: false,
        message: 'Configuration CinetPay serveur incomplète (' + configState + '). Vérifiez les secrets du Worker de production.'
      }, 503);
    }
    if (!isSasPay && (env.CINETPAY_COUNTRY || 'CD') !== 'CD') {
      return json({ success: false, message: 'La configuration CinetPay doit utiliser le pays CD (configuration actuelle: ' + env.CINETPAY_COUNTRY + ').' }, 503);
    }

    paymentStage = 'firestore-profile';
    const profile = await firestoreGet(env, `users/${encodeURIComponent(user.uid)}`);
    if (!profile) return json({ success: false, message: 'Profil utilisateur introuvable.' }, 404);
    if (profile.status === 'suspended') return json({ success: false, message: 'Ce compte est suspendu.' }, 403);

    const decision = decideSubscription(profile, planKey, new Date());
    if ('error' in decision) return json({ success: false, message: decision.error }, 409);

    const payerName = String(body.payerName || profile.displayName || user.email || 'Client IAMTRADER').trim();
    if (!amounts) return json({ success: false, message: 'Données de paiement invalides.' }, 400);
    if (isSasPay) {
      return await createSasPayCheckout(request, env, user, body, profile, planKey, plan, phone, amounts, decision, payerName);
    }

    const chargedAmount = cinetPayAmount(env, planKey);
    const currency = cinetPayCurrency(env.CINETPAY_COUNTRY || 'CD');
    const paymentId = randomId();
    const now = new Date().toISOString();

    paymentStage = 'firestore-create';
    await firestoreCreate(env, 'payments', paymentId, {
      id: paymentId,
      uid: user.uid,
      email: user.email || profile.email || '',
      displayName: profile.displayName || user.email || '',
      fullName: traderFullName(profile),
      plan: planKey,
      planName: plan.name,
      amount: chargedAmount,
      amountUsd: amounts.total,
      baseAmount: amounts.baseAmount,
      paymentFee: amounts.fee,
      paymentFeeRate: PAYMENT_FEE_RATE,
      currency,
      phone: phone || '',
      payerName,
      paymentMethod: String(body.paymentMethod || 'mobile_money'),
      paymentProvider: String(body.paymentProvider || 'CinetPay'),
      provider: 'CINETPAY',
      subscriptionAction: decision.action,
      currentPlanAtPurchase: decision.currentPlan,
      activationStartAt: decision.start.toISOString(),
      activationExpiresAt: decision.expires.toISOString(),
      status: 'initiated',
      reference: paymentId,
      transactionReference: paymentReference(paymentId),
      invoiceNumber: invoiceNumber(paymentId, now),
      createdAt: now
    });

    const origin = new URL(request.url).origin;
    const notifyUrl = new URL('/api/payments/cinetpay/notify', origin).toString();
    const returnUrl = new URL('/?payment=' + encodeURIComponent(paymentId), origin).toString();
    const failedUrl = new URL('/?payment=failed&paymentId=' + encodeURIComponent(paymentId), origin).toString();
    const parts = payerName.split(/\s+/).filter(Boolean);
    const paymentMethod = cinetPayPaymentMethod(String(body.paymentProvider || ''));

    paymentStage = 'cinetpay-init';
    const response = await cinetPayRequest(env, '/v1/payment', {
      method: 'POST',
      body: JSON.stringify({
        currency,
        merchant_transaction_id: paymentId,
        amount: chargedAmount,
        lang: 'fr',
        designation: `IAMTRADER ${plan.name} - abonnement`,
        client_email: user.email || profile.email || '',
        client_first_name: parts[0] || 'Trader',
        client_last_name: parts.slice(1).join(' ') || 'Trader',
        client_phone_number: '+243' + phone.slice(1),
        client_country: 'CD',
        success_url: returnUrl,
        failed_url: failedUrl,
        notify_url: notifyUrl,
        channel: 'PUSH',
        ...(paymentMethod ? { payment_method: paymentMethod } : {}),
        direct_pay: false
      })
    });

    const raw = await response.text();
    let result: any = {};
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      result = {};
    }
    const data = result?.data || result;
    const paymentUrl = data?.payment_url || data?.paymentUrl;
    const paymentToken = data?.payment_token || data?.paymentToken;
    const notifyToken = data?.notify_token || data?.notifyToken;
    const transactionId = data?.transaction_id || data?.transactionId;

    if (!response.ok || !paymentUrl || !paymentToken || !notifyToken || !transactionId) {
      paymentStage = 'firestore-payment-update';
    await firestorePatch(env, `payments/${paymentId}`, {
        status: 'failed',
        failureMessage: result?.description || result?.message || 'CinetPay a refusé la transaction.',
        cinetpayCode: result?.code || null,
        updatedAt: new Date().toISOString()
      }, ['status', 'failureMessage', 'cinetpayCode', 'updatedAt']);
      return json({
        success: false,
        message: result?.description || result?.message || 'Impossible d’initier le paiement CinetPay.'
      }, 400);
    }

    await firestorePatch(env, `payments/${paymentId}`, {
      status: 'processing',
      provider: 'CINETPAY',
      paymentUrl,
      cinetpayPaymentToken: paymentToken,
      cinetpayNotifyToken: notifyToken,
      cinetpayTransactionId: transactionId,
      cinetpayStatus: result?.status || data?.status || 'INITIATED',
      updatedAt: new Date().toISOString()
    }, ['status', 'provider', 'paymentUrl', 'cinetpayPaymentToken', 'cinetpayNotifyToken', 'cinetpayTransactionId', 'cinetpayStatus', 'updatedAt']);

    return json({
      success: true,
      payment: {
        id: paymentId,
        plan: planKey,
        planName: plan.name,
        amount: chargedAmount,
        amountUsd: amounts.total,
        baseAmount: amounts.baseAmount,
        paymentFee: amounts.fee,
        currency,
        status: 'processing',
        reference: paymentReference(paymentId),
        paymentUrl,
        paymentToken,
        subscriptionAction: decision.action,
        activationStartAt: decision.start.toISOString(),
        activationExpiresAt: decision.expires.toISOString(),
        message: 'Paiement initialisé. Vous allez être redirigé vers le guichet sécurisé CinetPay.'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible d’initier le paiement.';
    console.error('CinetPay payment initiation error:', paymentStage, message);
    return json({
      success: false,
      message: `Échec du paiement à l’étape "${paymentStage}": ${message}`
    }, 500);
  }
}

export async function handleCinetPayNotification(request: Request, env: CinetPayEnv) {
  if (request.method === 'GET') return json({ received: true });
  if (request.method !== 'POST') return json({ received: false }, 405);

  try {
    const contentType = request.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await request.json() as any
      : Object.fromEntries((await request.formData()).entries()) as any;

    const merchantTransactionId = String(
      payload.merchant_transaction_id || payload.merchantTransactionId || ''
    ).trim();
    const notifyToken = String(payload.notify_token || payload.notifyToken || '').trim();
    const cinetpayTransactionId = String(
      payload.transaction_id || payload.transactionId || ''
    ).trim();

    if (!merchantTransactionId) return json({ received: true });

    const payment = await firestoreGet(env, `payments/${merchantTransactionId}`);
    if (!payment) return json({ received: false }, 404);
    if (payment.status === 'paid') return json({ received: true });

    if (!notifyToken || !payment.cinetpayNotifyToken || notifyToken !== String(payment.cinetpayNotifyToken)) {
      return json({ received: false, message: 'Notification CinetPay invalide.' }, 401);
    }

    if (!env.CINETPAY_API_KEY || !env.CINETPAY_API_PASSWORD) return json({ received: false }, 503);

    const statusResponse = await cinetPayRequest(
      env,
      `/v1/payment/${encodeURIComponent(merchantTransactionId)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    const statusResult = await statusResponse.json() as any;
    const canonical = statusResult?.data || statusResult;
    const status = String(canonical?.status || '').toUpperCase();
    const canonicalMerchantId = String(
      canonical?.merchant_transaction_id || canonical?.merchantTransactionId || ''
    );

    if (canonicalMerchantId && canonicalMerchantId !== merchantTransactionId) {
      return json({ received: false, message: 'Transaction CinetPay non correspondante.' }, 400);
    }

    if (cinetpayTransactionId && canonical?.transaction_id && String(canonical.transaction_id) !== cinetpayTransactionId) {
      return json({ received: false, message: 'Identifiant de transaction CinetPay non correspondant.' }, 400);
    }

    if (status === 'SUCCESS' || String(statusResult?.code) === '100') {
      if (Number(canonical?.amount) && Number(canonical.amount) !== Number(payment.amount)) {
        await firestorePatch(env, `payments/${merchantTransactionId}`, {
          status: 'failed',
          failureMessage: 'Montant CinetPay différent de la commande.',
          updatedAt: new Date().toISOString()
        }, ['status', 'failureMessage', 'updatedAt']);
        return json({ received: true });
      }

      if (canonical?.currency && String(canonical.currency) !== String(payment.currency)) {
        await firestorePatch(env, `payments/${merchantTransactionId}`, {
          status: 'failed',
          failureMessage: 'Devise CinetPay différente de la commande.',
          updatedAt: new Date().toISOString()
        }, ['status', 'failureMessage', 'updatedAt']);
        return json({ received: true });
      }

      const planKey = payment.plan as keyof typeof PLANS;
      const profile = await firestoreGet(env, `users/${encodeURIComponent(String(payment.uid))}`);
      if (!PLANS[planKey] || !profile) return json({ received: false }, 404);

      const decision = decideSubscription(profile, planKey, new Date());
      if ('error' in decision) return json({ received: false }, 409);

      const paidAt = String(canonical?.payment_date || canonical?.paymentDate || new Date().toISOString());

      await firestorePatch(env, `payments/${merchantTransactionId}`, {
        status: 'paid',
        paidAt,
        provider: 'CINETPAY',
        cinetpayStatus: 'SUCCESS',
        cinetpayTransactionId: canonical?.transaction_id || cinetpayTransactionId || '',
        cinetpayPaymentMethod: canonical?.payment_method || canonical?.paymentMethod || '',
        updatedAt: paidAt
      }, ['status', 'paidAt', 'provider', 'cinetpayStatus', 'cinetpayTransactionId', 'cinetpayPaymentMethod', 'updatedAt']);

      await firestorePatch(
        env,
        `users/${encodeURIComponent(String(payment.uid))}`,
        subscriptionFields(
          profile,
          planKey,
          (payment.subscriptionAction as SubscriptionAction) || decision.action,
          decision.start.toISOString(),
          decision.expires.toISOString(),
          paidAt
        ),
        ['plan', 'paymentDate', 'subscriptionStartAt', 'subscriptionExpiresAt', 'subscriptionStatus', 'paymentStatus', 'planChangeConfirmedAt', 'pendingPlan', 'planChangeRequestedAt', 'scheduledPlan', 'scheduledStartAt', 'scheduledExpiresAt', 'updatedAt']
      );

      return json({ received: true });
    }

    if ([2010, 2005].includes(Number(statusResult?.code)) || ['FAILED', 'INSUFFICIENT_BALANCE', 'EXPIRED'].includes(status)) {
      await firestorePatch(env, `payments/${merchantTransactionId}`, {
        status: 'failed',
        failureMessage: statusResult?.description || statusResult?.message || `Paiement CinetPay ${status || 'échoué'}.`,
        cinetpayStatus: status || 'FAILED',
        updatedAt: new Date().toISOString()
      }, ['status', 'failureMessage', 'cinetpayStatus', 'updatedAt']);
    } else {
      await firestorePatch(env, `payments/${merchantTransactionId}`, {
        status: 'processing',
        cinetpayStatus: status || 'PENDING',
        updatedAt: new Date().toISOString()
      }, ['status', 'cinetpayStatus', 'updatedAt']);
    }

    return json({ received: true });
  } catch (error) {
    console.error('CinetPay notification error:', error);
    return json({ received: false }, 500);
  }
}

export async function handlePaymentCallback(request: Request, env: CinetPayEnv) {
  return handleCinetPayNotification(request, env);
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
      fullName: traderFullName(profile),
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
      transactionReference: paymentReference(idempotencyKey),
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
        reference: paymentReference(idempotencyKey),
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


export async function verifySasPayWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!/^\d{1,12}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > 300) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = timestamp + '.' + rawBody;
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed)));
  const expected = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index);
  }
  return difference === 0;
}

type SasPayWebhookDependencies = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  firestoreGet: typeof firestoreGet;
  firestorePatch: typeof firestorePatch;
  now: () => Date;
};

export async function handleSasPayWebhook(
  request: Request,
  env: SasPayEnv,
  dependencies: Partial<SasPayWebhookDependencies> = {}
) {
  const fetcher = dependencies.fetch || ((input, init) => globalThis.fetch(input, init));
  const readDocument = dependencies.firestoreGet || firestoreGet;
  const patchDocument = dependencies.firestorePatch || firestorePatch;
  const now = dependencies.now || (() => new Date());
  if (request.method !== 'POST') return json({ received: false, message: 'Méthode non autorisée.' }, 405);
  if (!env.SASPAY_WEBHOOK_SECRET || !env.SASPAY_API_KEY) {
    return json({ received: false, message: 'Configuration SasPay incomplète.' }, 503);
  }

  try {
    const rawBody = await request.text();
    const signedHeader = request.headers.get('X-SasPay-Signature') || '';
    const simpleSignature = request.headers.get('X-Signature') || '';
    let valid = false;

    // SasPay Softpay: X-SasPay-Signature: t=<unix>,v1=<hex> signs "<timestamp>.<raw body>".
    const timestampMatch = signedHeader.match(/(?:^|[, ])t=(\d+)/);
    const v1Match = signedHeader.match(/(?:^|[, ])v1=([a-f0-9]{64})/i);
    if (timestampMatch && v1Match) {
      valid = await verifySasPayWebhookSignature(
        rawBody,
        v1Match[1],
        timestampMatch[1],
        env.SASPAY_WEBHOOK_SECRET,
        Math.floor(now().getTime() / 1000)
      );
    } else if (/^[a-f0-9]{64}$/i.test(simpleSignature)) {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SASPAY_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
      const expected = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
      if (expected.length === simpleSignature.length) {
        let difference = 0;
        for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ simpleSignature.toLowerCase().charCodeAt(i);
        valid = difference === 0;
      }
    }
    if (!valid) return json({ received: false, message: 'Signature SasPay invalide ou expirée.' }, 401);

    let payload: any;
    try { payload = JSON.parse(rawBody); }
    catch { return json({ received: false, message: 'Corps JSON invalide.' }, 400); }

    const event = String(payload?.event || request.headers.get('X-Webhook-Event') || '');
    const eventData = payload?.data || payload;
    const saspayPaymentId = String(eventData?.payment_id || payload?.payment_id || '').trim();
    const reference = String(eventData?.reference || payload?.reference || '').trim();
    const match = reference.match(/^IAM-SUB-([a-f0-9]{24})$/i);
    const paymentId = match?.[1]?.toLowerCase();
    if (!paymentId || !saspayPaymentId) {
      return json({ received: false, message: 'Référence ou identifiant de paiement SasPay manquant.' }, 400);
    }

    const payment = await readDocument(env, 'payments/' + paymentId);
    if (!payment || payment.provider !== 'SASPAY' || String(payment.saspayPaymentId || '') !== saspayPaymentId) {
      return json({ received: false, message: 'Paiement IAMTRADER introuvable ou non correspondant.' }, 404);
    }
    if (payment.status === 'paid') return json({ received: true, duplicate: true });

    // Never activate an account from the webhook body alone: confirm with SasPay's status endpoint.
    const verifyResponse = await fetcher('https://api.saspay.me/api/v1/payments/' + encodeURIComponent(saspayPaymentId) + '/verify/', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + env.SASPAY_API_KEY }
    });
    const verifyRaw = await verifyResponse.text();
    let verifyResult: any = {};
    try { verifyResult = verifyRaw ? JSON.parse(verifyRaw) : {}; } catch { verifyResult = {}; }
    const canonical = verifyResult?.data || verifyResult;
    if (!verifyResponse.ok || String(canonical?.payment_id || '') !== saspayPaymentId) {
      console.error('SasPay Softpay status verification failed:', verifyResponse.status, verifyRaw.slice(0, 300));
      return json({ received: false, message: 'Impossible de vérifier le statut du paiement SasPay.' }, 502);
    }

    const status = String(canonical?.status || '').toUpperCase();
    const expectedEvent = status === 'SUCCESS'
      ? ['payment.success', 'transaction.success'].includes(event)
      : ['FAILED', 'EXPIRED'].includes(status)
        ? ['payment.failed', 'transaction.failed', 'payment.expired'].includes(event)
        : false;
    if (!expectedEvent) {
      if (status === 'PENDING' || status === 'PROCESSING') return json({ received: true, pending: true });
      return json({ received: false, message: 'L’événement ne correspond pas au statut confirmé par SasPay.' }, 409);
    }

    if (status === 'SUCCESS') {
      const amount = Number(canonical?.amount);
      const currency = String(canonical?.currency || '').toUpperCase();
      if (!amountsMatchToCents(amount, Number(payment.amount))) {
        await patchDocument(env, 'payments/' + paymentId, { status: 'failed', failureMessage: 'Montant SasPay différent du montant attendu.', updatedAt: now().toISOString() }, ['status', 'failureMessage', 'updatedAt']);
        return json({ received: true, rejected: 'amount_mismatch' });
      }
      if (currency !== String(payment.currency || '').toUpperCase()) {
        await patchDocument(env, 'payments/' + paymentId, { status: 'failed', failureMessage: 'Devise SasPay différente de la commande.', updatedAt: now().toISOString() }, ['status', 'failureMessage', 'updatedAt']);
        return json({ received: true, rejected: 'currency_mismatch' });
      }

      const planKey = payment.plan as keyof typeof PLANS;
      const profile = await readDocument(env, 'users/' + encodeURIComponent(String(payment.uid)));
      if (!PLANS[planKey] || !profile) return json({ received: false, message: 'Profil ou formule introuvable.' }, 404);
      const paidAt = String(canonical?.paid_at || now().toISOString());
      const storedAction = payment.subscriptionAction;
      const storedStart = new Date(String(payment.activationStartAt || ''));
      const storedExpires = new Date(String(payment.activationExpiresAt || ''));
      const activationValid = ['initial', 'renewal', 'upgrade'].includes(String(storedAction)) && Number.isFinite(storedStart.getTime()) && Number.isFinite(storedExpires.getTime());
      const decision = activationValid ? null : decideSubscription(profile, planKey, new Date(paidAt));
      if (decision && 'error' in decision) return json({ received: false, message: decision.error }, 409);

      await patchDocument(env, 'payments/' + paymentId, {
        status: 'paid', paidAt, provider: 'SASPAY', saspayStatus: 'SUCCESS',
        saspayTransactionId: String(canonical?.transaction_id || ''),
        saspayTransactionReference: reference,
        updatedAt: paidAt
      }, ['status', 'paidAt', 'provider', 'saspayStatus', 'saspayTransactionId', 'saspayTransactionReference', 'updatedAt']);

      await patchDocument(env, 'users/' + encodeURIComponent(String(payment.uid)), subscriptionFields(
        profile,
        planKey,
        activationValid ? storedAction as SubscriptionAction : decision!.action,
        activationValid ? storedStart.toISOString() : decision!.start.toISOString(),
        activationValid ? storedExpires.toISOString() : decision!.expires.toISOString(),
        paidAt
      ), ['plan', 'paymentDate', 'subscriptionStartAt', 'subscriptionExpiresAt', 'subscriptionStatus', 'paymentStatus', 'planChangeConfirmedAt', 'pendingPlan', 'planChangeRequestedAt', 'scheduledPlan', 'scheduledStartAt', 'scheduledExpiresAt', 'updatedAt']);
      return json({ received: true });
    }

    await patchDocument(env, 'payments/' + paymentId, {
      status: 'failed',
      failureMessage: 'Paiement SasPay ' + status + '.',
      saspayStatus: status,
      updatedAt: now().toISOString()
    }, ['status', 'failureMessage', 'saspayStatus', 'updatedAt']);
    return json({ received: true });
  } catch (error) {
    console.error('SasPay webhook processing error:', error);
    return json({ received: false }, 500);
  }
}
