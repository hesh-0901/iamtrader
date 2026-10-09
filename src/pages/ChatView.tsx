import React, { useRef, useState } from 'react';
import {
  Search, MoreVertical, Phone, Video, Paperclip, Image as ImageIcon,
  Mic, Send, Smile, Pin, Pencil, Trash2, X, Check, CheckCheck,
  MessageCircle, Plus, FileText, Play, Pause, Headphones, ArrowLeft,
  CircleDot, Users, Bell, ChevronDown
} from 'lucide-react';

type ChatMessage = {
  id: string; text?: string; time: string; mine: boolean; edited?: boolean;
  pinned?: boolean; imageUrl?: string; imageName?: string; voice?: boolean;
};

type Conversation = {
  id: string; name: string; initials: string; status: string; online: boolean;
  color: string; preview: string; time: string; unread?: number; group?: boolean;
};

const conversations: Conversation[] = [
  { id: 'market', name: 'Trading Floor', initials: 'TF', status: 'Groupe · 28 membres', online: true, color: 'bg-emerald-100 text-emerald-700', preview: 'Le NAS100 approche de la zone…', time: '09:42', unread: 3, group: true },
  { id: 'alex', name: 'Alex Mbuyi', initials: 'AM', status: 'En ligne', online: true, color: 'bg-sky-100 text-sky-700', preview: 'Bien vu pour le setup !', time: '09:35', unread: 1 },
  { id: 'mentor', name: 'Coach Trading', initials: 'CT', status: 'Vu récemment', online: false, color: 'bg-violet-100 text-violet-700', preview: 'Reste discipliné sur le risque.', time: 'Hier' },
  { id: 'gold', name: 'XAUUSD — Analyse', initials: 'AU', status: 'Groupe · 12 membres', online: false, color: 'bg-amber-100 text-amber-700', preview: 'Sarah : attention à la news US', time: 'Hier', group: true },
  { id: 'sarah', name: 'Sarah K.', initials: 'SK', status: 'Hors ligne', online: false, color: 'bg-pink-100 text-pink-700', preview: 'Merci pour le partage', time: 'Mar.' },
];

const initialMessages: Record<string, ChatMessage[]> = {
  market: [
    { id: 'm1', text: 'Bonjour l’équipe ! Quels actifs surveillez-vous ce matin ?', time: '09:31', mine: false },
    { id: 'm2', text: 'Je surveille XAUUSD. J’attends une prise de liquidité avant de chercher une entrée.', time: '09:34', mine: true },
    { id: 'm3', text: 'Même plan sur NAS100. Pas de setup clair, pas de trade.', time: '09:38', mine: false },
    { id: 'm4', text: 'Exactement. La patience fait partie de la stratégie.', time: '09:42', mine: false, pinned: true },
  ],
  alex: [
    { id: 'a1', text: 'Tu as vu le mouvement sur le gold ce matin ?', time: '09:20', mine: false },
    { id: 'a2', text: 'Oui, mais je n’ai pas pris l’entrée. Le MSS n’était pas assez propre.', time: '09:27', mine: true },
    { id: 'a3', text: 'Bien vu pour le setup !', time: '09:35', mine: false },
  ],
  mentor: [{ id: 'c1', text: 'Reste discipliné sur le risque. Une bonne analyse ne justifie jamais de dépasser ton plan.', time: 'Hier 17:12', mine: false }],
  gold: [{ id: 'g1', text: 'Partagez vos scénarios sur XAUUSD, mais précisez toujours votre invalidation.', time: 'Hier 14:05', mine: false }],
  sarah: [{ id: 's1', text: 'Merci pour le partage, l’explication du FVG était claire.', time: 'Mar. 11:40', mine: false }],
};

