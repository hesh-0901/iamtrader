import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
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
  const sessionId = getDeviceSessionId();
  const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
  const now = new Date().toISOString();
  void setDoc(sessionRef, {
    deviceName: getDeviceName(),
    userAgent: navigator.userAgent.slice(0, 300),
    createdAt: now,
    lastSeenAt: now,
    revoked: false,
  }, { merge: true }).catch(error => {
    console.warn('Device session registration notice:', error);
  });
  const unsubscribe = onSnapshot(sessionRef, snapshot => {
    if (snapshot.exists() && snapshot.data().revoked === true) {
      localStorage.removeItem(DEVICE_SESSION_KEY);
      onRevoked();
    }
  }, error => console.warn('Device session monitoring notice:', error));
  const heartbeat = window.setInterval(() => {
    void updateDoc(sessionRef, { lastSeenAt: new Date().toISOString() }).catch(() => undefined);
  }, 60_000);
  return () => {
    unsubscribe();
    window.clearInterval(heartbeat);
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
