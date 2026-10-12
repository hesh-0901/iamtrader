import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { calculatePaymentAmounts, handlePaymentRequest, handleSasPayWebhook, verifySasPayWebhookSignature } from './payments';
import type { PaymentEnv } from './firebaseAdmin';

const SECRET = 'unit-test-only-webhook-secret';
const API_KEY = 'unit-test-only-api-key';
const PAYMENT_ID = '0123456789abcdef01234567';
const TRANSACTION_ID = '123e4567-e89b-12d3-a456-426614174000';
const NOW = new Date('2026-10-12T12:00:00.000Z');
const ENV = { SASPAY_API_KEY: API_KEY, SASPAY_WEBHOOK_SECRET: SECRET };

function sign(rawBody: string, timestamp: string, secret = SECRET) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: TRANSACTION_ID,
    description: `IAMTRADER-${PAYMENT_ID}-Plus subscription`,
    status: 'SUCCESS',
    requested_amount: '10.29',
    currency: 'USD',
    updated_at: NOW.toISOString(),
    reference: 'SP-REFERENCE-1',
    ...overrides,
  };
}

function harness(options: { transaction?: Record<string, unknown>; failUserPatchOnce?: boolean } = {}) {
  const state = {
    payment: {
      id: PAYMENT_ID,
      uid: 'trader-1',
      provider: 'SASPAY',
      status: 'processing',
      plan: 'pro',
      amount: 10.29,
      currency: 'USD',
      subscriptionAction: 'initial',
      activationStartAt: '2026-10-12T12:00:00.000Z',
      activationExpiresAt: '2026-11-11T12:00:00.000Z',
    } as Record<string, unknown>,
    profile: { plan: 'free', status: 'active', paymentStatus: 'unpaid' } as Record<string, unknown>,
    transaction: transaction(options.transaction),
    userPatchFailures: options.failUserPatchOnce ? 1 : 0,
    reads: [] as string[],
    patches: [] as Array<{ path: string; data: Record<string, unknown> }>,
    canonicalReads: 0,
  };

  const dependencies = {
    fetch: async (_input: RequestInfo | URL) => {
      state.canonicalReads += 1;
      return Response.json({ data: state.transaction });
    },
    firestoreGet: async (_env: PaymentEnv, path: string) => {
      state.reads.push(path);
      if (path === `payments/${PAYMENT_ID}`) return state.payment;
      if (path === 'users/trader-1') return state.profile;
      return null;
    },
    firestorePatch: async (_env: PaymentEnv, path: string, data: Record<string, unknown>) => {
      state.patches.push({ path, data });
      if (path === 'users/trader-1' && state.userPatchFailures > 0) {
        state.userPatchFailures -= 1;
        throw new Error('temporary Firestore failure');
      }
      if (path === `payments/${PAYMENT_ID}`) Object.assign(state.payment, data);
      if (path === 'users/trader-1') Object.assign(state.profile, data);
      return {};
    },
    now: () => NOW,
  };

  return { state, dependencies };
}

async function webhookRequest(event = 'transaction.success', data: Record<string, unknown> = {}, options: { timestamp?: string; signatureSecret?: string; headerEvent?: string } = {}) {
  const timestamp = options.timestamp || String(Math.floor(NOW.getTime() / 1000));
  const rawBody = JSON.stringify({ event, data: { id: TRANSACTION_ID, ...data } });
  return new Request('https://iamtrader.trade/api/payments/saspay/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': sign(rawBody, timestamp, options.signatureSecret),
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Event': options.headerEvent || event,
    },
    body: rawBody,
  });
}

