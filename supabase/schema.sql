-- ============================================================
-- Vistara Studio · Supabase (PostgreSQL) schema
-- Canonical reference for the managed tables. Row types are
-- mirrored in /src/types/models.ts.
-- ============================================================

create extension if not exists "pgcrypto";

-- 0. Profiles Table
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
                  'queued', 'crawling', 'processing', 'completed', 'failed',
                  'identifying', 'researching', 'extracting', 'validating', 'planning'
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
  claim_ids      uuid[] default '{}',       -- internal provenance, never user-facing
  evidence_ids   uuid[] default '{}',       -- internal provenance, never user-facing
  source_urls    text[] default '{}',       -- internal provenance, never user-facing
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
                check (purpose in (
                  -- legacy
                  'college', 'investor', 'client', 'product-demo', 'portfolio', 'general',
                  -- research platform purposes
                  'company_overview', 'investor_research', 'competitor_analysis',
                  'product_research', 'sales_presentation', 'market_research'
                )),
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

alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.slides add column if not exists updated_at timestamptz not null default now();
alter table public.chat_messages add column if not exists updated_at timestamptz not null default now();
alter table public.project_events add column if not exists updated_at timestamptz not null default now();
alter table public.project_intake add column if not exists updated_at timestamptz not null default now();
alter table public.assets add column if not exists updated_at timestamptz not null default now();
alter table public.projects alter column status set default 'queued';
alter table public.slides add column if not exists claim_ids uuid[] default '{}';
alter table public.slides add column if not exists evidence_ids uuid[] default '{}';
alter table public.slides add column if not exists source_urls text[] default '{}';

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

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

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

create policy "projects_insert" on public.projects for insert with check (
  auth.role() = 'service_role'
  or (auth.uid() is not null and user_id = auth.uid())
);

create policy "projects_update" on public.projects for update using (
  auth.role() = 'service_role'
  or user_id = auth.uid()
);

create policy "projects_delete" on public.projects for delete using (
  auth.role() = 'service_role'
  or user_id = auth.uid()
);

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

create policy "events_select" on public.project_events for select using (true);
create policy "events_write" on public.project_events for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = project_events.project_id
      and p.user_id = auth.uid()
  )
);

create policy "intake_all" on public.project_intake for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = project_intake.project_id
      and p.user_id = auth.uid()
  )
);

create policy "specs_all" on public.project_specs for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = project_specs.project_id
      and p.user_id = auth.uid()
  )
);

create policy "assets_all" on public.assets for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = assets.project_id
      and p.user_id = auth.uid()
  )
);

create policy "visibility_select" on public.project_visibility for select using (true);
create policy "visibility_write" on public.project_visibility for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = project_visibility.project_id
      and p.user_id = auth.uid()
  )
);

-- 14. Research Architecture Tables (Evidence-Based Claims)

-- Sources Table: Tracks all web sources (official website, web search results, etc.)
create table if not exists public.sources (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  url              text not null,
  title            text,
  snippet          text,
  source_type      text not null default 'third_party'
                   check (source_type in (
                     'official',
                     'official_documentation',
                     'official_newsroom',
                     'news',
                     'government',
                     'industry',
                     'third_party'
                   )),
  publication_date text,
  domain           text,
  hierarchy_score  float default 0.5,
  fetched_at       timestamptz,
  status           text default 'success'
                   check (status in ('success', 'error', 'timeout', 'forbidden')),
  error_message    text,
  created_at       timestamptz not null default now()
);
create index if not exists sources_project_idx on public.sources (project_id);
create index if not exists sources_url_idx on public.sources (project_id, url);

-- Evidence Table: Extracted factual evidence from sources
create table if not exists public.evidence (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  source_id      uuid not null references public.sources (id) on delete cascade,
  claim_type     text not null default 'other'
                 check (claim_type in (
                   'company_description',
                   'product',
                   'service',
                   'feature',
                   'pricing',
                   'audience',
                   'industry',
                   'market',
                   'metric',
                   'customer',
                   'location',
                   'integration',
                   'technology',
                   'security',
                   'business_model',
                   'founder',
                   'leadership',
                   'partnership',
                   'news',
                   'competitor',
                   'differentiator',
                   'observation',
                   'other'
                 )),
  page_title     text,
  section        text,
  extracted_text text not null,
  raw_context    text,
  confidence     float default 1.0,
  publication_date text,
  created_at     timestamptz not null default now()
);
create index if not exists evidence_project_idx on public.evidence (project_id);
create index if not exists evidence_claim_type_idx on public.evidence (project_id, claim_type);

