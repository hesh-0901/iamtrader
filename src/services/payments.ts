import { auth } from '../firebase/config';

export type PaidPlan = 'pro' | 'community';

export interface PaymentInitResult {
  id: string;
  plan: PaidPlan;
  planName: string;
  amount: number;
  currency: string;
  status: 'processing';
  reference: string;
  message: string;
}

export async function createPayment(plan: PaidPlan, phone: string): Promise<PaymentInitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ plan, phone })
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

export async function createSimulatedPayment(plan: PaidPlan, phone: string): Promise<PaymentInitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const idempotencyKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const response = await fetch('/api/payments/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ plan, phone, idempotencyKey })
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
