import { useEffect, useRef, useState } from 'react';
import { useUIStore, useAuthStore } from '../../store';
import api from '../../lib/api';
import { X, Sparkles, Send, User, Wand2, Languages, FileText, ListChecks, Loader } from 'lucide-react';
import { cn } from '../../lib/utils';

const SUGGESTIONS = [
  { icon: ListChecks, label: 'Summarize my open tasks' },
  { icon: Wand2, label: 'Improve this text' },
  { icon: Languages, label: 'Translate to Spanish' },
  { icon: FileText, label: 'Write a status update' },
  { icon: Sparkles, label: 'Suggest 5 project names' },
  { icon: User, label: 'Help me write a performance review' },
];

export default function AIAssistant() {
  const { aiOpen, toggleAI, setAI } = useUIStore();
  const { user, currentOrganization } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const handler = () => setAI(true);
    window.addEventListener('open-ai', handler);
    return () => window.removeEventListener('open-ai', handler);
  }, [setAI]);

  useEffect(() => {
    if (aiOpen && messages.length === 0) {
      setMessages([{ role: 'assistant', content: `Hi ${user?.full_name?.split(' ')[0] || 'there'}! 👋 I'm your AI assistant. I can help with anything — projects, writing, summaries, translations, and more. Powered by Groq, OpenAI, Gemini, and more.` }]);
    }
  }, [aiOpen, user, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const message = (text || input).trim();
    if (!message) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', {
        messages: [{ role: 'user', content: message }],
        organization_id: currentOrganization?.id,
        feature: 'assistant',
      });
      setMessages((m) => [...m, { role: 'assistant', content: data.data.text || 'No response', provider: data.data.provider, fallback: data.data.fallback }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally { setLoading(false); }
  };

  if (!aiOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={toggleAI} />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-surface border-l border-border shadow-2xl flex flex-col animate-in">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white"><Sparkles size={14} /></div>
            <div>
              <h2 className="font-semibold">Apogee AI</h2>
              <p className="text-[10px] text-fg-3">Multi-provider with fallback</p>
            </div>
          </div>
          <button onClick={toggleAI} className="btn-icon btn-ghost"><X size={16} /></button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm', m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-fg')}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.provider && <div className="text-[10px] text-fg-3 mt-1">via {m.provider}{m.fallback && ' (fallback)'}</div>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-2 rounded-2xl px-3.5 py-2.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-fg-3 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 bg-fg-3 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 bg-fg-3 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 grid grid-cols-2 gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s.label} onClick={() => send(s.label)} className="flex items-center gap-2 p-2 rounded-lg border border-border text-xs text-left hover:bg-surface-2 transition">
                <s.icon size={12} className="text-fg-3 shrink-0" /> <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-border">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask me anything…"
              rows={1}
              className="input flex-1 resize-none min-h-[40px] max-h-32"
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn-primary btn-icon"><Send size={14} /></button>
          </form>
        </div>
      </div>
    </>
  );
}
