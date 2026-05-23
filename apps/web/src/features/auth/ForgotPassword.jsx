import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import { AuthShell } from './Login';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setDone(true);
    } catch (err) {} finally { setLoading(false); }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to reset your password.">
      {done ? (
        <div className="text-center py-6">
          <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-sm text-fg-2">If <strong>{email}</strong> exists in our system, you'll receive a reset link shortly.</p>
          <Link to="/auth/login" className="link mt-4 inline-block text-sm">← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input pl-9" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <span className="loader" /> : <>Send reset link <ArrowRight size={14} /></>}
          </button>
          <p className="text-center text-sm text-fg-2">
            <Link to="/auth/login" className="link">← Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
