-- =============================================================
-- APOGEE 3.5 — Phase 2 features
-- =============================================================

-- 1. KNOWLEDGE BASE (public-facing self-service)
CREATE TABLE IF NOT EXISTS kb_categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT,
  description     TEXT,
  icon            TEXT,
  parent_id       UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
  position        INT DEFAULT 0,
  is_public       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  slug            TEXT,
  content         JSONB,
  content_text    TEXT,
  excerpt         TEXT,
  author_id       UUID REFERENCES users(id),
  status          TEXT DEFAULT 'draft', -- draft, published, archived
  views           INT DEFAULT 0,
  helpful_count   INT DEFAULT 0,
  not_helpful_count INT DEFAULT 0,
  search_keywords TEXT[],
  related_articles UUID[] DEFAULT '{}',
  translations     JSONB DEFAULT '{}'::jsonb,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_articles_workspace ON kb_articles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);

-- 2. SERVICE QUEUES (enhanced helpdesk)
CREATE TABLE IF NOT EXISTS service_queues (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT DEFAULT '#6366f1',
  icon            TEXT,
  default_assignee_id UUID REFERENCES users(id),
  sla_policy_id   UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
  auto_assign     BOOLEAN DEFAULT FALSE,
  auto_assign_strategy TEXT DEFAULT 'round_robin', -- round_robin, load_balanced, least_loaded
  public_email    TEXT,
  is_public       BOOLEAN DEFAULT FALSE, -- public-facing portal
  greeting        TEXT,
  instructions    TEXT,
  position        INT DEFAULT 0,
  enabled         BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_queues_workspace ON service_queues(workspace_id);

-- 3. CANNED RESPONSES (for helpdesk)
CREATE TABLE IF NOT EXISTS canned_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  shortcut        TEXT,
  category        TEXT,
  usage_count     INT DEFAULT 0,
  author_id       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TICKET MACROS
CREATE TABLE IF NOT EXISTS ticket_macros (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  actions         JSONB NOT NULL, -- [{type: 'set_status', value: 'resolved'}, {type: 'add_comment', value: '...'}]
  enabled         BOOLEAN DEFAULT TRUE,
  usage_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CSAT SURVEYS (Customer Satisfaction)
CREATE TABLE IF NOT EXISTS csat_surveys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id       UUID REFERENCES tickets(id) ON DELETE CASCADE,
  customer_email  TEXT,
  customer_name   TEXT,
  rating          INT, -- 1-5
  nps_score       INT, -- 0-10
  comment         TEXT,
  token           TEXT UNIQUE NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_csat_ticket ON csat_surveys(ticket_id);

-- 6. ASSETS / CMDB
CREATE TABLE IF NOT EXISTS assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  asset_tag       TEXT,
  type            TEXT NOT NULL, -- hardware, software, service, network, facility
  category        TEXT,
  status          TEXT DEFAULT 'in_stock', -- in_stock, deployed, in_repair, retired, lost
  manufacturer    TEXT,
  model           TEXT,
  serial_number   TEXT,
  version         TEXT,
  vendor          TEXT,
  purchase_date   DATE,
  purchase_cost   NUMERIC,
  warranty_end    DATE,
  assigned_to_id  UUID REFERENCES users(id),
  location        TEXT,
  ip_address      TEXT,
  mac_address     TEXT,
  specifications  JSONB DEFAULT '{}'::jsonb,
  notes           TEXT,
  parent_id       UUID REFERENCES assets(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assets_workspace ON assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);

-- 7. CHANGES (Change Management)
CREATE TABLE IF NOT EXISTS changes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  type            TEXT DEFAULT 'standard', -- emergency, standard, normal
  category        TEXT, -- infrastructure, application, security, etc.
  risk            TEXT DEFAULT 'medium', -- low, medium, high
  impact         TEXT, -- low, medium, high
  status         TEXT DEFAULT 'draft', -- draft, review, approved, scheduled, implementing, completed, failed, cancelled
  change_reason  TEXT,
  change_plan    TEXT,
  rollback_plan  TEXT,
  risk_assessment TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end  TIMESTAMPTZ,
  actual_start   TIMESTAMPTZ,
  actual_end     TIMESTAMPTZ,
  requester_id   UUID REFERENCES users(id),
  assignee_id    UUID REFERENCES users(id),
  approver_id    UUID REFERENCES users(id),
  related_assets UUID[] DEFAULT '{}',
  related_tickets UUID[] DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_changes_workspace ON changes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_changes_status ON changes(status);

-- 8. INCIDENTS
CREATE TABLE IF NOT EXISTS incidents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id       UUID REFERENCES tickets(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  severity        TEXT DEFAULT 'medium', -- low, medium, high, critical
  status          TEXT DEFAULT 'open', -- open, investigating, identified, monitoring, resolved, closed
  category        TEXT, -- outage, degradation, security, data_loss
  commander_id    UUID REFERENCES users(id), -- incident commander
  resolved_at     TIMESTAMPTZ,
  post_mortem_id  UUID,
  timeline        JSONB DEFAULT '[]'::jsonb,
  affected_services TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DASHBOARDS
CREATE TABLE IF NOT EXISTS dashboards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  layout          JSONB NOT NULL, -- {rows: [[{widget_id, x, y, w, h, config}], ...]}
  is_default      BOOLEAN DEFAULT FALSE,
  is_shared       BOOLEAN DEFAULT FALSE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. DASHBOARD WIDGETS
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id    UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type            TEXT NOT NULL, -- kpi, line_chart, bar_chart, pie_chart, list, burndown, burnup, velocity, cfd, leaderboard, recent_activity, text
  title           TEXT NOT NULL,
  config          JSONB DEFAULT '{}'::jsonb, -- {data_source, filters, group_by, time_range, etc.}
  position        JSONB NOT NULL, -- {x, y, w, h}
  data_cache      JSONB, -- cached data for performance
  data_cache_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);

-- 11. INTEGRATION SYNC (for GitHub, Slack, etc.)
CREATE TABLE IF NOT EXISTS integration_syncs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES integrations_v2(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL, -- task, project, ticket
  entity_id       UUID NOT NULL,
  external_id     TEXT NOT NULL,
  external_url    TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  last_synced_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_integration_syncs_external ON integration_syncs(integration_id, external_id);

-- 12. INTEGRATION WEBHOOKS (incoming)
CREATE TABLE IF NOT EXISTS integration_webhooks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES integrations_v2(id) ON DELETE CASCADE,
  external_id     TEXT,
  event_type      TEXT NOT NULL,
  payload         JSONB,
  status          TEXT DEFAULT 'pending',
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. INCOMING WEBHOOK ENDPOINTS (for external integrations)
CREATE TABLE IF NOT EXISTS incoming_webhooks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  token           TEXT UNIQUE NOT NULL,
  source          TEXT NOT NULL, -- github, slack, jira, custom
  events          TEXT[] DEFAULT '{}',
  secret          TEXT,
  enabled         BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. ADVANCED AUTOMATIONS (enhanced)
ALTER TABLE automations ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS ai_prompt TEXT;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS run_count_success INT DEFAULT 0;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS run_count_failure INT DEFAULT 0;

-- 15. PUBLIC PAGES
CREATE TABLE IF NOT EXISTS public_pages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_type       TEXT NOT NULL, -- document, kb_article, form, ticket_portal
  page_id         UUID NOT NULL,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  password_hash   TEXT, -- for password-protected sharing
  expires_at      TIMESTAMPTZ,
  allow_indexing  BOOLEAN DEFAULT FALSE,
  views           INT DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_type, page_id, token)
);
CREATE INDEX IF NOT EXISTS idx_public_pages_token ON public_pages(token);

-- 16. GUEST ACCOUNTS
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_workspaces UUID[] DEFAULT '{}';
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS guest BOOLEAN DEFAULT FALSE;

-- 17. SAML SSO
CREATE TABLE IF NOT EXISTS sso_configs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL, -- saml, oidc
  metadata_url    TEXT,
  entity_id       TEXT,
  sso_url         TEXT,
  certificate     TEXT,
  config          JSONB DEFAULT '{}'::jsonb,
  enabled         BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, provider)
);