-- Claims Table: Validated claims extracted from evidence
create table if not exists public.claims (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  claim         text not null,
  value         text,
  claim_type    text not null default 'other'
                check (claim_type in (
                  'company_description',
                  'product',
                  'service',
                  'feature',
                  'pricing',
                  'audience',
                  'industry',
                  'market',
                  'metric',
                  'customer',
                  'location',
                  'integration',
                  'technology',
                  'security',
                  'business_model',
                  'founder',
                  'leadership',
                  'partnership',
                  'news',
                  'competitor',
                  'differentiator',
                  'observation',
                  'interpretation',
                  'other'
                )),
  status        text not null default 'supported'
                check (status in (
                  'verified',     -- directly stated by authoritative official source
                  'supported',    -- supported by evidence but not direct quote
                  'inferred',     -- analytical conclusion, clearly distinguished
                  'conflicting',  -- two credible sources disagree
                  'rejected'      -- contradicted or unsupported
                )),
  evidence_ids  uuid[] default '{}',
  source_urls   text[] default '{}',
  confidence    float default 1.0,
  basis         text default 'fact'
                check (basis in ('fact', 'observation', 'interpretation')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists claims_project_idx on public.claims (project_id);
create index if not exists claims_claim_type_idx on public.claims (project_id, claim_type);
create index if not exists claims_status_idx on public.claims (project_id, status);

-- Research Sessions Table: Track research runs for a project
create table if not exists public.research_sessions (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id) on delete cascade,
  research_type        text not null default 'initial'
                       check (research_type in ('initial', 'refresh', 'targeted')),
  status               text not null default 'queued'
                       check (status in (
                         'queued', 'identifying', 'crawling', 'researching',
                         'extracting', 'validating', 'planning', 'generating',
                         'completed', 'partial', 'failed'
                       )),
  subject_name         text,
  subject_type         text,
  research_mode        text default 'crawl_only'
                       check (research_mode in ('crawl_only', 'crawl_and_search')),
  crawl_date           timestamptz,
  search_date          timestamptz,
  completion_time      timestamptz,
  sources_count        integer default 0,
  evidence_count       integer default 0,
  claims_count         integer default 0,
  conflicts_count      integer default 0,
  errors_count         integer default 0,
  search_queries_run   integer default 0,
  created_at           timestamptz not null default now()
);
create index if not exists research_sessions_project_idx on public.research_sessions (project_id);

-- Additive migrations for existing tables (idempotent)
alter table public.sources add column if not exists snippet text;
alter table public.sources add column if not exists publication_date text;
alter table public.sources add column if not exists domain text;
alter table public.sources add column if not exists hierarchy_score float default 0.5;
alter table public.evidence add column if not exists raw_context text;
alter table public.evidence add column if not exists publication_date text;
alter table public.research_sessions add column if not exists status text default 'queued';
alter table public.research_sessions add column if not exists subject_name text;
alter table public.research_sessions add column if not exists subject_type text;
alter table public.research_sessions add column if not exists research_mode text default 'crawl_only';
alter table public.research_sessions add column if not exists completion_time timestamptz;
alter table public.research_sessions add column if not exists conflicts_count integer default 0;
alter table public.research_sessions add column if not exists errors_count integer default 0;
alter table public.research_sessions add column if not exists search_queries_run integer default 0;

-- 15. Enable RLS and add policies for new tables
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sources_project_url_unique'
      and conrelid = 'public.sources'::regclass
  ) then
    alter table public.sources add constraint sources_project_url_unique unique (project_id, url);
  end if;
