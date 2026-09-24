-- ============================================================
-- Vistara Studio · Production PostgreSQL Schema & Migration
-- Fixes PostgREST schema cache, table grants, RLS, indexes, triggers
-- ============================================================

create extension if not exists "pgcrypto";

-- 0. Profiles Table (linked to auth.users)
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 1. Projects Table
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  name          text not null,
  url           text not null,
  status        text not null default 'queued'
                check (status in (
                  'draft', 'analyzing', 'analyzed', 'generating', 'generated', 'error',
                  'queued', 'crawling', 'processing', 'completed', 'failed'
                )),
  analysis      jsonb,                     -- crawl output (pages, links, palette, tech, screenshot)
  audit         jsonb,                     -- five-axis scored audit with findings
  understanding jsonb,                     -- AI creative brief (understanding.v2)
  dna           jsonb,                     -- Vistara DNA structured profile with verified citations
  theme         jsonb,                     -- deck theme tokens
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
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
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
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

-- Upgrade databases created by the initial migration.
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.slides add column if not exists updated_at timestamptz not null default now();
alter table public.chat_messages add column if not exists updated_at timestamptz not null default now();
alter table public.project_events add column if not exists updated_at timestamptz not null default now();
alter table public.project_intake add column if not exists updated_at timestamptz not null default now();
alter table public.assets add column if not exists updated_at timestamptz not null default now();
alter table public.projects alter column status set default 'queued';

-- 9. Auto-sync auth.users to public.profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute procedure public.handle_new_user();

-- 10. Grant table & sequence privileges (CRUCIAL for PostgREST schema cache)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- 11. Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.slides enable row level security;
alter table public.chat_messages enable row level security;
alter table public.project_events enable row level security;
alter table public.project_intake enable row level security;
alter table public.project_specs enable row level security;
alter table public.assets enable row level security;
alter table public.project_visibility enable row level security;

-- 12. Drop legacy placeholder policies
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 13. Comprehensive Row Level Security (RLS) Policies

-- Profiles: Users can read all profiles (for collaborator cards); only owner updates
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Projects:
-- Select: User's own projects OR public/unlisted shared decks OR service_role
create policy "projects_select" on public.projects for select using (
  user_id = auth.uid()
  or user_id is null
  or auth.role() = 'service_role'
  or exists (
    select 1 from public.project_visibility pv
    where pv.project_id = projects.id
      and pv.visibility in ('public', 'unlisted')
  )
);

-- Insert: Signed-in user (or service role)
create policy "projects_insert" on public.projects for insert with check (
  auth.role() = 'service_role'
  or (auth.uid() is not null and user_id = auth.uid())
);

-- Update: Owner or service role
create policy "projects_update" on public.projects for update using (
  auth.role() = 'service_role'
  or user_id = auth.uid()
);

-- Delete: Owner or service role
create policy "projects_delete" on public.projects for delete using (
  auth.role() = 'service_role'
  or user_id = auth.uid()
);

-- Slides:
create policy "slides_select" on public.slides for select using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = slides.project_id
      and (
        p.user_id = auth.uid()
        or p.user_id is null
        or exists (
          select 1 from public.project_visibility pv
          where pv.project_id = p.id and pv.visibility in ('public', 'unlisted')
        )
      )
  )
);
create policy "slides_write" on public.slides for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = slides.project_id
      and p.user_id = auth.uid()
  )
);

-- Chat Messages:
create policy "chat_select" on public.chat_messages for select using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = chat_messages.project_id
      and p.user_id = auth.uid()
  )
);
create policy "chat_write" on public.chat_messages for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = chat_messages.project_id
      and p.user_id = auth.uid()
  )
);

-- Project Events:
create policy "events_select" on public.project_events for select using (true);
create policy "events_write" on public.project_events for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = project_events.project_id
      and p.user_id = auth.uid()
  )
);

-- Project Intake:
create policy "intake_all" on public.project_intake for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = project_intake.project_id
      and p.user_id = auth.uid()
  )
);

-- Project Specs:
create policy "specs_all" on public.project_specs for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = project_specs.project_id
      and p.user_id = auth.uid()
  )
);

-- Assets:
create policy "assets_all" on public.assets for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = assets.project_id
      and p.user_id = auth.uid()
  )
);

-- Visibility:
create policy "visibility_select" on public.project_visibility for select using (true);
create policy "visibility_write" on public.project_visibility for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = project_visibility.project_id
      and p.user_id = auth.uid()
  )
);

-- 14. Force PostgREST schema cache reload
notify pgrst, 'reload schema';
