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
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Action administrative refusée.');
  return payload as T;
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
