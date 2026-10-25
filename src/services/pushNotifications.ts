import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app, auth } from '../firebase/config';

export async function enablePipTalkPush(): Promise<{ success: boolean; message: string }> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { success: false, message: 'Les notifications push ne sont pas prises en charge par ce navigateur.' };
  }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  if (!vapidKey) {
    return { success: false, message: 'La clé VAPID Web Push doit être configurée dans Cloudflare Pages/Workers (VITE_FIREBASE_VAPID_KEY) et provenir des paramètres Firebase.' };
  }
  if (!(await isSupported())) return { success: false, message: 'Firebase Messaging n’est pas pris en charge sur cet appareil.' };
  const user = auth.currentUser;
  if (!user) return { success: false, message: 'Connectez-vous pour activer les notifications.' };
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return { success: false, message: 'Autorisez les notifications IAMTRADER dans les paramètres du navigateur.' };

  try {
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { success: false, message: 'Firebase n’a pas pu créer le jeton de notification.' };
    const idToken = await user.getIdToken();
    const response = await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
      body: JSON.stringify({ token })
    });
    if (!response.ok) throw new Error('Le serveur n’a pas pu enregistrer cet appareil.');
    return { success: true, message: 'Notifications activées sur cet appareil.' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Impossible d’activer les notifications.' };
  }
}

export async function notifyPipTalkRecipients(input: {
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  type?: 'text' | 'image' | 'voice';
  mentions?: string[];
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/piptalk/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
      body: JSON.stringify(input)
    });
    if (!response.ok) console.warn('[PipTalk] Push delivery request failed:', response.status);
  } catch (error) {
    console.warn('[PipTalk] Push delivery request unavailable:', error);
  }
}
