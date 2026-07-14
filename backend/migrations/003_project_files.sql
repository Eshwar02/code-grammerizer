-- Multi-file / repo-pull projects: one project can now hold many source files.
-- Single-file + snippet projects keep using projects.file_content as before;
-- repo projects also store a concatenated blob in file_content for whole-project
-- AI review, plus one row per file here for display + per-file findings.

create table if not exists project_files (
  id bigint primary key generated always as identity,
  project_id bigint references projects(id) on delete cascade,
  path text not null,            -- repo-relative path, e.g. src/utils/auth.py
  content text not null,
  language text default 'python',
  created_at timestamptz default now()
);

-- repo source metadata on the project (nullable; ignored by snippet/file projects)
alter table projects add column if not exists repo_url text;
alter table projects add column if not exists file_count int default 1;

create index if not exists idx_project_files_project on project_files(project_id);
