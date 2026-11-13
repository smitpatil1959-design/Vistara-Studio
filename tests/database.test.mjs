import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const sql = file => readFileSync(file, 'utf8').replace('create extension if not exists "pgcrypto";', '');
const bootstrap = `
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select current_user::text $$;
  grant usage on schema auth to anon, authenticated, service_role;
  create table storage.objects(id uuid primary key, bucket_id text);
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`;

for (const mode of ['fresh-schema', 'existing-production-upgrade']) {
  test(`database: ${mode} installs and preserves a deck on transaction failure`, async () => {
    const db = new PGlite();
    try {
      await db.exec(bootstrap);
      if (mode === 'fresh-schema') await db.exec(sql('supabase/schema.sql'));
      else {
        await db.exec(sql('supabase/migrations/20260905_production_schema.sql'));
        await db.exec(sql('supabase/migrations/20261105_backend_reliability.sql'));
        await db.exec(sql('supabase/migrations/20261105_workflow_integrity.sql'));
      }
      await db.exec(sql('supabase/migrations/20261105144642_align_evidence_claim_types.sql'));
      const owner = randomUUID(), pid = randomUUID(), sid = randomUUID();
      await db.query('insert into auth.users(id,email) values ($1,$2)', [owner, 'owner@example.test']);
      await db.query("insert into projects(id,user_id,name,url,status) values ($1,$2,'Example','https://example.com','generated')", [pid, owner]);
      await db.query("insert into slides(id,project_id,title) values ($1,$2,'Original')", [sid, pid]);
      const originalSpec = { slides: [{ id: sid }] };
      await db.query('insert into project_specs(project_id,spec) values ($1,$2)', [pid, JSON.stringify(originalSpec)]);

      // A duplicate key occurs after DELETE inside the procedure. PostgreSQL
      // must restore the old rows and document when that INSERT fails.
      const duplicate = randomUUID();
      const badRows = [{ id: duplicate, type: 'hero', title: 'Bad A' }, { id: duplicate, type: 'hero', title: 'Bad B' }];
      await assert.rejects(db.query('select save_project_deck($1,$2,$3,true)', [pid, JSON.stringify(badRows), JSON.stringify({ slides: [{ id: duplicate }, { id: duplicate }] })]), error => error.code === '23505');
      assert.equal((await db.query('select title from slides where project_id=$1', [pid])).rows[0].title, 'Original');
      assert.deepEqual((await db.query('select spec from project_specs where project_id=$1', [pid])).rows[0].spec, originalSpec);

      const nextId = randomUUID();
      const nextSpec = { slides: [{ id: nextId }] };
      await db.exec('set role service_role');
      const saved = await db.query('select save_project_deck($1,$2,$3,true) as version', [pid, JSON.stringify([{ id: nextId, title: 'Replacement', type: 'hero' }]), JSON.stringify(nextSpec)]);
      assert.equal(saved.rows[0].version, 2);
      assert.equal((await db.query('select title from slides where project_id=$1', [pid])).rows[0].title, 'Replacement');
      assert.deepEqual((await db.query('select spec from project_specs where project_id=$1', [pid])).rows[0].spec, nextSpec);
      await assert.rejects(db.query('select save_project_deck($1,$2,$3,false,1)', [pid, JSON.stringify([{ id: nextId, title: 'Stale' }]), JSON.stringify(nextSpec)]), error => error.code === '40001');
      assert.equal((await db.query('select title from slides where project_id=$1', [pid])).rows[0].title, 'Replacement');
      await db.exec('reset role');
      assert.equal((await db.query("select public from storage.buckets where id='assets'")).rows[0].public, false);

      // Verify upgraded CHECK constraints accept current intake/status/types.
      await db.query("insert into project_intake(project_id,purpose) values ($1,'competitor_analysis')", [pid]);
      await db.query("update projects set status='researching' where id=$1", [pid]);
      await db.query("insert into claims(project_id,claim,claim_type) values ($1,'A competitor fact','competitor')", [pid]);
      const sourceId = randomUUID();
      await db.query("insert into sources(id,project_id,url,source_type) values ($1,$2,'https://example.com','official')", [sourceId, pid]);
      for (const type of ['competitor', 'differentiator', 'observation']) {
        await db.query('insert into evidence(project_id,source_id,claim_type,extracted_text) values ($1,$2,$3,$4)', [pid, sourceId, type, 'Example supports this evidence category.']);
      }

      // Direct anonymous requests must not enumerate profiles or unlisted
      // workspace data, and cannot execute the service-only save function.
      await db.exec('set role anon');
      for (const table of ['profiles', 'projects', 'project_events', 'slides']) {
        assert.equal((await db.query(`select count(*)::integer as n from ${table}`)).rows[0].n, 0);
      }
      await assert.rejects(db.query('select save_project_deck($1,$2,$3,true)', [pid, JSON.stringify([{ id: nextId }]), JSON.stringify(nextSpec)]), error => error.code === '42501');
      await db.exec('reset role');
      // The migration is safe to apply again.
      await db.exec(sql('supabase/migrations/20261105_workflow_integrity.sql'));
    } finally { await db.close(); }
  });
}
