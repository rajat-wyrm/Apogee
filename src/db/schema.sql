-- =============================================================
-- APOGEE — Enterprise Productivity Platform
-- PostgreSQL schema (Neon 18). Multi-tenant, multi-workspace.
-- Idempotent: safe to run repeatedly.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =============================================================
-- 1. USERS
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  phone         TEXT,
  locale        TEXT DEFAULT 'en',
  timezone      TEXT DEFAULT 'UTC',
  status        TEXT NOT NULL DEFAULT 'active', -- active, suspended, invited
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  backup_codes TEXT[],
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  preferences   JSONB DEFAULT '{}'::jsonb,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm ON users USING gin (full_name gin_trgm_ops);

-- =============================================================
-- 2. OAUTH
-- =============================================================
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL, -- google, github, microsoft, apple
  provider_user_id TEXT NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  scope         TEXT,
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);

-- =============================================================
-- 3. REFRESH TOKENS / SESSIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  user_agent  TEXT,
  ip          TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);

-- =============================================================
-- 4. ORGANIZATIONS (tenants)
-- =============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  logo_url      TEXT,
  website       TEXT,
  industry      TEXT,
  size          TEXT, -- 1-10, 11-50, 51-200, 201-500, 500+
  plan          TEXT NOT NULL DEFAULT 'free', -- free, pro, enterprise
  plan_status   TEXT DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  billing_email CITEXT,
  settings      JSONB DEFAULT '{}'::jsonb,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_plan ON organizations(plan);

-- =============================================================
-- 5. WORKSPACES (sub-org grouping)
-- =============================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  color         TEXT DEFAULT '#6366f1',
  visibility    TEXT DEFAULT 'private', -- private, public
  archived_at   TIMESTAMPTZ,
  settings      JSONB DEFAULT '{}'::jsonb,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_org ON workspaces(organization_id);

-- =============================================================
-- 6. ORG MEMBERSHIPS (multi-tenant)
-- =============================================================
CREATE TABLE IF NOT EXISTS memberships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, guest
  status          TEXT NOT NULL DEFAULT 'active', -- active, invited, suspended
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  invited_by      UUID REFERENCES users(id),
  UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_membership_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_org ON memberships(organization_id);

-- =============================================================
-- 7. WORKSPACE MEMBERSHIPS
-- =============================================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member', -- lead, editor, commenter, viewer
  added_by      UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- =============================================================
-- 8. TEAMS
-- =============================================================
CREATE TABLE IF NOT EXISTS teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT DEFAULT '#6366f1',
  icon          TEXT,
  lead_id       UUID REFERENCES users(id),
  settings      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- =============================================================
-- 9. PROJECTS
-- =============================================================
CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  slug          TEXT,
  description   TEXT,
  icon          TEXT,
  color         TEXT DEFAULT '#6366f1',
  status        TEXT NOT NULL DEFAULT 'active', -- active, archived, completed, on_hold
  visibility    TEXT DEFAULT 'workspace', -- workspace, private, public
  start_date    DATE,
  target_date   DATE,
  progress      INT DEFAULT 0,
  view_type     TEXT DEFAULT 'kanban', -- kanban, list, calendar, timeline, gantt
  template_id   UUID,
  settings      JSONB DEFAULT '{}'::jsonb,
  metadata      JSONB DEFAULT '{}'::jsonb,
  owner_id      UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_status ON projects(status);

-- =============================================================
-- 10. PROJECT MEMBERS
-- =============================================================
CREATE TABLE IF NOT EXISTS project_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT DEFAULT 'contributor', -- lead, contributor, viewer
  added_by    UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- =============================================================
