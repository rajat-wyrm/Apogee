import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store';
import { Logo, LogoText } from '../../components/ui/Logo';
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res?.require2fa) navigate('/auth/2fa', { state: { userId: res.userId } });
      else { toast.success('Welcome back!'); navigate(location.state?.from?.pathname || '/app'); }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const googleLogin = () => { window.location.href = '/api/oauth/google'; };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your workspace to continue.">
      <div className="space-y-4">
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 text-danger text-sm">
            <AlertCircle size={14} /> {error}
          </motion.div>
        )}

        <button onClick={googleLogin} type="button" className="btn-secondary btn-block justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-default" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-surface px-2 text-fg-3">or continue with email</span></div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input pl-9" autoComplete="email" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0">Password</label>
              <Link to="/auth/forgot" className="text-xs link">Forgot?</Link>
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input pl-9 pr-10" autoComplete="current-password" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon btn-ghost">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary btn-block justify-center">
            {loading ? <Loader size={14} className="animate-spin" /> : <>Sign in <ArrowRight size={14} /></>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-fg-2">
          Don't have an account? <Link to="/auth/register" className="link font-medium">Create one</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-full flex flex-col lg:flex-row bg-surface">
      <div className="hidden lg:flex flex-1 relative gradient-bg overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute top-20 left-20 w-72 h-72 bg-brand-500/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <Link to="/" className="flex items-center gap-2 text-fg-2 hover:text-fg transition w-fit">
            <Logo size={28} />
            <span className="font-semibold">Apogee</span>
          </Link>
          <div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance leading-tight">
              The all-in-one <br /><span className="gradient-text">productivity platform</span>
            </h2>
            <p className="mt-4 text-fg-2 max-w-md text-balance">Projects, tasks, docs, AI, analytics, service desk — all in one beautifully unified workspace.</p>
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
              {['Real-time collab', 'AI-native', 'Jira-grade agile', 'Notion docs'].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check size={14} className="text-emerald-500 shrink-0" /> {f}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-fg-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-ring" /> All systems operational
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-surface-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="lg:hidden mb-6 flex justify-center">
            <LogoText size={32} />
          </div>
          <div className="bg-surface rounded-2xl border border-default shadow-xl p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-fg-2">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
