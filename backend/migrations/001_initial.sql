-- Users
create table if not exists users (
  id bigint primary key generated always as identity,
  name text not null,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- Projects
create table if not exists projects (
  id bigint primary key generated always as identity,
  user_id bigint references users(id) on delete cascade,
  project_name text not null,
  upload_type text not null,
  file_content text,
  file_name text,
  language text default 'python',
  created_at timestamptz default now()
);

-- Reviews
create table if not exists reviews (
  id bigint primary key generated always as identity,
  project_id bigint references projects(id) on delete cascade,
  review_score float,
  summary text,
  static_analysis jsonb,
  complexity_metrics jsonb,
  ai_review jsonb,
  documentation text,
  created_at timestamptz default now()
);

-- Review Findings
create table if not exists review_findings (
  id bigint primary key generated always as identity,
  review_id bigint references reviews(id) on delete cascade,
  severity text not null,
  category text not null,
  issue text not null,
  explanation text,
  suggestion text,
  file_name text,
  line_number int
);

-- Row Level Security
alter table users enable row level security;
alter table projects enable row level security;
alter table reviews enable row level security;
alter table review_findings enable row level security;

-- Indexes
create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_reviews_project_id on reviews(project_id);
create index if not exists idx_findings_review_id on review_findings(review_id);