-- 18. SCIM PROVISIONING
CREATE TABLE IF NOT EXISTS scim_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  endpoint_url    TEXT,
  enabled         BOOLEAN DEFAULT TRUE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- 19. APPROVAL CHAINS
CREATE TABLE IF NOT EXISTS approval_chains (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  steps           JSONB NOT NULL, -- [{approver_id, required, condition}]
  entity_type     TEXT NOT NULL,
  conditions      JSONB DEFAULT '{}'::jsonb,
  enabled         BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. ATTACHMENTS (enhanced)
CREATE TABLE IF NOT EXISTS attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      BIGINT,
  url             TEXT NOT NULL,
  thumbnail_url   TEXT,
  uploader_id     UUID REFERENCES users(id),
  entity_type     TEXT, -- document, task, ticket, comment
  entity_id       UUID,
  page_id         UUID,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

-- 21. PAGE ANALYTICS
CREATE TABLE IF NOT EXISTS page_analytics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_type       TEXT NOT NULL,
  page_id         UUID NOT NULL,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL, -- view, edit, share, comment
  duration_seconds INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_analytics_page ON page_analytics(page_type, page_id);
CREATE INDEX IF NOT EXISTS idx_page_analytics_workspace ON page_analytics(workspace_id, created_at DESC);

-- 22. EXPORT QUEUE (async exports for large data)
CREATE TABLE IF NOT EXISTS export_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  type            TEXT NOT NULL, -- pdf, csv, json, excel
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  filters         JSONB DEFAULT '{}'::jsonb,
  status          TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  progress        INT DEFAULT 0,
  url             TEXT,
  expires_at      TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. NOTIFICATION DIGEST
CREATE TABLE IF NOT EXISTS notification_digest (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  frequency       TEXT NOT NULL, -- instant, hourly, daily, weekly
  enabled         BOOLEAN DEFAULT TRUE,
  last_sent_at    TIMESTAMPTZ,
  next_send_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. FAVORITES
CREATE TABLE IF NOT EXISTS favorites (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  position        INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- 25. TAGS (universal)
CREATE TABLE IF NOT EXISTS tags (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT DEFAULT '#6366f1',
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS tag_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, entity_type, entity_id)
);

-- 26. NOTIFICATION RULES (granular)
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb;

-- 27. TICKET COMMENTS (enhanced)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- 28. BLOCK COMMENTS
CREATE TABLE IF NOT EXISTS block_comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  block_id        TEXT NOT NULL, -- Tiptap block ID
  author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  parent_id       UUID REFERENCES block_comments(id) ON DELETE CASCADE,
  reactions       JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_block_comments_document ON block_comments(document_id);

-- 29. TYPING / CURSORS (real-time)
CREATE TABLE IF NOT EXISTS presence_cursors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_type       TEXT NOT NULL, -- document, task, project
  page_id         UUID NOT NULL,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cursor_position JSONB, -- {block_id, offset, selection}
  last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_type, page_id, user_id)
);

-- 30. MENTION NOTIFICATIONS
CREATE TABLE IF NOT EXISTS mentions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type     TEXT NOT NULL, -- document, task, comment
  source_id       UUID NOT NULL,
  mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  context         TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user_id, read_at);

-- Triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['kb_categories','kb_articles','service_queues','canned_responses','ticket_macros','csat_surveys','assets','changes','incidents','dashboards','dashboard_widgets','integration_syncs','integration_webhooks','incoming_webhooks','public_pages','sso_configs','scim_tokens','approval_chains','attachments','page_analytics','export_jobs','notification_digest','favorites','tags','tag_assignments','block_comments','presence_cursors','mentions'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch ON %I; CREATE TRIGGER trg_%I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();', t, t, t, t);
  END LOOP;
END $$;

-- =============================================================
-- DONE
-- =============================================================
