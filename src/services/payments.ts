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
  paymentUrl?: string;
  message: string;
  subscriptionAction?: 'initial' | 'renewal' | 'upgrade';
  activationStartAt?: string;
  activationExpiresAt?: string;
}

export interface PaymentDetails { phone: string; countryCode?: string; paymentMethod: string; paymentProvider: string; payerName: string; }
type PaymentResponse = { success?: boolean; message?: string; payment?: unknown; subscription?: unknown };

export async function createPayment(plan: PaidPlan, details: PaymentDetails): Promise<PaymentInitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch('/api/payments/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ plan, ...details, idempotencyKey })
  });
  const data = await response.json() as PaymentResponse;
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible d’initier le paiement.');
  return data.payment as PaymentInitResult;
}

export async function verifySasPayPayment(reference: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/payments/verify?reference=' + encodeURIComponent(reference), {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await response.json() as {
    success?: boolean;
    status?: 'paid' | 'processing' | 'failed' | 'unknown';
    message?: string;
    payment?: { id: string; plan: PaidPlan; planName: string; amount: number; currency: string; status: string; reference: string };
  };
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible de vérifier le paiement SasPay.');
  return { status: data.status || 'unknown', payment: data.payment };
}

export async function getSasPayPaymentStatus(reference: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/payments/status?reference=' + encodeURIComponent(reference), {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await response.json() as { success?: boolean; status?: string; message?: string };
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible de consulter le statut du paiement.');
  return { status: String(data.status || 'PENDING').toUpperCase() };
}

export async function getPaymentStatus(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch(`/api/payments?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await response.json() as PaymentResponse;
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

export async function syncSubscriptionStatus() {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/subscription/status', {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await response.json() as PaymentResponse;
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