export function ChatView() {
  const [activeId, setActiveId] = useState('market');
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = conversations.find(c => c.id === activeId) || conversations[0];
  const currentMessages = messages[activeId] || [];

  const updateMessages = (next: ChatMessage[]) => setMessages(prev => ({ ...prev, [activeId]: next }));
  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    if (editingId) {
      updateMessages(currentMessages.map(m => m.id === editingId ? { ...m, text, edited: true } : m));
      setEditingId(null);
    } else {
      updateMessages([...currentMessages, { id: crypto.randomUUID(), text, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), mine: true }]);
    }
    setDraft('');
  };
  const attachImage = (file?: File) => {
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    updateMessages([...currentMessages, { id: crypto.randomUUID(), imageUrl, imageName: file.name, text: draft.trim() || undefined, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), mine: true }]);
    setDraft('');
    setShowAttach(false);
  };
  const togglePin = (id: string) => {
    updateMessages(currentMessages.map(m => m.id === id ? { ...m, pinned: !m.pinned } : m));
    setMenuMessage(null);
  };
  const deleteMessage = (id: string) => {
    updateMessages(currentMessages.filter(m => m.id !== id));
    setMenuMessage(null);
  };
  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id); setDraft(m.text || ''); setMenuMessage(null);
  };
  const startVoice = () => {
    setRecording(v => !v);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex h-[min(720px,calc(100vh-190px))] min-h-[520px]">
        <aside className={`${mobileChatOpen ? 'hidden md:flex' : 'flex'} w-full md:w-[310px] lg:w-[340px] shrink-0 flex-col border-r border-slate-200 bg-white`}>
          <div className="border-b border-slate-100 px-4 pb-4 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f8f2] text-[#00a982]"><MessageCircle className="h-5 w-5" /></div>
                  <div><h2 className="text-base font-black tracking-tight text-[#0b1f35]">PipTalk</h2><p className="text-[10px] font-medium text-slate-400">La communauté des traders</p></div>
                </div>
              </div>
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Nouvelle conversation"><Plus className="h-4 w-4" /></button>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une discussion" className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
            </label>
            <div className="mt-3 flex gap-2">
              <button className="rounded-full bg-[#e7f8f2] px-3 py-1.5 text-[10px] font-bold text-[#008b6d]">Tous</button>
              <button className="rounded-full px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">Non lus</button>
              <button className="rounded-full px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">Groupes</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).map(c => (
              <button key={c.id} onClick={() => { setActiveId(c.id); setMobileChatOpen(true); setEditingId(null); setDraft(''); }} className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 ${activeId === c.id ? 'bg-[#f0fbf7]' : ''}`}>
                <div className="relative shrink-0">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-black ${c.color}`}>{c.initials}</div>
                  {c.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-slate-800">{c.name}</span><span className="shrink-0 text-[9px] text-slate-400">{c.time}</span></div>
                  <div className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-[10px] text-slate-500">{c.preview}</span>{c.unread && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00a982] px-1 text-[9px] font-bold text-white">{c.unread}</span>}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b1f35] text-[10px] font-black text-white">IT</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-slate-800">Mon espace trader</p><p className="text-[9px] text-slate-400">Messagerie communautaire</p></div>
            <MoreVertical className="h-4 w-4 text-slate-400" />
          </div>
        </aside>

        <section className={`${mobileChatOpen ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-[#f7faf9]`}>
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
            <button onClick={() => setMobileChatOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Retour aux discussions"><ArrowLeft className="h-4 w-4" /></button>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black ${active.color}`}>{active.initials}</div>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-extrabold text-[#0b1f35]">{active.name}</h3>{active.group && <Users className="h-3.5 w-3.5 text-slate-400" />}</div><p className="mt-0.5 text-[10px] text-slate-500">{active.status}</p></div>
            <button className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:block" title="Appel vocal"><Phone className="h-4 w-4" /></button>
            <button className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:block" title="Appel vidéo"><Video className="h-4 w-4" /></button>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Options de conversation"><Search className="h-4 w-4" /></button>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Plus d’options"><MoreVertical className="h-4 w-4" /></button>
          </header>
          {currentMessages.some(m => m.pinned) && <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-2.5"><Pin className="h-3.5 w-3.5 shrink-0 text-emerald-700" /><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Message épinglé</p><p className="truncate text-[11px] text-slate-600">{currentMessages.find(m => m.pinned)?.text || 'Pièce jointe'}</p></div><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></div>}
          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-6">
            <div className="flex justify-center"><span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[9px] font-semibold text-slate-400 shadow-sm">Aujourd’hui</span></div>
            {currentMessages.map(m => (
              <div key={m.id} className={`group relative flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[75%] ${m.mine ? 'rounded-br-md bg-[#dff8ed] text-slate-800' : 'rounded-bl-md border border-slate-100 bg-white text-slate-700'}`}>
                  {m.pinned && <div className="mb-1 flex items-center gap-1 text-[9px] font-bold text-emerald-700"><Pin className="h-3 w-3" /> Épinglé</div>}
                  {m.imageUrl && <img src={m.imageUrl} alt={m.imageName || 'Image partagée'} className="mb-2 max-h-64 rounded-lg object-cover" />}
                  {m.voice && <div className="flex min-w-48 items-center gap-2 py-1"><button className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white"><Play className="h-3.5 w-3.5" /></button><div className="flex-1"><div className="h-1 rounded-full bg-emerald-200"><div className="h-1 w-1/3 rounded-full bg-emerald-600" /></div><p className="mt-1 text-[9px] text-slate-500">Message vocal · 0:08</p></div><Headphones className="h-4 w-4 text-emerald-600" /></div>}
                  {m.text && <p className="whitespace-pre-wrap break-words text-[12px] leading-5">{m.text}</p>}
                  <div className="mt-1.5 flex items-center justify-end gap-1.5"><span className="text-[9px] text-slate-400">{m.edited ? 'modifié · ' : ''}{m.time}</span>{m.mine && <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />}</div>
                  <button onClick={() => setMenuMessage(menuMessage === m.id ? null : m.id)} className="absolute -right-2 -top-2 hidden rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm group-hover:block" title="Actions du message"><MoreVertical className="h-3 w-3" /></button>
                  {menuMessage === m.id && <div className="absolute right-0 top-6 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    <button onClick={() => togglePin(m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Pin className="h-3.5 w-3.5" />{m.pinned ? 'Désépingler' : 'Épingler'}</button>
                    {m.mine && <button onClick={() => startEdit(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Modifier</button>}
                    {m.mine && <button onClick={() => deleteMessage(m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Supprimer</button>}
                  </div>}
                </div>
              </div>
            ))}
          </div>
          <footer className="border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
            {editingId && <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-800"><span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" />Modification du message</span><button onClick={() => { setEditingId(null); setDraft(''); }}><X className="h-3.5 w-3.5" /></button></div>}
            {recording && <div className="mb-2 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-600"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />Enregistrement vocal simulé…<button className="ml-auto" onClick={() => setRecording(false)}>Annuler</button></div>}
            <div className="flex items-end gap-1.5 sm:gap-2">
              <div className="relative">
                <button onClick={() => setShowAttach(v => !v)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" title="Joindre un fichier"><Paperclip className="h-5 w-5" /></button>
                {showAttach && <div className="absolute bottom-12 left-0 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><button onClick={() => fileInput.current?.click()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50"><ImageIcon className="h-4 w-4 text-emerald-600" />Photo ou image</button><button onClick={() => { setShowAttach(false); fileInput.current?.click(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50"><FileText className="h-4 w-4 text-sky-600" />Document</button></div>}
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={e => attachImage(e.target.files?.[0])} />
              </div>
              <button className="hidden h-10 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 sm:flex" title="Emoji"><Smile className="h-5 w-5" /></button>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Écrire un message…" rows={1} className="max-h-28 min-h-10 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-5 text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white" />
              {draft.trim() ? <button onClick={sendMessage} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00a982] text-white shadow-sm transition hover:bg-[#008f72]" title="Envoyer"><Send className="h-4 w-4" /></button> : <button onClick={startVoice} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${recording ? 'bg-rose-500 text-white' : 'bg-[#00a982] text-white hover:bg-[#008f72]'}`} title={recording ? 'Arrêter le vocal' : 'Message vocal'}><Mic className="h-4 w-4" /></button>}
            </div>
            <p className="mt-2 pl-12 text-[9px] text-slate-400">Entrée pour envoyer · Maj + Entrée pour un saut de ligne</p>
          </footer>
        </section>
      </div>
    </div>
  );
}
