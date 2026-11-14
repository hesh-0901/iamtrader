import { auth } from '../firebase/config';

async function adminMutation<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Session administrateur introuvable.');
  const token = await user.getIdToken();
  const response = await fetch('/api/admin/mutation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload?.error || 'Action administrative refusée.');
  return payload as T;
}

export function adminMigrateSubscriptionExpiry() {
  return adminMutation<{ success: boolean; scanned: number; migrated: number; expired: number; withoutExpiry: number }>({ action: 'migrate-subscription-expiry' });
}

export function adminUpdateUser(uid: string, data: Record<string, unknown>) {
  return adminMutation({ action: 'update-user', uid, data });
}

export function adminUpdateContact(messageId: string, data: Record<string, unknown>) {
  return adminMutation({ action: 'update-contact', messageId, data });
}

export function adminDeleteContact(messageId: string) {
  return adminMutation({ action: 'delete-contact', messageId });
}

export function adminAddLog(log: Record<string, unknown>) {
  return adminMutation({ action: 'add-log', log });
}

export async function adminGetPayments<T = unknown>(): Promise<T> {
  return adminMutation<T>({ action: 'get-payments' });
}

export function adminUpdatePayment(paymentId: string, data: Record<string, unknown>) {
  return adminMutation({ action: 'update-payment', paymentId, data });
}

// Keep payment mutations in the same secure admin service surface as payment reads.


export function adminGetAiMonitoring<T = unknown>(): Promise<T> {
  return adminMutation<T>({ action: 'get-ai-monitoring' });
}

export function adminSaveAiConfig(assistants: Array<Record<string, unknown>>) {
  return adminMutation<{ success: boolean }>({ action: 'save-ai-config', data: { assistants } });
}

export function adminGetAiModels<T = unknown>(): Promise<T> {
  return adminMutation<T>({ action: 'get-ai-models' });
}


export async function adminComposeEmail(input: { id?: string; to: string; subject: string; message: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Session administrateur introuvable.');
  const token = await user.getIdToken();
  const response = await fetch('/api/contact-compose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ action: 'send', ...input })
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; success?: boolean; historySaved?: boolean; id?: string; warning?: string };
  if (!response.ok || !payload.success) throw new Error(payload.error || 'Envoi impossible.');
  return payload;
}

export async function adminSaveEmailDraft(input: { id?: string; to: string; subject: string; message: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Session administrateur introuvable.');
  const token = await user.getIdToken();
  const response = await fetch('/api/contact-compose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ action: 'draft', ...input })
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; success?: boolean; id?: string };
  if (!response.ok || !payload.success) throw new Error(payload.error || 'Enregistrement du brouillon impossible.');
  return payload;
}
