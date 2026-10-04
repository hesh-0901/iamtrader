import { auth } from '../firebase/config';

export interface PaymentHistoryItem {
  id: string;
  plan?: string;
  planName?: string;
  amount: number;
  baseAmount: number;
  paymentFee: number;
  currency: string;
  status: 'initiated' | 'processing' | 'paid' | 'failed';
  reference: string;
  invoiceNumber?: string | null;
  buyerUid?: string | null;
  buyerEmail?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  payerName?: string | null;
  payerPhone?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  subscriptionAction?: 'initial' | 'renewal' | 'upgrade';
  activationStartAt?: string | null;
  activationExpiresAt?: string | null;
  paymentProvider?: string | null;
  paymentMethod?: string | null;
}

export async function getPaymentHistory(): Promise<PaymentHistoryItem[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');
  const idToken = await user.getIdToken();
  const response = await fetch('/api/payments/history', {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Impossible de récupérer votre historique.');
  return data.payments as PaymentHistoryItem[];
}
