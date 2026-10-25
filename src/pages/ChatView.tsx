import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { FriendsView } from './FriendsView';
import { auth, db, app } from '../firebase/config';
import { enablePipTalkPush, notifyPipTalkRecipients } from '../services/pushNotifications';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, Timestamp
} from 'firebase/firestore';
import {
  Search, MoreVertical, Send, Pin, Pencil, Trash2, X, CheckCheck, Copy, Forward,
  MessageCircle, Plus, ArrowLeft, Users, Loader2, Image as ImageIcon, Mic, Square, Settings, Save, Reply, FileAudio, BellRing, Smile
} from 'lucide-react';

type ChatConversation = {
  id: string; members: string[]; memberNames?: Record<string, string>;
  group?: boolean; title?: string; description?: string; avatarURL?: string; systemGroup?: boolean; lastMessage?: string;
  updatedAt?: Timestamp | null; createdAt?: Timestamp | null;
};
type ChatMessage = {
  id: string; senderId: string; text: string; createdAt?: Timestamp | null;
  edited?: boolean; pinned?: boolean; forwarded?: boolean; forwardedFrom?: string; reactions?: Record<string, string>; type?: 'text' | 'image' | 'voice'; mediaUrl?: string; mediaName?: string; mediaPublicId?: string; mediaResourceType?: string; expiresAt?: Timestamp | null; duration?: number; senderName?: string; senderAvatarURL?: string; mentions?: string[]; replyToId?: string; replyToMessageId?: string; replyToSenderId?: string; replyToSenderName?: string; replyToText?: string; replyToType?: 'text' | 'image' | 'voice';
};

const formatTime = (value?: Timestamp | null) => value?.toDate
  ? value.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  : '…';
const formatDay = (value?: Timestamp | null) => value?.toDate
  ? value.toDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  : '';