end $$;
drop policy if exists "sources_all" on public.sources;
drop policy if exists "evidence_all" on public.evidence;
drop policy if exists "claims_all" on public.claims;
drop policy if exists "research_sessions_all" on public.research_sessions;
alter table public.sources enable row level security;
alter table public.evidence enable row level security;
alter table public.claims enable row level security;
alter table public.research_sessions enable row level security;

create policy "sources_all" on public.sources for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = sources.project_id
      and p.user_id = auth.uid()
  )
);

create policy "evidence_all" on public.evidence for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = evidence.project_id
      and p.user_id = auth.uid()
  )
);

create policy "claims_all" on public.claims for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = claims.project_id
      and p.user_id = auth.uid()
  )
);

create policy "research_sessions_all" on public.research_sessions for all using (
  auth.role() = 'service_role'
  or exists (
    select 1 from public.projects p
    where p.id = research_sessions.project_id
      and p.user_id = auth.uid()
  )
);


-- Upgrade existing installations; CREATE TABLE IF NOT EXISTS does not update checks.
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (status in (
  'draft','analyzing','analyzed','generating','generated','error','queued','crawling','processing','completed','failed',
  'identifying','researching','extracting','validating','planning'
));
alter table public.project_intake drop constraint if exists project_intake_purpose_check;
alter table public.project_intake add constraint project_intake_purpose_check check (purpose in (
  'college','investor','client','product-demo','portfolio','general','company_overview','investor_research',
  'competitor_analysis','product_research','sales_presentation','market_research'
));
alter table public.slides add column if not exists claim_ids uuid[] default '{}';
alter table public.slides add column if not exists evidence_ids uuid[] default '{}';
alter table public.slides add column if not exists source_urls text[] default '{}';
alter table public.claims drop constraint if exists claims_claim_type_check;
alter table public.claims add constraint claims_claim_type_check check (claim_type in (
  'company_description','product','service','feature','pricing','audience','industry','market','metric','customer',
  'location','integration','technology','security','business_model','founder','leadership','partnership','news',
  'competitor','differentiator','observation','interpretation','other'
));

-- Research tables were formerly created after the broad grants, leaving API
-- access unavailable on databases initialized from schema.sql.
grant all on public.sources, public.evidence, public.claims, public.research_sessions to authenticated, service_role;

-- Public/link-only reads go through the API visibility gate. Direct anonymous
-- database queries must not enumerate unlisted decks, email addresses or events.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid());
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (user_id = auth.uid());
drop policy if exists slides_select on public.slides;
create policy slides_select on public.slides for select using (
  exists (select 1 from public.projects p where p.id = slides.project_id and p.user_id = auth.uid())
);
drop policy if exists events_select on public.project_events;
create policy events_select on public.project_events for select using (
  exists (select 1 from public.projects p where p.id = project_events.project_id and p.user_id = auth.uid())
);
drop policy if exists visibility_select on public.project_visibility;
create policy visibility_select on public.project_visibility for select using (
  exists (select 1 from public.projects p where p.id = project_visibility.project_id and p.user_id = auth.uid())
);