describe('SasPay payment validation', () => {
  test('requires authentication on checkout and payment-status reads', async () => {
    const post = await handlePaymentRequest(new Request('https://iamtrader.test/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro', phone: '0991234567', paymentProvider: 'saspay' })
    }), {} as never);
    const get = await handlePaymentRequest(new Request('https://iamtrader.test/api/payments?id=0123456789abcdef01234567'), {} as never);

    expect(post.status).toBe(401);
    expect(get.status).toBe(401);
  });

  test('calculates the exact USD checkout totals using cent rounding', () => {
    expect(calculatePaymentAmounts(9.99)).toEqual({ baseAmount: 9.99, fee: 0.3, total: 10.29 });
    expect(calculatePaymentAmounts(89.99)).toEqual({ baseAmount: 89.99, fee: 2.7, total: 92.69 });
  });

  test('verifies the raw-body HMAC and rejects tampering or stale timestamps', async () => {
    const rawBody = '{"event":"transaction.success","data":{"id":"abc"}}';
    const timestamp = String(Math.floor(NOW.getTime() / 1000));
    const signature = sign(rawBody, timestamp);

    expect(await verifySasPayWebhookSignature(rawBody, signature, timestamp, SECRET, Number(timestamp))).toBe(true);
    expect(await verifySasPayWebhookSignature(rawBody + ' ', signature, timestamp, SECRET, Number(timestamp))).toBe(false);
    expect(await verifySasPayWebhookSignature(rawBody, signature, String(Number(timestamp) - 301), SECRET, Number(timestamp))).toBe(false);
  });

  test('activates the subscription only after a signed canonical success with matching amount and currency', async () => {
    const { state, dependencies } = harness();
    const response = await handleSasPayWebhook(await webhookRequest(), ENV, dependencies);

    expect(response.status).toBe(200);
    expect(state.canonicalReads).toBe(1);
    expect(state.payment.status).toBe('paid');
    expect(state.payment.saspayTransactionId).toBe(TRANSACTION_ID);
    expect(state.profile.plan).toBe('pro');
    expect(state.profile.subscriptionStatus).toBe('active');
    expect(state.profile.subscriptionStartAt).toBe('2026-10-12T12:00:00.000Z');
    expect(state.profile.subscriptionExpiresAt).toBe('2026-11-11T12:00:00.000Z');
  });

  test('rejects invalid signatures before looking up a canonical transaction', async () => {
    const { state, dependencies } = harness();
    const request = await webhookRequest('transaction.success', {}, { signatureSecret: 'wrong-secret' });
    const response = await handleSasPayWebhook(request, ENV, dependencies);

    expect(response.status).toBe(401);
    expect(state.canonicalReads).toBe(0);
    expect(state.patches).toHaveLength(0);
  });

  test('rejects amount or currency mismatches without activating an account', async () => {
    for (const invalidTransaction of [
      { requested_amount: '10.28' },
      { requested_amount: '10.295' },
      { currency: 'CDF' },
    ]) {
      const { state, dependencies } = harness({ transaction: invalidTransaction });
      const response = await handleSasPayWebhook(await webhookRequest(), ENV, dependencies);
      const body = await response.json() as { rejected?: string };

      expect(response.status).toBe(200);
      expect(body.rejected).toBeDefined();
      expect(state.payment.status).toBe('failed');
      expect(state.profile.plan).toBe('free');
      expect(state.patches.some(patch => patch.path === 'users/trader-1')).toBe(false);
    }
  });

  test('retries subscription activation when the payment write succeeded but the profile write failed', async () => {
    const { state, dependencies } = harness({ failUserPatchOnce: true });
    const originalConsoleError = console.error;
    console.error = () => {};
    let firstResponse: Response;
    try {
      firstResponse = await handleSasPayWebhook(await webhookRequest(), ENV, dependencies);
    } finally {
      console.error = originalConsoleError;
    }
    expect(firstResponse.status).toBe(500);
    expect(state.payment.status).toBe('paid');
    expect(state.profile.plan).toBe('free');

    const retryResponse = await handleSasPayWebhook(await webhookRequest(), ENV, dependencies);
    expect(retryResponse.status).toBe(200);
    expect(state.profile.plan).toBe('pro');
    expect(state.profile.subscriptionExpiresAt).toBe('2026-11-11T12:00:00.000Z');
  });

  test('does not downgrade a paid payment when a later event reports failure', async () => {
    const { state, dependencies } = harness();
    state.payment.status = 'paid';
    const failure = transaction({ status: 'FAILED' });
    state.transaction = failure;
    const response = await handleSasPayWebhook(
      await webhookRequest('transaction.failed'),
      ENV,
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(state.payment.status).toBe('paid');
    expect(state.patches).toHaveLength(0);
  });
});