-- 11. STATUS / LABEL LIBRARIES
-- =============================================================
CREATE TABLE IF NOT EXISTS project_statuses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT DEFAULT '#94a3b8',
  category      TEXT DEFAULT 'todo', -- backlog, todo, in_progress, review, done, cancelled
  position      INT DEFAULT 0,
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS labels (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT DEFAULT '#6366f1',
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

-- =============================================================
-- 12. TASKS (issues, tickets, items)
-- =============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE,
  number          INT NOT NULL, -- human-friendly: PROJ-123
  title           TEXT NOT NULL,
  description     TEXT,
  status_id       UUID REFERENCES project_statuses(id) ON DELETE SET NULL,
  priority        TEXT DEFAULT 'medium', -- urgent, high, medium, low, none
  type            TEXT DEFAULT 'task', -- task, bug, feature, story, epic, subtask
  assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date      TIMESTAMPTZ,
  due_date        TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  estimate_minutes INT,
  spent_minutes   INT DEFAULT 0,
  story_points    INT,
  position        DOUBLE PRECISION DEFAULT 0,
  rank            TEXT, -- for lexorank ordering
  is_archived     BOOLEAN DEFAULT FALSE,
  is_pinned       BOOLEAN DEFAULT FALSE,
  is_blocked      BOOLEAN DEFAULT FALSE,
  blocked_reason  TEXT,
  recurrence      JSONB, -- RRULE
  attachments     JSONB DEFAULT '[]'::jsonb,
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_task_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_status ON tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_task_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_number ON tasks(project_id, number);
CREATE INDEX IF NOT EXISTS idx_task_position ON tasks(project_id, position);
CREATE INDEX IF NOT EXISTS idx_task_title_trgm ON tasks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_task_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_task_archived ON tasks(is_archived);

-- =============================================================
-- 13. TASK RELATIONS (depends, blocks, relates, duplicates)
-- =============================================================
CREATE TABLE IF NOT EXISTS task_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  relation      TEXT NOT NULL, -- blocks, blocked_by, relates_to, duplicates, duplicate_of
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, target_id, relation)
);

