begin;
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
commit;
