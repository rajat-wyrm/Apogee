import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, ArrowRight, CheckCircle2, FolderKanban, CheckSquare, Calendar,
  FileText, Users, BarChart3, BookOpen, Zap, Shield, Globe, HeadphonesIcon,
  Workflow, MousePointer2, LayoutDashboard, Bot, Pencil, Star, Quote
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar, AvatarGroup } from '../components/ui/Avatar';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';

const navLinks = [
  { to: '#features', label: 'Features' },
  { to: '#how', label: 'How it works' },
  { to: '#pricing', label: 'Pricing' },
  { to: '#testimonials', label: 'Customers' },
];

const features = [
  { icon: FolderKanban, title: 'Projects & Tasks', description: 'Plan, organize and ship work in one place with boards, lists and timelines.', tone: 'brand' },
  { icon: FileText, title: 'Docs & Wiki', description: 'Beautiful docs with real-time collaboration, embeds and rich blocks.', tone: 'accent' },
  { icon: Calendar, title: 'Calendar & Goals', description: 'Track deadlines and OKRs alongside the work that drives them.', tone: 'success' },
  { icon: Workflow, title: 'Automations', description: 'Trigger workflows from any event. No-code rules that just work.', tone: 'warning' },
  { icon: Bot, title: 'AI Copilot', description: 'Smart recommendations, summaries and intelligent task creation.', tone: 'brand' },
  { icon: BarChart3, title: 'Analytics', description: 'Real-time dashboards with productivity and team performance metrics.', tone: 'accent' },
];

const stats = [
  { value: '10k+', label: 'Teams worldwide' },
  { value: '99.99%', label: 'Uptime SLA' },
  { value: '4.9/5', label: 'Customer rating' },
  { value: '120+', label: 'Integrations' },
];

const pricing = [
  {
    name: 'Starter', price: 0, period: 'forever',
    description: 'For individuals and small teams getting started.',
    features: ['Up to 5 members', 'Unlimited projects', '2 GB storage', 'Community support'],
    cta: 'Get started', href: '/register', highlighted: false,
  },
  {
    name: 'Pro', price: 12, period: 'per user / month',
    description: 'Best for growing teams that need more power.',
    features: ['Unlimited members', 'Advanced automations', '50 GB storage', 'Priority support', 'AI Copilot', 'Custom fields'],
    cta: 'Start free trial', href: '/register', highlighted: true,
  },
  {
    name: 'Enterprise', price: null, period: 'custom',
    description: 'Advanced controls and security for large orgs.',
    features: ['SSO & SCIM', 'Audit logs', 'Dedicated CSM', 'Custom SLA', 'On-prem options', '99.99% uptime'],
    cta: 'Contact sales', href: 'mailto:sales@apogee.app', highlighted: false,
  },
];

const testimonials = [
  {
    quote: 'Apogee replaced four tools for us. The AI Copilot alone saves my team 5 hours a week.',
    name: 'Sara Lin', role: 'Head of Product, Northwind',
    rating: 5,
  },
  {
    quote: 'The most beautiful project management tool I have ever used. Performance is unreal.',
    name: 'Marcus Vega', role: 'CTO, Helio Labs',
    rating: 5,
  },
  {
    quote: 'Onboarding took ten minutes. Our team adopted it before lunch.',
    name: 'Priya Anand', role: 'Operations Lead, Crisp',
    rating: 5,
  },
];

const logos = ['Northwind', 'Helio', 'Crisp', 'Lumen', 'Forge', 'Atlas'];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] },
};

