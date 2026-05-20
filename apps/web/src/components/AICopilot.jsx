import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function AICopilot() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/ai/smart-recommendations', { taskId: null }); // we can customize later
      setResponse(data.recommendations || data.prediction || 'No recommendations available.');
    } catch (err) {
      toast.error('AI request failed');
      setResponse('AI is currently unavailable. Please check your API keys.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 glass rounded-full p-3 shadow-lg hover:shadow-xl transition"
        title="AI Copilot"
      >
        <Sparkles className="h-6 w-6 text-blue-400" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-20 right-6 z-40 glass rounded-2xl w-96 max-w-[calc(100vw-2rem)] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-400" /> AI Copilot
              </h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
              {response && <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-sm">{response}</div>}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 rounded-lg border p-2 dark:bg-gray-700 dark:text-white text-sm"
                onKeyDown={(e) => e.key === 'Enter' && askAI()}
              />
              <button onClick={askAI} disabled={loading} className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
