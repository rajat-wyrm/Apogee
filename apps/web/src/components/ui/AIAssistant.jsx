import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore, useUIStore } from '../../store';
import { cn, formatRelative } from '../../lib/utils';
import { Sparkles, X, Send, Loader, FileText, ListTodo, Wand2, Languages, Hash, MessageCircle, Lightbulb, Brain, ChevronDown, Copy, Check, RefreshCw, Bot, User, Zap, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const QUICK_ACTIONS = [
  { id: 'qa1', label: 'Summarize my tasks', icon: ListTodo, prompt: 'Summarize all my open tasks grouped by priority.' },
  { id: 'qa2', label: 'Draft a status update', icon: FileText, prompt: 'Draft a concise status update for my team covering this week.' },
  { id: 'qa3', label: 'Suggest priorities', icon: Wand2, prompt: 'Look at my open tasks and suggest which I should focus on first.' },
  { id: 'qa4', label: 'Brainstorm ideas', icon: Brain, prompt: 'Help me brainstorm 5 creative ideas for a team offsite.' },
  { id: 'qa5', label: 'Improve writing', icon: Sparkles, prompt: 'Improve this text to be clearer and more professional: ' },
  { id: 'qa6', label: 'Translate', icon: Languages, prompt: 'Translate this to Spanish: ' },
];

export function AIAssistant({ onClose }) {
  const { currentOrganization, user } = useAuthStore();
  const { theme } = useUIStore();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi ${user?.full_name?.split(' ')[0] || 'there'}! 👋 I'm your AI assistant. I can help you write, summarize, translate, brainstorm, and much more. What can I help with?`, provider: 'groq' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const send = useMutation({
    mutationFn: (text) => api.post('/ai/chat', { messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }], organization_id: currentOrganization?.id, feature: 'assistant' }),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: 'assistant', content: res.data.data.text, provider: res.data.data.provider }]);
    },
    onError: () => {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', provider: null }]);
    },
    onSettled: () => setLoading(false),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = (text) => {
    const message = (text || input).trim();
    if (!message || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setLoading(true);
    send.mutate(message);
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onClose} />
      <div className={cn('fixed inset-y-0 right-0 z-50 w-full sm:w-96 lg:w-[28rem] bg-surface border-l border-default shadow-2xl flex flex-col animate-slide-right')}>
        <div className="p-4 border-b border-default bg-gradient-to-br from-brand-500/5 to-purple-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-sm">AI Assistant</h2>
                <p className="text-[10px] text-fg-3 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Multi-provider · 6 AI models
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost"><X size={16} /></button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex gap-2 animate-fade', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white shrink-0">
                  <Bot size={14} />
                </div>
              )}
              <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm', m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-fg')}>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                {m.role === 'assistant' && m.provider && (
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-default">
                    <span className="text-[10px] text-fg-3">via {m.provider}</span>
                    <button onClick={() => copy(m.content)} className="text-[10px] text-fg-3 hover:text-fg-2 inline-flex items-center gap-1 ml-auto">
                      <Copy size={10} /> Copy
                    </button>
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <Avatar name={user?.full_name} src={user?.avatar_url} size="xs" className="shrink-0" />
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 animate-fade">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white shrink-0">
                <Bot size={14} />
              </div>
              <div className="bg-surface-2 rounded-2xl px-3.5 py-2.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-fg-3 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 bg-fg-3 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 bg-fg-3 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <div className="text-[10px] uppercase tracking-wider text-fg-3 font-semibold mb-1.5">Quick actions</div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_ACTIONS.map((qa) => {
                const Icon = qa.icon;
                return (
                  <button key={qa.id} onClick={() => handleSend(qa.prompt)} className="flex items-center gap-1.5 p-2 rounded-lg border border-default text-xs hover:bg-surface-3 hover:border-brand-300 transition text-left">
                    <Icon size={12} className="text-brand-500 shrink-0" />
                    <span className="truncate">{qa.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-default bg-surface-2">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask me anything… (Shift+Enter for new line)"
              rows={1}
              className="textarea flex-1 resize-none min-h-[40px] max-h-32"
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn-primary btn-icon shrink-0">
              {loading ? <Loader size={14} /> : <Send size={14} />}
            </button>
          </form>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-fg-3">
            <span className="flex items-center gap-1"><span className="kbd">↵</span> Send</span>
            <span className="flex items-center gap-1"><span className="kbd">⇧↵</span> New line</span>
            <span className="ml-auto">Groq · OpenAI · Gemini · DeepSeek</span>
          </div>
        </div>
      </div>
    </>
  );
}
