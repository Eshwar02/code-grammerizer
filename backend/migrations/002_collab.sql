-- Team Collaboration: isolated workspaces, members, invites, live-collab files

-- Workspaces = isolated team environment
create table if not exists workspaces (
  id bigint primary key generated always as identity,
  name text not null,
  owner_id bigint references users(id) on delete cascade,
  share_code text unique,
  share_enabled boolean default true,
  created_at timestamptz default now()
);

-- Membership + role per workspace
create table if not exists workspace_members (
  id bigint primary key generated always as identity,
  workspace_id bigint references workspaces(id) on delete cascade,
  user_id bigint references users(id) on delete cascade,
  role text not null default 'editor',        -- owner | editor | viewer
  created_at timestamptz default now(),
  unique (workspace_id, user_id)
);

-- Pending email invites (resolved to membership on the invitee's next login)
create table if not exists workspace_invites (
  id bigint primary key generated always as identity,
  workspace_id bigint references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'editor',
  invited_by bigint references users(id) on delete set null,
  accepted boolean default false,
  created_at timestamptz default now()
);

-- Files inside a workspace. ydoc_snapshot = base64 Yjs state (CRDT), content = latest plain text
create table if not exists workspace_files (
  id bigint primary key generated always as identity,
  workspace_id bigint references workspaces(id) on delete cascade,
  name text not null,
  language text default 'python',
  ydoc_snapshot text,
  content text default '',
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Change log: one row per saved edit, kept for retrieval/audit
create table if not exists workspace_changes (
  id bigint primary key generated always as identity,
  workspace_id bigint references workspaces(id) on delete cascade,
  file_id bigint references workspace_files(id) on delete cascade,
  user_id bigint references users(id) on delete set null,
  user_name text,
  file_name text,
  summary text,          -- human readable, e.g. "+42 / -7 chars, 3 lines"
  chars_added int default 0,
  chars_removed int default 0,
  created_at timestamptz default now()
);

-- NOTE: RLS intentionally left disabled to match the existing tables. The FastAPI
-- backend connects with the Supabase key and is the sole gatekeeper (it checks
-- workspace membership in code). Enabling RLS without policies would block it.

create index if not exists idx_ws_members_ws on workspace_members(workspace_id);
create index if not exists idx_ws_changes_ws on workspace_changes(workspace_id);
create index if not exists idx_ws_members_user on workspace_members(user_id);
create index if not exists idx_ws_invites_email on workspace_invites(email);
create index if not exists idx_ws_files_ws on workspace_files(workspace_id);
