-- =============================================================
-- APOGEE 3.0 — Advanced features (sprints, epics, releases, workflows, custom fields, SLAs, approvals)
-- Idempotent: safe to run repeatedly.
-- =============================================================

-- 1. EPICS (hierarchy above tasks)
CREATE TABLE IF NOT EXISTS epics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT DEFAULT '#8b5cf6',
  status          TEXT DEFAULT 'open', -- open, in_progress, done, cancelled
  owner_id        UUID REFERENCES users(id),
  start_date      DATE,
  end_date        DATE,
  progress        INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_epics_workspace ON epics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_epics_project ON epics(project_id);
CREATE INDEX IF NOT EXISTS idx_epics_status ON epics(status);

-- 2. RELEASES / VERSIONS
CREATE TABLE IF NOT EXISTS releases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  version         TEXT,
  status          TEXT DEFAULT 'unreleased', -- unreleased, released, archived
  release_date    DATE,
  released_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_releases_workspace ON releases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_releases_project ON releases(project_id);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);

-- Add release_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES epics(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES releases(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points INT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS fix_version_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS affected_version_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS component_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS environment TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS security_level TEXT DEFAULT 'standard';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- 3. SPRINTS
CREATE TABLE IF NOT EXISTS sprints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  goal            TEXT,
  status          TEXT DEFAULT 'future', -- future, active, completed
  start_date      DATE,
  end_date        DATE,
  capacity_hours  NUMERIC DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);

-- 4. SPRINT ISSUES (which tasks are in which sprint)
CREATE TABLE IF NOT EXISTS sprint_tasks (
  sprint_id  UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (sprint_id, task_id)
);

-- 5. COMPONENTS
CREATE TABLE IF NOT EXISTS components (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  lead_id         UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_components_project ON components(project_id);

-- 6. CUSTOM FIELDS
CREATE TABLE IF NOT EXISTS custom_fields (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL, -- task, project, document, ticket
  name            TEXT NOT NULL,
  key             TEXT NOT NULL,
  type            TEXT NOT NULL, -- text, number, date, select, multi_select, checkbox, url, email, user, users, formula
  options         JSONB DEFAULT '[]'::jsonb, -- for select/multi_select
  config          JSONB DEFAULT '{}'::jsonb, -- for formula: { expression }
  required        BOOLEAN DEFAULT FALSE,
  description     TEXT,
  position        INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity ON custom_fields(workspace_id, entity_type);

-- 7. CUSTOM FIELD VALUES
CREATE TABLE IF NOT EXISTS custom_field_values (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id        UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  value_text      TEXT,
  value_number    NUMERIC,
  value_date      DATE,
  value_json      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cfv_entity ON custom_field_values(entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfv_field_entity ON custom_field_values(field_id, entity_id);

-- 8. WORKFLOWS (custom status transitions)
CREATE TABLE IF NOT EXISTS workflows (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  entity_type     TEXT NOT NULL DEFAULT 'task',
  description     TEXT,
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_statuses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'todo', -- backlog, todo, in_progress, review, done, cancelled
  color           TEXT DEFAULT '#94a3b8',
  position        INT DEFAULT 0,
  is_initial      BOOLEAN DEFAULT FALSE,
  is_final        BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_wf_statuses_workflow ON workflow_statuses(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_transitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_status_id  UUID NOT NULL REFERENCES workflow_statuses(id) ON DELETE CASCADE,
  to_status_id    UUID NOT NULL REFERENCES workflow_statuses(id) ON DELETE CASCADE,
  name            TEXT,
  conditions      JSONB DEFAULT '[]'::jsonb,
  validators      JSONB DEFAULT '[]'::jsonb,
  post_functions  JSONB DEFAULT '[]'::jsonb,
  position        INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wf_transitions_workflow ON workflow_transitions(workflow_id);

-- 9. APPROVALS
CREATE TABLE IF NOT EXISTS approvals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL, -- task, document, release
  entity_id       UUID NOT NULL,
  requester_id    UUID REFERENCES users(id),
  status          TEXT DEFAULT 'pending', -- pending, approved, rejected, cancelled
  title           TEXT NOT NULL,
  description     TEXT,
  required_count  INT DEFAULT 1,
  due_date        TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approvals_entity ON approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_id   UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  approver_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision      TEXT NOT NULL, -- approved, rejected
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_decisions ON approval_decisions(approval_id);

-- 10. SLA POLICIES
CREATE TABLE IF NOT EXISTS sla_policies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  entity_type     TEXT DEFAULT 'ticket',
  conditions      JSONB DEFAULT '[]'::jsonb,
  response_time_minutes INT,
  resolution_time_minutes INT,
  enabled         BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_tracking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id       UUID NOT NULL REFERENCES sla_policies(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_due_at TIMESTAMPTZ,
  resolution_due_at TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  response_breached BOOLEAN DEFAULT FALSE,
  resolution_breached BOOLEAN DEFAULT FALSE,
  paused          BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_entity ON sla_tracking(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_breached ON sla_tracking(response_breached, resolution_breached);

-- 11. PAGE VERSIONS (for documents)
CREATE TABLE IF NOT EXISTS page_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  title           TEXT,
  content         JSONB,
  content_text    TEXT,
  author_id       UUID REFERENCES users(id),
  change_summary  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_versions ON page_versions(document_id, version DESC);

-- 12. PAGE REACTIONS
CREATE TABLE IF NOT EXISTS page_reactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_type     TEXT NOT NULL, -- document, comment, task
  page_id       UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_type, page_id, user_id, emoji)
);

-- 13. BACKLINKS (cross-references)
CREATE TABLE IF NOT EXISTS backlinks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type   TEXT NOT NULL, -- document, task, project
  source_id     UUID NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     UUID NOT NULL,
  context       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_backlinks_target ON backlinks(target_type, target_id);

-- 14. SYNCED BLOCKS
CREATE TABLE IF NOT EXISTS synced_blocks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  content         JSONB NOT NULL,
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. SAVED VIEWS (extended)
CREATE TABLE IF NOT EXISTS views (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL, -- task, document, project, ticket
  entity_id       UUID, -- optional: specific project/board
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'list', -- list, board, calendar, gallery, timeline, table, gantt
  config          JSONB DEFAULT '{}'::jsonb, -- filters, sorts, groups, columns, hidden_fields
  is_shared       BOOLEAN DEFAULT FALSE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_views_entity ON views(entity_type, entity_id);

-- 16. SAVED FILTERS (JQL-equivalent)
CREATE TABLE IF NOT EXISTS saved_filters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  jql             TEXT NOT NULL, -- our query language
  description     TEXT,
  is_shared       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. ROADMAP / TIMELINE ENTRIES
CREATE TABLE IF NOT EXISTS roadmap_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  start_date      DATE,
  end_date        DATE,
  color           TEXT DEFAULT '#6366f1',
  category        TEXT, -- now, next, later, released
  progress        INT DEFAULT 0,
  parent_id       UUID REFERENCES roadmap_items(id) ON DELETE CASCADE,
  bar_type        TEXT DEFAULT 'bar', -- bar, milestone
  dependencies    JSONB DEFAULT '[]'::jsonb, -- array of {item_id, type: 'FS'|'SS'|'FF'|'SF'}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_roadmap_workspace ON roadmap_items(workspace_id);

-- 18. SATISFACTION SURVEYS
CREATE TABLE IF NOT EXISTS csat_surveys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  customer_email  TEXT,
  customer_name   TEXT,
  rating          INT, -- 1-5
  comment         TEXT,
  token           TEXT UNIQUE NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ
);

-- 19. NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS notification_prefs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL DEFAULT 'inapp', -- inapp, email, push, sms, slack
  event_type      TEXT NOT NULL, -- task.assigned, task.completed, mention, etc.
  enabled         BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, workspace_id, channel, event_type)
);

-- 20. GUEST ACCOUNTS
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS guest_workspace_ids UUID[] DEFAULT '{}';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS publish_token TEXT;

-- 21. INTEGRATIONS
CREATE TABLE IF NOT EXISTS integrations_v2 (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL, -- slack, github, google, figma, jira, linear, gitlab, bitbucket, teams, discord
  status          TEXT DEFAULT 'active',
  config          JSONB DEFAULT '{}'::jsonb,
  credentials     JSONB DEFAULT '{}'::jsonb, -- encrypted
  last_sync_at    TIMESTAMPTZ,
  sync_cursor     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES integrations_v2(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB,
  status          TEXT DEFAULT 'pending',
  attempt         INT DEFAULT 0,
  error           TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_integration_events ON integration_events(integration_id, status);

-- 22. QUEUES (for service desk)
CREATE TABLE IF NOT EXISTS support_queues (
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
  public_email    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. CAPACITY
CREATE TABLE IF NOT EXISTS capacity (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sprint_id       UUID REFERENCES sprints(id) ON DELETE CASCADE,
  hours           NUMERIC NOT NULL DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sprint_id)
);

-- 24. REACTIONS (extended to comments and tasks)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- 25. REPORTS (extended with scheduled)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS schedule TEXT; -- cron expression
ALTER TABLE reports ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS subscribers UUID[] DEFAULT '{}';

-- 26. KNOWLEDGE BASE (for service desk)
CREATE TABLE IF NOT EXISTS kb_articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         JSONB,
  content_text    TEXT,
  slug            TEXT,
  category        TEXT,
  views           INT DEFAULT 0,
  helpful_count   INT DEFAULT 0,
  not_helpful_count INT DEFAULT 0,
  is_published    BOOLEAN DEFAULT FALSE,
  author_id       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. ASSETS (CMDB)
CREATE TABLE IF NOT EXISTS assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL, -- hardware, software, service, network
  status          TEXT DEFAULT 'in_stock', -- in_stock, deployed, in_repair, retired
  serial          TEXT,
  model           TEXT,
  vendor          TEXT,
  assigned_to_id  UUID REFERENCES users(id),
  location        TEXT,
  purchase_date   DATE,
  warranty_end    DATE,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 28. ADD-ONS / MARKETPLACE
CREATE TABLE IF NOT EXISTS addons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  category        TEXT, -- integration, automation, template, theme
  icon            TEXT,
  author          TEXT,
  version         TEXT DEFAULT '1.0.0',
  config_schema   JSONB,
  manifest        JSONB,
  is_public       BOOLEAN DEFAULT TRUE,
  is_official     BOOLEAN DEFAULT FALSE,
  installs        INT DEFAULT 0,
  rating          NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addon_installs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  addon_id        UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  config          JSONB DEFAULT '{}'::jsonb,
  enabled         BOOLEAN DEFAULT TRUE,
  installed_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(addon_id, organization_id)
);

-- 29. WATCHERS (subscribe to issues)
CREATE TABLE IF NOT EXISTS watchers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, user_id)
);

-- 30. CHANGELOG
CREATE TABLE IF NOT EXISTS changelog (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  field         TEXT,
  old_value     JSONB,
  new_value     JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_changelog_entity ON changelog(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_changelog_workspace ON changelog(workspace_id, created_at DESC);

-- 31. AUTOMATION RULES (extended)
ALTER TABLE automations ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS last_run_status TEXT;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 32. SECRETS (encrypted secrets per workspace)
CREATE TABLE IF NOT EXISTS secrets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  value_encrypted TEXT NOT NULL,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

-- 33. OAUTH APPS (for marketplace apps)
CREATE TABLE IF NOT EXISTS oauth_apps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  client_id       TEXT UNIQUE NOT NULL,
  client_secret   TEXT NOT NULL, -- hashed
  redirect_uris   TEXT[] NOT NULL,
  scopes          TEXT[] DEFAULT '{}',
  homepage        TEXT,
  logo_url        TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id          UUID NOT NULL REFERENCES oauth_apps(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL, -- hashed
  refresh_token   TEXT,
  scopes          TEXT[],
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 34. SUBSCRIPTION / BILLING ENHANCEMENTS
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS seats_used INT DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS usage_period_start TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS usage_period_end TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 35. SUPPORT STATUS PAGE
CREATE TABLE IF NOT EXISTS status_updates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL, -- operational, degraded, partial_outage, major_outage, maintenance
  message         TEXT,
  affected_services TEXT[],
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 36. ON-CALL SCHEDULES
CREATE TABLE IF NOT EXISTS oncall_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  timezone        TEXT DEFAULT 'UTC',
  rotation_hours  INT DEFAULT 168, -- 1 week
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oncall_shifts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id     UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL
);

-- 37. RUNBOOKS
CREATE TABLE IF NOT EXISTS runbooks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         JSONB,
  steps           JSONB DEFAULT '[]'::jsonb,
  category        TEXT,
  author_id       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 38. POSTMORTEMS
CREATE TABLE IF NOT EXISTS postmortems (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id     UUID, -- optional link to ticket
  title           TEXT NOT NULL,
  summary         TEXT,
  timeline        JSONB DEFAULT '[]'::jsonb,
  root_cause      TEXT,
  action_items    JSONB DEFAULT '[]'::jsonb,
  lessons_learned TEXT,
  author_id       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 39. EMBEDS
CREATE TABLE IF NOT EXISTS embeds_v2 (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url           TEXT NOT NULL,
  provider      TEXT,
  type          TEXT, -- video, image, article, tweet, etc.
  title         TEXT,
  description   TEXT,
  thumbnail_url TEXT,
  oembed        JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(url)
);

-- 40. DATABASE RELATIONS (extended for documents/collections)
CREATE TABLE IF NOT EXISTS relations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL, -- task, document, project, ticket
  source_id       UUID NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       UUID NOT NULL,
  relation_type   TEXT NOT NULL DEFAULT 'related', -- related, parent, child, blocks, blocked_by, duplicates, duplicate_of, relates_to
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_type, source_id);

-- Triggers for new tables
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['epics', 'releases', 'sprints', 'components', 'custom_fields', 'workflows', 'workflow_statuses', 'workflow_transitions', 'approvals', 'sla_policies', 'sla_tracking', 'page_versions', 'synced_blocks', 'views', 'saved_filters', 'roadmap_items', 'csat_surveys', 'notification_prefs', 'integrations_v2', 'support_queues', 'capacity', 'kb_articles', 'assets', 'addons', 'addon_installs', 'watchers', 'changelog', 'secrets', 'oauth_apps', 'oauth_tokens', 'status_updates', 'oncall_schedules', 'oncall_shifts', 'runbooks', 'postmortems', 'relations', 'custom_field_values', 'page_reactions', 'backlinks', 'approval_decisions'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch ON %I; CREATE TRIGGER trg_%I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();', t, t, t, t);
  END LOOP;
END $$;

-- =============================================================
-- DONE
-- =============================================================
