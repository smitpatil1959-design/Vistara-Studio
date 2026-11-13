-- Backend reliability upgrade. Apply after the existing production migration.
begin;

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

-- Keep deck rows, the canonical document, and generation status in one
-- transaction. Only the server service role may call this function.
create or replace function public.save_project_deck(
  p_project_id uuid, p_slides jsonb, p_spec jsonb, p_generated boolean default false
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  next_version integer;
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
revoke all on function public.save_project_deck(uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_project_deck(uuid, jsonb, jsonb, boolean) to service_role;

notify pgrst, 'reload schema';
commit;