function Logo() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 font-semibold text-[var(--fg)]">
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="text-lg tracking-tight">Apogee</span>
    </Link>
  );
}

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={cn('fixed inset-x-0 top-0 z-40 transition-all duration-300', scrolled ? 'pt-2' : 'pt-4')}>
      <div className="mx-auto max-w-6xl px-4">
        <div className={cn(
          'flex h-14 items-center justify-between rounded-2xl px-4 transition-all duration-300',
          scrolled ? 'glass-strong shadow-soft' : 'bg-transparent'
        )}>
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <a key={l.to} href={l.to} className="rounded-lg px-3 py-1.5 text-sm text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button as={Link} to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
            <Button as={Link} to="/register" variant="gradient" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Get started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="absolute inset-0 -z-10 grid-bg" aria-hidden="true" />
      <div className="absolute inset-0 -z-10 gradient-mesh" aria-hidden="true" />
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, -16, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-[6%] top-32 hidden h-72 w-72 rounded-full bg-brand-500/20 blur-3xl lg:block"
      />
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, 16, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[4%] bottom-12 hidden h-72 w-72 rounded-full bg-accent-500/20 blur-3xl lg:block"
      />

      <div className="relative mx-auto max-w-6xl px-4">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <Badge tone="brand" size="lg" className="mx-auto mb-6" leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
            New · AI Copilot now in beta
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-[var(--fg)] sm:text-6xl lg:text-7xl">
            The workspace where teams <span className="text-gradient">actually ship</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-[var(--fg-muted)] sm:text-xl">
            Projects, docs, goals, automations and AI — unified into one delightful platform.
            Built for teams who care about speed and craft.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button as={Link} to="/register" size="xl" variant="gradient" rightIcon={<ArrowRight className="h-5 w-5" />}>
              Start for free
            </Button>
            <Button as={Link} to="/login" size="xl" variant="outline" leftIcon={<MousePointer2 className="h-5 w-5" />}>
              Live demo
            </Button>
          </div>
          <p className="mt-4 text-sm text-[var(--fg-subtle)]">No credit card required · 14-day Pro trial</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="absolute -inset-x-8 -inset-y-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/30 via-accent-500/20 to-warning-500/30 blur-2xl" aria-hidden="true" />
          <Card variant="elevated" padding="none" className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-danger-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success-500/70" />
              </div>
              <div className="mx-auto rounded-md bg-[var(--bg-elevated)] px-3 py-0.5 text-xs text-[var(--fg-subtle)]">app.apogee.com</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr]">
              <aside className="hidden border-r border-[var(--border)] bg-[var(--bg-muted)]/40 p-3 md:block">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">Workspaces</div>
                {['Product', 'Marketing', 'Engineering'].map((w, i) => (
                  <div key={w} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-xs', i === 0 && 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300')}>
                    <LayoutDashboard className="h-3.5 w-3.5" /> {w}
                  </div>
                ))}
                <div className="mt-4 mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">Views</div>
                {['My tasks', 'Inbox', 'Calendar'].map((v) => (
                  <div key={v} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]">
                    <CheckSquare className="h-3.5 w-3.5" /> {v}
                  </div>
                ))}
              </aside>
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Q4 launch</h3>
                    <p className="text-xs text-[var(--fg-subtle)]">12 tasks · 3 members</p>
                  </div>
                  <AvatarGroup size="sm">
                    <Avatar name="Sara Lin" />
                    <Avatar name="Marcus Vega" />
                    <Avatar name="Priya Anand" />
                  </AvatarGroup>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'To do', color: 'bg-slate-400', count: 4 },
                    { label: 'In progress', color: 'bg-brand-500', count: 3 },
                    { label: 'Done', color: 'bg-success-500', count: 5 },
                  ].map((col) => (
                    <div key={col.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--fg-muted)] inline-flex items-center gap-1.5">
                          <span className={cn('h-1.5 w-1.5 rounded-full', col.color)} />
                          {col.label}
                        </span>
                        <span className="text-[var(--fg-subtle)]">{col.count}</span>
                      </div>
                      {[1, 2].map((i) => (
                        <div key={i} className="mt-2 rounded-md bg-[var(--bg-elevated)] p-2 shadow-soft">
                          <div className="h-2 w-3/4 rounded bg-[var(--bg-muted)]" />
                          <div className="mt-1.5 h-1.5 w-1/2 rounded bg-[var(--bg-muted)]" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

function LogoCloud() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--bg-muted)]/40 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
          Trusted by teams at
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {logos.map((l) => (
            <span key={l} className="text-lg font-semibold tracking-tight text-[var(--fg-subtle)] opacity-70 hover:opacity-100 transition-opacity">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge tone="accent" className="mx-auto">Features</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl text-balance">
            Everything your team needs, <span className="text-gradient">nothing it doesn&apos;t</span>.
          </h2>
          <p className="mt-4 text-pretty text-[var(--fg-muted)]">
            Built with the depth of an enterprise platform, the simplicity of a startup tool,
            and the polish of a consumer app.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, idx) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
            >
              <Card interactive padding="lg" className="h-full group">
                <div className={cn(
                  'inline-flex h-11 w-11 items-center justify-center rounded-xl',
                  f.tone === 'brand' && 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
                  f.tone === 'accent' && 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-300',
                  f.tone === 'success' && 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-300',
                  f.tone === 'warning' && 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-300',
                )}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight text-[var(--fg)]">{f.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--fg-subtle)]">{f.description}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <Card variant="gradient" padding="lg" className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-30" aria-hidden="true" />
          <div className="relative grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{s.value}</p>
                <p className="mt-1 text-sm text-white/70">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Users, title: 'Invite your team', description: 'Bring your team in seconds with Google sign-in or email invites.' },
    { icon: LayoutDashboard, title: 'Set up a workspace', description: 'Organize by team, project or client — whatever fits your workflow.' },
    { icon: Zap, title: 'Ship faster', description: 'Automate, collaborate, and use AI to remove the busywork.' },
  ];
  return (
    <section id="how" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge tone="success" className="mx-auto">How it works</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl text-balance">Up and running in 3 steps</h2>
        </motion.div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card padding="lg" className="h-full relative">
                <span className="absolute -top-3 -left-3 inline-flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-sm font-bold text-white shadow-glow">
                  {i + 1}
                </span>
                <s.icon className="h-7 w-7 text-brand-600" />
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--fg-subtle)]">{s.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge tone="warning" className="mx-auto">Pricing</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl text-balance">Simple, fair pricing</h2>
          <p className="mt-4 text-[var(--fg-muted)]">Start free. Upgrade when you&apos;re ready.</p>
        </motion.div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {pricing.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <Card
                padding="lg"
                className={cn(
                  'h-full relative',
                  p.highlighted && 'ring-2 ring-brand-500 shadow-glow'
                )}
              >
                {p.highlighted && (
                  <Badge tone="brand" className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
                )}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-[var(--fg-subtle)]">{p.description}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  {p.price === null ? (
                    <span className="text-4xl font-bold tracking-tight">Custom</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold tracking-tight">${p.price}</span>
                      <span className="text-sm text-[var(--fg-subtle)]">/{p.period}</span>
                    </>
                  )}
                </div>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[var(--fg-muted)]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Button
                    as="a"
                    variant={p.highlighted ? 'gradient' : 'outline'}
                    fullWidth
                    href={p.href}
                  >
                    {p.cta}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section id="testimonials" className="py-24 sm:py-32 bg-[var(--bg-muted)]/40 border-y border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge tone="brand" className="mx-auto">Customers</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl text-balance">Loved by teams everywhere</h2>
        </motion.div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <Card padding="lg" className="h-full">
                <Quote className="h-7 w-7 text-brand-500/40" />
                <p className="mt-3 text-base text-[var(--fg)] text-pretty">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-4 flex items-center gap-1 text-warning-500">
                  {Array.from({ length: t.rating }).map((_, k) => (
                    <Star key={k} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar name={t.name} />
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-[var(--fg-subtle)]">{t.role}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-3xl gradient-primary p-10 text-center sm:p-16">
          <div className="absolute inset-0 grid-bg opacity-30" aria-hidden="true" />
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <div className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl text-balance">
              Ready to bring your team together?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-white/80">
              Join thousands of teams building the future of their industry on Apogee.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button as={Link} to="/register" size="xl" className="bg-white !text-brand-700 hover:!bg-white/90" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Start free
              </Button>
              <Button as="a" href="mailto:sales@apogee.app" size="xl" variant="outline" className="border-white/30 !text-white hover:!bg-white/10">
                Talk to sales
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-muted)]/40">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-[var(--fg-subtle)]">
              The all-in-one workspace where modern teams plan, collaborate and ship faster.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
              <Shield className="h-3.5 w-3.5" /> SOC 2 Type II · GDPR ready
            </div>
          </div>
          {[
            { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'Changelog'] },
            { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
            { title: 'Legal', links: ['Privacy', 'Terms', 'Security'] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--fg-subtle)]">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:text-[var(--fg)] transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--fg-subtle)] sm:flex-row">
          <p>© {new Date().getFullYear()} Apogee. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Globe className="h-3.5 w-3.5" /> English
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <LandingNav />
      <main>
        <Hero />
        <LogoCloud />
        <Features />
        <Stats />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
