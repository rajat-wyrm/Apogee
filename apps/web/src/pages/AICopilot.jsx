import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, Sparkles, Loader2, User as UserIcon } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

const SUGGESTIONS = [
  'Summarize my open tasks',
  'What should I focus on today?',
  'Draft a project update email',
  'Suggest tasks for Q4 launch',
];

export default function AICopilot() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your AI Copilot. I can help you summarize work, draft messages, and surface what needs your attention. What would you like to do?' },
  ]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = prompt.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setPrompt('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/smart-recommendations', { query: text }).catch(() => ({ data: {} }));
      const reply = data?.recommendations || data?.response || 'I can help with that. Try asking about your tasks or projects.';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      toast.error('AI request failed');
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I\'m having trouble responding right now. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex h-[calc(100dvh-7rem)] flex-col">
      <PageHeader
        title="AI Copilot"
        description="Your intelligent workspace assistant."
        action={<Badge tone="brand" leftIcon={<Sparkles className="h-3 w-3" />}>Beta</Badge>}
      />

      <Card padding="none" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              {m.role === 'assistant' ? (
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">
                  <Bot className="h-5 w-5" />
                </span>
              ) : (
                <Avatar name="You" size="md" />
              )}
              <div className={cn(
                'max-w-2xl rounded-2xl px-4 py-2.5 text-sm',
                m.role === 'assistant'
                  ? 'bg-[var(--bg-muted)] text-[var(--fg)]'
                  : 'bg-brand-600 text-white'
              )}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">
                <Bot className="h-5 w-5" />
              </span>
              <div className="rounded-2xl bg-[var(--bg-muted)] px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-subtle)]" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors"
              >
                <Sparkles className="h-3 w-3 text-brand-500" /> {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2"
          >
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask the AI Copilot…"
              size="lg"
              containerClassName="flex-1"
            />
            <Button type="submit" size="lg" variant="gradient" loading={loading} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </motion.div>
  );
}
