import React, { useEffect, useRef, useState } from 'react';
import { FileText, Mic, Paperclip, Send, Square, X, Check, Sparkles, Loader2 } from 'lucide-react';
import { addTrade } from '../../services/firestore';
import { TradingAccount, Trade, UserProfile } from '../../types';
import { useToast } from '../common/Toast';

type Message = { role: 'user' | 'assistant'; content: string };
type Attachment = { name: string; mimeType: string; data: string };
type ChloeAction = {
  type: 'create_trade';
  confidence?: number;
  reason?: string;
  trade: Record<string, any>;
};

interface ChloeChatProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userProfile: UserProfile | null;
  accounts: TradingAccount[];
  trades: Trade[];
  currentPage: string;
}

const STORAGE_KEY = 'iamtrader_chloe_chat_v1';
const RETENTION_MS = 48 * 60 * 60 * 1000;

function renderText(text: string) {
  return text.split(/\n+/).map((line, index) => (
    <p key={index} className="m-0 leading-5">
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
      )}
    </p>
  ));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getSession(date: string) {
  const hour = new Date(date).getUTCHours();
  if (hour < 8) return 'Asia';
  if (hour < 13) return 'London';
  if (hour < 16) return 'Overlap';
  if (hour < 22) return 'New York';
  return 'Asia';
}

