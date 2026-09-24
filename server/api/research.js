/**
 * Research API — sub-resource endpoints for a project's research session.
 *
 * All routes require the user to be the project owner.
 * Returns typed, normalized JSON — never raw Supabase rows.
 *
 * GET /api/research?projectId=:id              → research session status + summary
 * GET /api/research?projectId=:id&r=sources    → sources list
 * GET /api/research?projectId=:id&r=evidence   → evidence items
 * GET /api/research?projectId=:id&r=claims     → verified claims
 *
 * Security: OPENAI_API_KEY never appears in any response.
 */

import supabase from './db-client.js';
import { requireProjectOwner } from '../visibility.js';
import config from '../config.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, r: resource } = req.query || {};
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  try {
    if (!(await requireProjectOwner(supabase, req, projectId))) {
      return res.status(403).json({ error: 'Only the project owner can access research data.' });
    }

    // ── Session status (default resource) ──────────────────────────────────
    if (!resource) {
      const { data: session, error } = await supabase
        .from('research_sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          return res.status(503).json({ error: 'Research tables not initialized. Run supabase/schema.sql.', code: 'DATABASE_UNINITIALIZED' });
        }
        return res.status(500).json({ error: 'Failed to load research session' });
      }

      if (!session) {
        return res.status(404).json({ error: 'No research session found for this project.', code: 'NO_SESSION' });
      }

      return res.status(200).json({
        id: session.id,
        status: session.status,
        researchMode: session.research_mode,
        subjectName: session.subject_name,
        subjectType: session.subject_type,
        sourcesCount: session.sources_count,
        evidenceCount: session.evidence_count,
        claimsCount: session.claims_count,
        conflictsCount: session.conflicts_count,
        errorsCount: session.errors_count,
        searchQueriesRun: session.search_queries_run,
        crawlDate: session.crawl_date,
        searchDate: session.search_date,
        completionTime: session.completion_time,
        createdAt: session.created_at,
        openaiConfigured: config.isOpenAiConfigured(),
      });
    }

    // ── Sources ─────────────────────────────────────────────────────────────
    if (resource === 'sources') {
      const { data: sources, error } = await supabase
        .from('sources')
        .select('id, url, title, snippet, source_type, domain, hierarchy_score, publication_date, fetched_at, status')
        .eq('project_id', projectId)
        .eq('status', 'success')
        .order('hierarchy_score', { ascending: false })
        .limit(50);

      if (error) return res.status(500).json({ error: 'Failed to load sources' });

      // Normalize — never send raw DB rows to client
      const normalized = (sources || []).map(s => ({
        id: s.id,
        url: String(s.url || ''),
        title: String(s.title || ''),
        snippet: String(s.snippet || ''),
        sourceType: String(s.source_type || 'third_party'),
        domain: String(s.domain || ''),
        hierarchyScore: Number(s.hierarchy_score || 0.5),
        publicationDate: s.publication_date ? String(s.publication_date) : null,
        fetchedAt: s.fetched_at ? String(s.fetched_at) : null,
      }));

      return res.status(200).json({ sources: normalized, count: normalized.length });
    }

    // ── Evidence ────────────────────────────────────────────────────────────
    if (resource === 'evidence') {
      const { data: evidence, error } = await supabase
        .from('evidence')
        .select('id, source_id, claim_type, page_title, section, extracted_text, confidence, publication_date, sources(url, source_type)')
        .eq('project_id', projectId)
        .order('confidence', { ascending: false })
        .limit(100);

      if (error) return res.status(500).json({ error: 'Failed to load evidence' });

      const normalized = (evidence || []).map(e => ({
        id: e.id,
        sourceId: e.source_id,
        claimType: String(e.claim_type || 'other'),
        pageTitle: e.page_title ? String(e.page_title) : null,
        section: e.section ? String(e.section) : null,
        extractedText: String(e.extracted_text || ''),
        confidence: Number(e.confidence || 0.5),
        publicationDate: e.publication_date ? String(e.publication_date) : null,
        sourceUrl: e.sources?.url ? String(e.sources.url) : null,
        sourceType: e.sources?.source_type ? String(e.sources.source_type) : 'third_party',
      }));

      return res.status(200).json({ evidence: normalized, count: normalized.length });
    }

    // ── Claims ──────────────────────────────────────────────────────────────
    if (resource === 'claims') {
      const { data: claims, error } = await supabase
        .from('claims')
        .select('id, claim, claim_type, status, confidence, source_urls, basis')
        .eq('project_id', projectId)
        .order('confidence', { ascending: false })
        .limit(150);

      if (error) return res.status(500).json({ error: 'Failed to load claims' });

      const normalized = (claims || []).map(c => ({
        id: c.id,
        claim: String(c.claim || ''),
        claimType: String(c.claim_type || 'other'),
        status: String(c.status || 'inferred'),
        confidence: Number(c.confidence || 0.3),
        sourceUrls: Array.isArray(c.source_urls) ? c.source_urls.map(u => String(u)) : [],
        basis: String(c.basis || 'observation'),
      }));

      return res.status(200).json({ claims: normalized, count: normalized.length });
    }

    return res.status(400).json({ error: `Unknown resource: ${String(resource).slice(0, 30)}` });

  } catch (err) {
    console.error('[research api]', err);
    const msg = err?.message || '';
    if (/fetch failed|getaddrinfo|enotfound/i.test(msg)) {
      return res.status(503).json({ error: 'Database service unreachable', code: 'DATABASE_UNREACHABLE' });
    }
    return res.status(500).json({ error: 'Research API error' });
  }
}
