import { firestoreGet, firestoreSet, firestoreQueryCollection, firebaseMessagingAccessToken, verifyFirebaseIdToken } from './firebaseAdmin';

type PushEnv = {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_API_KEY?: string;
  VITE_FIREBASE_VAPID_KEY?: string;
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export async function handlePushConfig(request: Request, env: PushEnv): Promise<Response> {
  if (request.method !== 'GET') return json({ success: false, error: 'Method not allowed' }, 405);
  const vapidKey = env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) return json({ success: false, error: 'VAPID key is not configured on the Worker' }, 503);
  return json({ success: true, vapidKey });
}

async function authenticate(request: Request, env: PushEnv) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('UNAUTHORIZED');
  return verifyFirebaseIdToken(env, token);
}

export async function handlePushRegister(request: Request, env: PushEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const user = await authenticate(request, env);
    const body = await request.json() as { token?: string };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token || token.length > 4096) return json({ success: false, error: 'Invalid push token' }, 400);
    const path = 'pushTokens/' + encodeURIComponent(user.uid);
    const current = await firestoreGet(env, path) as { tokens?: unknown } | null;
    const tokens = Array.isArray(current?.tokens) ? current.tokens.filter((item): item is string => typeof item === 'string') : [];
    const next = [...tokens.filter(item => item !== token), token].slice(-10);
    await firestoreSet(env, path, { uid: user.uid, tokens: next, updatedAt: new Date().toISOString() });
    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Push registration failed' },
      error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 500);
  }
}

export async function handlePipTalkPush(request: Request, env: PushEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const sender = await authenticate(request, env);
    const body = await request.json() as { conversationId?: string; senderId?: string; senderName?: string; text?: string; type?: string; mentions?: string[] };
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
    if (!conversationId || body.senderId !== sender.uid) return json({ success: false, error: 'Invalid message metadata' }, 400);
    const conversation = await firestoreGet(env, 'conversations/' + encodeURIComponent(conversationId)) as { members?: unknown; title?: string } | null;
    if (!conversation) return json({ success: false, error: 'Conversation not found' }, 404);
    let recipients: string[] = [];
    if (conversationId === 'community-hub') {
      const registered = await firestoreQueryCollection(env, 'pushTokens', 500, 'updatedAt');
      recipients = registered.map(item => String(item.uid || item.id || '')).filter(uid => uid && uid !== sender.uid);
    } else {
      if (!Array.isArray(conversation.members) || !conversation.members.includes(sender.uid)) return json({ success: false, error: 'Forbidden' }, 403);
      recipients = conversation.members.filter((uid): uid is string => typeof uid === 'string' && uid !== sender.uid);
    }
    if (Array.isArray(body.mentions) && body.mentions.length) {
      const mentioned = new Set(body.mentions.filter((uid): uid is string => typeof uid === 'string'));
      // Mentions are additive: every conversation participant gets the message notification,
      // while the mention list is carried for future targeted mention-specific handling.
      void mentioned;
    }
    const accessToken = await firebaseMessagingAccessToken(env);
    const text = body.type === 'image' ? 'Vous a envoyé une image' : body.type === 'voice' ? 'Vous a envoyé un message vocal' : String(body.text || 'Nouveau message').slice(0, 160);
    let sent = 0;
    for (const uid of recipients) {
      const stored = await firestoreGet(env, 'pushTokens/' + encodeURIComponent(uid)) as { tokens?: unknown } | null;
      const tokens = Array.isArray(stored?.tokens) ? stored.tokens.filter((item): item is string => typeof item === 'string') : [];
      for (const token of tokens) {
        const response = await fetch('https://fcm.googleapis.com/v1/projects/iamtrader/messages:send', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: {
            token,
            notification: { title: String(body.senderName || 'Nouveau message sur PipTalk').slice(0, 100), body: text },
            data: { url: '/?section=piptalk', conversationId, type: String(body.type || 'text') },
            webpush: { headers: { Urgency: 'high' }, notification: { icon: '/brand/favicon-iamtrader-192.png', badge: '/brand/favicon-iamtrader-192.png', tag: 'piptalk-' + conversationId, renotify: true } }
          } })
        });
        if (response.ok) sent++;
        else if (response.status === 404 || response.status === 400) console.warn('FCM token rejected; user should refresh push registration', uid, response.status);
        else console.error('FCM push failed:', response.status, (await response.text()).slice(0, 200));
      }
    }
    return json({ success: true, sent });
  } catch (error) {
    console.error('PipTalk push failed:', error);
    return json({ success: false, error: error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Push delivery failed' },
      error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 500);
  }
}
