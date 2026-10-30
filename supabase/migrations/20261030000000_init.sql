-- Job tracker schema. The app connects as the postgres role through the pooler, which bypasses RLS.
-- RLS is enabled with no policies so the tables are NOT readable through Supabase's public REST API.

create table if not exists applications (
  id           integer generated always as identity primary key,
  company      text not null,
  role         text not null,
  url          text,
  location     text,
  source       text,
  status       text not null default 'saved'
               check (status in ('saved', 'applied', 'oa', 'interview', 'offer', 'rejected', 'ghosted')),
  applied_date date,
  notes        text,
  description  text,
  match_score  integer,
  match_json   text,
  matched_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists documents (
  id             integer generated always as identity primary key,
  application_id integer not null references applications (id) on delete cascade,
  kind           text not null check (kind in ('resume', 'cover_letter', 'other')),
  filename       text not null,
  stored_name    text not null, -- path inside the "documents" storage bucket
  mime_type      text not null,
  size           integer not null,
  created_at     timestamptz not null default now()
);

create index if not exists documents_application_id_idx on documents (application_id);

create table if not exists settings (
  key   text primary key,
  value text
);

alter table applications enable row level security;
alter table documents enable row level security;
alter table settings enable row level security;

-- Private bucket for resumes and cover letters; only the server (service role key) reads and writes it.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 4194304)
on conflict (id) do nothing;
