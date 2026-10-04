import { auth } from '../firebase/config';

export type PaidPlan = 'pro' | 'community';

export interface PaymentInitResult {
  id: string;
  plan: PaidPlan;
  planName: string;
  amount: number;
  baseAmount?: number;
  paymentFee?: number;
  currency: string;
  status: 'processing';
  reference: string;
  message: string;
  subscriptionAction?: 'initial' | 'renewal' | 'upgrade';
  activationStartAt?: string;
  activationExpiresAt?: string;
}

export interface PaymentDetails { phone: string; paymentMethod: 'mobile_money'; paymentProvider: string; payerName: string; }

export async function createPayment(plan: PaidPlan, details: PaymentDetails): Promise<PaymentInitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ plan, ...details })
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible d’initier le paiement.');
  return data.payment as PaymentInitResult;
}

export async function getPaymentStatus(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch(`/api/payments?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible de consulter le paiement.');
  return data.payment as {
    id: string;
    plan: PaidPlan;
    planName: string;
    amount: number;
    currency: string;
    status: 'initiated' | 'processing' | 'paid' | 'failed';
    reference: string;
    createdAt: string;
    paidAt?: string | null;
  };
}

export async function createSimulatedPayment(plan: PaidPlan, details: PaymentDetails): Promise<PaymentInitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const idempotencyKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const response = await fetch('/api/payments/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ plan, ...details, idempotencyKey })
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible de créer la simulation.');
  return data.payment as PaymentInitResult;
}

export async function confirmSimulatedPayment(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/payments/simulate/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ id })
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible de confirmer la simulation.');
  return data.payment as PaymentInitResult & { paidAt?: string };
}


export async function syncSubscriptionStatus() {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/subscription/status', {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible de synchroniser l’abonnement.');
  return data.subscription as {
    plan: PaidPlan | 'free';
    subscriptionStatus: 'pending' | 'active' | 'expired' | 'scheduled';
    subscriptionStartAt?: string | null;
    subscriptionExpiresAt?: string | null;
    scheduledPlan?: PaidPlan | 'free' | null;
    scheduledStartAt?: string | null;
    scheduledExpiresAt?: string | null;
  };
}
