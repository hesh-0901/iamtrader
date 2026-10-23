import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, Check, X, MessageCircle, Users, Compass, Clock3, ChevronRight, Send, ShieldCheck, Loader2, UserRound, CheckCircle2 } from 'lucide-react';
import { collection, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile } from '../types';

type Profile = { uid: string; displayName: string; avatarURL?: string; photoURL?: string };
type Request = { id: string; senderId: string; receiverId: string; status: string; senderName?: string; receiverName?: string };

type Tab = 'discover' | 'requests' | 'friends';

export function FriendsView({ userProfile }: { userProfile: UserProfile | null }) {
  const uid = auth.currentUser?.uid || userProfile?.uid || '';
  const [tab, setTab] = useState<Tab>('discover');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Request[]>([]);
  const [friends, setFriends] = useState<Request[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [confirmFriend, setConfirmFriend] = useState<Profile | null>(null);

  useEffect(() => {
    if (!uid) return;
    const a = onSnapshot(query(collection(db, 'friendRequests'), where('receiverId', '==', uid)), snapshot => {
      setIncoming(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Request)));
    }, err => setError(err.message));
    const b = onSnapshot(query(collection(db, 'friendRequests'), where('senderId', '==', uid)), snapshot => {
      setOutgoing(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Request)));
    }, err => setError(err.message));
    return () => { a(); b(); };
  }, [uid]);

  const received = incoming.filter(item => item.status === 'pending');
  const sentPending = outgoing.filter(item => item.status === 'pending');
  const acceptedOutgoing = outgoing.filter(item => item.status === 'accepted');
  const acceptedIncoming = incoming.filter(item => item.status === 'accepted');
  const acceptedRequests = useMemo(() => {
    const unique = new Map<string, Request>();
    [...acceptedOutgoing, ...acceptedIncoming].forEach(item => {
      const otherUid = item.senderId === uid ? item.receiverId : item.senderId;
      if (otherUid && !unique.has(otherUid)) unique.set(otherUid, item);
    });
    return [...unique.values()];
  }, [acceptedOutgoing, acceptedIncoming, uid]);

  const search = async () => {
    setError('');
    setNotice('');
    if (term.trim().length < 2) { setError('Saisissez au moins 2 caractères du pseudo.'); return; }
    try {
      const snapshot = await getDocs(collection(db, 'publicProfiles'));
      setResults(snapshot.docs
        .map(item => ({ uid: item.id, ...item.data() } as Profile))
        .filter(profile => profile.uid !== uid && (profile.displayName || '').toLowerCase().includes(term.trim().toLowerCase()))
        .slice(0, 20));
    } catch (err: any) {
      setError(err?.message || 'Recherche impossible. Vérifiez les règles Firestore et les profils publiés.');
    }
  };

  const add = async (profile: Profile) => {
    if (!uid || !userProfile) { setError('Connectez-vous pour ajouter un trader.'); return; }
    setBusy(profile.uid); setError(''); setNotice('');
    try {
      const reverseId = profile.uid + '_' + uid;
      const reverseSnapshot = await getDocs(query(collection(db, 'friendRequests'), where('__name__', '==', reverseId)));
      if (!reverseSnapshot.empty && reverseSnapshot.docs[0].data().status === 'pending') {
        await updateDoc(doc(db, 'friendRequests', reverseId), { status: 'accepted', updatedAt: serverTimestamp() });
        setNotice('La demande réciproque a été acceptée. Vous êtes maintenant amis.');
      } else {
        await setDoc(doc(db, 'friendRequests', uid + '_' + profile.uid), {
          senderId: uid, receiverId: profile.uid, status: 'pending',
          senderName: userProfile.displayName || 'Trader', receiverName: profile.displayName,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        setNotice('Demande envoyée à ' + profile.displayName + '.');
      }
      setConfirmFriend(null);
    } catch (err: any) {
      setError(err?.message || 'Envoi impossible.');
    } finally { setBusy(''); }
  };

  const respond = async (request: Request, status: 'accepted' | 'rejected') => {
    setBusy(request.id); setError(''); setNotice('');
    try {
      await updateDoc(doc(db, 'friendRequests', request.id), { status, updatedAt: serverTimestamp() });
      setNotice(status === 'accepted' ? 'Demande acceptée.' : 'Demande refusée.');
    } catch (err: any) {
      setError(err?.message || 'Action impossible.');
    } finally { setBusy(''); }
  };

  const chat = async (request: Request) => {
    const otherUid = request.senderId === uid ? request.receiverId : request.senderId;
    const members = [uid, otherUid].sort();
    const conversationId = 'dm_' + members.join('_');
    setBusy(request.id); setError(''); setNotice('');
    try {
      await setDoc(doc(db, 'conversations', conversationId), {
        members, group: false, createdBy: uid,
        memberNames: {
          [uid]: userProfile?.displayName || 'Trader',
          [otherUid]: request.senderId === uid ? request.receiverName || 'Trader' : request.senderName || 'Trader'
        },
        lastMessage: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge: true });
      setNotice('Conversation prête. Ouvrez PipTalk pour discuter.');
    } catch (err: any) {
      setError(err?.message || 'Création du chat impossible.');
    } finally { setBusy(''); }
  };

  const profileName = (request: Request) => request.senderId === uid
    ? request.receiverName || 'Trader'
    : request.senderName || 'Trader';
  const isFriend = (profileUid: string) => acceptedRequests.some(request => (request.senderId === uid ? request.receiverId : request.senderId) === profileUid);
  const hasPending = (profileUid: string) => sentPending.some(request => request.receiverId === profileUid) || received.some(request => request.senderId === profileUid);
  const getRequestForFriend = (profileUid: string) => acceptedRequests.find(request => (request.senderId === uid ? request.receiverId : request.senderId) === profileUid);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'discover', label: 'Découvrir', icon: <Compass className="h-4 w-4" /> },
    { id: 'requests', label: 'Demandes', icon: <Clock3 className="h-4 w-4" />, count: received.length },
    { id: 'friends', label: 'Mes amis', icon: <Users className="h-4 w-4" />, count: acceptedRequests.length }
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-1 pb-8 sm:px-4">
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/70 p-5 shadow-sm sm:p-7">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><Users className="h-5 w-5" /></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Communauté IAMTRADER</p><h1 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Traders & amis</h1><p className="mt-1 text-xs text-slate-500">Développez votre réseau et échangez avec d’autres traders.</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
            <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-sm"><p className="text-[10px] font-semibold text-slate-500">Amis</p><p className="mt-1 text-xl font-extrabold text-slate-900">{acceptedRequests.length}</p></div>
            <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-sm"><p className="text-[10px] font-semibold text-slate-500">En attente</p><p className="mt-1 text-xl font-extrabold text-slate-900">{received.length + sentPending.length}</p></div>
          </div>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/85 p-1.5 shadow-sm" aria-label="Sections traders et amis">
        {tabs.map(item => <button key={item.id} type="button" onClick={() => { setTab(item.id); setError(''); setNotice(''); }} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:px-5 ${tab === item.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          {item.icon}<span>{item.label}</span>{typeof item.count === 'number' && <span className={`rounded-full px-2 py-0.5 text-[10px] ${tab === item.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span>}
        </button>)}
      </nav>

      {(error || notice) && <div className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span className="flex-1">{error || notice}</span><button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Fermer" className="font-bold">×</button></div>}

      {tab === 'discover' && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Search className="h-4 w-4" /></div><div><h2 className="text-sm font-extrabold text-slate-900">Trouver des traders</h2><p className="mt-1 text-xs leading-5 text-slate-500">Recherchez un pseudo pour découvrir un profil et envoyer une demande.</p></div></div>
        <form onSubmit={event => { event.preventDefault(); void search(); }} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Rechercher par pseudo…" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50" /></div>
          <button type="submit" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white shadow-md shadow-emerald-600/15 transition hover:bg-emerald-700"><Search className="h-4 w-4" />Rechercher</button>
        </form>
        {results.length > 0 ? <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {results.map(profile => <div key={profile.uid} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30">
            <img src={profile.avatarURL || profile.photoURL || '/brand/logo-iamtrader-symbol.png'} alt="" className="h-11 w-11 shrink-0 rounded-full border border-slate-100 bg-slate-50 object-cover" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{profile.displayName}</p><p className="mt-0.5 text-[10px] text-slate-400">Trader IAMTRADER</p></div>
            {isFriend(profile.uid) ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Ami</span> : hasPending(profile.uid) ? <span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-500">En attente</span> : <button type="button" onClick={() => setConfirmFriend(profile)} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-50"><UserPlus className="h-3.5 w-3.5" />Ajouter</button>}
          </div>)}
        </div> : term.trim().length >= 2 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center"><UserRound className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">Aucun trader trouvé</p><p className="mt-1 text-xs text-slate-400">Essayez un autre pseudo.</p></div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/60 px-5 py-9 text-center"><Compass className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-700">Votre prochain contact est peut-être ici</p><p className="mt-1 text-xs text-slate-400">Entrez au moins deux caractères pour lancer une recherche.</p></div>}
      </section>}

      {tab === 'requests' && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Clock3 className="h-4 w-4" /></div><div><h2 className="text-sm font-extrabold text-slate-900">Demandes d’amitié</h2><p className="mt-1 text-xs text-slate-500">Acceptez les traders que vous souhaitez ajouter à votre réseau.</p></div></div>
        <div className="space-y-2">{received.map(request => <div key={request.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 sm:p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{(request.senderName || 'T').slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{request.senderName || 'Trader'}</p><p className="mt-0.5 text-[10px] text-slate-400">Souhaite rejoindre votre réseau</p></div><button type="button" onClick={() => void respond(request, 'accepted')} disabled={!!busy} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-[10px] font-bold text-white disabled:opacity-50">{busy === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Accepter</button><button type="button" onClick={() => void respond(request, 'rejected')} disabled={!!busy} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" aria-label="Refuser"><X className="h-4 w-4" /></button></div>)}
          {received.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">Tout est à jour</p><p className="mt-1 text-xs text-slate-400">Aucune demande reçue pour le moment.</p></div>}
        </div>
        {sentPending.length > 0 && <div className="mt-6 border-t border-slate-100 pt-5"><h3 className="mb-3 text-xs font-bold text-slate-600">Demandes envoyées ({sentPending.length})</h3><div className="space-y-2">{sentPending.map(request => <div key={request.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-700">{request.receiverName || 'Trader'}</p><p className="text-[10px] text-slate-400">En attente de réponse</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">En attente</span></div>)}</div></div>}
      </section>}

      {tab === 'friends' && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Users className="h-4 w-4" /></div><div><h2 className="text-sm font-extrabold text-slate-900">Votre réseau</h2><p className="mt-1 text-xs text-slate-500">Retrouvez vos amis et démarrez une conversation privée.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2">{acceptedRequests.map(request => { const otherUid = request.senderId === uid ? request.receiverId : request.senderId; return <div key={otherUid} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 p-4 transition hover:border-emerald-200 hover:shadow-sm"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-sm font-extrabold text-emerald-800">{profileName(request).slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{profileName(request)}</p><p className="mt-0.5 text-[10px] text-slate-400">Ami dans votre réseau</p></div><button type="button" onClick={() => void chat(request)} disabled={!!busy} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-[10px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{busy === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}Discuter</button></div>; })}
          {acceptedRequests.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-200 px-5 py-12 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">Votre réseau commence ici</p><p className="mt-1 text-xs text-slate-400">Découvrez des traders et envoyez votre première demande.</p><button type="button" onClick={() => setTab('discover')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white">Découvrir des traders <ChevronRight className="h-4 w-4" /></button></div>}
        </div>
      </section>}

      {confirmFriend && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="friend-modal-title" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmFriend(null); }}>
        <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
          <div className="relative bg-gradient-to-br from-emerald-600 to-teal-700 px-6 pb-8 pt-6 text-white"><button type="button" onClick={() => setConfirmFriend(null)} aria-label="Fermer" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 transition hover:bg-white/25"><X className="h-4 w-4" /></button><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><UserPlus className="h-6 w-6" /></div><p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">Connexion traders</p><h2 id="friend-modal-title" className="mt-1 text-xl font-extrabold">Ajouter un ami</h2><p className="mt-1 text-xs text-emerald-50">Envoyez une demande pour connecter vos réseaux.</p></div>
          <div className="-mt-4 rounded-t-3xl bg-white px-6 pb-6 pt-5"><div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"><img src={confirmFriend.avatarURL || confirmFriend.photoURL || '/brand/logo-iamtrader-symbol.png'} alt="" className="h-12 w-12 rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{confirmFriend.displayName}</p><p className="mt-0.5 text-[10px] text-slate-500">Trader IAMTRADER</p></div></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => setConfirmFriend(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Annuler</button><button type="button" onClick={() => void add(confirmFriend)} disabled={!!busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{busy === confirmFriend.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer la demande</button></div></div>
        </div>
      </div>}
    </div>
  );
}