-- Storage is provisioned alongside the database. Writes use the server role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('assets', 'assets', true, 6291456, array['image/jpeg','image/png','image/webp','image/avif','image/gif']),
  ('screenshots', 'screenshots', true, 6291456, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Research snapshots belong to one run. Historical rows remain readable in
-- existing decks, but cannot contaminate newly researched presentations.
alter table public.sources add column if not exists research_session_id uuid references public.research_sessions(id) on delete cascade;
alter table public.evidence add column if not exists research_session_id uuid references public.research_sessions(id) on delete cascade;
alter table public.claims add column if not exists research_session_id uuid references public.research_sessions(id) on delete cascade;
alter table public.sources drop constraint if exists sources_project_url_unique;
create unique index if not exists sources_run_url_unique on public.sources(project_id, research_session_id, url);
create index if not exists evidence_run_idx on public.evidence(project_id, research_session_id);
create index if not exists claims_run_idx on public.claims(project_id, research_session_id);

-- Upgrade legacy enums instead of silently losing evidence on CHECK failures.
alter table public.sources drop constraint if exists sources_source_type_check;
alter table public.sources add constraint sources_source_type_check check (source_type in ('official','official_documentation','official_newsroom','news','government','industry','third_party'));
alter table public.claims drop constraint if exists claims_status_check;
update public.claims set status = 'conflicting' where status = 'conflict';
alter table public.claims add constraint claims_status_check check (status in ('verified','supported','inferred','conflicting','rejected'));
create index if not exists sources_session_idx on public.sources(research_session_id);
create index if not exists evidence_session_idx on public.evidence(research_session_id);
create index if not exists claims_session_idx on public.claims(research_session_id);
create index if not exists evidence_source_idx on public.evidence(source_id);

-- Auth invokes this as a trigger; public clients must not invoke privileged code.
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- A restrictive policy also blocks legacy permissive storage policies from
-- accidentally granting anonymous access through the authenticated object route.
drop policy if exists vistara_private_image_delivery on storage.objects;
create policy vistara_private_image_delivery on storage.objects as restrictive for select to anon, authenticated
  using (bucket_id not in ('assets', 'screenshots'));

-- Existing public object URLs stop granting access. Image responses are served
-- by the application after checking the current project permissions.
update storage.buckets set public = false where id in ('assets', 'screenshots');

-- Remove the old overload so PostgREST resolves optional arguments consistently.
drop function if exists public.save_project_deck(uuid, jsonb, jsonb, boolean);

-- Keep deck rows, the canonical document, and generation status in one
-- transaction. Only the server service role may call this function.
create or replace function public.save_project_deck(
  p_project_id uuid, p_slides jsonb, p_spec jsonb, p_generated boolean default false, p_expected_version integer default null
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  next_version integer;
  current_version integer;
begin
  if jsonb_typeof(p_slides) is distinct from 'array' then
    raise exception 'Slides must be an array';
  end if;
  if jsonb_array_length(p_slides) < 1 or jsonb_array_length(p_slides) > 200 then
    raise exception 'A presentation must have between 1 and 200 slides';
  end if;
  if jsonb_typeof(p_spec) is distinct from 'object'
    or jsonb_typeof(p_spec->'slides') is distinct from 'array' then
    raise exception 'Invalid presentation document';
  end if;
  if jsonb_array_length(p_spec->'slides') <> jsonb_array_length(p_slides) then
    raise exception 'Slide rows and document must have matching lengths';
  end if;

  perform id from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;

  select coalesce((select version from public.project_specs where project_id = p_project_id), 0) into current_version;
  if p_expected_version is not null and current_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'This presentation changed in another tab. Reload before saving to avoid overwriting newer work.';
  end if;

  delete from public.slides where project_id = p_project_id;
  insert into public.slides (
    id, project_id, sort_order, type, title, subtitle, body, bullets, stats,
    image_url, layout, animation, theme_override, custom_label,
    claim_ids, evidence_ids, source_urls
  ) select
    r.id, p_project_id, coalesce(r.sort_order, 0), coalesce(r.type, 'custom'),
    r.title, r.subtitle, r.body, r.bullets, r.stats, r.image_url,
    r.layout, r.animation, r.theme_override, r.custom_label,
    coalesce(r.claim_ids, '{}'::uuid[]), coalesce(r.evidence_ids, '{}'::uuid[]),
    coalesce(r.source_urls, '{}'::text[])
  from jsonb_to_recordset(p_slides) as r(
    id uuid, sort_order double precision, type text, title text, subtitle text,
    body text, bullets jsonb, stats jsonb, image_url text, layout text,
    animation text, theme_override jsonb, custom_label text,
    claim_ids uuid[], evidence_ids uuid[], source_urls text[]
  );

  insert into public.project_specs (project_id, spec, version, updated_at)
  values (p_project_id, p_spec, 1, now())
  on conflict (project_id) do update set
    spec = excluded.spec, version = project_specs.version + 1, updated_at = now()
  returning version into next_version;

  if p_generated then
    update public.projects set status = 'generated', updated_at = now() where id = p_project_id;
  end if;
  return next_version;
end;
$$;
revoke all on function public.save_project_deck(uuid, jsonb, jsonb, boolean, integer) from public, anon, authenticated;
grant execute on function public.save_project_deck(uuid, jsonb, jsonb, boolean, integer) to service_role;


notify pgrst, 'reload schema';
