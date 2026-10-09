import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { auth, db, app } from '../firebase/config';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, Timestamp
} from 'firebase/firestore';
import {
  Search, MoreVertical, Send, Pin, Pencil, Trash2, X, CheckCheck,
  MessageCircle, Plus, ArrowLeft, Users, Loader2, Image as ImageIcon, Mic, Square, Paperclip
} from 'lucide-react';

type ChatConversation = {
  id: string; members: string[]; memberNames?: Record<string, string>;
  group?: boolean; title?: string; lastMessage?: string;
  updatedAt?: Timestamp | null; createdAt?: Timestamp | null;
};
type ChatMessage = {
  id: string; senderId: string; text: string; createdAt?: Timestamp | null;
  edited?: boolean; pinned?: boolean; type?: 'text' | 'image' | 'voice'; mediaUrl?: string; mediaName?: string; duration?: number;
};

const formatTime = (value?: Timestamp | null) => value?.toDate
  ? value.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  : '…';
const formatDay = (value?: Timestamp | null) => value?.toDate
  ? value.toDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  : '';

export function ChatView({ userProfile }: { userProfile: UserProfile | null }) {
  const uid = auth.currentUser?.uid || userProfile?.uid;
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState('');
  const [queryText, setQueryText] = useState('');
  const [targetUid, setTargetUid] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    if (!uid) { setLoadingChats(false); return; }
    const q = query(collection(db, 'conversations'), where('members', 'array-contains', uid), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, snapshot => {
      setConversations(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as ChatConversation)));
      setLoadingChats(false);
    }, err => { setError(err.message); setLoadingChats(false); });
  }, [uid]);

  useEffect(() => {
    if (!uid || !activeId) { setMessages([]); return; }
    setLoadingMessages(true);
    const q = query(collection(db, 'conversations', activeId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snapshot => {
      setMessages(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as ChatMessage)));
      setLoadingMessages(false);
    }, err => { setError(err.message); setLoadingMessages(false); });
  }, [uid, activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const active = conversations.find(item => item.id === activeId);
  const otherUid = active?.members.find(member => member !== uid) || '';
  const activeName = active?.title || active?.memberNames?.[otherUid] || (otherUid ? `Trader ${otherUid.slice(0, 7)}` : 'Choisir une discussion');
  const filtered = useMemo(() => conversations.filter(item => {
    const other = item.members.find(member => member !== uid) || '';
    const name = item.title || item.memberNames?.[other] || other;
    return name.toLowerCase().includes(queryText.toLowerCase()) || other.toLowerCase().includes(queryText.toLowerCase()) || (item.lastMessage || '').toLowerCase().includes(queryText.toLowerCase());
  }), [conversations, queryText, uid]);

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

  const sendMedia = async (file: File, type: 'image' | 'voice', duration?: number) => {
    if (!uid || !activeId || uploadingMedia) return;
    if (file.size > 12 * 1024 * 1024) { setError('Le fichier dépasse la limite de 12 Mo.'); return; }
    setUploadingMedia(true); setError('');
    try {
      const storage = getStorage(app);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `media-${Date.now()}`;
      const path = `piptalk/${activeId}/${uid}/${Date.now()}-${safeName}`;
      const destination = storageRef(storage, path);
      await uploadBytes(destination, file, { contentType: file.type || (type === 'voice' ? 'audio/webm' : 'application/octet-stream') });
      const mediaUrl = await getDownloadURL(destination);
      await addDoc(collection(db, 'conversations', activeId, 'messages'), {
        senderId: uid, text: type === 'image' ? 'Image' : 'Message vocal',
        type, mediaUrl, mediaName: safeName, duration: duration || 0,
        pinned: false, edited: false, createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'conversations', activeId), {
        lastMessage: type === 'image' ? '📷 Image' : '🎤 Message vocal',
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      setError(err?.message || 'Impossible d’envoyer ce média. Vérifiez les règles Firebase Storage.');
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
        if (blob.size) void sendMedia(new File([blob], `vocal-${Date.now()}.webm`, { type: blob.type }), 'voice');
      };
      recorder.start(); setRecording(true);
    } catch (err: any) { setError(err?.message || 'Autorisez l’accès au microphone pour enregistrer un vocal.'); }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') { recorderRef.current.stop(); setRecording(false); }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!uid || !activeId || !text || sending) return;
    setSending(true); setError('');
    try {
      if (editingId) {
        await updateDoc(doc(db, 'conversations', activeId, 'messages', editingId), { text, edited: true, editedAt: serverTimestamp() });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'conversations', activeId, 'messages'), {
          senderId: uid, text, pinned: false, edited: false, createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'conversations', activeId), { lastMessage: text.slice(0, 500), updatedAt: serverTimestamp() });
      }
      setDraft('');
    } catch (err: any) { setError(err?.message || 'Échec de l’envoi du message.'); }
    finally { setSending(false); }
  };

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
  const beginEdit = (message: ChatMessage) => { setEditingId(message.id); setDraft(message.text); setMenuMessage(null); };

  if (!uid) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><MessageCircle className="mx-auto h-8 w-8 text-emerald-600" /><h3 className="mt-3 font-bold text-slate-900">Connectez-vous à PipTalk</h3><p className="mt-1 text-sm text-slate-500">Votre session IAMTRADER est nécessaire pour envoyer et recevoir des messages.</p></div>;

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex h-[min(720px,calc(100vh-190px))] min-h-[520px]">
      <aside className={`${mobileChatOpen ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-[310px] lg:w-[340px]`}>
        <div className="border-b border-slate-100 px-4 pb-4 pt-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f8f2] text-[#00a982]"><MessageCircle className="h-5 w-5" /></div><div><h2 className="text-base font-black text-[#0b1f35]">PipTalk</h2><p className="text-[10px] text-slate-400">Messagerie en temps réel</p></div></div><button onClick={() => { setShowNewChat(v => !v); setError(''); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Nouvelle conversation"><Plus className="h-4 w-4" /></button></div>
          {showNewChat && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><label className="text-[10px] font-bold text-slate-700">UID du trader destinataire</label><input value={targetUid} onChange={e => setTargetUid(e.target.value)} placeholder="Coller l’UID Firebase du trader" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-emerald-400" /><button onClick={startConversation} className="mt-2 w-full rounded-lg bg-[#00a982] px-3 py-2 text-xs font-bold text-white">Créer la discussion</button><p className="mt-2 text-[9px] leading-4 text-slate-500">L’UID doit appartenir à un autre compte IAMTRADER.</p></div>}
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><Search className="h-4 w-4 text-slate-400" /><input value={queryText} onChange={e => setQueryText(e.target.value)} placeholder="Rechercher une discussion" className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" /></label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingChats && <div className="flex items-center justify-center gap-2 p-6 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Chargement des discussions…</div>}
          {!loadingChats && filtered.length === 0 && <div className="px-5 py-10 text-center"><Users className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-xs font-bold text-slate-600">Aucune discussion</p><p className="mt-1 text-[10px] leading-4 text-slate-400">Utilisez + pour démarrer une conversation avec un UID IAMTRADER.</p></div>}
          {filtered.map(item => { const other = item.members.find(member => member !== uid) || ''; const name = item.title || item.memberNames?.[other] || `Trader ${other.slice(0, 7)}`; return <button key={item.id} onClick={() => { setActiveId(item.id); setMobileChatOpen(true); setEditingId(null); setDraft(''); }} className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3.5 text-left hover:bg-slate-50 ${activeId === item.id ? 'bg-[#f0fbf7]' : ''}`}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-slate-800">{name}</div><p className="mt-1 truncate text-[10px] text-slate-500">{item.lastMessage || 'Démarrer la conversation'}</p></div><span className="text-[9px] text-slate-400">{formatTime(item.updatedAt)}</span></button>; })}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3"><div className="h-8 w-8 overflow-hidden rounded-full bg-[#0b1f35] text-center text-[10px] font-black leading-8 text-white">{(userProfile?.avatarURL || userProfile?.photoURL) ? <img src={userProfile.avatarURL || userProfile.photoURL} alt="Mon avatar" className="h-full w-full object-cover" /> : (userProfile?.displayName || 'IT').slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-slate-800">{userProfile?.displayName || 'Mon espace trader'}</p><p className="text-[9px] text-slate-400">Connecté à IAMTRADER</p></div></div>
      </aside>
      <section className={`${mobileChatOpen ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-[#f7faf9]`}>
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5"><button onClick={() => setMobileChatOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Retour"><ArrowLeft className="h-4 w-4" /></button><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{activeName.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-extrabold text-[#0b1f35]">{activeName}</h3><p className="text-[10px] text-slate-500">{active ? (active.group ? 'Groupe' : 'Conversation privée') : 'Sélectionnez une discussion'}</p></div></header>
        {error && <div className="flex items-start gap-2 border-b border-rose-100 bg-rose-50 px-4 py-2 text-[10px] text-rose-700"><span className="flex-1 break-words">{error}</span><button onClick={() => setError('')} aria-label="Fermer"><X className="h-3.5 w-3.5" /></button></div>}
        <div className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-6">
          {!active && <div className="flex h-full flex-col items-center justify-center text-center"><MessageCircle className="h-10 w-10 text-emerald-300" /><p className="mt-3 text-sm font-bold text-slate-700">Vos messages, en direct</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Choisissez une discussion ou créez-en une nouvelle pour commencer.</p></div>}
          {active && loadingMessages && <p className="text-center text-xs text-slate-400">Chargement des messages…</p>}
          {messages.map((message, index) => {
            const mine = message.senderId === uid;
            const currentDate = message.createdAt?.toDate ? message.createdAt.toDate().toDateString() : '';
            const previousDate = index > 0 && messages[index - 1].createdAt?.toDate ? messages[index - 1].createdAt!.toDate().toDateString() : '';
            const showDay = !!currentDate && currentDate !== previousDate;
            return <React.Fragment key={message.id}>{showDay && <div className="flex justify-center py-2"><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold capitalize text-slate-500 shadow-sm">{formatDay(message.createdAt)}</span></div>}<div className={`group relative flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[75%] ${mine ? 'rounded-br-md bg-[#dff8ed] text-slate-800' : 'rounded-bl-md border border-slate-100 bg-white text-slate-700'}`}>{message.pinned && <div className="mb-1 flex items-center gap-1 text-[9px] font-bold text-emerald-700"><Pin className="h-3 w-3" />Épinglé</div>}{message.type === 'image' && message.mediaUrl ? <a href={message.mediaUrl} target="_blank" rel="noreferrer"><img src={message.mediaUrl} alt="Image envoyée" className="mb-2 max-h-72 max-w-full rounded-lg object-contain" /></a> : message.type === 'voice' && message.mediaUrl ? <audio controls preload="metadata" src={message.mediaUrl} className="my-1 max-w-full" /> : <p className="whitespace-pre-wrap break-words text-[12px] leading-5">{message.text}</p>}<div className="mt-1.5 flex items-center justify-end gap-1.5"><span className="text-[9px] text-slate-400">{message.edited ? 'modifié · ' : ''}{formatTime(message.createdAt)}</span>{mine && <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />}</div><button onClick={() => setMenuMessage(menuMessage === message.id ? null : message.id)} className="absolute -right-2 -top-2 hidden rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm group-hover:block" title="Actions"><MoreVertical className="h-3 w-3" /></button>{menuMessage === message.id && <div className="absolute right-0 top-6 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"><button onClick={() => togglePin(message)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Pin className="h-3.5 w-3.5" />{message.pinned ? 'Désépingler' : 'Épingler'}</button>{mine && <button onClick={() => beginEdit(message)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Modifier</button>}{mine && <button onClick={() => removeMessage(message)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Supprimer</button>}</div>}</div></div></React.Fragment>; })}
          <div ref={bottomRef} />
        </div>
        <footer className="border-t border-slate-200 bg-white px-3 py-3 sm:px-4">{editingId && <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-800"><span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" />Modification du message</span><button onClick={() => { setEditingId(null); setDraft(''); }}><X className="h-3.5 w-3.5" /></button></div>}<div className="flex items-end gap-2"><input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => void handleFile(e.target.files?.[0])} /><button type="button" disabled={!active || uploadingMedia} onClick={() => fileInputRef.current?.click()} title="Envoyer une image" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ImageIcon className="h-4 w-4" /></button><button type="button" disabled={!active || uploadingMedia} onClick={() => recording ? stopRecording() : void startRecording()} title={recording ? "Arrêter l’enregistrement" : "Enregistrer un vocal"} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${recording ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'} disabled:opacity-40`}>{recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button><textarea value={draft} onChange={e => setDraft(e.target.value)} onPaste={handlePaste} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} disabled={!active || sending} placeholder={active ? 'Écrire un message…' : 'Sélectionnez une discussion…'} rows={1} className="max-h-28 min-h-10 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-5 text-slate-700 outline-none focus:border-emerald-300 focus:bg-white disabled:opacity-50" /><button onClick={() => void sendMessage()} disabled={!active || !draft.trim() || sending || uploadingMedia} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00a982] text-white shadow-sm hover:bg-[#008f72] disabled:opacity-40" title="Envoyer">{sending || uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div><p className="mt-2 pl-2 text-[9px] text-slate-400">Entrée pour envoyer · Maj + Entrée pour un saut de ligne · Coller une image avec Ctrl+V</p></footer>
      </section>
    </div>
  </div>;
}
