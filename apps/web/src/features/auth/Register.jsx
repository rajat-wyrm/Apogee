import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../../store';
import { AuthShell } from './Login';
import { Mail, Lock, User, ArrowRight, Chrome, AlertCircle, Loader, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strength, setStrength] = useState(0);

  const checkStrength = (pwd) => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    setStrength(s);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      toast.success('Welcome to Apogee!');
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const strengthColor = ['bg-danger', 'bg-warning', 'bg-info', 'bg-success'];
  const strengthLabel = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <AuthShell title="Create your account" subtitle="Start your 14-day Pro trial. No credit card required.">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 text-danger text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button onClick={() => window.location.href = '/api/oauth/google'} type="button" className="btn-secondary btn-block justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign up with Google
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-default" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-surface px-2 text-fg-3">or with email</span></div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" className="input pl-9" autoComplete="name" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" className="input pl-9" autoComplete="email" />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input type="password" required minLength={8} value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); checkStrength(e.target.value); }} placeholder="At least 8 characters" className="input pl-9" autoComplete="new-password" />
            </div>
            {form.password && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? strengthColor[strength - 1] : 'bg-surface-3'} transition`} />
                  ))}
                </div>
                <p className="text-xs text-fg-3">{strengthLabel[strength - 1] || 'Too short'}</p>
              </div>
            )}
            <p className="help">Use 8+ characters with uppercase, numbers & symbols.</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary btn-block justify-center">
            {loading ? <Loader size={14} className="animate-spin" /> : <>Create account <ArrowRight size={14} /></>}
          </button>
          <p className="text-xs text-fg-3 text-center">By signing up, you agree to our Terms & Privacy.</p>
        </form>

        <p className="mt-6 text-center text-sm text-fg-2">
          Already have an account? <Link to="/auth/login" className="link font-medium">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
