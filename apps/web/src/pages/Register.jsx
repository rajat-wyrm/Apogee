import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, ArrowRight, AlertCircle, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthLayout from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Separator } from '../components/ui/Separator';
import { Progress } from '../components/ui/Progress';
import { GoogleIcon } from '../components/ui/SocialIcons';
import useAuthStore from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '';

function getPasswordStrength(p) {
  if (!p) return { score: 0, label: '', tone: 'neutral' };
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (p.length >= 12) score++;
  const map = [
    { label: '', tone: 'neutral' },
    { label: 'Weak', tone: 'danger' },
    { label: 'Fair', tone: 'warning' },
    { label: 'Good', tone: 'warning' },
    { label: 'Strong', tone: 'success' },
    { label: 'Excellent', tone: 'success' },
  ];
  return { score, ...map[score], pct: (score / 5) * 100 };
}

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const checks = useMemo(() => ([
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ]), [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (strength.score < 2) {
      setError('Please choose a stronger password.');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success('Welcome to Apogee!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = `${API_URL}/api/oauth/google`;
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start your journey with Apogee — it's free.">
      <div className="space-y-6">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={handleGoogle}
          leftIcon={<GoogleIcon className="h-5 w-5" />}
        >
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">or</span>
          <Separator className="flex-1" />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            label="Full name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
            autoComplete="name"
            required
          />
          <Input
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="h-4 w-4" />}
            autoComplete="email"
            required
          />
          <div>
            <Input
              type="password"
              label="Password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              autoComplete="new-password"
              required
            />
            {password && (
              <div className="mt-3 space-y-2">
                <Progress
                  value={strength.pct}
                  tone={strength.tone === 'neutral' ? 'brand' : strength.tone}
                  size="sm"
                />
                <p className="text-xs text-[var(--fg-subtle)]">
                  Strength: <span className="font-medium text-[var(--fg-muted)]">{strength.label}</span>
                </p>
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 text-xs">
                  {checks.map((c) => (
                    <li key={c.label} className={`flex items-center gap-1.5 ${c.met ? 'text-success-600 dark:text-success-400' : 'text-[var(--fg-subtle)]'}`}>
                      {c.met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <p className="text-xs text-[var(--fg-subtle)]">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-[var(--fg)]">Terms</Link> and{' '}
            <Link to="/privacy" className="underline hover:text-[var(--fg)]">Privacy Policy</Link>.
          </p>

          <Button type="submit" variant="gradient" size="lg" fullWidth loading={loading} rightIcon={!loading && <ArrowRight className="h-4 w-4" />}>
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--fg-muted)]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
