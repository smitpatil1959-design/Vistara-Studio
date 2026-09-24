-- ============================================================
-- Vistara Studio · Supabase Migration 20260826_init_schema.sql
-- ============================================================

create extension if not exists "pgcrypto";

-- 1. Projects Table
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  name          text not null,
  url           text not null,
  status        text not null default 'draft'
                check (status in (
                  'draft', 'analyzing', 'analyzed', 'generating', 'generated', 'error',
                  'queued', 'crawling', 'processing', 'completed', 'failed'
                )),
  analysis      jsonb,                     -- crawl output (pages, links, palette, tech, screenshot)
  audit         jsonb,                     -- five-axis scored audit with issues[]
  understanding jsonb,                     -- AI creative brief
  dna           jsonb,                     -- Vistara DNA structured profile with verified citations
  theme         jsonb,                     -- deck theme tokens
  created_at    timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists projects_created_at_idx on public.projects (created_at desc);

-- 2. Slides Table
create table if not exists public.slides (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  sort_order     double precision not null default 0,
  type           text not null default 'custom',
  title          text,
  subtitle       text,
  body           text,
  bullets        jsonb,                    -- string[]; "head — detail" pairs
  stats          jsonb,                    -- { value, label }[]
  image_url      text,
  layout         text default 'left',      -- left | center | split | grid
  animation      text default 'fade',      -- fade | stagger | slide | zoom | none
  theme_override jsonb,                    -- per-slide accent overrides
  custom_label   text,
  created_at     timestamptz not null default now()
);
create index if not exists slides_project_order on public.slides (project_id, sort_order);

-- 3. Chat Messages Table
create table if not exists public.chat_messages (
  id         bigserial primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_project_time on public.chat_messages (project_id, created_at);

-- 4. Project Events Table (Activity Feed)
create table if not exists public.project_events (
  id         bigserial primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind       text not null check (kind in (
    'created', 'updated',
    'analysis_started', 'analysis_complete', 'analysis_failed',
    'generate_started', 'generated',
    'slide_updated', 'slide_created', 'slide_deleted',
    'ai_edit'
  )),
  created_at timestamptz not null default now()
);
create index if not exists project_events_lookup on public.project_events (project_id, created_at desc);

-- 5. Project Intake Table
create table if not exists public.project_intake (
  project_id    uuid primary key references public.projects (id) on delete cascade,
  purpose       text not null default 'general'
                check (purpose in ('college', 'investor', 'client', 'product-demo', 'portfolio', 'general')),
  design_prompt text,
  created_at    timestamptz not null default now()
);

-- 6. Project Presentation Specification Table
create table if not exists public.project_specs (
  project_id uuid primary key references public.projects (id) on delete cascade,
  spec       jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

-- 7. Assets Table
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  kind        text not null default 'upload' check (kind in ('upload', 'scan')),
  name        text not null,
  path        text not null,
  thumb_path  text,
  url         text not null,
  thumb_url   text,
  width       integer,
  height      integer,
  bytes       integer,
  mime        text,
  source_page text,
  created_at  timestamptz not null default now()
);
create index if not exists assets_project_idx on public.assets (project_id, created_at desc);

-- 8. Project Visibility Table
create table if not exists public.project_visibility (
  project_id uuid primary key references public.projects (id) on delete cascade,
  visibility text not null default 'unlisted' check (visibility in ('public', 'unlisted', 'private')),
  updated_at timestamptz not null default now()
);

-- Enable RLS and establish policies
alter table public.projects enable row level security;
alter table public.slides enable row level security;
alter table public.chat_messages enable row level security;
alter table public.project_events enable row level security;
alter table public.project_intake enable row level security;
alter table public.project_specs enable row level security;
alter table public.assets enable row level security;
alter table public.project_visibility enable row level security;

-- Permissive policies for authenticated & anon service access
do $$
begin
  -- Projects policies
  if not exists (select 1 from pg_policies where tablename = 'projects' and policyname = 'Projects select access') then
    create policy "Projects select access" on public.projects for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'projects' and policyname = 'Projects insert access') then
    create policy "Projects insert access" on public.projects for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'projects' and policyname = 'Projects update access') then
    create policy "Projects update access" on public.projects for update using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'projects' and policyname = 'Projects delete access') then
    create policy "Projects delete access" on public.projects for delete using (true);
  end if;

  -- Slides policies
  if not exists (select 1 from pg_policies where tablename = 'slides' and policyname = 'Slides select access') then
    create policy "Slides select access" on public.slides for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'slides' and policyname = 'Slides write access') then
    create policy "Slides write access" on public.slides for all using (true);
  end if;

  -- Chat policies
  if not exists (select 1 from pg_policies where tablename = 'chat_messages' and policyname = 'Chat select access') then
    create policy "Chat select access" on public.chat_messages for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'chat_messages' and policyname = 'Chat write access') then
    create policy "Chat write access" on public.chat_messages for all using (true);
  end if;

  -- Events policies
  if not exists (select 1 from pg_policies where tablename = 'project_events' and policyname = 'Events select access') then
    create policy "Events select access" on public.project_events for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'project_events' and policyname = 'Events write access') then
    create policy "Events write access" on public.project_events for all using (true);
  end if;

  -- Intake policies
  if not exists (select 1 from pg_policies where tablename = 'project_intake' and policyname = 'Intake access') then
    create policy "Intake access" on public.project_intake for all using (true);
  end if;

  -- Specs policies
  if not exists (select 1 from pg_policies where tablename = 'project_specs' and policyname = 'Specs access') then
    create policy "Specs access" on public.project_specs for all using (true);
  end if;

  -- Assets policies
  if not exists (select 1 from pg_policies where tablename = 'assets' and policyname = 'Assets access') then
    create policy "Assets access" on public.assets for all using (true);
  end if;

  -- Visibility policies
  if not exists (select 1 from pg_policies where tablename = 'project_visibility' and policyname = 'Visibility access') then
    create policy "Visibility access" on public.project_visibility for all using (true);
  end if;
end $$;