export function ChatView({ userProfile, initialConversationId, onUnreadCountChange, isVisible = true }: { userProfile: UserProfile | null; initialConversationId?: string; onUnreadCountChange?: (count: number) => void; isVisible?: boolean }) {
  const uid = auth.currentUser?.uid || userProfile?.uid;
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [acceptedFriends, setAcceptedFriends] = useState<Array<{ uid: string; name: string; avatarURL?: string }>>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readReceiptsByUser, setReadReceiptsByUser] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState(initialConversationId || '');
  const [draft, setDraft] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);
  const [messageMenuPosition, setMessageMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [queryText, setQueryText] = useState('');
  const [targetUid, setTargetUid] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const messageMenuRef = useRef<HTMLDivElement>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('piptalk-notifications-enabled') === 'true');
  const [showNotificationOptions, setShowNotificationOptions] = useState(false);
  const [selectedAlertSound, setSelectedAlertSound] = useState(() => typeof window !== 'undefined' ? window.localStorage.getItem('piptalk-alert-sound') || 'doux' : 'doux');
  const [previewingAlertSound, setPreviewingAlertSound] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobileChatClosing, setMobileChatClosing] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageSoundContextRef = useRef<AudioContext | null>(null);
  const firstMessageSnapshotRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [pendingVoice, setPendingVoice] = useState<File | null>(null);
  const [pendingVoiceUrl, setPendingVoiceUrl] = useState('');
  const recordingStartedAtRef = useRef(0);
  const [pendingVoiceDuration, setPendingVoiceDuration] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupTitleDraft, setGroupTitleDraft] = useState('Community Hub');
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState('');
  const [groupAvatarDraft, setGroupAvatarDraft] = useState('');
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const [viewerImage, setViewerImage] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [publicProfiles, setPublicProfiles] = useState<Array<{ uid: string; displayName: string; avatarURL?: string; photoURL?: string }>>([]);
  const [mentionUids, setMentionUids] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // Charger les profils publiés pour proposer les mentions @ dans le chat.
  useEffect(() => {
    if (!uid) { setPublicProfiles([]); return; }
    return onSnapshot(collection(db, 'publicProfiles'), snapshot => {
      setPublicProfiles(snapshot.docs
        .map(item => ({ uid: item.id, ...item.data() } as { uid: string; displayName?: string; avatarURL?: string; photoURL?: string }))
        .filter(item => typeof item.displayName === 'string' && item.displayName.trim())
        .map(item => ({ uid: item.uid, displayName: item.displayName!.trim(), avatarURL: item.avatarURL, photoURL: item.photoURL })));
    }, err => {
      console.warn('PipTalk mentions: impossible de charger les profils publics.', err);
    });
  }, [uid]);

  useEffect(() => {
    if (!initialConversationId) return;
    setActiveId(initialConversationId);
    setMobileChatOpen(true);
  }, [initialConversationId]);

  // Inclure tous les amis acceptés dans la colonne de gauche, même avant leur premier DM.
  useEffect(() => {
    if (!uid) { setAcceptedFriends([]); return; }
    const byRequestId = new Map<string, { id: string; senderId: string; receiverId: string; status: string; senderName?: string; receiverName?: string }>();
    let sentReady = false;
    let receivedReady = false;
    const publish = () => {
      if (!sentReady || !receivedReady) return;
      const friends = new Map<string, { uid: string; name: string; avatarURL?: string }>();
      byRequestId.forEach(request => {
        if (request.status !== 'accepted') return;
        const otherUid = request.senderId === uid ? request.receiverId : request.senderId;
        if (!otherUid || otherUid === uid) return;
        const publicProfile = publicProfiles.find(profile => profile.uid === otherUid);
        const name = publicProfile?.displayName || (request.senderId === uid ? request.receiverName : request.senderName) || 'Trader';
        friends.set(otherUid, { uid: otherUid, name, avatarURL: publicProfile?.avatarURL });
      });
      setAcceptedFriends(Array.from(friends.values()));
    };
    const unsubSent = onSnapshot(query(collection(db, 'friendRequests'), where('senderId', '==', uid)), snapshot => {
      snapshot.docs.forEach(item => byRequestId.set(item.id, { id: item.id, ...item.data() } as any));
      sentReady = true; publish();
    }, err => console.error('[PipTalk] Demandes envoyées indisponibles', err));
    const unsubReceived = onSnapshot(query(collection(db, 'friendRequests'), where('receiverId', '==', uid)), snapshot => {
      snapshot.docs.forEach(item => byRequestId.set(item.id, { id: item.id, ...item.data() } as any));
      receivedReady = true; publish();
    }, err => console.error('[PipTalk] Demandes reçues indisponibles', err));
    return () => { unsubSent(); unsubReceived(); };
  }, [uid, publicProfiles]);

  // Community Hub is a system group available to every authenticated user.
  useEffect(() => {
    if (!uid) { setLoadingChats(false); return; }
    const q = query(collection(db, 'conversations'), where('members', 'array-contains', uid));
    return onSnapshot(q, snapshot => {
      const personal = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() } as ChatConversation))
        .sort((a, b) => (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
      console.debug('[PipTalk] Conversations chargées', { uid, count: personal.length, ids: personal.map(item => item.id) });
      setConversations(previous => {
        const hub = previous.find(item => item.id === 'community-hub');
        return [...personal.filter(item => item.id !== 'community-hub'), ...(hub ? [hub] : [])];
      });
      setError('');
      setLoadingChats(false);
    }, err => { console.error('[PipTalk] Lecture des conversations refusée', { uid, code: err.code, message: err.message }); setError(err.message); setLoadingChats(false); });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'conversations', 'community-hub'), snapshot => {
      if (!snapshot.exists()) return;
      const hub = { id: snapshot.id, ...snapshot.data() } as ChatConversation;
      setConversations(previous => [hub, ...previous.filter(item => item.id !== hub.id)]);
    }, err => { setError(err.message); });
  }, [uid]);

  // Repair inbox previews from the actual latest message. Older app versions
  // sometimes wrote messages without updating conversations.lastMessage.
  useEffect(() => {
    if (!uid || !conversations.length) return;
    let cancelled = false;
    const refreshLatestPreviews = async () => {
      const previews = await Promise.all(conversations.map(async conversation => {
        try {
          const latestQuery = query(
            collection(db, 'conversations', conversation.id, 'messages'),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const snapshot = await getDocs(latestQuery);
          if (snapshot.empty) return null;
          const latest = snapshot.docs[0].data() as Partial<ChatMessage>;
          const preview = latest.type === 'image'
            ? '📷 Image'
            : latest.type === 'voice'
              ? '🎤 Message vocal'
              : (typeof latest.text === 'string' ? latest.text.trim().slice(0, 500) : '');
          if (!preview) return null;
          return { id: conversation.id, preview, createdAt: latest.createdAt };
        } catch (err) {
          // A preview refresh must never break the conversation list.
          console.warn('[PipTalk] Aperçu du dernier message indisponible', conversation.id, err);
          return null;
        }
      }));
      if (cancelled) return;
      const latestById = new Map(previews.filter((item): item is NonNullable<typeof item> => !!item).map(item => [item.id, item]));
      setConversations(previous => {
        let changed = false;
        const next = previous.map(conversation => {
          const latest = latestById.get(conversation.id);
          if (!latest) return conversation;
          // The conversation's updatedAt can be a few milliseconds newer than
          // the message's createdAt, so it cannot reliably determine preview freshness.
          if (conversation.lastMessage === latest.preview) return conversation;
          changed = true;
          return { ...conversation, lastMessage: latest.preview };
        });
        return changed ? next : previous;
      });
    };
    void refreshLatestPreviews();
    return () => { cancelled = true; };
  }, [uid, conversations.map(conversation => conversation.id).join('|')]);

  // Create the fixed default group if it does not exist yet. Firestore rules
  // restrict this creation to the exact Community Hub system document.
  useEffect(() => {
    if (!uid) return;
    const hubRef = doc(db, 'conversations', 'community-hub');
    void getDoc(hubRef).then(snapshot => {
      if (snapshot.exists()) return;
      return setDoc(hubRef, {
        members: [uid], group: true, title: 'Community Hub',
        memberNames: { [uid]: currentDisplayName },
        lastMessage: 'Bienvenue dans Community Hub.', createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(), createdBy: uid, systemGroup: true
      });
    }).catch(err => {
      console.error('[PipTalk] Initialisation de Community Hub impossible', err);
      setError(err?.message || 'Impossible d’initialiser Community Hub.');
    });
  }, [uid, userProfile?.displayName, auth.currentUser?.displayName, auth.currentUser?.email]);

  // Initialiser le contexte audio après la première interaction utilisateur
  // pour respecter les restrictions d'autoplay des navigateurs mobiles.
  useEffect(() => {
    const unlockAudio = () => {
      if (typeof window === 'undefined' || !('AudioContext' in window)) return;
      if (!messageSoundContextRef.current) {
        const AudioContextConstructor = window.AudioContext;
        messageSoundContextRef.current = new AudioContextConstructor();
      }
      if (messageSoundContextRef.current?.state === 'suspended') {
        void messageSoundContextRef.current.resume().catch(() => undefined);
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      void messageSoundContextRef.current?.close().catch(() => undefined);
      messageSoundContextRef.current = null;
    };
  }, []);

  const playAlertSound = (soundId: string) => {
    const audioContext = messageSoundContextRef.current;
    if (!audioContext || audioContext.state !== 'running') return;
    const patterns: Record<string, { notes: number[]; spacing: number; type: OscillatorType }> = {
      doux: { notes: [880, 1175], spacing: 0.12, type: 'sine' },
      dynamique: { notes: [660, 880, 1175], spacing: 0.09, type: 'sine' },
      pulse: { notes: [740, 740], spacing: 0.16, type: 'triangle' }
    };
    const pattern = patterns[soundId] || patterns.doux;
    try {
      pattern.notes.forEach((frequency, index) => {
        const startAt = audioContext.currentTime + index * pattern.spacing;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = pattern.type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.1, startAt + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.105);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.12);
      });
    } catch (err) {
      console.debug('[PipTalk] Son de notification indisponible', err);
    }
  };

  const playIncomingMessageSound = () => playAlertSound(selectedAlertSound);

  const markConversationRead = async (conversationId: string, lastMessageAt?: Timestamp | null) => {
    if (!uid || !conversationId) return;
    try {
      await setDoc(doc(db, 'conversations', conversationId, 'readStates', uid), { userId: uid, lastReadAt: lastMessageAt || serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) { console.warn('[PipTalk] État de lecture non synchronisé', conversationId, err); }
  };

  useEffect(() => {
    if (!uid || !conversations.length) { setUnreadByConversation({}); return; }
    const unsubscribers: Array<() => void> = [];
    const messageUnsubscribers = new Map<string, () => void>();
    const liveCounts = new Map<string, number>();
    const publishCounts = () => setUnreadByConversation(Object.fromEntries(liveCounts));
    conversations.forEach(conversation => {
      const unsubscribeReadState = onSnapshot(
        doc(db, 'conversations', conversation.id, 'readStates', uid),
        readSnapshot => {
          const lastReadAt = readSnapshot.data()?.lastReadAt as Timestamp | undefined;
          const messagesRef = collection(db, 'conversations', conversation.id, 'messages');
          const messagesQuery = lastReadAt
            ? query(messagesRef, where('createdAt', '>', lastReadAt), orderBy('createdAt', 'asc'))
            : query(messagesRef, orderBy('createdAt', 'desc'), limit(100));
          messageUnsubscribers.get(conversation.id)?.();
          const unsubscribeMessages = onSnapshot(messagesQuery, snapshot => {
            const unread = snapshot.docs.filter(message => {
              const data = message.data();
              return data.senderId !== uid && (!lastReadAt || (data.createdAt?.toMillis?.() || 0) > lastReadAt.toMillis());
            }).length;
            liveCounts.set(conversation.id, isVisible && conversation.id === activeId ? 0 : unread);
            publishCounts();
          }, err => console.warn('[PipTalk] Comptage temps réel indisponible', conversation.id, err));
          messageUnsubscribers.set(conversation.id, unsubscribeMessages);
        },
        err => console.warn('[PipTalk] État de lecture indisponible', conversation.id, err)
      );
      unsubscribers.push(unsubscribeReadState);
    });
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      messageUnsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [uid, conversations.map(conversation => conversation.id).join('|'), activeId, isVisible]);

  // Confirmations de lecture : ne refléter que les états réellement écrits par les destinataires.
  useEffect(() => {
    if (!uid || !activeId || !isVisible) { setReadReceiptsByUser({}); return; }
    const conversation = conversations.find(item => item.id === activeId);
    const otherMembers = (conversation?.members || []).filter(memberUid => memberUid && memberUid !== uid);
    if (!otherMembers.length) { setReadReceiptsByUser({}); return; }
    const latestByUser: Record<string, number> = {};
    const unsubscribers = otherMembers.map(memberUid => onSnapshot(
      doc(db, 'conversations', activeId, 'readStates', memberUid),
      snapshot => {
        const value = snapshot.data()?.lastReadAt as Timestamp | undefined;
        if (value?.toMillis) latestByUser[memberUid] = value.toMillis();
        else delete latestByUser[memberUid];
        setReadReceiptsByUser({ ...latestByUser });
      },
      err => console.warn('[PipTalk] Confirmation de lecture indisponible', memberUid, err)
    ));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [uid, activeId, isVisible, conversations]);

  useEffect(() => {
    firstMessageSnapshotRef.current = true;
    if (!uid || !activeId) { setMessages([]); return; }
    if (isVisible) void markConversationRead(activeId);
    setLoadingMessages(true);
    const q = collection(db, 'conversations', activeId, 'messages');
    return onSnapshot(q, snapshot => {
      const loadedMessages = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() } as ChatMessage))
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

      // Ignorer le snapshot initial (historique) et ne signaler que les vrais
      // nouveaux messages ajoutés par un autre utilisateur.
      if (firstMessageSnapshotRef.current) {
        firstMessageSnapshotRef.current = false;
      } else {
        const incomingMessages = snapshot.docChanges()
          .filter(change => change.type === 'added')
          .map(change => ({ id: change.doc.id, ...change.doc.data() } as ChatMessage))
          .filter(message => message.senderId && message.senderId !== uid);
        if (incomingMessages.length) {
          playIncomingMessageSound();
          if (typeof document !== 'undefined' && document.hidden &&
              typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const newest = incomingMessages[incomingMessages.length - 1];
            const sender = newest.senderName?.trim() || 'Nouveau message';
            const body = newest.type === 'image' ? 'Vous a envoyé une image'
              : newest.type === 'voice' ? 'Vous a envoyé un message vocal'
              : (newest.text || 'Vous a envoyé un message').slice(0, 140);
            void (async () => {
              try {
                const registration = 'serviceWorker' in navigator
                  ? await navigator.serviceWorker.getRegistration()
                  : undefined;
                if (registration?.showNotification) {
                  await registration.showNotification(sender, {
                    body,
                    icon: '/brand/favicon-iamtrader-192.png',
                    badge: '/brand/favicon-iamtrader-192.png',
                    tag: 'piptalk-' + activeId,
                    renotify: true,
                    data: { url: '/?section=piptalk', conversationId: activeId }
                  });
                } else {
                  const notification = new Notification(sender, { body, tag: 'piptalk-' + activeId });
                  notification.onclick = () => { window.focus(); notification.close(); };
                }
              } catch (err) {
                console.debug('[PipTalk] Notification système indisponible', err);
              }
            })();
          }
        }
      }

      if (loadedMessages.length && activeId) {
        const latestTimestamp = loadedMessages[loadedMessages.length - 1].createdAt;
        if (latestTimestamp && isVisible) void markConversationRead(activeId, latestTimestamp);
      }
      console.debug('[PipTalk] Messages chargés', { uid, conversationId: activeId, count: loadedMessages.length });
      setMessages(loadedMessages);
      setLoadingMessages(false);
    }, err => { console.error('[PipTalk] Lecture des messages refusée', { uid, conversationId: activeId, code: err.code, message: err.message }); setError(err.message); setLoadingMessages(false); });
  }, [uid, activeId, isVisible]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!viewerImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewerImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerImage]);

  const active = conversations.find(item => item.id === activeId);
  const otherUid = active?.members.find(member => member !== uid) || '';
  const activeName = active?.title || active?.memberNames?.[otherUid] || (otherUid ? `Trader ${otherUid.slice(0, 7)}` : 'Choisir une discussion');
  const currentDisplayName = userProfile?.displayName?.trim() || auth.currentUser?.displayName?.trim() || auth.currentUser?.email?.split('@')[0] || 'Trader';
  const currentAvatar = userProfile?.photoURL || userProfile?.avatarURL || auth.currentUser?.photoURL || '';
  const avatarForMessage = (message: ChatMessage) => {
    const profile = publicProfiles.find(item => item.uid === message.senderId);
    return message.senderAvatarURL || profile?.avatarURL || profile?.photoURL ||
      (message.senderId === uid ? currentAvatar : '');
  };
  // Resolve inbox avatars from the participant profile, not only the conversation
  // document (older direct-message documents do not store an avatarURL).
  const avatarForConversation = (conversation: ChatConversation, participantUid: string) => {
    const profile = publicProfiles.find(item => item.uid === participantUid);
    const friend = acceptedFriends.find(item => item.uid === participantUid);
    // A conversation-level avatar may be the creator/admin's photo from an
    // older version. For direct messages, the participant's own profile wins.
    if (conversation.group) {
      return conversation.avatarURL || profile?.avatarURL || profile?.photoURL ||
        friend?.avatarURL || (participantUid === uid ? currentAvatar : '');
    }
    return profile?.avatarURL || profile?.photoURL || friend?.avatarURL ||
      (participantUid === uid ? currentAvatar : '') || conversation.avatarURL || '';
  };
  // One-time, admin-only repair for legacy Community Hub messages that lack a
  // real display name. Process each message once and only update missing/generic
  // names, so normal snapshot refreshes cannot make names flicker.
  const profileBackfillRef = useRef(new Set<string>());
  useEffect(() => {
    if (userProfile?.role !== 'admin' || activeId !== 'community-hub' || !messages.length) return;
    let cancelled = false;
    const repairLegacyNames = async () => {
      for (const message of messages) {
        const name = message.senderName?.trim() || '';
        const genericName = !name || /^Trader\\s+[a-z0-9]{1,12}$/i.test(name);
        if (!genericName || !message.senderId || profileBackfillRef.current.has(message.id)) continue;
        try {
          const profileSnap = await getDoc(doc(db, 'users', message.senderId));
          const profile = profileSnap.exists() ? profileSnap.data() : null;
          const displayName = typeof profile?.displayName === 'string' ? profile.displayName.trim() : '';
          if (cancelled) return;
          if (!displayName) continue;
          profileBackfillRef.current.add(message.id);
          await updateDoc(doc(db, 'conversations', 'community-hub', 'messages', message.id), {
            senderName: displayName,
            ...(typeof profile?.photoURL === 'string' && profile.photoURL.trim()
              ? { senderAvatarURL: profile.photoURL.trim() }
              : {})
          });
        } catch (err) {
          // Non-admin users and inaccessible legacy profiles must not break chat.
          console.warn('PipTalk display-name repair skipped:', err);
        }
      }
    };
    void repairLegacyNames();
    return () => { cancelled = true; };
  }, [uid, activeId, messages, userProfile?.role]);
  // Keep message rendering read-only: do not rewrite legacy messages from a
  // snapshot effect, which can cause visible sender-name/avatar changes while
  // the live Firestore listener is refreshing. New messages already store the
  // sender's display name and avatar at send time.

  const inboxItems = useMemo(() => {
    const items = [...conversations];
    acceptedFriends.forEach(friend => {
      const existing = items.some(item => item.members?.length === 2 && item.group !== true && item.members.includes(uid || '') && item.members.includes(friend.uid));
      if (!existing) items.push({
        id: 'dm_' + [uid || '', friend.uid].sort().join('_'),
        members: [uid || '', friend.uid],
        memberNames: { [friend.uid]: friend.name },
        avatarURL: friend.avatarURL,
        lastMessage: '',
        updatedAt: null,
        createdAt: null,
        group: false
      });
    });
    return items.sort((a, b) => (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
  }, [conversations, acceptedFriends, uid]);

  const totalUnread = Object.entries(unreadByConversation).filter(([conversationId]) => !isVisible || conversationId !== activeId).reduce((total, [, count]) => total + count, 0);

  useEffect(() => { onUnreadCountChange?.(totalUnread); }, [totalUnread, onUnreadCountChange]);

  const filtered = useMemo(() => inboxItems.filter(item => {
    const other = item.members.find(member => member !== uid) || '';
    const name = item.title || item.memberNames?.[other] || acceptedFriends.find(friend => friend.uid === other)?.name || other;
    return name.toLowerCase().includes(queryText.toLowerCase()) || other.toLowerCase().includes(queryText.toLowerCase()) || (item.lastMessage || '').toLowerCase().includes(queryText.toLowerCase());
  }), [inboxItems, acceptedFriends, queryText, uid]);

  const closeMobileChat = () => {
    if (mobileCloseTimerRef.current) clearTimeout(mobileCloseTimerRef.current);
    setMobileChatClosing(true);
    mobileCloseTimerRef.current = setTimeout(() => { setMobileChatOpen(false); setMobileChatClosing(false); }, 180);
  };

  const beginMessageLongPress = (messageId: string, event?: React.TouchEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const rect = event?.currentTarget.getBoundingClientRect();
    if (rect) {
      const menuWidth = 208;
      const menuHeight = 300;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
      const top = rect.top >= menuHeight + 16
        ? rect.top - menuHeight - 6
        : Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 8);
      setMessageMenuPosition({ left, top: Math.max(8, top) });
    }
    longPressTimerRef.current = setTimeout(() => {
      setReactionMessageId(null);
      setMenuMessage(messageId);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
    }, 450);
  };
  const openMessageMenu = (event: React.MouseEvent<HTMLButtonElement>, messageId: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 200;
    // Reserve room for the complete menu (reactions + actions), not only the old short menu.
    const menuHeight = 360;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const top = rect.top >= menuHeight + 16
      ? rect.top - menuHeight - 6
      : Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - menuHeight - 8));
    setMessageMenuPosition({ left, top });
    setMenuMessage(messageId);
    setReactionMessageId(null);
  };
  const cancelMessageLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const openInboxConversation = async (item: ChatConversation) => {
    if (!uid) return;
    // The system group is intentionally not a two-person conversation and
    // therefore has no "other" participant to resolve.
    if (item.id === 'community-hub') {
      setError('');
      setEditingId(null);
      setDraft('');
      setActiveId('community-hub');
      setMobileChatOpen(true);
      return;
    }
    const other = item.members.find(member => member !== uid);
    if (!other) {
      setError('Cette conversation ne contient aucun autre participant.');
      return;
    }
    setError('');
    setEditingId(null);
    setDraft('');
    try {
      let conversationId = item.id;
      if (item.id.startsWith('dm_')) {
        const members = [uid, other].sort();
        conversationId = 'dm_' + members.join('_');
        const existing = conversations.find(candidate => candidate.members?.length === 2 && candidate.group !== true && candidate.members.includes(uid) && candidate.members.includes(other));
        if (existing) conversationId = existing.id;
        else {
          await setDoc(doc(db, 'conversations', conversationId), {
            members, group: false, createdBy: uid,
            memberNames: {
              [uid]: currentDisplayName,
              [other]: acceptedFriends.find(friend => friend.uid === other)?.name || 'Trader'
            },
            lastMessage: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }
      setActiveId(conversationId);
      setMobileChatOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Impossible d’ouvrir cette conversation.');
    }
  };

  const startConversation = async () => {
    const target = targetUid.trim();
    if (!uid) { setError('Connectez-vous pour utiliser PipTalk.'); return; }
    if (!target || target === uid) { setError('Saisissez l’identifiant UID d’un autre trader.'); return; }
    setError('');
    const existing = conversations.find(item => item.members.includes(target) && item.members.includes(uid) && item.members.length === 2 && !item.group);
    if (existing) {
      setActiveId(existing.id); setMobileChatOpen(true); setShowNewChat(false); setTargetUid(''); return;
    }
    try {
      const ref = doc(collection(db, 'conversations'));
      await setDoc(ref, {
        members: [uid, target], group: false,
        memberNames: { [uid]: userProfile?.displayName || auth.currentUser?.displayName || 'Moi' },
        lastMessage: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        createdBy: uid
      });
      setActiveId(ref.id); setMobileChatOpen(true); setShowNewChat(false); setTargetUid('');
    } catch (err: any) { setError(err?.message || 'Impossible de créer la conversation.'); }
  };

  const replyPayload = (message: ChatMessage | null) => message ? {
    replyToMessageId: message.id,
    replyToSenderId: message.senderId,
    replyToSenderName: message.senderName?.trim() || (message.senderId === uid ? currentDisplayName : active?.memberNames?.[message.senderId] || `Trader ${message.senderId.slice(0, 7)}`),
    replyToText: message.type === 'image' ? '📷 Image' : message.type === 'voice' ? '🎤 Message vocal' : message.text.slice(0, 240),
  } : {};

  const handleDraftChange = (value: string) => {
    setDraft(value);
    const match = value.match(/(?:^|\\s)@([^@\\s]*)$/);
    setMentionQuery(match ? match[1].toLocaleLowerCase() : null);
  };

  const chooseMention = (profile: { uid: string; displayName: string }) => {
    const match = draft.match(/(?:^|\\s)@([^@\\s]*)$/);
    if (!match) return;
    const start = match.index ?? 0;
    const prefix = draft.slice(0, start);
    const atOffset = match[0].lastIndexOf('@');
    const nextDraft = prefix + match[0].slice(0, atOffset) + '@' + profile.displayName + ' ' + draft.slice(start + match[0].length);
    setDraft(nextDraft);
    setMentionUids(previous => previous.includes(profile.uid) ? previous : [...previous, profile.uid]);
    setMentionQuery(null);
  };

  const sendMedia = async (file: File, type: 'image' | 'voice', duration?: number) => {
    if (!uid || !activeId || uploadingMedia) return;
    if (file.size > 12 * 1024 * 1024) { setError('Le fichier dépasse la limite de 12 Mo.'); return; }
    setUploadingMedia(true); setError('');
    try {
      // Unsigned Cloudinary preset; API secret stays server-side.
      const cloudName = 'ocgef9bk';
      const uploadPreset = 'piptalk_media';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || ('media-' + Date.now());
      const form = new FormData();
      form.append('file', file, safeName);
      form.append('upload_preset', uploadPreset);
      form.append('folder', 'piptalk/' + activeId + '/' + uid);
      const response = await fetch('https://api.cloudinary.com/v1_1/' + cloudName + '/auto/upload', { method: 'POST', body: form });
      const uploaded = await response.json() as { secure_url?: string; public_id?: string; resource_type?: string; error?: { message?: string } };
      if (!response.ok || !uploaded.secure_url || !uploaded.public_id) {
        throw new Error(uploaded.error?.message || 'Échec du téléversement Cloudinary. Vérifiez le preset piptalk_media en mode Unsigned.');
      }
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 72 * 60 * 60 * 1000));
      await addDoc(collection(db, 'conversations', activeId, 'messages'), {
        senderId: uid,
        senderName: currentDisplayName,
        senderAvatarURL: currentAvatar,
        text: type === 'image' ? 'Image' : 'Message vocal',
        type, mediaUrl: uploaded.secure_url, mediaPublicId: uploaded.public_id,
        mediaResourceType: uploaded.resource_type || (type === 'voice' ? 'video' : 'image'),
        mediaName: safeName, duration: duration || 0, expiresAt,
        ...replyPayload(replyTo),
        pinned: false, edited: false, createdAt: serverTimestamp()
      });
      void notifyPipTalkRecipients({ conversationId: activeId, senderId: uid, senderName: currentDisplayName, text: type === 'image' ? 'Image' : 'Message vocal', type });
      setReplyTo(null);
      await updateDoc(doc(db, 'conversations', activeId), {
        lastMessage: type === 'image' ? '📷 Image' : '🎤 Message vocal',
        [`memberNames.${uid}`]: currentDisplayName,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      setError(err?.message || 'Impossible d’envoyer ce média avec Cloudinary.');
    } finally { setUploadingMedia(false); }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Sélectionnez un fichier image.'); return; }
    await sendMedia(file, 'image');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find(item => item.type.startsWith('image/'));
    const file = imageItem?.getAsFile();
    if (file) { event.preventDefault(); void handleFile(file); }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('L’enregistrement vocal n’est pas pris en charge par ce navigateur.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder; recordingChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        if (blob.size) {
          const file = new File([blob], `vocal-${Date.now()}.webm`, { type: blob.type });
          setPendingVoice(file);
          setPendingVoiceUrl(URL.createObjectURL(file));
          setPendingVoiceDuration(Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000)));
        }
      };
      recorder.start(); recordingStartedAtRef.current = Date.now(); setRecording(true);
    } catch (err: any) { setError(err?.message || 'Autorisez l’accès au microphone pour enregistrer un vocal.'); }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') { recorderRef.current.stop(); setRecording(false); }
  };

  const cancelPendingVoice = () => {
    if (pendingVoiceUrl) URL.revokeObjectURL(pendingVoiceUrl);
    setPendingVoice(null);
    setPendingVoiceUrl('');
    setPendingVoiceDuration(0);
  };

  const confirmVoiceSend = async () => {
    if (!pendingVoice) return;
    const file = pendingVoice;
    const duration = pendingVoiceDuration;
    await sendMedia(file, 'voice', duration);
    cancelPendingVoice();
  };

  useEffect(() => {
    const textarea = draftTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = window.matchMedia('(min-width: 640px)').matches ? 160 : 144;
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
  }, [draft]);

  const insertEmoji = (emoji: string) => {
    handleDraftChange(draft + emoji);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => draftTextareaRef.current?.focus());
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!uid || !activeId) return;
    const reactions = { ...(message.reactions || {}) };
    if (reactions[uid] === emoji) delete reactions[uid];
    else reactions[uid] = emoji;
    try {
      await updateDoc(doc(db, 'conversations', activeId, 'messages', message.id), { reactions });
      setReactionMessageId(null);
    } catch (err: any) { setError(err?.message || 'Impossible d’ajouter la réaction.'); }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!uid || !activeId || !text || sending) return;
    setSending(true); setError('');
    try {
      if (editingId) {
        const previousMessage = messages.find(message => message.id === editingId);
        await updateDoc(doc(db, 'conversations', activeId, 'messages', editingId), { text, edited: true, editedAt: serverTimestamp() });
        if (previousMessage?.text && active?.lastMessage === previousMessage.text) {
          await updateDoc(doc(db, 'conversations', activeId), { lastMessage: text.slice(0, 500), updatedAt: serverTimestamp() });
        }
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'conversations', activeId, 'messages'), {
          senderId: uid,
          senderName: currentDisplayName,
          senderAvatarURL: currentAvatar,
          text, mentions: mentionUids, ...replyPayload(replyTo), pinned: false, edited: false, createdAt: serverTimestamp()
        });
        void notifyPipTalkRecipients({ conversationId: activeId, senderId: uid, senderName: currentDisplayName, text, type: 'text', mentions: mentionUids });
        await updateDoc(doc(db, 'conversations', activeId), { lastMessage: text.slice(0, 500), [`memberNames.${uid}`]: currentDisplayName, updatedAt: serverTimestamp() });
      }
      setDraft('');
      setMentionUids([]);
      setMentionQuery(null);
      setReplyTo(null);
    } catch (err: any) { setError(err?.message || 'Échec de l’envoi du message.'); }
    finally { setSending(false); }
  };

  const openGroupSettings = () => {
    if (!active || active.id !== 'community-hub' || userProfile?.role !== 'admin') return;
    setGroupTitleDraft(active.title || 'Community Hub');
    setGroupDescriptionDraft(active.description || '');
    setGroupAvatarDraft(active.avatarURL || '');
    setShowGroupSettings(true);
    setError('');
  };

  const saveGroupSettings = async () => {
    if (!active || active.id !== 'community-hub' || userProfile?.role !== 'admin') return;
    const title = groupTitleDraft.trim();
    if (!title) { setError('Le nom du groupe est obligatoire.'); return; }
    setSavingGroupSettings(true);
    setError('');
    try {
      await updateDoc(doc(db, 'conversations', 'community-hub'), {
        title, description: groupDescriptionDraft.trim().slice(0, 300),
        avatarURL: groupAvatarDraft.trim(), updatedAt: serverTimestamp()
      });
      setShowGroupSettings(false);
    } catch (err: any) { setError('Paramètres du groupe : ' + (err?.message || 'permission refusée')); }
    finally { setSavingGroupSettings(false); }
  };

  const copyMessage = async (message: ChatMessage) => {
    if (!message.text?.trim()) { setError('Ce message ne contient pas de texte à copier.'); setMenuMessage(null); return; }
    try { await navigator.clipboard.writeText(message.text); setMenuMessage(null); }
    catch { setError('Impossible de copier le message. Vérifiez les autorisations du navigateur.'); }
  };

  const forwardMessage = async (conversation: ChatConversation) => {
    const message = forwardingMessage;
    if (!message || !uid) return;
    try {
      const forwardedText = message.text || (message.type === 'image' ? 'Image transférée' : message.type === 'voice' ? 'Message vocal transféré' : '');
      const payload: Record<string, unknown> = { senderId: uid, senderName: currentDisplayName, text: forwardedText, type: message.type || 'text', createdAt: serverTimestamp(), forwarded: true, forwardedFrom: message.senderName || (message.senderId === uid ? 'Vous' : 'Trader') };
      if (message.mediaUrl) payload.mediaUrl = message.mediaUrl;
      if (message.mediaName) payload.mediaName = message.mediaName;
      if (message.mediaPublicId) payload.mediaPublicId = message.mediaPublicId;
      if (message.mediaResourceType) payload.mediaResourceType = message.mediaResourceType;
      if (message.duration !== undefined) payload.duration = message.duration;
      await addDoc(collection(db, 'conversations', conversation.id, 'messages'), payload);
      await updateDoc(doc(db, 'conversations', conversation.id), { lastMessage: forwardedText, updatedAt: serverTimestamp() });
      setForwardingMessage(null); setMenuMessage(null);
    } catch (err: any) { setError(err?.message || 'Impossible de transférer ce message.'); }
  };

  useEffect(() => {
    if (!menuMessage) return;
    const outside = (event: PointerEvent) => { if (messageMenuRef.current && !messageMenuRef.current.contains(event.target as Node)) { setMenuMessage(null); setReactionMessageId(null); } };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuMessage(null); setReactionMessageId(null); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuMessage]);

  const togglePin = async (message: ChatMessage) => {
    if (!activeId) return;
    try {
      await updateDoc(doc(db, 'conversations', activeId, 'messages', message.id), { pinned: !message.pinned });
      setMenuMessage(null);
    } catch (err: any) { setError(err?.message || 'Impossible d’épingler ce message.'); }
  };
  const removeMessage = async (message: ChatMessage) => {
    if (!activeId) return;
    try { await deleteDoc(doc(db, 'conversations', activeId, 'messages', message.id)); setMenuMessage(null); }
    catch (err: any) { setError(err?.message || 'Impossible de supprimer ce message.'); }
  };
  const beginEdit = (message: ChatMessage) => { setEditingId(message.id); setDraft(message.text); setReplyTo(null); setMenuMessage(null); };
  const beginReply = (message: ChatMessage) => { setReplyTo(message); setEditingId(null); setDraft(''); setMenuMessage(null); };

  if (!uid) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><MessageCircle className="mx-auto h-8 w-8 text-emerald-600" /><h3 className="mt-3 font-bold text-slate-900">Connectez-vous à PipTalk</h3><p className="mt-1 text-sm text-slate-500">Votre session IAMTRADER est nécessaire pour envoyer et recevoir des messages.</p></div>;

  return <><style>{`@keyframes piptalk-enter{from{opacity:0;transform:translateY(14px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes piptalk-exit{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(10px) scale(.99)}}.piptalk-chat-wallpaper{background-color:#f7f9f8;background-image:radial-gradient(circle at 1px 1px,rgba(100,116,139,.10) 1px,transparent 0),radial-gradient(circle at 15px 17px,rgba(100,116,139,.055) 1px,transparent 0);background-size:24px 24px,32px 32px}.piptalk-chat-wallpaper:before{content:"";position:fixed;pointer-events:none;inset:0;opacity:.12;background-image:radial-gradient(ellipse at 15% 20%,transparent 0 25px,rgba(148,163,184,.16) 26px 27px,transparent 28px),radial-gradient(ellipse at 85% 75%,transparent 0 31px,rgba(148,163,184,.12) 32px 33px,transparent 34px);background-size:180px 180px,220px 220px;z-index:0}.piptalk-chat-wallpaper>*{position:relative;z-index:1}@media(max-width:767px){.piptalk-fullscreen{position:fixed;inset:0;z-index:1000;width:100vw;height:100dvh;max-width:none;margin:0;border:0;border-radius:0;box-shadow:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}.piptalk-fullscreen textarea{font-size:16px!important}}@media(min-width:768px){.piptalk-fullscreen{animation:piptalk-enter .2s ease-out}}`} </style><div className={`-mx-3 w-[calc(100%+1.5rem)] overflow-hidden rounded-none border-0 bg-white shadow-none sm:mx-0 sm:w-auto sm:rounded-3xl sm:border sm:border-slate-200/90 sm:shadow-[0_16px_48px_rgba(11,31,53,0.08)] ${mobileChatOpen ? 'piptalk-fullscreen' : ''}`} style={mobileChatOpen ? {animation: mobileChatClosing ? 'piptalk-exit .18s ease-in forwards' : 'piptalk-enter .24s cubic-bezier(.2,.8,.2,1) both'} : undefined}>
    <div className={`flex min-h-0 ${mobileChatOpen ? 'h-full' : 'h-[calc(100dvh-112px)]'} sm:h-[min(760px,calc(100dvh-210px))] sm:min-h-[520px]`}>
      <aside className={`${mobileChatOpen ? 'hidden md:flex' : 'flex'} h-full min-h-0 w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-[310px] lg:w-[340px]`}>
        <div className="shrink-0 border-b border-slate-100 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f8f2] text-[#00a982]"><MessageCircle className="h-5 w-5" /></div><div><div className="flex items-center gap-1.5"><h2 className="text-base font-black text-[#0b1f35]">PipTalk</h2>{totalUnread > 0 && <span aria-label={`${totalUnread} messages non lus`} className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-extrabold text-white">{totalUnread > 99 ? '99+' : totalUnread}</span>}</div><p className="text-[10px] text-slate-400">Messagerie en temps réel</p></div></div><button onClick={() => { setShowFriendsModal(true); setShowNewChat(false); setError(''); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Ouvrir mes amis et démarrer une conversation"><Plus className="h-4 w-4" /></button></div>
          {showNewChat && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><label className="text-[10px] font-bold text-slate-700">UID du trader destinataire</label><input value={targetUid} onChange={e => setTargetUid(e.target.value)} placeholder="Coller l’UID Firebase du trader" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-emerald-400" /><button onClick={startConversation} className="mt-2 w-full rounded-lg bg-[#00a982] px-3 py-2 text-xs font-bold text-white">Créer la discussion</button><p className="mt-2 text-[9px] leading-4 text-slate-500">L’UID doit appartenir à un autre compte IAMTRADER.</p></div>}
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><Search className="h-4 w-4 text-slate-400" /><input value={queryText} onChange={e => setQueryText(e.target.value)} placeholder="Rechercher une discussion" className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" /></label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20 sm:pb-0">
          {loadingChats && <div className="flex items-center justify-center gap-2 p-6 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Chargement des discussions…</div>}
          {!loadingChats && filtered.length === 0 && <div className="px-5 py-10 text-center"><Users className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-xs font-bold text-slate-600">Aucune discussion</p><p className="mt-1 text-[10px] leading-4 text-slate-400">Utilisez + pour démarrer une conversation avec un UID IAMTRADER.</p></div>}
          {filtered.map(item => { const other = item.members.find(member => member !== uid) || ''; const name = item.title || item.memberNames?.[other] || acceptedFriends.find(friend => friend.uid === other)?.name || `Trader ${other.slice(0, 7)}`; const avatar = item.id === 'community-hub' ? (item.avatarURL || '') : avatarForConversation(item, other); return <button key={item.id} onClick={() => { void openInboxConversation(item); }} className={`group flex w-full items-center gap-2.5 border-b border-slate-100/80 px-3 py-3 text-left transition-colors hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3.5 ${activeId === item.id ? 'bg-[#f0fbf7]' : 'bg-white'}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xs font-black text-emerald-700 ring-1 ring-slate-200/70 sm:h-11 sm:w-11">{avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} /> : name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold leading-4 text-slate-800 sm:text-xs">{name}</div><p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500 sm:mt-1 sm:text-[10px]">{item.lastMessage || 'Démarrer la conversation'}</p></div><span className="shrink-0 self-start pt-0.5 text-[9px] tabular-nums text-slate-400">{formatTime(item.updatedAt)}</span>{(unreadByConversation[item.id] || 0) > 0 && activeId !== item.id && <span aria-label={`${unreadByConversation[item.id]} messages non lus`} className="inline-flex min-w-5 h-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[9px] font-extrabold text-white">{unreadByConversation[item.id] > 99 ? '99+' : unreadByConversation[item.id]}</span>}</button>; })}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-[1010] mt-auto shrink-0 border-t border-slate-200/90 bg-white px-3 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(15,23,42,0.035)] sm:static sm:z-auto sm:py-2.5 sm:bg-slate-50/70 sm:shadow-none">
          {showNotificationOptions && <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#071a2b]/55 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="piptalk-sound-title" onClick={event => { if (event.target === event.currentTarget) setShowNotificationOptions(false); }}>
            <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_28px_100px_rgba(3,20,35,0.35)]">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#082b3b] via-[#075b51] to-[#00a982] px-5 pb-6 pt-5 text-white sm:px-7 sm:pt-7">
                <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full border border-white/10 bg-white/5" /><div className="absolute -right-2 top-8 h-20 w-20 rounded-full border border-white/10" />
                <button onClick={() => setShowNotificationOptions(false)} aria-label="Fermer" className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 p-2 text-white/80 transition hover:bg-white/20"><X className="h-4 w-4" /></button>
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-inner"><BellRing className="h-6 w-6" /></div>
                <p className="relative mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-100">Personnalisation PipTalk</p>
                <h3 id="piptalk-sound-title" className="relative mt-1 text-xl font-black tracking-tight sm:text-2xl">Choisis ton son d’alerte</h3>
                <p className="relative mt-2 max-w-xs text-xs leading-5 text-white/75">Écoute les trois signatures sonores et sélectionne celle qui te convient.</p>
              </div>
              <div className="space-y-2.5 px-4 py-4 sm:px-6 sm:py-5">
                {[
                  { id: 'doux', title: 'Doux', subtitle: 'Deux notes cristallines', detail: 'Discret et élégant', icon: '◖' },
                  { id: 'dynamique', title: 'Dynamique', subtitle: 'Carillon montant', detail: 'Clair et perceptible', icon: '♫' },
                  { id: 'pulse', title: 'Pulse', subtitle: 'Deux bips électroniques', detail: 'Moderne et distinctif', icon: '∿' }
                ].map(sound => <div key={sound.id} className={`flex items-center gap-3 rounded-2xl border p-3 transition-all sm:p-3.5 ${selectedAlertSound === sound.id ? 'border-emerald-400 bg-emerald-50/80 shadow-[0_5px_18px_rgba(16,185,129,0.10)]' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50'}`}>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${selectedAlertSound === sound.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{sound.icon}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-extrabold text-[#0b1f35]">{sound.title}</p>{selectedAlertSound === sound.id && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">Sélectionné</span>}</div><p className="mt-0.5 text-[11px] font-medium text-slate-600">{sound.subtitle}</p><p className="mt-0.5 text-[10px] text-slate-400">{sound.detail}</p></div>
                  <div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => { setPreviewingAlertSound(sound.id); playAlertSound(sound.id); window.setTimeout(() => setPreviewingAlertSound(current => current === sound.id ? '' : current), 650); }} aria-label={`Écouter le son ${sound.title}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"><span className={`text-sm ${previewingAlertSound === sound.id ? 'text-emerald-600' : ''}`}>▶</span></button><button type="button" onClick={() => { setSelectedAlertSound(sound.id); window.localStorage.setItem('piptalk-alert-sound', sound.id); playAlertSound(sound.id); }} aria-label={`Sélectionner le son ${sound.title}`} className={`flex h-9 w-9 items-center justify-center rounded-full transition ${selectedAlertSound === sound.id ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700'}`}>{selectedAlertSound === sound.id ? <CheckCheck className="h-4 w-4" /> : <span className="text-base">✓</span>}</button></div>
                </div>)}
                {pushStatus && <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">{pushStatus}</p>}
                <button disabled={pushBusy} onClick={async () => { setPushBusy(true); const result = await enablePipTalkPush(); setPushStatus(result.message); if (result.success) { setNotificationsEnabled(true); window.localStorage.setItem('piptalk-notifications-enabled', 'true'); window.localStorage.setItem('piptalk-notification-mode', 'push'); setShowNotificationOptions(false); } setPushBusy(false); }} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a982] to-[#059669] px-4 py-3 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(0,169,130,0.22)] transition hover:brightness-105 disabled:opacity-60">{pushBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}{pushBusy ? 'Activation…' : notificationsEnabled ? 'Enregistrer mon choix' : 'Activer les notifications'}</button>
                <p className="px-2 text-center text-[9px] leading-4 text-slate-400">Ton choix de son est mémorisé sur cet appareil. Le son système en arrière-plan dépend aussi des réglages du téléphone.</p>
              </div>
            </div>
          </div>}
          <div className="flex min-h-[42px] items-center justify-between gap-2 sm:min-h-[48px]">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#0b1f35] text-center text-[10px] font-black leading-7 text-white sm:h-8 sm:w-8 sm:leading-8">{(userProfile?.avatarURL || userProfile?.photoURL) ? <img src={userProfile.avatarURL || userProfile.photoURL} alt="Mon avatar" className="h-full w-full object-cover" /> : (userProfile?.displayName || 'IT').slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-slate-800">{userProfile?.displayName || 'Mon espace trader'}</p><p className="text-[9px] text-slate-400">En ligne</p></div>
            <button onClick={() => { if (notificationsEnabled) { setNotificationsEnabled(false); window.localStorage.setItem('piptalk-notifications-enabled', 'false'); window.localStorage.removeItem('piptalk-notification-mode'); setShowNotificationOptions(false); setPushStatus('Notifications désactivées sur cet appareil.'); } else setShowNotificationOptions(value => !value); }} aria-label={notificationsEnabled ? 'Désactiver les notifications' : 'Activer les notifications'} title={notificationsEnabled ? 'Notifications activées — cliquer pour désactiver' : 'Activer les notifications'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${notificationsEnabled ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'border-slate-200 bg-white text-slate-400 hover:border-emerald-300 hover:text-emerald-600'}`}><BellRing className="h-5 w-5" /></button>
          </div>
        </div>
      </aside>
      <section className={`${mobileChatOpen ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-[#f7faf9]`}>
        {active && <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5"><button onClick={closeMobileChat} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Retour"><ArrowLeft className="h-4 w-4" /></button><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{active ? (active.id === 'community-hub' ? (active.avatarURL || '') : avatarForConversation(active, otherUid)) ? <img src={active.id === 'community-hub' ? (active.avatarURL || '') : avatarForConversation(active, otherUid)} alt={activeName} className="h-full w-full object-cover" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/brand/logo-iamtrader-symbol.png'; }} /> : activeName.slice(0, 2).toUpperCase() : <MessageCircle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-extrabold text-[#0b1f35]">{activeName}</h3><p className="text-[10px] text-slate-500">{active?.description || (active ? (active.group ? 'Groupe communautaire' : 'Conversation privée') : 'Sélectionnez une discussion')}</p></div>{active?.id === 'community-hub' && userProfile?.role === 'admin' && <button onClick={openGroupSettings} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Paramètres</span></button>}</header>}
        {showGroupSettings && <div className="border-b border-emerald-100 bg-emerald-50/50 p-4"><div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-extrabold text-slate-800">Paramètres de Community Hub</h4><button onClick={() => setShowGroupSettings(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="space-y-3"><label className="block text-xs font-semibold text-slate-600">Nom du groupe<input value={groupTitleDraft} onChange={e => setGroupTitleDraft(e.target.value)} maxLength={60} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label><label className="block text-xs font-semibold text-slate-600">Description<input value={groupDescriptionDraft} onChange={e => setGroupDescriptionDraft(e.target.value)} maxLength={300} placeholder="Présentation du groupe" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label><label className="block text-xs font-semibold text-slate-600">URL de l’avatar du groupe<input value={groupAvatarDraft} onChange={e => setGroupAvatarDraft(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label><div className="flex justify-end gap-2"><button onClick={() => setShowGroupSettings(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">Annuler</button><button onClick={() => void saveGroupSettings()} disabled={savingGroupSettings} className="flex items-center gap-2 rounded-lg bg-[#00a982] px-3 py-2 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" />{savingGroupSettings ? 'Enregistrement…' : 'Enregistrer'}</button></div></div></div></div>}
        {error && <div className="flex items-start gap-2 border-b border-rose-100 bg-rose-50 px-4 py-2 text-[10px] text-rose-700"><span className="flex-1 break-words">{error}</span><button onClick={() => setError('')} aria-label="Fermer"><X className="h-3.5 w-3.5" /></button></div>}
        <div className="piptalk-chat-wallpaper relative min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pt-4 pb-24 sm:space-y-4 sm:px-7 sm:py-6">
          {!active && <div className="flex h-full flex-col items-center justify-center text-center"><div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200/70 bg-white/75 text-emerald-500 shadow-sm"><MessageCircle className="h-8 w-8" /></div><p className="mt-3 text-sm font-bold text-slate-700">Vos messages, en direct</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Choisissez une discussion ou créez-en une nouvelle pour commencer.</p></div>}
          {active && loadingMessages && <p className="text-center text-xs text-slate-400">Chargement des messages…</p>}
          {messages.map((message, index) => {
            const mine = message.senderId === uid;
            const currentDate = message.createdAt?.toDate ? message.createdAt.toDate().toDateString() : '';
            const previousDate = index > 0 && messages[index - 1].createdAt?.toDate ? messages[index - 1].createdAt!.toDate().toDateString() : '';
            const showDay = !!currentDate && currentDate !== previousDate;
            const senderName = message.senderName?.trim() || active?.memberNames?.[message.senderId]?.trim() || (mine ? currentDisplayName : `Trader ${message.senderId.slice(0, 7)}`);
            return <React.Fragment key={message.id}>
              {showDay && <div className="flex justify-center py-2"><span className="rounded-full border border-slate-200/80 bg-white/90 px-3.5 py-1.5 text-[10px] font-semibold capitalize text-slate-500 shadow-sm">{formatDay(message.createdAt)}</span></div>}
              <div className={`group relative flex w-full items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine && active?.group && <div className="mb-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">{avatarForMessage(message) ? <img src={avatarForMessage(message)} alt={senderName} className="h-full w-full object-cover" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/brand/logo-iamtrader-symbol.png'; }} /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100 text-[10px] font-extrabold text-emerald-800">{senderName.slice(0, 2).toUpperCase()}</div>}</div>}
                <div className={`relative flex min-w-0 max-w-[82%] flex-col ${mine ? 'items-end' : 'items-start'} sm:max-w-[70%]`}>
                <div onTouchStart={event => beginMessageLongPress(message.id, event)} onTouchEnd={cancelMessageLongPress} onTouchMove={cancelMessageLongPress} onContextMenu={event => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); const menuWidth = 208; const menuHeight = 300; const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)); const top = rect.top >= menuHeight + 16 ? rect.top - menuHeight - 6 : Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 8); setMessageMenuPosition({ left, top: Math.max(8, top) }); setMenuMessage(message.id); setReactionMessageId(null); }} className={`relative min-w-0 max-w-full rounded-[18px] px-3 py-2.5 shadow-[0_2px_7px_rgba(15,23,42,0.045)] transition-shadow hover:shadow-md sm:px-3.5 sm:py-2.5 ${mine ? 'rounded-br-[6px] border border-emerald-200 bg-gradient-to-br from-[#d1fae5] to-[#bbf7d0] text-slate-900' : 'rounded-bl-[6px] border border-slate-200 bg-[#f1f5f9] text-slate-800'}`}>
                  {(active?.group || message.type === 'voice') && <div className={`mb-0.5 flex items-center gap-1.5 text-[10px] font-extrabold tracking-[-0.01em] ${mine ? 'text-emerald-800' : 'text-slate-800'}`}><span className="truncate">{senderName}</span>{mine && <span className="rounded-full bg-emerald-100/80 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-700">Vous</span>}</div>}
                  {message.forwarded && <div className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold ${mine ? "text-emerald-800" : "text-slate-500"}`}><Forward className="h-3 w-3" /><span>Transféré · Origine : {message.forwardedFrom || "Expéditeur initial inconnu"}</span></div>}
                  {message.pinned && <div className="mb-1 flex items-center gap-1 text-[9px] font-bold text-emerald-700"><Pin className="h-3 w-3" />Message épinglé</div>}
                  {(message.replyToMessageId || message.replyToId) && <div className={`mb-1.5 flex max-w-full gap-1.5 rounded-lg border-l-[3px] px-2 py-1.5 text-left ${mine ? 'border-emerald-600 bg-emerald-100/70' : 'border-slate-400 bg-slate-50'}`}><Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" /><div className="min-w-0"><p className="truncate text-[10px] font-bold text-slate-700">{message.replyToSenderName || 'Message cité'}</p><p className="truncate text-[11px] text-slate-500">{message.replyToText || 'Message'}</p></div></div>}
                  {message.expiresAt?.toDate && message.expiresAt.toDate().getTime() <= Date.now()
                    ? <p className="text-xs italic text-slate-400">Média expiré après 72 heures</p>
                    : message.type === 'image' && message.mediaUrl
                      ? <button type="button" onClick={() => setViewerImage(message)} aria-label="Ouvrir l’image dans PipTalk" className="mb-1 block max-w-full cursor-zoom-in overflow-hidden rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-emerald-400"><img src={message.mediaUrl} alt={message.mediaName || "Image envoyée"} loading="lazy" className="max-h-72 max-w-full rounded-xl object-contain" /></button>
                      : message.type === 'voice' && message.mediaUrl
                        ? <VoiceMessagePlayer src={message.mediaUrl} mine={mine} duration={message.duration || 0} />
                        : <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.5] sm:text-[15px] sm:leading-[1.55]">{message.text}</p>}

                  <div className="mt-0.5 flex items-center justify-end gap-1"><span className="text-[10px] leading-4 text-slate-500">{message.edited ? 'modifié · ' : ''}{formatTime(message.createdAt)}</span>{mine && (() => { const sentAt = message.createdAt?.toMillis?.() || 0; const readBySomeone = sentAt > 0 && (active?.members || []).some(memberUid => memberUid !== uid && (readReceiptsByUser[memberUid] || 0) >= sentAt); return readBySomeone ? <CheckCheck title="Lu" aria-label="Lu" className="h-3 w-3 text-emerald-600" /> : null; })()}</div>
                  {active?.group && <span aria-hidden="true" className={`pointer-events-none absolute bottom-3 h-2.5 w-2.5 rotate-45 ${mine ? '-right-[5px] border-b border-r border-emerald-200 bg-[#bbf7d0]' : '-left-[5px] border-b border-l border-slate-200 bg-[#f1f5f9]'}`} />}
                  <button type="button" onClick={event => { event.stopPropagation(); openMessageMenu(event, message.id); }} className={`absolute -top-2 z-20 flex rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow-md transition-opacity ${mine ? '-left-2' : '-right-2'} opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100`} title="Actions" aria-label="Actions du message"><MoreVertical className="h-3 w-3" /></button>
                  {menuMessage === message.id && messageMenuPosition && <div ref={messageMenuRef} style={{ position: 'fixed', left: messageMenuPosition.left, top: messageMenuPosition.top, maxHeight: 'calc(100dvh - 16px)' }} className="z-[1200] w-52 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-xl"><div className="border-b border-slate-100 px-2 py-2"><p className="mb-1.5 px-1 text-[10px] font-semibold text-slate-500">Réactions</p><div className="flex items-center justify-between gap-0.5">{['❤️','👍','😂','🔥','😮','🙏'].map(emoji => <button key={emoji} type="button" onClick={() => { void toggleReaction(message, emoji); setMenuMessage(null); }} aria-label={`Réagir avec ${emoji}`} className="flex h-7 w-7 items-center justify-center rounded-full text-base hover:bg-emerald-50">{emoji}</button>)}</div></div><button onClick={() => { setReactionMessageId(reactionMessageId === message.id ? null : message.id); setMenuMessage(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Smile className="h-3.5 w-3.5" />Plus de réactions</button><button onClick={() => void copyMessage(message)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Copy className="h-3.5 w-3.5" />Copier</button><button onClick={() => { setForwardingMessage(message); setMenuMessage(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Forward className="h-3.5 w-3.5" />Transférer</button><button onClick={() => beginReply(message)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Reply className="h-3.5 w-3.5" />Répondre</button><button onClick={() => togglePin(message)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Pin className="h-3.5 w-3.5" />{message.pinned ? 'Désépingler' : 'Épingler'}</button>{mine && <button onClick={() => beginEdit(message)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Modifier</button>}{mine && <button onClick={() => removeMessage(message)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Supprimer</button>}</div>}
                  {reactionMessageId === message.id && messageMenuPosition && <div style={{ position: 'fixed', left: messageMenuPosition.left, top: messageMenuPosition.top }} className="z-[1200] flex max-w-[calc(100vw-16px)] items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl">{['❤️','👍','😂','🔥','😮','🙏'].map(emoji => <button key={emoji} type="button" onClick={() => void toggleReaction(message, emoji)} aria-label={`Réagir avec ${emoji}`} className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-emerald-50">{emoji}</button>)}</div>}
                </div>
                {message.reactions && Object.keys(message.reactions).length > 0 && <div className={`mt-1 flex max-w-full flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>{Object.entries(Object.values(message.reactions).reduce((counts, emoji) => { counts[emoji] = (counts[emoji] || 0) + 1; return counts; }, {} as Record<string, number>)).map(([emoji, count]) => <button key={emoji} type="button" onClick={() => void toggleReaction(message, emoji)} aria-label={`Réagir avec ${emoji}`} className={`rounded-full border px-2 py-0.5 text-xs shadow-sm transition ${message.reactions?.[uid] === emoji ? 'border-emerald-300 bg-emerald-100' : 'border-slate-200 bg-white/90'}`}>{emoji} <span className="text-[10px] font-semibold text-slate-600">{count}</span></button>)}</div>}
                </div>
                {mine && active?.group && <div className="mb-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">{avatarForMessage(message) ? <img src={avatarForMessage(message)} alt={senderName} className="h-full w-full object-cover" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/brand/logo-iamtrader-symbol.png'; }} /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100 text-[10px] font-extrabold text-emerald-800">{senderName.slice(0, 2).toUpperCase()}</div>}</div>}
              </div>
            </React.Fragment>; })}
          <div ref={bottomRef} />
        </div>
        {active && <footer className="fixed inset-x-0 bottom-0 z-[1010] shrink-0 border-t border-slate-200/90 bg-white/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:static sm:z-auto sm:px-4 sm:py-3">
      {replyTo && <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2"><Reply className="h-4 w-4 shrink-0 text-emerald-700" /><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-emerald-800">Réponse à {replyTo.senderName || (replyTo.senderId === uid ? 'vous' : 'ce message')}</p><p className="truncate text-[11px] text-slate-600">{replyTo.type === 'image' ? 'Image' : replyTo.type === 'voice' ? 'Message vocal' : replyTo.text}</p></div><button onClick={() => setReplyTo(null)} aria-label="Annuler la réponse" className="rounded-lg p-1 text-slate-500 hover:bg-white"><X className="h-4 w-4" /></button></div>}
      {editingId && <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-800"><span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" />Modification du message</span><button onClick={() => { setEditingId(null); setDraft(''); }}><X className="h-3.5 w-3.5" /></button></div>}
      {pendingVoice && pendingVoiceUrl ? <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
        <button type="button" onClick={cancelPendingVoice} aria-label="Supprimer le vocal" title="Supprimer le vocal" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"><Mic className="h-3 w-3" />Écouter avant l’envoi · {Math.floor(pendingVoiceDuration / 60)}:{String(pendingVoiceDuration % 60).padStart(2, '0')}</div><audio src={pendingVoiceUrl} controls preload="metadata" className="h-8 w-full" /></div>
        <button type="button" onClick={() => void confirmVoiceSend()} disabled={uploadingMedia} aria-label="Confirmer et envoyer le vocal" title="Confirmer et envoyer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a982] text-white shadow-sm hover:bg-[#008f72] disabled:opacity-50">{uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </div> : recording ? <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2.5"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /><span className="flex-1 text-xs font-medium text-slate-700">Enregistrement en cours…</span><button type="button" onClick={() => { if (recorderRef.current?.state === 'recording') { recorderRef.current.onstop = () => { recorderRef.current?.stream?.getTracks().forEach(track => track.stop()); }; recorderRef.current.stop(); } setRecording(false); recordingChunksRef.current = []; }} className="rounded-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100">Annuler</button><button type="button" onClick={stopRecording} className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white" aria-label="Arrêter et préécouter"><Square className="h-4 w-4 fill-current" /></button></div> : <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => void handleFile(e.target.files?.[0])} />
        <button type="button" disabled={!active || uploadingMedia} onClick={() => fileInputRef.current?.click()} title="Envoyer une image" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 sm:h-10 sm:w-10"><ImageIcon className="h-4 w-4" /></button>
        <button type="button" disabled={!active || uploadingMedia} onClick={() => setShowEmojiPicker(value => !value)} title="Insérer un émoji" aria-label="Insérer un émoji" aria-expanded={showEmojiPicker} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition sm:h-10 sm:w-10 ${showEmojiPicker ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50'}`}><Smile className="h-4 w-4" /></button>
        <div className="relative min-w-0 flex-1">
          {showEmojiPicker && <div role="dialog" aria-label="Choisir un émoji" className="absolute bottom-full left-0 z-40 mb-2 grid w-[min(280px,calc(100vw-24px))] grid-cols-7 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">{['😀','😂','🥹','😍','😎','🤔','😮','😭','🙏','👏','👍','👎','❤️','🔥','🎉','💯','💪','🤝','📈','📉','🚀','💰','✅','❌','⚠️','💡','🙌','✨'].map(emoji => <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} aria-label={`Insérer ${emoji}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-emerald-50 active:scale-95">{emoji}</button>)}</div>}
          {mentionQuery !== null && publicProfiles.some(profile => profile.displayName.toLocaleLowerCase().includes(mentionQuery)) && <div className="absolute bottom-full left-0 z-30 mb-2 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {publicProfiles.filter(profile => profile.displayName.toLocaleLowerCase().includes(mentionQuery)).slice(0, 8).map(profile => <button key={profile.uid} type="button" onMouseDown={event => event.preventDefault()} onClick={() => chooseMention(profile)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-emerald-50">
              {profile.avatarURL ? <img src={profile.avatarURL} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">{profile.displayName.slice(0, 2).toUpperCase()}</span>}
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{profile.displayName}</span><span className="text-[10px] text-emerald-700">@Mentionner</span>
            </button>)}
          </div>}
          <textarea ref={draftTextareaRef} value={draft} onChange={e => handleDraftChange(e.target.value)} onPaste={handlePaste} onKeyDown={e => { if (e.key === 'Escape') setMentionQuery(null); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (mentionQuery !== null) { setMentionQuery(null); return; } void sendMessage(); } }} disabled={!active || sending} placeholder={active ? 'Écrire un message… tapez @ pour mentionner' : 'Sélectionnez une discussion…'} rows={1} className="max-h-36 sm:max-h-40 min-h-9 w-full resize-none overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-5 text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-50 disabled:opacity-50 sm:min-h-10 sm:px-3.5 sm:py-2.5 sm:text-xs" />
        </div>
        {draft.trim() ? <button onClick={() => void sendMessage()} disabled={!active || sending || uploadingMedia} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00b98b] to-[#008f72] text-white shadow-md shadow-emerald-900/15 transition hover:brightness-105 disabled:opacity-40 sm:h-10 sm:w-10" title="Envoyer">{sending || uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button> : <button type="button" disabled={!active || uploadingMedia} onClick={() => void startRecording()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 sm:h-10 sm:w-10" title="Enregistrer un vocal" aria-label="Enregistrer un vocal"><Mic className="h-4 w-4" /></button>}
      </div>}
      {!pendingVoice && !recording && <p className="mt-1 hidden pl-2 text-[9px] text-slate-400 sm:block">Entrée pour envoyer · Maj + Entrée pour un saut de ligne · Coller une image avec Ctrl+V</p>}
    </footer>}
      </section>
    </div>
    {forwardingMessage && <div role="dialog" aria-modal="true" aria-label="Transférer le message" className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setForwardingMessage(null); }}>
      <div className="flex max-h-[80dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-bold text-slate-900">Transférer le message</h2><p className="mt-0.5 text-[11px] text-slate-500">Choisissez une conversation.</p></div><button type="button" onClick={() => setForwardingMessage(null)} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        <div className="overflow-y-auto p-2">{conversations.filter(conversation => conversation.id !== activeId).map(conversation => <button key={conversation.id} type="button" onClick={() => void forwardMessage(conversation)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-emerald-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{(conversation.title || conversation.memberNames?.[conversation.members.find(member => member !== uid) || ''] || 'Chat').slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{conversation.title || conversation.memberNames?.[conversation.members.find(member => member !== uid) || ''] || 'Discussion'}</span><span className="block truncate text-[10px] text-slate-500">{conversation.group ? 'Groupe' : 'Discussion privée'}</span></span><Forward className="h-4 w-4 shrink-0 text-slate-400" /></button>)}{!conversations.some(conversation => conversation.id !== activeId) && <p className="px-3 py-6 text-center text-xs text-slate-500">Aucune autre conversation disponible.</p>}</div>
      </div>
    </div>}
    {showFriendsModal && <div role="dialog" aria-modal="true" aria-label="Traders et amis" className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setShowFriendsModal(false); }}>
      <div className="relative flex h-[60dvh] max-h-[60dvh] w-full max-w-5xl translate-y-0 flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl animate-[slideUp_220ms_ease-out] sm:h-auto sm:max-h-[94dvh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div><h2 className="text-sm font-extrabold text-slate-900">Traders & amis</h2><p className="mt-0.5 text-[10px] text-slate-500">Retrouvez vos amis, gérez les demandes et découvrez des traders.</p></div>
          <button type="button" onClick={() => setShowFriendsModal(false)} aria-label="Fermer Traders et amis" className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-3 w-3" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FriendsView userProfile={userProfile} initialTab="friends" onOpenChat={conversationId => { setShowFriendsModal(false); setError(''); setActiveId(conversationId); setMobileChatOpen(true); }} />
        </div>
      </div>
    </div>}
    {viewerImage?.mediaUrl && <div role="dialog" aria-modal="true" aria-label="Visionneuse d’image" onClick={() => setViewerImage(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-3 backdrop-blur-md sm:p-8">
      <button type="button" onClick={() => setViewerImage(null)} aria-label="Fermer l’image" className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white sm:right-5 sm:top-5"><X className="h-5 w-5" /></button>
      <div className="flex h-full w-full items-center justify-center" onClick={event => event.stopPropagation()}>
        <img src={viewerImage.mediaUrl} alt={viewerImage.mediaName || "Image envoyée"} className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl" />
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 max-w-[90vw] -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-xs text-white/85">{viewerImage.mediaName || "Image envoyée"} · Cliquez à côté pour fermer</div>
    </div>}
  </div></>;
}


function VoiceMessagePlayer({ src, mine, duration }: { src: string; mine: boolean; duration: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(duration);
  const [playError, setPlayError] = useState(false);
  const bars = [4,7,11,6,13,9,5,15,8,12,6,10,16,7,12,5,9,14,6,11,8,15,5,10,13,7,4,12,8,15,6,10,5,13,8,11,6,14,9,5,12,7,15,10,6,13,8,4];
  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  };
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime || 0);
    const updateDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setTotalTime(audio.duration);
    };
    const ended = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', ended);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', ended);
    };
  }, [src]);
  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlayError(false);
    if (audio.paused) {
      try { await audio.play(); setPlaying(true); }
      catch { setPlaying(false); setPlayError(true); }
    } else {
      audio.pause();
      setPlaying(false);
    }
  };
  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setCurrentTime(audio.currentTime);
  };
  const progress = totalTime > 0 ? Math.min(1, currentTime / totalTime) : 0;
  return (
    <div className="my-0.5 flex w-[min(230px,62vw)] min-w-[175px] items-center gap-2">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button type="button" onClick={() => void togglePlayback()} aria-label={playing ? 'Mettre le vocal en pause' : 'Lire le message vocal'} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${mine ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-white'}`}>
        {playing ? <Square className="h-3.5 w-3.5 fill-current" /> : <span className="ml-0.5 block h-0 w-0 border-y-[7px] border-y-transparent border-l-[10px] border-l-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div role="slider" aria-label="Position du message vocal" aria-valuemin={0} aria-valuemax={Math.round(totalTime)} aria-valuenow={Math.round(currentTime)} tabIndex={0} onClick={seek} onKeyDown={event => {
          const audio = audioRef.current;
          if (!audio || !Number.isFinite(audio.duration)) return;
          if (event.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
          if (event.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
        }} className="flex h-6 cursor-pointer items-center gap-[2px] outline-none" >
          {bars.map((height, index) => <span key={index} className="block min-w-[2px] flex-1 rounded-full" style={{ height: height + 'px', maxHeight: '18px', backgroundColor: index / bars.length < progress ? (mine ? '#065f46' : '#334155') : (mine ? '#789b91' : '#94a3b8'), opacity: 1, visibility: 'visible' }} />)}
        </div>
        <div className="flex items-center justify-between text-[9px] leading-3 text-slate-600">
          <span>{formatDuration(currentTime > 0 ? currentTime : totalTime)}</span>
          <span className="text-[9px]">{playError ? 'Lecture impossible' : 'Message vocal'}</span>
        </div>
      </div>
    </div>
  );
}