CREATE TABLE IF NOT EXISTS task_labels (
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id    UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- =============================================================
-- 14. COMMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS comments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  document_id   UUID,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  body          TEXT NOT NULL,
  body_html     TEXT,
  reactions     JSONB DEFAULT '{}'::jsonb,
  mentions      UUID[] DEFAULT '{}',
  attachments   JSONB DEFAULT '[]'::jsonb,
  is_edited     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_task ON comments(task_id);

-- =============================================================
-- 15. DOCUMENTS (Notion-style pages)
-- =============================================================
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES documents(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Untitled',
  icon            TEXT,
  cover_url       TEXT,
  content         JSONB DEFAULT '{}'::jsonb, -- Tiptap doc
  content_text    TEXT, -- plain text for search
  is_template     BOOLEAN DEFAULT FALSE,
  is_published    BOOLEAN DEFAULT FALSE,
  is_archived     BOOLEAN DEFAULT FALSE,
  position        DOUBLE PRECISION DEFAULT 0,
  path            TEXT, -- materialized breadcrumb
  last_edited_by  UUID REFERENCES users(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_doc_parent ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_doc_text_trgm ON documents USING gin (content_text gin_trgm_ops);

-- =============================================================
-- 16. WIKI / KNOWLEDGE BASE
-- =============================================================
CREATE TABLE IF NOT EXISTS wiki_spaces (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  visibility      TEXT DEFAULT 'private',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS wiki_pages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wiki_space_id   UUID NOT NULL REFERENCES wiki_spaces(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES wiki_pages(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         JSONB DEFAULT '{}'::jsonb,
  content_text    TEXT,
  slug            TEXT,
  version         INT DEFAULT 1,
  is_published    BOOLEAN DEFAULT FALSE,
  views_count     INT DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 17. WHITEBOARDS
-- =============================================================
CREATE TABLE IF NOT EXISTS whiteboards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  data            JSONB DEFAULT '{}'::jsonb,
  thumbnail_url   TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 18. GOALS / OKRs
-- =============================================================
CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES goals(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  owner_id        UUID REFERENCES users(id),
  metric_type     TEXT DEFAULT 'percentage', -- percentage, numeric, binary
  target_value    NUMERIC,
  current_value   NUMERIC DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  status          TEXT DEFAULT 'on_track', -- on_track, at_risk, off_track, completed
  progress        INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_key_results (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id       UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  target_value  NUMERIC,
  current_value NUMERIC DEFAULT 0,
  owner_id      UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 19. NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL, -- mention, assigned, due, comment, share, system
  title         TEXT NOT NULL,
  body          TEXT,
  icon          TEXT,
  link          TEXT,
  entity_type   TEXT, -- task, document, project, etc.
  entity_id     UUID,
  actor_id      UUID REFERENCES users(id),
  read_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  channel       TEXT DEFAULT 'inapp', -- inapp, email, push, sms
  data          JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_unread ON notifications(user_id) WHERE read_at IS NULL;

-- =============================================================
-- 20. AUDIT LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     UUID,
  ip            TEXT,
  user_agent    TEXT,
  diff          JSONB,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- =============================================================
-- 21. FILES / ATTACHMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploader_id   UUID REFERENCES users(id),
  filename      TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    BIGINT,
  url           TEXT NOT NULL,
  thumbnail_url TEXT,
  provider      TEXT DEFAULT 'cloudinary',
  provider_public_id TEXT,
  entity_type   TEXT,
  entity_id     UUID,
  folder        TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_org ON files(organization_id);

-- =============================================================
-- 22. SHARES / PUBLIC LINKS
-- =============================================================
CREATE TABLE IF NOT EXISTS shares (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  token         TEXT UNIQUE NOT NULL,
  password      TEXT,
  permission    TEXT DEFAULT 'view', -- view, comment, edit
  expires_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 23. BOOKMARKS / PINNED
-- =============================================================
CREATE TABLE IF NOT EXISTS bookmarks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  collection    TEXT DEFAULT 'inbox',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entity_type, entity_id)
);

-- =============================================================
-- 24. VIEWS / SAVED FILTERS
-- =============================================================
CREATE TABLE IF NOT EXISTS saved_views (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  name          TEXT NOT NULL,
  query         JSONB NOT NULL,
  is_shared     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 25. ACTIVITY FEED
-- =============================================================
CREATE TABLE IF NOT EXISTS activities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  verb          TEXT NOT NULL, -- created, updated, completed, commented, joined
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  target_type   TEXT,
  target_id     UUID,
  summary       TEXT,
  data          JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_org ON activities(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activities(workspace_id, created_at DESC);

-- =============================================================
-- 26. PRESENCE
-- =============================================================
CREATE TABLE IF NOT EXISTS presence (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'online', -- online, away, dnd, offline
  current_page  TEXT,
  socket_id     TEXT,
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  metadata      JSONB DEFAULT '{}'::jsonb
);

-- =============================================================
-- 27. TIME TRACKING
-- =============================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ,
  duration_seconds INT,
  description   TEXT,
  is_billable   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_user ON time_entries(user_id, started_at DESC);

-- =============================================================
-- 28. SCHEDULES / EVENTS (calendar)
-- =============================================================
CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ,
  all_day       BOOLEAN DEFAULT FALSE,
  timezone      TEXT DEFAULT 'UTC',
  location      TEXT,
  color         TEXT,
  type          TEXT DEFAULT 'event', -- event, milestone, reminder
  recurrence    JSONB,
  attendees     UUID[] DEFAULT '{}',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_org_time ON events(organization_id, start_at);

-- =============================================================
-- 29. FORMS (data collection)
-- =============================================================
CREATE TABLE IF NOT EXISTS forms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  schema        JSONB NOT NULL,
  settings      JSONB DEFAULT '{}'::jsonb,
  status        TEXT DEFAULT 'draft', -- draft, published, closed
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id       UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  data          JSONB NOT NULL,
  submitted_by  UUID REFERENCES users(id),
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 30. AUTOMATIONS / RULES
-- =============================================================
CREATE TABLE IF NOT EXISTS automations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  trigger       JSONB NOT NULL, -- {type, config}
  conditions    JSONB DEFAULT '[]'::jsonb,
  actions       JSONB NOT NULL, -- [{type, config}]
  enabled       BOOLEAN DEFAULT TRUE,
  run_count     INT DEFAULT 0,
  last_run_at   TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'success', -- success, failed, skipped
  logs          JSONB DEFAULT '[]'::jsonb,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  finished_at   TIMESTAMPTZ
);

-- =============================================================
-- 31. TEMPLATES
-- =============================================================
CREATE TABLE IF NOT EXISTS templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type          TEXT NOT NULL, -- project, task, document, workspace
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  is_public     BOOLEAN DEFAULT FALSE,
  payload       JSONB NOT NULL,
  category      TEXT,
  tags          TEXT[],
  uses_count    INT DEFAULT 0,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 32. INTEGRATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS integrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL, -- slack, github, linear, jira, google, figma
  config          JSONB DEFAULT '{}'::jsonb,
  credentials     JSONB DEFAULT '{}'::jsonb, -- encrypted in app layer
  status          TEXT DEFAULT 'active',
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, provider)
);

-- =============================================================
-- 33. WEBHOOKS (outbound)
-- =============================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,
  events          TEXT[] NOT NULL,
  active          BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id    UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event         TEXT NOT NULL,
  payload       JSONB,
  response_code INT,
  response_body TEXT,
  status        TEXT, -- success, failed, pending
  attempt       INT DEFAULT 1,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 34. SUBSCRIPTIONS / BILLING
-- =============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_id       TEXT UNIQUE,
  plan            TEXT NOT NULL, -- free, pro, enterprise
  status          TEXT NOT NULL, -- active, trialing, past_due, canceled, unpaid
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  seats           INT DEFAULT 1,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_id       TEXT UNIQUE,
  number          TEXT,
  amount_due      INT,
  amount_paid     INT,
  currency        TEXT DEFAULT 'usd',
  status          TEXT,
  hosted_url      TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 35. API KEYS
-- =============================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  prefix        TEXT NOT NULL,
  hash          TEXT NOT NULL,
  scopes        TEXT[] DEFAULT '{}',
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 36. FEATURE FLAGS
-- =============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key           TEXT UNIQUE NOT NULL,
  description   TEXT,
  enabled       BOOLEAN DEFAULT FALSE,
  rollout_percentage INT DEFAULT 0,
  config        JSONB DEFAULT '{}'::jsonb,
  updated_by    UUID REFERENCES users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 37. REPORTS / SAVED DASHBOARDS
-- =============================================================
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id      UUID REFERENCES users(id),
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT DEFAULT 'dashboard', -- dashboard, chart, list
  layout        JSONB NOT NULL,
  is_shared     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 38. HELPDESK / TICKETS
-- =============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  requester_id    UUID REFERENCES users(id),
  assignee_id     UUID REFERENCES users(id),
  subject         TEXT NOT NULL,
  description     TEXT,
  priority        TEXT DEFAULT 'normal',
  status          TEXT DEFAULT 'open',
  source          TEXT DEFAULT 'email', -- email, web, api, chat
  tags            TEXT[],
  first_response_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 39. AI USAGE / CACHE
-- =============================================================
CREATE TABLE IF NOT EXISTS ai_usage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  feature       TEXT NOT NULL,
  provider      TEXT,
  model         TEXT,
  prompt_tokens INT,
  completion_tokens INT,
  cost          NUMERIC DEFAULT 0,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org ON ai_usage(organization_id, created_at DESC);

-- =============================================================
-- 40. IMPORTS / EXPORTS
-- =============================================================
CREATE TABLE IF NOT EXISTS import_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  type          TEXT NOT NULL, -- tasks, projects, contacts
  status        TEXT DEFAULT 'pending', -- pending, running, done, failed
  source        TEXT, -- csv, json, jira, asana
  total         INT DEFAULT 0,
  processed     INT DEFAULT 0,
  failed        INT DEFAULT 0,
  errors        JSONB DEFAULT '[]'::jsonb,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  type          TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  url           TEXT,
  filters       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 41. EMBEDS
-- =============================================================
CREATE TABLE IF NOT EXISTS embeds (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  url           TEXT NOT NULL,
  provider      TEXT,
  oembed        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 42. CHANNELS (chat)
-- =============================================================
CREATE TABLE IF NOT EXISTS channels (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  topic         TEXT,
  visibility    TEXT DEFAULT 'public',
  is_private    BOOLEAN DEFAULT FALSE,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id    UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT DEFAULT 'member',
  last_read_at  TIMESTAMPTZ,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id    UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES users(id),
  body          TEXT NOT NULL,
  parent_id     UUID REFERENCES messages(id) ON DELETE CASCADE,
  attachments   JSONB DEFAULT '[]'::jsonb,
  reactions     JSONB DEFAULT '{}'::jsonb,
  edited_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_channel ON messages(channel_id, created_at DESC);

-- =============================================================
-- TRIGGERS
-- =============================================================
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','organizations','workspaces','teams','projects','tasks','comments','documents','wiki_pages','whiteboards','goals','events','forms','automations','templates','webhooks','subscriptions','reports','tickets','channels']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch ON %I; CREATE TRIGGER trg_%I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();', t, t, t, t);
  END LOOP;
END $$;

-- Updated_at triggers for tables that don't have updated_at column
DO $$
DECLARE t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- =============================================================
-- DONE
-- =============================================================
