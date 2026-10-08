import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, X } from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface VyraChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VyraChat({ isOpen, onClose }: VyraChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Bonjour, je suis VYRA, l’assistante IA d’IAMTRADER. Je peux vous aider à comprendre la plateforme, vos métriques et les concepts de trading.',
    },
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

      const data = await response.json();

      if (!response.ok || !data.reply) {
        throw new Error(data.error || 'Le service IA n’a pas pu répondre.');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: error?.message || 'Une erreur est survenue. Réessayez dans un instant.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      <div
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Chat avec VYRA"
        className="pointer-events-auto absolute right-4 top-20 sm:right-6 w-[calc(100vw-2rem)] sm:w-[390px] h-[min(620px,calc(100vh-6rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 flex flex-col"
      >
        <header className="h-14 shrink-0 border-b border-slate-100 bg-white px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-xl bg-[#eff8ff] border border-[#dbeeff] flex items-center justify-center overflow-hidden">
              <img src="/vyra-avatar.webp" alt="" className="w-full h-full object-cover" />
              <span className="absolute right-0.5 bottom-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#10233a] leading-none">VYRA</p>
              <p className="text-[10px] text-slate-400 mt-1">Assistante IA IAMTRADER</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            aria-label="Fermer VYRA"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-3.5 space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              {message.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 mr-2 mt-1">
                  <img src="/vyra-avatar.webp" alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[82%] rounded-2xl rounded-br-md bg-[#10233a] text-white px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap'
                    : 'max-w-[82%] rounded-2xl rounded-bl-md bg-white border border-slate-200 text-slate-700 px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap shadow-sm'
                }
              >
                {message.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start items-center gap-2">
              <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0">
                <img src="/vyra-avatar.webp" alt="" className="w-full h-full object-cover" />
              </div>
              <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-3.5 py-2.5">
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={sendMessage} className="shrink-0 border-t border-slate-100 bg-white p-3">
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500/10">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="Écrire à VYRA..."
              className="flex-1 resize-none bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none max-h-24"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 shrink-0 rounded-lg bg-[#10233a] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#183653] transition-colors"
              aria-label="Envoyer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[9px] text-slate-400 text-center mt-2">VYRA peut faire des erreurs. Vérifiez les informations importantes.</p>
        </form>
      </section>
    </div>
  );
}