export function ChloeChat({ isOpen, onClose, userId, userProfile, accounts, trades, currentPage }: ChloeChatProps) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (stored?.savedAt && Date.now() - stored.savedAt < RETENTION_MS && Array.isArray(stored.messages)) return stored.messages;
    } catch {}
    return [{ role: 'assistant', content: 'Bonjour. Je suis Chloé, votre intelligence opérationnelle IAMTRADER. Je peux analyser vos données, vos captures, vos documents et vous aider directement dans votre journal.' }];
  });
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingAction, setPendingAction] = useState<ChloeAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), messages })); } catch {}
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, pendingAction]);

  if (!isOpen) return null;

  const context = {
    currentPage,
    user: userProfile ? {
      uid: userId,
      displayName: userProfile.displayName,
      plan: userProfile.plan,
      role: userProfile.role,
      settings: userProfile.settings,
    } : null,
    accounts: accounts.map(a => ({
      id: a.id, name: a.name, currency: a.currency, currentBalance: a.currentBalance,
      initialBalance: a.initialBalance,
    })),
    journal: {
      tradeCount: trades.length,
      recentTrades: trades.slice(-80),
    },
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, 5 - attachments.length);
    const next: Attachment[] = [];
    for (const file of selected) {
      if (file.size > 12 * 1024 * 1024) {
        showToast(`${file.name} dépasse 12 Mo.`, 'error');
        continue;
      }
      try {
        next.push({ name: file.name, mimeType: file.type || 'application/octet-stream', data: await fileToBase64(file) });
      } catch {
        showToast(`Impossible de lire ${file.name}.`, 'error');
      }
    }
    setAttachments(prev => [...prev, ...next]);
  };

  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if ((!input.trim() && !attachments.length) || loading) return;

    const visibleText = input.trim() || 'Analyse le fichier que je viens de joindre.';
    const attachmentNames = attachments.map(a => a.name).join(', ');
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: attachmentNames
          ? `${visibleText}\n\nFichiers : ${attachmentNames}`
          : visibleText,
      },
    ]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chloe-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, { role: 'user', content: visibleText }], userContext: context, attachments }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Chloé est indisponible.');
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Je n’ai pas de réponse exploitable.' }]);
      setPendingAction(data.action || null);
      setAttachments([]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: error?.message || 'Une erreur est survenue.' }]);
    } finally {
      setLoading(false);
    }
  };

  const executeTrade = async () => {
    if (!pendingAction?.trade || pendingAction.type !== 'create_trade') return;
    const t = pendingAction.trade;
    const account = accounts.find(a => a.id === t.accountId) || accounts[0];
    const currentMonthTradeCount = trades.filter((trade) => { const d = new Date(trade.entryDate); const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); }).length;
    if (userProfile?.plan === 'free' && currentMonthTradeCount >= 5) { showToast('La limite Starter de 5 trades ce mois-ci est atteinte.', 'error'); return; }
    const instruments = (userProfile as any)?.settings?.instruments || [];
    const instrument = instruments.find((x: any) => String(x.symbol).toUpperCase() === String(t.symbol || '').toUpperCase());

    if (!account || !instrument || !t.symbol || !t.direction || !t.entryDate || !t.entryPrice || !t.positionSize || !t.stopLoss || !t.setup || !t.timeframe || !t.emotion) {
      showToast('Chloé n’a pas encore toutes les informations obligatoires pour enregistrer ce trade.', 'error');
      return;
    }

    const entry = Number(t.entryPrice);
    const exit = t.exitPrice === null || t.exitPrice === '' || t.exitPrice == null ? undefined : Number(t.exitPrice);
    const size = Number(t.positionSize);
    const sl = Number(t.stopLoss);
    const multiplier = Number(instrument.valuePerPriceUnit);
    const commission = t.commission == null || t.commission === '' ? 0 : Math.max(0, Number(t.commission));
    const priceMove = exit === undefined ? 0 : t.direction === 'BUY' ? exit - entry : entry - exit;
    const pnl = exit === undefined ? 0 : priceMove * size * multiplier - commission;
    const risk = Math.abs(entry - sl) * size * multiplier;
    const rMultiple = exit !== undefined && risk > 0 ? Number((pnl / risk).toFixed(2)) : undefined;
    const result = exit === undefined ? 'OPEN' : pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';
    const entryIso = new Date(t.entryDate).toISOString();

    await addTrade({
      userId,
      accountId: account.id,
      symbol: String(t.symbol).toUpperCase(),
      direction: t.direction,
      entryDate: entryIso,
      ...(t.exitDate ? { exitDate: new Date(t.exitDate).toISOString() } : {}),
      entryPrice: entry,
      ...(exit !== undefined ? { exitPrice: exit } : {}),
      stopLoss: sl,
      ...(t.takeProfit != null && t.takeProfit !== '' ? { takeProfit: Number(t.takeProfit) } : {}),
      ...(commission > 0 ? { commission } : {}),
      positionSize: size,
      riskAmount: risk,
      result,
      pnl,
      ...(rMultiple !== undefined ? { rMultiple } : {}),
      setup: String(t.setup),
      session: getSession(entryIso),
      timeframe: String(t.timeframe),
      emotion: String(t.emotion),
      notes: String(t.notes || ''),
    } as any);

    setPendingAction(null);
    setMessages(prev => [...prev, { role: 'assistant', content: 'Le trade a été enregistré dans votre journal IAMTRADER.' }]);
    showToast('Trade enregistré par Chloé.', 'success');
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('La capture vocale n’est pas disponible sur ce navigateur.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) audioChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const file = new File([blob], 'message-vocal.webm', { type: blob.type });
        const data = await fileToBase64(file);
        setAttachments(prev => [...prev, { name: file.name, mimeType: file.type, data }]);
        showToast('Message vocal ajouté. Envoyez-le à Chloé.', 'success');
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      showToast('Autorisation du microphone refusée ou indisponible.', 'error');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none">
      <div className="absolute inset-0 bg-[#06111f]/25 backdrop-blur-[2px] pointer-events-auto" onClick={onClose} />
      <section className="pointer-events-auto absolute right-3 top-[72px] sm:right-6 w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-3rem)] max-w-5xl h-[min(82vh,760px)] overflow-hidden rounded-[30px] border border-[#dce9e5] bg-white shadow-[0_30px_80px_rgba(6,17,31,0.22)] flex flex-col" role="dialog" aria-modal="true" aria-label="Chat avec Chloé">
        <header className="shrink-0 flex items-center justify-between border-b border-[#e7efec] bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#00c796] to-[#00a982] text-white shadow-[0_8px_22px_rgba(0,169,130,0.2)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2"><h2 className="text-sm font-black text-[#081827]">Chloé</h2><span className="rounded-full bg-[#eafbf6] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#168c73]">IA APP</span></div>
              <p className="mt-0.5 text-[9px] font-medium text-[#7a8b9b]">Intelligence opérationnelle IAMTRADER</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#dce9e5] text-[#5d7183] hover:bg-[#f0faf6]" aria-label="Fermer Chloé"><X className="h-3.5 w-3.5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfdfc] px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-4xl space-y-3">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <div className="mr-2 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00c796] to-[#00a982] text-white"><Sparkles className="h-3.5 w-3.5" /></div>}
                <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-[11px] leading-relaxed shadow-sm ${message.role === 'user' ? 'rounded-br-md bg-[#081827] text-white' : 'rounded-bl-md border border-[#dcebe5] bg-white text-[#43586b]'}`}>
                  {renderText(message.content)}
                </div>
              </div>
            ))}
            {loading && <div className="flex items-center gap-2 text-xs text-[#71839a]"><Loader2 className="h-4 w-4 animate-spin text-[#00a982]" /> Chloé analyse votre demande…</div>}
            {pendingAction && (
              <div className="rounded-2xl border border-[#bfe8dc] bg-[#eafbf6] p-4">
                <div className="text-xs font-black text-[#08795f]">Action proposée : enregistrer ce trade</div>
                <p className="mt-1 text-[10px] text-[#4f6f65]">{pendingAction.reason || 'Les informations semblent suffisantes.'}</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  {Object.entries(pendingAction.trade).filter(([,v]) => v !== null && v !== '' && v !== undefined).slice(0, 12).map(([key,value]) => <div key={key} className="rounded-lg bg-white/80 px-2 py-1.5"><span className="block text-[#8a9aab]">{key}</span><strong className="text-[#10233a]">{String(value)}</strong></div>)}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={executeTrade} className="inline-flex items-center gap-1.5 rounded-xl bg-[#00a982] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#008f70]"><Check className="h-3.5 w-3.5" /> Enregistrer</button>
                  <button type="button" onClick={() => setPendingAction(null)} className="rounded-xl border border-[#cfe3dc] bg-white px-3 py-2 text-[10px] font-bold text-[#5d7183]">Annuler</button>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-[#e7efec] bg-white px-4 py-3 sm:px-6">
          {attachments.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {attachments.map((file, i) => <div key={i} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dce9e5] bg-[#f7fbf9] px-2.5 py-1.5 text-[10px] text-[#43586b]"><FileText className="h-3 w-3 text-[#00a982]" />{file.name}<button type="button" onClick={() => setAttachments(prev => prev.filter((_,idx) => idx !== i))}><X className="h-3 w-3" /></button></div>)}
            </div>
          )}
          <form onSubmit={send} className="flex items-center gap-2 rounded-2xl border border-[#d9e6e1] bg-white p-1.5 shadow-[0_8px_25px_rgba(8,24,39,0.05)]">
            <input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" id="chloe-file-input" onChange={e => handleFiles(e.target.files)} />
            <label htmlFor="chloe-file-input" className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#71839a] hover:bg-[#f0faf6] hover:text-[#00a982]" title="Joindre un fichier"><Paperclip className="h-4 w-4" /></label>
            <button type="button" onClick={recording ? stopRecording : startRecording} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${recording ? 'bg-rose-50 text-rose-500' : 'text-[#71839a] hover:bg-[#f0faf6] hover:text-[#00a982]'}`} title={recording ? 'Arrêter' : 'Message vocal'}>
              {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
            </button>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Demandez à Chloé d'analyser ou d'agir…" className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-[#081827] outline-none placeholder:text-[#9aa9b5]" disabled={loading} />
            <button type="submit" disabled={loading || (!input.trim() && !attachments.length)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00a982] text-white disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </form>
          <p className="mt-1.5 text-center text-[9px] text-[#9aa9b5]">Chloé peut lire le contexte IAMTRADER fourni à la session, analyser des fichiers et préparer des actions.</p>
        </div>
      </section>
    </div>
  );
}
