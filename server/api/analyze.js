import supabase from './db-client.js';
import { analyzeWebsite } from '../engine.js';
import { CrawlBlockedError } from '../security.js';
import { ASSET_BUCKET, optimizeImage, assetPath } from '../assets.js';
import { enforceRateLimit } from '../ratelimit.js';
import { requireProjectOwner } from '../visibility.js';
import { orchestrateResearch } from '../researchOrchestrator.js';
import { claimPipeline, setPipelineStatus } from '../pipeline.js';
import { assetUrl } from '../assetAccess.js';

export const maxDuration = 60;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // IMPORTANT: Never forward target website headers to the client.
  // All target website headers are treated as data, not Vistara response headers.
};

async function logEvent(project_id, kind) {
  try {
    const { error } = await supabase
      .from('project_events')
      .insert({ project_id, kind });

    if (error) {
      console.warn('event log failed:', error.message);
    }
  } catch { }
}

/** Crawl error → user-facing message */
function mapCrawlError(e) {
  if (e instanceof CrawlBlockedError) {
    switch (e.code || e.message) {
      case 'blocked-host':
        return 'That address is not crawlable — localhost, private networks and cloud metadata endpoints are blocked for safety.';

      case 'protocol':
        return 'Only http/https websites can be analyzed.';

      case 'port':
        return 'Only standard web ports (80/443) are allowed.';

      case 'dns':
        return 'DNS lookup failed — check the domain is spelled correctly and resolves publicly.';

      case 'redirect-loop':
        return 'The site redirects in a loop or beyond the safe hop limit.';

      case 'timeout':
        return 'The site took too long to respond. It may block crawlers — try again in a moment.';

      default:
        return 'The crawl was blocked before it began.';
    }
  }

  switch (e.message) {
    case 'timeout':
      return 'The site took too long to respond. It may block crawlers — try another URL.';

    case 'unreachable':
      return 'We could not reach that address. Check the URL and try again.';

    case 'invalid-url':
      return 'That URL does not look valid.';

    default:
      return 'Analysis failed unexpectedly. Please try again.';
  }
}

