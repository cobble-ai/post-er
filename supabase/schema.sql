-- Post Calendar schema. Paste this whole file into the Supabase SQL editor and run it.
-- Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text not null default 'peter',
  raw_text text not null,
  follow_up_question text,
  follow_up_answer text,
  status text not null check (status in ('needs_detail', 'drafted'))
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  note_id uuid not null references notes(id) on delete cascade,
  author text not null default 'peter',
  platform text not null check (platform in ('x', 'linkedin')),
  angle text not null,
  body text not null,
  status text not null check (status in ('bank', 'scheduled', 'posted', 'discarded')),
  scheduled_date date,
  posted_at timestamptz
);

create index if not exists drafts_status_idx on drafts (status);
create index if not exists drafts_scheduled_date_idx on drafts (scheduled_date);

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  voice_samples text not null default '',
  extra_rules text not null default ''
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- The app talks to Postgres only from the server with the service role key,
-- which bypasses RLS. Enabling RLS with no policies blocks everyone else.
alter table notes enable row level security;
alter table drafts enable row level security;
alter table settings enable row level security;
