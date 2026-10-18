import { collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface DeviceSession {
  id: string;
  deviceName: string;
  userAgent: string;
  createdAt?: { toMillis?: () => number } | string;
  lastSeenAt?: { toMillis?: () => number } | string;
  revoked?: boolean;
}

const DEVICE_SESSION_KEY = 'iamtrader-device-session-v1';

export function getDeviceSessionId(): string {
  let id = localStorage.getItem(DEVICE_SESSION_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_SESSION_KEY, id);
  }
  return id;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  const platform = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone / iPad' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Appareil';
  const browser = /Edg\//i.test(ua) ? 'Microsoft Edge' : /Chrome\//i.test(ua) ? 'Google Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : 'Navigateur';
  return `${browser} · ${platform}`;
}

export function watchDeviceSession(uid: string, onRevoked: () => void): () => void {
  let unsubscribe = () => undefined;
  let heartbeat: number | undefined;
  let cancelled = false;

  const initialize = async () => {
    let sessionId = getDeviceSessionId();
    let sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
    let snapshot = await getDoc(sessionRef);

    // A revoked device can sign in again; give the new authenticated session a fresh device-session ID.
    if (snapshot.exists() && snapshot.data().revoked === true) {
      localStorage.removeItem(DEVICE_SESSION_KEY);
      sessionId = getDeviceSessionId();
      sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
      snapshot = await getDoc(sessionRef);
    }

    const now = new Date().toISOString();
    if (snapshot.exists()) {
      await updateDoc(sessionRef, { lastSeenAt: now });
    } else {
      await setDoc(sessionRef, {
        deviceName: getDeviceName(),
        userAgent: navigator.userAgent.slice(0, 300),
        createdAt: now,
        lastSeenAt: now,
        revoked: false,
      });
    }
    if (cancelled) return;

    unsubscribe = onSnapshot(sessionRef, currentSnapshot => {
      if (currentSnapshot.exists() && currentSnapshot.data().revoked === true) {
        localStorage.removeItem(DEVICE_SESSION_KEY);
        onRevoked();
      }
    }, error => console.warn('Device session monitoring notice:', error));

    heartbeat = window.setInterval(() => {
      void updateDoc(sessionRef, { lastSeenAt: new Date().toISOString() }).catch(() => undefined);
    }, 60_000);
  };

  void initialize().catch(error => {
    console.warn('Device session registration notice:', error);
  });

  return () => {
    cancelled = true;
    unsubscribe();
    if (heartbeat !== undefined) window.clearInterval(heartbeat);
  };
}

export function subscribeDeviceSessions(uid: string, callback: (sessions: DeviceSession[]) => void): () => void {
  const sessionsQuery = query(collection(db, 'users', uid, 'sessions'), orderBy('lastSeenAt', 'desc'));
  return onSnapshot(sessionsQuery, snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as DeviceSession)));
  }, error => {
    console.warn('Device session list notice:', error);
    callback([]);
  });
}

export async function revokeDeviceSession(uid: string, sessionId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'sessions', sessionId), {
    revoked: true,
    revokedAt: new Date().toISOString(),
  });
}

export async function endCurrentDeviceSession(uid: string): Promise<void> {
  const sessionId = getDeviceSessionId();
  try {
    await updateDoc(doc(db, 'users', uid, 'sessions', sessionId), {
      revoked: true,
      revokedAt: new Date().toISOString(),
    });
  } finally {
    localStorage.removeItem(DEVICE_SESSION_KEY);
  }
}