async function storeCapture(projectId, buffer, name, sourcePage) {
  const opt = await optimizeImage(buffer);

  const mainPath = assetPath(projectId, name, 'main');

  const { error: uploadError } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(mainPath, opt.main, {
      contentType: opt.mime || 'image/jpeg',
      upsert: true,
    });
  if (uploadError) throw uploadError;

  let thumbPath = null;

  if (opt.thumb) {
    thumbPath = assetPath(projectId, name, 'thumb');

    const { error: thumbError } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(thumbPath, opt.thumb, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    if (thumbError) thumbPath = null;
  }

  const { error: assetError } = await supabase.from('assets').insert({
    project_id: projectId,
    kind: 'scan',
    name,
    path: mainPath,
    thumb_path: thumbPath,
    url: assetUrl(projectId, mainPath),
    thumb_url: thumbPath ? assetUrl(projectId, thumbPath) : null,
    width: opt.width,
    height: opt.height,
    bytes: opt.main.length,
    mime: opt.mime || 'image/jpeg',
    source_page: sourcePage,
  });
  if (assetError) {
    await supabase.storage.from(ASSET_BUCKET).remove([mainPath, thumbPath].filter(Boolean));
    throw assetError;
  }

  return assetUrl(projectId, mainPath);
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  if (!enforceRateLimit(req, res, 'analyze', 12, 3600_000)) {
    return;
  }

  const { projectId } = req.body || {};

  if (!projectId) {
    return res.status(400).json({
      error: 'projectId required',
    });
  }

  let acquired = false;
  let crawlResult;
  try {
    // ── Ownership check ────────────────────────────────────────────────
    if (!(await requireProjectOwner(supabase, req, projectId))) {
      return res.status(403).json({
        error: 'Only the project owner can analyze this project.',
      });
    }

    // ── Load project ──────────────────────────────────────────────────
    const {
      data: project,
      error: pErr,
    } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (pErr) {
      if (pErr.code === 'PGRST205' || pErr.code === '42P01') {
        return res.status(503).json({
          error:
            'Supabase tables not initialized. Run the SQL in supabase/schema.sql.',
          code: 'DATABASE_UNINITIALIZED',
        });
      }

      return res.status(404).json({
        error: 'Project not found.',
      });
    }

    if (!project) {
      return res.status(404).json({
        error: 'Project not found.',
      });
    }

    // ── Load purpose ──────────────────────────────────────────────────
    const { data: intake } = await supabase
      .from('project_intake')
      .select('purpose')
      .eq('project_id', projectId)
      .maybeSingle();

    const researchPurpose = intake?.purpose || 'general';

    // ── Idempotency ───────────────────────────────────────────────────
    acquired = await claimPipeline(supabase, project, 'crawling');
    if (!acquired) {
      return res.status(409).json({
        error: 'Research already in progress.',
      });
    }

    // ── Crawl phase ───────────────────────────────────────────────────
    void logEvent(projectId, 'analysis_started');

    try {
      crawlResult = await analyzeWebsite(project.url);

      // Store home screenshot
      if (crawlResult.screenshotBuffer) {
        try {
          crawlResult.analysis.screenshot = await storeCapture(
            projectId,
            crawlResult.screenshotBuffer,
            'home.png',
            '/'
          );
        } catch (e) {
          console.warn(
            'screenshot store failed:',
            e?.message
          );
        }
      }

      // Store page screenshots
      for (const shot of crawlResult.pageShots || []) {
        try {
          await storeCapture(
            projectId,
            shot.buffer,
            `page${shot.path
              .replace(/[^a-z0-9]+/gi, '-')
              .slice(0, 40) || '-index'}.png`,
            shot.path
          );
        } catch (e) {
          console.warn(
            'page shot store failed:',
            shot.path,
            e?.message
          );
        }
      }
    } catch (e) {
      const errObj =
        e instanceof CrawlBlockedError
          ? e.toStructured()
          : new CrawlBlockedError(
            e?.message || 'unknown',
            {
              details: e?.message,
            }
          ).toStructured();

      await supabase
        .from('projects')
        .update({
          status: 'failed',
          analysis: {
            crawlError: errObj,
            crawlStatus: 'failed',
          },
        })
        .eq('id', projectId);

      void logEvent(projectId, 'analysis_failed');

      return res.status(422).json({
        error: mapCrawlError(e),
        ...errObj,
      });
    }

    // ── Research pipeline ─────────────────────────────────────────────
    await setPipelineStatus(supabase, projectId, 'processing');

    const research = await orchestrateResearch(
      projectId,
      project,
      crawlResult,
      researchPurpose
    );

    // Attach research summary to analysis
    if (research.sessionStatus === 'failed') {
      const error = new Error('Research evidence could not be saved. Check the database migrations and retry the analysis.');
      error.code = 'RESEARCH_FAILED';
      throw error;
    }
    crawlResult.analysis = {
      ...crawlResult.analysis,

      research: {
        sessionId: research.sessionId,
        mode: research.researchMode,
        status: research.sessionStatus,
        subject: research.subjectInfo,
        summary: research.summary,
        webResearchStatus: research.webResearchStatus,
      },
    };

    // ── Build theme ───────────────────────────────────────────────────
    const ds = crawlResult.designSystem || {};

    const theme = {
      skin: ds.skin || 'light',
      accent2: ds.accent2 || '#0E7490',

      headingFont: ds.headingFont || 'Inter Tight',
      bodyFont: ds.bodyFont || 'Inter',
      motion: ds.motion || 'smooth',
      radius: ds.radius || 20,

      colors: ds.colors || undefined,

      ...(project.theme || {}),

      accent:
        project.theme?.accent ||
        ds.accent ||
        crawlResult.suggestedAccent ||
        '#65A30D',
    };

    // ── Finalize ──────────────────────────────────────────────────────
    const productName =
      research.subjectInfo?.name ||
      crawlResult.understanding?.identity?.productName?.value ||
      crawlResult.understanding?.identity?.name?.value ||
      crawlResult.understanding?.productName ||
      project.name;
    if (crawlResult.analysis.brandKit) crawlResult.analysis.brandKit.brandName = productName;

    const {
      data: updated,
      error: uErr,
    } = await supabase
      .from('projects')
      .update({
        status: 'completed',
        analysis: crawlResult.analysis,
        audit: crawlResult.audit,
        understanding: crawlResult.understanding,
        dna: crawlResult.dna || null,
        theme,
        name: productName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();

    if (uErr) {
      throw uErr;
    }

    void logEvent(projectId, 'analysis_complete');

    // ── Insert chat confirmation ──────────────────────────────────────
    const modeNote =
      research.researchMode === 'crawl_and_search'
        ? `researched ${research.summary.totalSources} sources and extracted ${research.summary.totalEvidence} evidence points`
        : `crawled ${crawlResult.analysis.pages?.length ?? 0
        } official pages and extracted ${research.summary.totalEvidence} evidence points (no additional public-search evidence was available)`;

    try {
      const { error: chatInsertError } = await supabase
        .from('chat_messages')
        .insert({
          project_id: projectId,
          role: 'assistant',
          content: `Analysis complete. Vistara ${modeNote}.`,
        });

      if (chatInsertError) {
        console.warn(
          '[analyze] chat message insert failed:',
          chatInsertError.message
        );
      }
    } catch (err) {
      console.warn(
        '[analyze] chat message insert exception:',
        err?.message
      );
    }

    return res.status(200).json(updated);

  } catch (err) {
    console.error('analyze api error:', err);
    if (acquired) {
      try {
        await setPipelineStatus(supabase, projectId, 'failed', {
          ...(crawlResult ? { analysis: crawlResult.analysis, audit: crawlResult.audit, understanding: crawlResult.understanding } : {}),
        });
      } catch (statusError) { console.error('[analyze] Could not record failure:', statusError.message); }
    }

    const msg = err?.message || String(err || '');

    if (err instanceof CrawlBlockedError) {
      const structured = err.toStructured();
      return res.status(422).json({
        error: mapCrawlError(err),
        ...structured,
      });
    }

    if (
      err?.code === 'PGRST205' ||
      err?.code === '42P01'
    ) {
      return res.status(503).json({
        error:
          'Supabase tables not initialized. Run supabase/schema.sql.',
        code: 'DATABASE_UNINITIALIZED',
      });
    }

    if (err?.name === 'PostgrestError' || (typeof err?.code === 'string' && err.code.startsWith('PGRST'))) {
      return res.status(503).json({
        error: 'Database service is currently unreachable.',
        code: 'DATABASE_UNREACHABLE',
      });
    }

    if (/getaddrinfo|enotfound/i.test(msg)) {
      return res.status(422).json({
        error: 'DNS lookup failed — check that the domain name is spelled correctly and resolves publicly.',
        code: 'DNS_ERROR',
      });
    }

    if (/timed?out|econnrefused/i.test(msg)) {
      return res.status(422).json({
        error: 'Could not establish connection to the target website.',
        code: 'NETWORK_ERROR',
      });
    }

    if (err?.code === 'RESEARCH_FAILED') return res.status(503).json({ error: err.message, code: err.code });
    return res.status(500).json({
      error: err.message || 'Server error',
    });
  }
}
