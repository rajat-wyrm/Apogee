# Apogee 4.0

> The all-in-one enterprise productivity platform. Project management, CRM, collaboration, AI — built for teams that move fast.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-22-green)
![Tests](https://img.shields.io/badge/tests-100%25%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-purple)

## Overview

Apogee is a full-stack SaaS platform that combines project management, an industrial CRM, real-time collaboration, and AI-powered assistance into a single, blazingly fast application. Built for teams of 10-600 members, it scales from startup to enterprise without compromise.

**Why Apogee?**
- **All-in-one** — Projects, tasks, docs, CRM, wiki, helpdesk, whiteboard, calendar, automations, analytics
- **Industrial CRM** — Companies, contacts, pipelines, deals, leads, activities, quotes with full conversion workflows
- **Real-time** — Socket.IO for presence, notifications, live collaboration
- **AI-native** — Multi-provider AI assistant (Groq, OpenAI, Gemini, DeepSeek, HuggingFace, Anthropic) with automatic fallback
- **Offline-ready** — PWA with service worker, 1758 KiB precached
- **Enterprise-grade** — 2FA, SSO, RBAC, audit logs, encryption, compliance-ready

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 14+ (or Neon serverless)
- Redis (or Upstash REST)

### Installation

```bash
# Clone
git clone https://github.com/rajat-wyrm/apogee.git
cd apogee

# Backend
npm install
cp .env.example .env  # edit with your credentials
npm run migrate        # run database migrations
npm run seed           # seed initial data
npm run dev            # start on http://localhost:5050

# Frontend (in another terminal)
cd apps/web
npm install
npm run dev            # start on http://localhost:5173
```

### Docker

```bash
docker compose up -d
```

### Default Admin

```
Email:    admin@apogee.dev
Password: Admin123!
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                       │
│  Vite 6 · Tailwind 4 · Tiptap · Framer Motion · PWA         │
├─────────────────────────────────────────────────────────────┤
│                    Backend (Node.js 22)                      │
│  Express · Socket.IO · BullMQ · Passport · Helmet           │
├─────────────────────────────────────────────────────────────┤
│                   Data Layer                                 │
│  PostgreSQL (Neon) · Redis (Upstash) · Cloudinary            │
└─────────────────────────────────────────────────────────────┘
```

## Modules

### Core Platform (30+ modules)
| Module | Description |
|--------|-------------|
| **Auth** | JWT, OAuth (Google, GitHub, Microsoft), 2FA TOTP, password reset, account lockout |
| **Organizations** | Multi-org, member management, RBAC, usage stats, audit logs |
| **Workspaces** | Team workspaces with member management |
| **Projects** | Project CRUD, statuses, members, templates |
| **Tasks** | Full task management, comments, time tracking, links, bulk ops |
| **Documents** | Rich-text docs, page hierarchy, versions, backlinks, synced blocks |
| **Notifications** | Real-time, preferences, digest, push |
| **Search** | Global search across all entities |
| **Analytics** | Dashboards, trends, productivity, workload |
| **AI** | Multi-provider assistant with usage tracking |
| **Webhooks** | Outgoing webhooks with delivery tracking |
| **Admin** | User management, feature flags, audit logs |
| **Billing** | Plans, subscriptions, invoices, Stripe integration |
| **Files** | Cloudinary-powered file uploads, sharing |
| **Reports** | Custom reports, exports |

### Industrial CRM
| Entity | Features |
|--------|----------|
| **Companies** | Full CRUD, search, tags, industry, revenue, addresses, social links |
| **Contacts** | Full CRUD, lifecycle stages (lead → MQL → SQL → customer), scoring, activity tracking |
| **Pipelines** | Customizable stages with probability %, color coding, default pipeline |
| **Deals** | Full CRUD, drag-drop stage moves, win/loss tracking, value forecasting |
| **Leads** | Capture, score, one-click conversion to contact/company/deal |
| **Activities** | Calls, emails, meetings, tasks with due dates, outcomes, duration |
| **Quotes** | Line items, tax, discount, auto-numbered, send/accept workflow |
| **Dashboard** | Pipeline value, won revenue, deals by stage, top deals, KPIs |

### Collaboration
| Module | Description |
|--------|-------------|
| **Teams** | Team management with roles |
| **Calendar** | Events, agenda, scheduling |
| **Whiteboards** | Collaborative whiteboard editor |
| **Wiki** | Knowledge base with spaces and pages |
| **Helpdesk** | Ticket management, SLA, service portal |
| **Automations** | Rule engine with triggers and actions |
| **Goals** | OKR tracking with key results |
| **Forms** | Form builder with submissions |
| **Templates** | Reusable project/document templates |
| **Time** | Time tracking, timers, reports |
| **Shares** | Public link sharing |
| **Presence** | Real-time user presence |
| **Labels** | Color-coded labels with task assignment |

### Advanced (Phase 2)
| Module | Description |
|--------|-------------|
| **Sprints** | Agile sprint management with burndown charts |
| **Epics** | Large initiative tracking |
| **Releases** | Version management |
| **Components** | Project component tracking |
| **Workflows** | Custom workflow definitions |
| **Custom Fields** | Per-entity custom fields |
| **Approvals** | Multi-step approval workflows |
| **SLA** | Service level agreement policies |
| **Roadmap** | Product roadmap planning |
| **Capacity** | Team capacity planning |
| **KB** | Knowledge base with categories |
| **Service Queues** | Jira-like service desk |
| **CSAT** | Customer satisfaction surveys |
| **CMDB/Assets** | IT asset management |
| **Changes** | Change management |
| **Incidents** | Incident response |
| **Dashboards** | Custom dashboards |
| **Export Jobs** | CSV/JSON/PDF exports |
| **SSO/SCIM** | Enterprise SSO provisioning |
| **Incoming Webhooks** | Third-party integrations |

## API Reference

### Authentication
```bash
# Register
POST /api/auth/register
{ "email": "user@example.com", "password": "SecurePass1!", "full_name": "John Doe" }

# Login
POST /api/auth/login
{ "email": "user@example.com", "password": "SecurePass1!" }
# Returns: { access, refresh, user, organization, workspace }

# Google OAuth
GET /api/oauth/google  # redirects to Google

# Refresh token
POST /api/auth/refresh
{ "refresh_token": "..." }
```

### CRM
```bash
# Create company
POST /api/crm/companies?organization_id=...
{ "name": "Acme Corp", "domain": "acme.com", "industry": "Technology" }

# Create deal
POST /api/crm/deals?organization_id=...
{ "title": "Big Deal", "pipeline_id": "...", "stage_id": "...", "value": 50000 }

# Convert lead
POST /api/crm/leads/:id/convert?organization_id=...
```

### Full API
All endpoints return JSON in this format:
```json
{
  "success": true,
  "data": { ... }
}
```

Errors:
```json
{
  "success": false,
  "error": { "message": "...", "code": "..." }
}
```

## Testing

```bash
# Run all tests
node tests/e2e-auth.test.js
node tests/e2e-organizations.test.js
node tests/e2e-all-modules.test.js
node tests/e2e-crm.test.js
node tests/e2e-world-class.test.js
```

Test results:
- **Auth E2E:** 61/61 (100%)
- **Organizations E2E:** 43/44 (97.7%)
- **All Modules E2E:** 60/60 (100%)
- **CRM E2E:** 26/26 (100%)
- **World-Class E2E:** 58/58 (100%)

## Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure `DATABASE_URL` with connection pooling
- [ ] Set `JWT_SECRET` and `JWT_REFRESH_SECRET` to strong random values
- [ ] Configure Stripe live keys
- [ ] Set up Cloudinary production credentials
- [ ] Configure Upstash Redis
- [ ] Set up email SMTP
- [ ] Configure OAuth providers (Google, GitHub, Microsoft)
- [ ] Enable HTTPS
- [ ] Set up monitoring (Sentry, DataDog, etc.)
- [ ] Configure backups

### Environment Variables

```env
# Core
NODE_ENV=production
PORT=5000
APP_URL=https://app.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com

# Database
DATABASE_URL=postgresql://...
DB_SCHEMA=apogee
DB_POOL_MAX=20

# Auth
JWT_SECRET=your-strong-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/api/oauth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# AI Providers
GROQ_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
DEEPSEEK_API_KEY=...
HUGGINGFACE_API_KEY=...
ANTHROPIC_API_KEY=...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=apogee

# Email
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_OAUTH=true
ENABLE_2FA=true
ENABLE_AI=true
ENABLE_BILLING=true
```

## Performance

- **Compression:** Brotli + Gzip
- **Connection pooling:** With retry logic and non-blocking warm-up
- **PWA:** 1758 KiB precached, offline-first
- **Code splitting:** Vendor, UI, data, editor, charts chunks
- **Image optimization:** Cloudinary transformations
- **Search:** Full-text search with indexes
- **Caching:** Redis-backed response caching

## Security

- **Authentication:** JWT with refresh token rotation
- **Authorization:** RBAC with org/workspace/project levels
- **2FA:** TOTP with backup codes
- **OAuth:** Google, GitHub, Microsoft
- **Rate limiting:** Auth brute-force protection (50/15min per IP+email)
- **SQL injection:** Parameterized queries throughout
- **XSS:** Content Security Policy, input sanitization
- **CORS:** Configured allowed origins
- **Helmet:** Security headers
- **Audit logging:** All sensitive operations

## UI/UX

- **Responsive:** Mobile-first, works on all screen sizes
- **Dark mode:** System/light/dark with smooth transitions
- **Animations:** Framer Motion for delightful micro-interactions
- **Accessibility:** ARIA labels, keyboard navigation, focus management
- **Loading states:** Skeleton loaders, spinners
- **Empty states:** Helpful messages with CTAs
- **Error handling:** Toast notifications, retry buttons
- **Search:** Instant search with debouncing
- **Command palette:** Keyboard-driven navigation (Cmd+K)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with love using:
- [Express](https://expressjs.com/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Tiptap](https://tiptap.dev/)
- [Framer Motion](https://www.framer.com/motion/)
- [Socket.IO](https://socket.io/)
- [Neon](https://neon.tech/)
- [Upstash](https://upstash.com/)
- [Cloudinary](https://cloudinary.com/)

---

**Apogee** — *The all-in-one productivity platform for modern teams.*

Built with dedication by the Apogee team.
