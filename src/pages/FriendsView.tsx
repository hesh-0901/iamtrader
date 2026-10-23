import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, Check, X, MessageCircle, Users, Compass, Clock3, ChevronRight, Send, Loader2, UserRound, CheckCircle2 } from 'lucide-react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile } from '../types';

type Profile = { uid: string; displayName: string; avatarURL?: string; photoURL?: string };
type Request = { id: string; senderId: string; receiverId: string; status: string; senderName?: string; receiverName?: string };

type Tab = 'discover' | 'requests' | 'friends';

export function FriendsView({ userProfile, onOpenChat }: { userProfile: UserProfile | null; onOpenChat?: (conversationId: string) => void }) {
  const uid = auth.currentUser?.uid || userProfile?.uid || '';
  const [tab, setTab] = useState<Tab>('discover');
  const [term, setTerm] = useState('');
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [results, setResults] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Request[]>([]);
  const [friends, setFriends] = useState<Request[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmFriend, setConfirmFriend] = useState<Profile | null>(null);

  useEffect(() => {
    console.info('[FriendsView] Initialisation des abonnements Firestore', { uid: uid || null, authenticated: !!auth.currentUser });
    if (!uid) {
      setError('Aucun utilisateur connecté : UID absent.');
      return;
    }

    const a = onSnapshot(
      query(collection(db, 'friendRequests'), where('receiverId', '==', uid)),
      snapshot => {
        console.debug('[FriendsView] Demandes reçues chargées', { uid, count: snapshot.size });
        setIncoming(snapshot.docs.map(item => ({
          id: item.id,
          ...item.data()
        } as Request)));
      },
      err => {
        console.error('[FriendsView] Lecture demandes reçues refusée', {
          code: err.code,
          message: err.message,
          uid
        });
        setError(`Demandes reçues : ${err.code} — ${err.message}`);
      }
    );

    const b = onSnapshot(
      query(collection(db, 'friendRequests'), where('senderId', '==', uid)),
      snapshot => {
        console.debug('[FriendsView] Demandes envoyées chargées', { uid, count: snapshot.size });
        setOutgoing(snapshot.docs.map(item => ({
          id: item.id,
          ...item.data()
        } as Request)));
      },
      err => {
        console.error('[FriendsView] Lecture demandes envoyées refusée', {
          code: err.code,
          message: err.message,
          uid
        });
        setError(`Demandes envoyées : ${err.code} — ${err.message}`);
      }
    );

    return () => {
      console.debug('[FriendsView] Arrêt des abonnements Firestore', { uid });
      a();
      b();
    };
  }, [uid]);

  // Load the platform's published trader directory independently of the search dialog.
  // This lists registered profiles, not only users currently online.
  useEffect(() => {
    if (!uid) return;
    let active = true;
    console.info('[FriendsView] Chargement de l’annuaire des traders démarré', { uid });
    const unsubscribe = onSnapshot(collection(db, 'publicProfiles'), snapshot => {
      if (!active) return;
      const profiles = snapshot.docs
        .map(item => {
          const data = item.data() as Record<string, unknown>;
          const displayName = [data.displayName, data.username, data.name, data.email]
            .find(value => typeof value === 'string' && value.trim().length > 0);
          const resolvedName = typeof displayName === 'string'
            ? (displayName.includes('@') ? displayName.split('@')[0] : displayName).trim()
            : '';
          return {
            uid: item.id,
            displayName: resolvedName || `Trader ${item.id.slice(0, 7)}`,
            avatarURL: typeof data.avatarURL === 'string' ? data.avatarURL : typeof data.photoURL === 'string' ? data.photoURL : typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
            photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined
          } as Profile;
        })
        .filter(profile => profile.uid !== uid)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      setAllProfiles(profiles);
      console.info('[FriendsView] Annuaire des traders chargé en temps réel', { uid, count: profiles.length });
    }, (err: any) => {
      if (!active) return;
      console.error('[FriendsView] Échec du chargement de l’annuaire', { uid, code: err?.code || null, message: err?.message || String(err), error: err });
      setError(err?.code === 'permission-denied'
        ? 'Accès refusé par Firestore : vérifiez la règle de lecture de publicProfiles.'
        : 'Impossible de charger les traders. Réessayez.');
    });
    return () => { active = false; unsubscribe(); };
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
    const normalizedTerm = term.trim().toLocaleLowerCase();
    if (normalizedTerm.length < 2) {
      setError('Saisissez au moins 2 caractères du pseudo.');
      setHasSearched(false);
      return;
    }
    setError('');
    setNotice('');
    setSearching(true);
    setHasSearched(true);
    console.info('[FriendsView] Recherche de traders démarrée', { uid: uid || null, termLength: normalizedTerm.length });
    try {
      setResults(allProfiles
        .filter(profile => profile.displayName.toLocaleLowerCase().includes(normalizedTerm))
        .slice(0, 100));
    } catch (err: any) {
      console.error('[FriendsView] Échec de la recherche de traders', { uid: uid || null, code: err?.code || null, message: err?.message || String(err), error: err });
      setResults([]);
      setError(err?.code === 'permission-denied'
        ? 'Accès refusé par Firestore. Vérifiez la règle de lecture de publicProfiles.'
        : err?.message || 'Recherche impossible. Vérifiez votre connexion et les profils publiés.');
    } finally {
      setSearching(false);
    }
  };

  const add = async (profile: Profile) => {
    if (!uid || !userProfile) { setError('Connectez-vous pour ajouter un trader.'); return; }
    setBusy(profile.uid); setError(''); setNotice('');
    console.info('[FriendsView] Envoi/traitement de demande démarré', { uid: uid || null, targetUid: profile.uid });
    let stage = 'lecture_demande_reciproque';
    try {
      // Constrain the query by the participant fields so Firestore rules can prove
      // that the signed-in user is allowed to read the matching request.
      const reverseSnapshot = await getDocs(query(
        collection(db, 'friendRequests'),
        where('senderId', '==', profile.uid),
        where('receiverId', '==', uid)
      ));
      console.debug('[FriendsView] Vérification de la demande réciproque terminée', { uid, targetUid: profile.uid, count: reverseSnapshot.size });
      const reverseRequest = reverseSnapshot.docs.find(item => item.id === profile.uid + '_' + uid);
      if (reverseRequest && reverseRequest.data().status === 'pending') {
        stage = 'acceptation_demande_reciproque';
        await updateDoc(doc(db, 'friendRequests', reverseRequest.id), { status: 'accepted', updatedAt: serverTimestamp() });
        console.info('[FriendsView] Demande réciproque acceptée', { uid, targetUid: profile.uid, requestId: reverseRequest.id });
        setNotice('La demande réciproque a été acceptée. Vous êtes maintenant amis.');
      } else {
        stage = 'creation_demande';
        await setDoc(doc(db, 'friendRequests', uid + '_' + profile.uid), {
          senderId: uid, receiverId: profile.uid, status: 'pending',
          senderName: userProfile.displayName || 'Trader', receiverName: profile.displayName,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        console.info('[FriendsView] Demande envoyée avec succès', { uid, targetUid: profile.uid, requestId: uid + '_' + profile.uid });
        setNotice('Demande envoyée à ' + profile.displayName + '.');
      }
      setConfirmFriend(null);
    } catch (err: any) {
      console.error('[FriendsView] Échec de l’envoi/traitement de demande', { stage, uid: uid || null, targetUid: profile.uid, code: err?.code || null, message: err?.message || String(err), error: err });
      setError(err?.message || 'Envoi impossible.');
    } finally { setBusy(''); }
  };

  const respond = async (request: Request, status: 'accepted' | 'rejected') => {
    setBusy(request.id); setError(''); setNotice('');
    console.info('[FriendsView] Réponse à une demande démarrée', { uid: uid || null, requestId: request.id, status });
    try {
      await updateDoc(doc(db, 'friendRequests', request.id), { status, updatedAt: serverTimestamp() });
      setNotice(status === 'accepted' ? 'Demande acceptée.' : 'Demande refusée.');
    } catch (err: any) {
      console.error('[FriendsView] Échec de la réponse à une demande', { uid: uid || null, requestId: request.id, status, code: err?.code || null, message: err?.message || String(err), error: err });
      setError(err?.message || 'Action impossible.');
    } finally { setBusy(''); }
  };

  const chat = async (request: Request) => {
    const otherUid = request.senderId === uid ? request.receiverId : request.senderId;
    if (!uid || !otherUid) { setError('Impossible d’identifier les participants.'); return; }
    const members = [uid, otherUid].sort();
    const conversationId = 'dm_' + members.join('_');
    setBusy(request.id); setError(''); setNotice('');
    console.info('[FriendsView] Ouverture de conversation démarrée', { uid, otherUid });
    try {
      // Query conversations the current user is allowed to read. Avoid getDoc on
      // a missing DM document, which can be rejected by membership-based rules.
      const snapshot = await getDocs(query(
        collection(db, 'conversations'),
        where('members', 'array-contains', uid)
      ));
      const existing = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() } as { id: string; members: string[]; group?: boolean; memberNames?: Record<string, string> }))
        .find(item => item.id !== 'community-hub'
          && item.group !== true
          && item.members?.length === 2
          && item.members.includes(uid)
          && item.members.includes(otherUid));
      const memberNames = {
        ...(existing?.memberNames || {}),
        [uid]: userProfile?.displayName || auth.currentUser?.displayName || 'Trader',
        [otherUid]: request.senderId === uid
          ? request.receiverName || 'Trader'
          : request.senderName || 'Trader'
      };
      let targetConversationId = existing?.id || conversationId;
      if (existing) {
        await updateDoc(doc(db, 'conversations', existing.id), {
          memberNames,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, 'conversations', conversationId), {
          members, group: false, createdBy: uid, memberNames,
          lastMessage: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      }
      setNotice('Conversation ouverte dans PipTalk.');
      onOpenChat?.(targetConversationId);
    } catch (err: any) {
      console.error('[FriendsView] Échec de l’ouverture de conversation', {
        uid, otherUid, code: err?.code || null, message: err?.message || String(err), error: err
      });
      setError(err?.code === 'permission-denied'
        ? 'Accès refusé par Firestore. Vérifiez les règles des conversations.'
        : err?.message || 'Ouverture du chat impossible.');
    } finally { setBusy(''); }
  };

  const profileName = (request: Request) => request.senderId === uid
    ? request.receiverName || 'Trader'
    : request.senderName || 'Trader';
  const isFriend = (profileUid: string) => acceptedRequests.some(request => (request.senderId === uid ? request.receiverId : request.senderId) === profileUid);
  const hasPending = (profileUid: string) => sentPending.some(request => request.receiverId === profileUid) || received.some(request => request.senderId === profileUid);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'discover', label: 'Découvrir', icon: <Compass className="h-4 w-4" /> },
    { id: 'requests', label: 'Demandes', icon: <Clock3 className="h-4 w-4" />, count: received.length },
    { id: 'friends', label: 'Mes amis', icon: <Users className="h-4 w-4" />, count: acceptedRequests.length }
  ];

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col px-0 pb-[env(safe-area-inset-bottom)] pt-0 sm:mx-auto sm:min-h-[calc(100dvh-7rem)] sm:max-w-5xl sm:px-4 sm:pb-8 sm:pt-2">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:mb-3 sm:rounded-xl sm:border">
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Communauté</p><p className="truncate text-sm font-extrabold text-slate-900 sm:text-base">Votre réseau de traders</p></div>
        <button type="button" onClick={() => { setSearchOpen(true); setError(''); setNotice(''); }} aria-label="Rechercher un trader" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"><Search className="h-4 w-4" /></button>
      </div>
      <nav className="z-20 mb-2 grid shrink-0 grid-cols-3 gap-1 border-b border-slate-200 bg-white px-1 py-1 sm:sticky sm:top-0 sm:mb-3 sm:rounded-2xl sm:border sm:p-1.5 sm:shadow-sm" aria-label="Sections traders et amis">
        {tabs.map(item => <button key={item.id} type="button" onClick={() => { setTab(item.id); setError(''); setNotice(''); }} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-bold transition-all sm:gap-2 sm:text-xs ${tab === item.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>{item.icon}<span className="truncate">{item.label}</span>{typeof item.count === 'number' && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${tab === item.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span>}</button>)}
      </nav>
      {(error || notice) && <div className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span className="flex-1 break-words">{error || notice}</span><button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Fermer" className="font-bold">×</button></div>}
      {tab === 'discover' && <section className="min-h-[55vh] flex-1 overflow-y-auto bg-white sm:flex-none sm:rounded-2xl sm:border sm:border-slate-200/80 sm:shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Compass className="h-4 w-4" /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold text-slate-900">Découvrir</h2><p className="mt-0.5 text-[11px] text-slate-500">Rencontrez d’autres traders.</p></div><button type="button" onClick={() => setSearchOpen(true)} aria-label="Rechercher" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><Search className="h-4 w-4" /></button></div>
        {allProfiles.length ? <div className="divide-y divide-slate-100">{allProfiles.map(profile => <div key={profile.uid} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4"><img src={profile.avatarURL || profile.photoURL || '/brand/logo-iamtrader-symbol.png'} alt="" className="h-10 w-10 shrink-0 rounded-full border border-slate-100 object-cover" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/brand/logo-iamtrader-symbol.png'; }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{profile.displayName}</p><p className="mt-0.5 text-[10px] text-slate-400">Trader IAMTRADER</p></div>{isFriend(profile.uid) ? <span className="rounded-full bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-700">Ami</span> : hasPending(profile.uid) ? <span className="rounded-full bg-slate-100 px-2.5 py-2 text-[10px] text-slate-500">En attente</span> : <button type="button" onClick={() => setConfirmFriend(profile)} className="flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 px-3 py-2.5 text-[10px] font-bold text-emerald-700"><UserPlus className="h-3.5 w-3.5" />Ajouter</button>}</div>)}</div> : <button type="button" onClick={() => setSearchOpen(true)} className="flex min-h-40 w-full flex-col items-center justify-center px-5 py-8 text-center"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Search className="h-5 w-5" /></div><p className="mt-3 text-sm font-bold text-slate-800">Découvrir les traders</p><p className="mt-1 text-xs text-slate-500">Les profils publiés sur IAMTRADER apparaîtront ici.</p></button>}
      </section>}
      {tab === 'requests' && <section className="min-h-[55vh] flex-1 overflow-y-auto bg-white sm:flex-none sm:rounded-2xl sm:border sm:border-slate-200/80 sm:shadow-sm"><div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-extrabold text-slate-900">Demandes reçues</h2><p className="mt-0.5 text-[11px] text-slate-500">{received.length} en attente</p></div><div className="divide-y divide-slate-100">{received.map(request => <div key={request.id} className="flex items-center gap-3 px-3 py-3.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{(request.senderName || 'T').slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{request.senderName || 'Trader'}</p><p className="mt-0.5 text-[10px] text-slate-400">Demande d’amitié</p></div><button type="button" onClick={() => void respond(request,'accepted')} disabled={!!busy} className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-[10px] font-bold text-white">{busy===request.id?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Check className="h-3.5 w-3.5"/>}Accepter</button><button type="button" onClick={() => void respond(request,'rejected')} disabled={!!busy} aria-label="Refuser" className="rounded-xl border border-slate-200 p-2.5 text-slate-500"><X className="h-4 w-4"/></button></div>)}{!received.length && <div className="px-5 py-12 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-slate-300"/><p className="mt-2 text-sm font-bold text-slate-700">Aucune demande en attente</p><p className="mt-1 text-xs text-slate-400">Les nouvelles demandes apparaîtront ici.</p></div>}</div>{sentPending.length>0 && <div className="border-t border-slate-100 px-4 py-3"><p className="mb-2 text-[11px] font-bold text-slate-500">Demandes envoyées ({sentPending.length})</p>{sentPending.map(request=><div key={request.id} className="flex justify-between gap-3 py-2"><span className="truncate text-xs font-semibold text-slate-700">{request.receiverName||'Trader'}</span><span className="text-[10px] text-amber-700">En attente</span></div>)}</div>}</section>}
      {tab === 'friends' && <section className="min-h-[55vh] flex-1 overflow-y-auto bg-white sm:flex-none sm:rounded-2xl sm:border sm:border-slate-200/80 sm:shadow-sm"><div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-extrabold text-slate-900">Mes amis</h2><p className="mt-0.5 text-[11px] text-slate-500">{acceptedRequests.length} dans votre réseau</p></div><div className="divide-y divide-slate-100">{acceptedRequests.map(request=>{const otherUid=request.senderId===uid?request.receiverId:request.senderId;return <div key={otherUid} className="flex items-center gap-3 px-3 py-3.5"><img src={allProfiles.find(profile => profile.uid === otherUid)?.avatarURL || allProfiles.find(profile => profile.uid === otherUid)?.photoURL || '/brand/logo-iamtrader-symbol.png'} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/brand/logo-iamtrader-symbol.png'; }} className="h-10 w-10 shrink-0 rounded-full border border-slate-100 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{profileName(request)}</p><p className="mt-0.5 text-[10px] text-slate-400">Dans votre réseau</p></div><button type="button" onClick={()=>void chat(request)} disabled={!!busy} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-[10px] font-bold text-white">{busy===request.id?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<MessageCircle className="h-3.5 w-3.5"/>}Discuter</button></div>})}{!acceptedRequests.length&&<div className="px-5 py-12 text-center"><Users className="mx-auto h-7 w-7 text-slate-300"/><p className="mt-2 text-sm font-bold text-slate-700">Votre réseau est vide</p><p className="mt-1 text-xs text-slate-400">Découvrez un trader pour commencer.</p><button type="button" onClick={()=>setTab('discover')} className="mt-3 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white">Découvrir <ChevronRight className="inline h-4 w-4"/></button></div>}</div></section>}
      {searchOpen && <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="trader-search-title" onMouseDown={event=>{if(event.target===event.currentTarget)setSearchOpen(false)}}>
        <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-h-[min(80dvh,680px)] sm:max-w-lg sm:rounded-3xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3.5"><div><h2 id="trader-search-title" className="text-base font-extrabold text-slate-900">Rechercher un trader</h2><p className="mt-0.5 text-xs text-slate-500">Entrez au moins deux caractères.</p></div><button type="button" onClick={()=>setSearchOpen(false)} aria-label="Fermer la recherche" className="rounded-full bg-slate-100 p-2.5"><X className="h-4 w-4"/></button></div>
          <form onSubmit={event=>{event.preventDefault();void search()}} className="flex shrink-0 gap-2 p-3 sm:p-4"><input autoFocus value={term} onChange={event=>{setTerm(event.target.value);setError('');setHasSearched(false)}} placeholder="Pseudo du trader…" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base outline-none focus:border-emerald-400 focus:bg-white" style={{fontSize: '16px', transform: 'none', zoom: 1}}/><button type="submit" disabled={term.trim().length<2||searching} className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-40">{searching?<Loader2 className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>}{searching?'Recherche…':'Chercher'}</button></form>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" style={{WebkitOverflowScrolling:'touch'}}>
            {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}
            {!searching && hasSearched && !error && results.length===0 && <div className="px-3 py-10 text-center"><UserRound className="mx-auto h-7 w-7 text-slate-300"/><p className="mt-2 text-sm font-bold text-slate-700">Aucun trader trouvé</p><p className="mt-1 text-xs text-slate-500">Vérifiez le pseudo ou réessayez avec moins de caractères.</p></div>}
            {!hasSearched && results.length===0 && <div className="px-3 py-8 text-center"><Search className="mx-auto h-6 w-6 text-slate-300"/><p className="mt-2 text-xs text-slate-500">Les résultats apparaîtront ici.</p></div>}
            {results.map(profile=><div key={profile.uid} className="flex items-center gap-3 border-b border-slate-100 py-3"><img src={profile.avatarURL||profile.photoURL||'/brand/logo-iamtrader-symbol.png'} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{profile.displayName}</p><p className="text-[10px] text-slate-400">Trader IAMTRADER</p></div>{isFriend(profile.uid)?<span className="text-xs font-bold text-emerald-700">Ami</span>:hasPending(profile.uid)?<span className="text-[10px] text-slate-500">En attente</span>:<button type="button" onClick={()=>{setSearchOpen(false);setConfirmFriend(profile)}} className="rounded-xl border border-emerald-200 px-3 py-2.5 text-xs font-bold text-emerald-700">Ajouter</button>}</div>)}
          </div>
        </div>
      </div>}
      {confirmFriend && <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="friend-modal-title" onMouseDown={event=>{if(event.target===event.currentTarget)setConfirmFriend(null)}}><div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"><div className="relative bg-gradient-to-br from-emerald-600 to-teal-700 px-5 pb-6 pt-5 text-white"><button type="button" onClick={()=>setConfirmFriend(null)} aria-label="Fermer" className="absolute right-4 top-4 rounded-full bg-white/15 p-2"><X className="h-4 w-4"/></button><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><UserPlus className="h-5 w-5"/></div><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-100">Connexion traders</p><h2 id="friend-modal-title" className="mt-1 text-lg font-extrabold">Ajouter un ami</h2></div><div className="px-5 pb-5 pt-4"><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><img src={confirmFriend.avatarURL||confirmFriend.photoURL||'/brand/logo-iamtrader-symbol.png'} alt="" className="h-11 w-11 rounded-full object-cover"/><div className="min-w-0"><p className="truncate text-sm font-bold">{confirmFriend.displayName}</p><p className="mt-0.5 text-[10px] text-slate-500">Trader IAMTRADER</p></div></div><div className="mt-4 flex gap-2"><button type="button" onClick={()=>setConfirmFriend(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600">Annuler</button><button type="button" onClick={()=>void add(confirmFriend)} disabled={!!busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white">{busy===confirmFriend.uid?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}Envoyer</button></div></div></div></div>}
    </div>
  );
}
