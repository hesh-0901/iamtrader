const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/iamtrader/databases/(default)/documents';

export interface PaymentEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_API_KEY?: string;
  LABYRINTHE_API_TOKEN?: string;
  PAYMENT_SIMULATION_ENABLED?: string;
}

function base64Url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function firestoreValue(value: unknown): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  return { stringValue: String(value) };
}

function firestoreFields(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]));
}

function fromFirestoreValue(value: any): unknown {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  return null;
}

function fromFirestoreDocument(doc: any): Record<string, unknown> {
  return Object.fromEntries(Object.entries(doc?.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function accessToken(env: PaymentEnv): Promise<string> {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  const service = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: service.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const pem = service.private_key.replace(/\\n/g, '\n');
  const body = pem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(body), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(header + '.' + payload));
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: header + '.' + payload + '.' + base64Url(signature)
    })
  });
  if (!response.ok) throw new Error('Unable to obtain Firebase service token');
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Firebase service token missing');
  return data.access_token;
}

export async function firestoreGet(env: PaymentEnv, path: string) {
  const token = await accessToken(env);
  const response = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore GET failed: ${response.status}`);
  return fromFirestoreDocument(await response.json());
}

export async function firestoreCreate(env: PaymentEnv, collectionName: string, documentId: string, data: Record<string, unknown>) {
  const token = await accessToken(env);
  const response = await fetch(`${FIRESTORE_BASE}/${collectionName}?documentId=${encodeURIComponent(documentId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields(data) })
  });
  if (!response.ok) throw new Error(`Firestore CREATE failed: ${response.status}`);
  return response.json();
}

export async function firestorePatch(env: PaymentEnv, path: string, data: Record<string, unknown>, fieldPaths: string[]) {
  const token = await accessToken(env);
  const params = fieldPaths.map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
  const response = await fetch(`${FIRESTORE_BASE}/${path}?${params}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields(data) })
  });
  if (!response.ok) throw new Error(`Firestore PATCH failed: ${response.status}`);
  return response.json();
}

export async function verifyFirebaseIdToken(env: PaymentEnv, idToken: string): Promise<{ uid: string; email?: string }> {
  if (!env.FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY is not configured');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!response.ok) throw new Error('Invalid Firebase authentication token');
  const data = await response.json() as { users?: Array<{ localId: string; email?: string }> };
  const user = data.users?.[0];
  if (!user?.localId) throw new Error('Authenticated Firebase user not found');
  return { uid: user.localId, email: user.email };
}
