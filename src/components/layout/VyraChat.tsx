import React, { useEffect, useRef, useState } from 'react';
import { Send, X, Sparkles } from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface VyraChatProps {
  isOpen: boolean;
  onClose: () => void;
}

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-[#172b3d]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderVyraText(text: string): React.ReactNode {
  const lines = text.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').split('\n');

  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-1.5" aria-hidden="true" />;

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    const bullet = trimmed.match(/^(?:[-*•])\s+(.+)$/);
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    const content = heading?.[1] ?? bullet?.[1] ?? numbered?.[2] ?? trimmed;
    const parts = renderInline(content);

    if (heading) return <div key={index} className="mt-1 mb-1 text-[11px] font-bold leading-4 text-[#172b3d]">{parts}</div>;
    if (bullet) return <div key={index} className="flex gap-1.5 leading-5"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#00a982]" /><span>{parts}</span></div>;
    if (numbered) return <div key={index} className="flex gap-1.5 leading-5"><span className="min-w-4 font-semibold text-[#168c73]">{numbered[1]}.</span><span>{parts}</span></div>;

    return <p key={index} className="m-0 leading-5">{parts}</p>;
  });
}

export function VyraChat({ isOpen, onClose }: VyraChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Bonjour. Je suis VYRA, l’assistante IA d’IAMTRADER. Je peux vous aider à comprendre la plateforme et ses fonctionnalités.' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sendMessage = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;

    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.reply !== 'string') {
        throw new Error(typeof data.error === 'string' ? data.error : 'Réponse IA indisponible.');
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error?.message || 'Je rencontre actuellement un problème de connexion. Réessayez dans quelques instants.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      <div className="absolute inset-0 bg-[#06111f]/20 backdrop-blur-[2px] pointer-events-auto" onClick={onClose} aria-hidden="true" />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Chat avec VYRA"
        className="pointer-events-auto absolute right-3 top-[72px] sm:right-6 w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-3rem)] max-w-5xl h-[min(82vh,760px)] overflow-hidden rounded-[30px] border border-[#dce9e5] bg-white shadow-[0_30px_80px_rgba(6,17,31,0.22)] flex flex-col"
      >
        <header className="shrink-0 flex items-center justify-between border-b border-[#e7efec] bg-white px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00c796] to-[#00a982] text-white shadow-[0_8px_20px_rgba(0,169,130,0.24)]">
              <Sparkles className="h-5 w-5 animate-[spin_4s_linear_infinite]" />
              <span className="absolute inset-0 rounded-full ring-2 ring-[#00c796]/20 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-black text-[#081827]">VYRA</h2>
                <span className="rounded-full bg-[#eafbf6] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#168c73]">IA</span>
              </div>
              <p className="mt-0.5 text-[9px] font-medium text-[#7a8b9b]">Échange instantané</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer VYRA" className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#dce9e5] bg-white text-[#5d7183] transition-all hover:border-[#b9d9cf] hover:bg-[#f0faf6] hover:text-[#168c73]">
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfdfc] px-3.5 py-4">
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="mr-2 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00c796] to-[#00a982] text-white shadow-[0_5px_14px_rgba(0,169,130,0.2)]">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed shadow-sm ${
                  message.role === 'user'
                    ? 'rounded-br-md bg-[#081827] text-white'
                    : 'rounded-bl-md border border-[#dcebe5] bg-white text-[#43586b]'
                }`}>
                  {message.role === 'assistant' ? renderVyraText(message.content) : message.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#00c796] to-[#00a982] text-white shadow-[0_5px_14px_rgba(0,169,130,0.2)]">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[#e2ece8] bg-white px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00a982]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00a982] [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00a982] [animation-delay:240ms]" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <form onSubmit={sendMessage} className="shrink-0 border-t border-[#e7efec] bg-white px-3.5 py-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[#d9e6e1] bg-white p-1.5 shadow-[0_8px_25px_rgba(8,24,39,0.05)] focus-within:border-[#8bd4c0] focus-within:ring-4 focus-within:ring-[#00a982]/5">
            <input
              type="text"
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Posez votre question à l’IA..."
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[11px] text-[#081827] outline-none placeholder:text-[#9aa9b5]"
              disabled={isLoading}
            />
            <button type="submit" disabled={!input.trim() || isLoading} aria-label="Envoyer à VYRA" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00a982] text-white shadow-[0_8px_18px_rgba(0,169,130,0.2)] transition-all hover:bg-[#008f70] disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[8px] font-medium text-[#9aa9b5]">VYRA peut faire des erreurs. Vérifiez les informations importantes.</p>
        </form>
      </section>
    </div>
  );
}
