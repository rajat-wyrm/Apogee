import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

function Logo() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 font-semibold text-white">
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="text-lg tracking-tight">Apogee</span>
    </Link>
  );
}

function AuthSide() {
  return (
    <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between p-12">
      <div className="absolute inset-0 grid-bg opacity-30" aria-hidden="true" />
      <div className="absolute inset-0 gradient-mesh opacity-90" aria-hidden="true" />
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-10 top-32 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-10 bottom-32 h-72 w-72 rounded-full bg-accent-500/30 blur-3xl"
      />
      <div className="relative z-10">
        <Logo />
      </div>
      <div className="relative z-10 space-y-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl"
        >
          The workspace where teams <span className="text-gradient">actually ship</span>.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-md text-pretty text-lg text-white/70"
        >
          Join thousands of teams using Apogee to plan, collaborate, and deliver faster than ever.
        </motion.p>
        <ul className="space-y-3 text-white/80">
          {['Unlimited projects & tasks', 'AI Copilot included', 'SSO & advanced security', '99.99% uptime SLA'].map((f) => (
            <motion.li
              key={f}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex items-center gap-2.5 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-success-400" /> {f}
            </motion.li>
          ))}
        </ul>
      </div>
      <div className="relative z-10 flex items-center gap-3 text-xs text-white/50">
        <span>© {new Date().getFullYear()} Apogee</span>
        <span>·</span>
        <Link to="/" className="hover:text-white inline-flex items-center gap-1">
          Back to home <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <AuthSide />
        <div className="flex flex-col">
          <header className="flex items-center justify-between p-6 lg:hidden">
            <Logo />
          </header>
          <main className="flex flex-1 items-center justify-center p-6 py-12 sm:p-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md"
            >
              <div className="mb-8 text-center lg:text-left">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">{title}</h1>
                {subtitle && <p className="mt-2 text-sm text-[var(--fg-subtle)] text-pretty">{subtitle}</p>}
              </div>
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
