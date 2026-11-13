> Historical initial review. The follow-up work supersedes the unresolved items and deployment prerequisites below. See [WORKFLOW_VERIFICATION.md](WORKFLOW_VERIFICATION.md) for the current status, live migrations and browser results.

# Vistara Studio — frontend-to-backend review

Reviewed on 5 November 2026. Backend fixes are in this checkout. Frontend pages, components, hooks, services and styles under `src/` were not changed. The Vite configuration was changed only to connect local development requests to the real backend.

## Required before deployment

Apply `supabase/migrations/20261105_backend_reliability.sql` to the existing Supabase database before deploying this checkout. The live database does not currently expose the new `save_project_deck` function. New generation and canonical presentation saves depend on that function and will return an error until it is installed.

The migration creates missing research objects when needed, upgrades old constraints, installs transactional deck saves, restricts direct anonymous database reads, and provisions the image buckets if absent. It was tested against both the canonical schema and the older production migration in a local PostgreSQL engine, including reapplication and rollback after an insert failure. It has **not** been applied to the live database. No live projects, users, storage objects or policies were modified during this review.

## Confirmed problems and backend changes

| Feature | Problem found | Change |
| --- | --- | --- |
| Signup | `/api/auth/signup` imported a file that no longer exists after the API reorganization. | Corrected the deployed wrapper and nested router aliases. |
| Local development | `npm run dev` served Vite without any API handler, so frontend API requests could receive HTML or missing routes. | Added backend middleware for the existing API routes; validated with local HTTP smoke checks. |
| Presentation regeneration | Existing slides were deleted before checking claims, running the planner, or saving the replacement. A failure could erase the current deck. | Build and validate first; commit slides, canonical spec and generated status in one PostgreSQL transaction. |
| Manual presentation saves | Spec writes and slide projection used separate requests. A failure could leave them inconsistent. | Save both representations in the same database transaction and retain citation provenance. |
| Parallel analysis/generation | Read-then-write status checks allowed concurrent requests to start the same pipeline. | Added a database compare-and-set claim shared by analysis and generation. |
| Interrupted jobs | Research failures could leave projects permanently marked as running. | Record failure, restore the previous generation status on failure, and permit retry after a six-minute expired lease. |
| Private sharing | A failed visibility lookup defaulted to unlisted, potentially exposing a private deck. | Permission lookup failures now fail closed. |
| Workspace chat | Public/unlisted presentation links could retrieve the workspace chat transcript. | Chat reads now require project ownership. |
| Direct database privacy | The live anonymous key could retrieve profile records; SQL also contained broad activity and project read policies. | Added owner-only database read policies in the migration. Shared presentation access continues through the backend visibility gate. This protection is pending live migration. |
| Manual slide endpoints | Create/update/delete did not consistently synchronize `project_specs`; reorder synchronization ran after the request without being awaited. | Await synchronization before responding and clear a stale spec when no slides remain. |
| Custom canvas edits | Rebuilding the spec from legacy slide rows discarded manually positioned elements and custom backgrounds. | Merge content changes into existing canonical elements, preserving positions, extra elements, backgrounds and canonical theme. |
| Theme changes | Project theme updates could leave the canonical presentation using the previous theme. | Synchronize canonical theme and motion while preserving custom element placement. |
| AI regeneration | The AI regenerate operation used the legacy builder and discarded the selected presentation purpose. | Reuse verified research claims and the purpose-aware planner; save transactionally. Scope slide mutations to the owning project. |
| AI copy polish | The module was imported as a default export although it only has named exports, silently disabling the copy-polish pass. CTA filtering also used inconsistent indices. | Corrected the import and aligned the filtered slide indices. Live paid provider behavior remains unverified. |
| Research sessions | A `maybeSingle()` lookup failed once multiple historical sessions existed; updates could overwrite all sessions for a project. | Each run owns a new session ID and updates only that session. Missing research schema is a visible failure. |
| Research reporting | Search errors were omitted from saved counts; crawl-only mode could be reported despite successful public-source research. | Record search errors and return the actual effective research mode. |
| Project deletion | Slides, chat and specs were deleted before storage cleanup, so a storage failure could leave a partially erased project. | Keep database content until storage cleanup succeeds, then use one cascading project delete. Storage and database changes still cannot be one distributed transaction. |
| Images and cropping | Failed uploads were sometimes ignored; failed crops could be reported as successful; saved dimensions described the input rather than the resized file. | Check storage errors, clean up failed uploads, fail invalid crops visibly, preserve MIME type, and report actual output dimensions. |
| Export image loading | Images were buffered before checking their size; redirected images could pass readiness checks without being fetched correctly. | Validate each redirect, cap bytes during streaming, enforce deadlines, and check background imagery too. |
| PowerPoint content | Some custom element types could silently disappear from exports; positioned elements retaining a flow slot could render twice. | Separate positioned elements from flow slots and block unsupported PowerPoint content in readiness checks. |
| Claim conflicts | Different metrics containing different numbers could be classified as contradictory; punctuation removal confused decimal values. | Require the same assertion structure and preserve decimal precision. |
| Configuration and production dependencies | Runtime modules threw during import without secrets; duplicate database clients diverged; the crawler imported an undeclared HTTP dependency supplied only by development tooling. | Keep module loading safe, consolidate clients, add request deadlines, declare `undici` explicitly, and upgrade `sharp` to the security-fixed release. |

## Remaining problems and limitations

These are not claims that every listed feature fails on every request. They distinguish source-confirmed defects from unverified deployment behavior.

1. **Frontend autosave can lose edits.** In `src/studio/EditorStage.tsx`, `persist()` returns when a save is already running. An older request can subsequently set the state to saved while newer edits have not been sent. `flushSave()` also marks saved immediately without awaiting completion. Backend transactions cannot recover a document the frontend never sends. This code was left unchanged as requested.

2. **Multiple tabs can overwrite each other's edits.** The frontend save request contains the full document without an expected version. Saves are transactional, but the latest accepted request wins. Reliable conflict handling requires a version precondition and corresponding frontend behavior.

3. **Research refresh can mix old and new evidence.** Evidence and claims are queried by project rather than research-run ID. Repeated analysis appends evidence; changing a project's URL and researching it again can retain claims from the previous subject. The session-tracking fix does not isolate evidence by session. A proper refresh model needs run-scoped evidence and claim snapshots.

4. **Private deck images remain public by URL.** Both live image buckets are public, and the frontend stores public image URLs. The deck permission gate protects the document, not an already-known image URL. Full image privacy requires protected asset delivery and migration of existing public objects.

5. **PowerPoint export has incomplete element coverage.** Groups, icons, flow-positioned charts/shapes and absolute buttons are now flagged as blocking instead of silently omitted. The exporter also has finite flow capacities and substitutes theme colors for gradient backgrounds. Web/PDF and native PowerPoint do not have identical rendering support.

6. **AI commands are largely rule-driven.** `directorTurn()` is synchronous and maps supported phrases to validated operations. General conversational editing is not a full live-model editing implementation. Correcting the copy-polish import does not change that architecture.

7. **Rate limits are per process.** `server/ratelimit.js` uses an in-memory map. Separate serverless instances do not share budgets. This is a scaling/cost-control limitation, rather than a normal single-user flow failure.

8. **Dependency audit still reports security findings.** After the backend dependency updates, npm reported 55 findings: 2 low, 19 moderate, 33 high and 1 critical. The critical archive dependency is pinned to `tar@7.5.7` by the existing Vercel tooling, so a normal compatible update did not remove it. Remaining affected areas include the deployment toolchain, frontend router/development server and the PowerPoint image-size parser. Broad forced upgrades were not applied during this backend-focused change.

9. **Existing browser E2E tooling is not a reliable current verification suite.** It assumes a running server, a pre-existing target project and fixed demo credentials. Its server harness loads old bundled route files, and the browser launcher assumes the serverless Linux Chromium path. The newly added backend tests exercise current source instead. A complete browser acceptance run is still needed after the live migration and deployment.

10. **Generation status in the current page can be stale.** `src/pages/Studio.tsx` passes the project loaded before generation to `onGenerated(newSlides, fresh)`. That object may still say completed even though the backend now says generated. The stage override opens the editor, but local project state can disagree until reloaded. Left unchanged with the frontend.

## Validation performed

- Existing engine/security suite: **117/117 passed** with network access. Three initial DNS checks failed in the restricted environment and passed on the permitted rerun.
- New backend and database regression suite: **30/30 passed**. Includes real PostgreSQL rollback behavior for fresh and upgraded installations; remaining API tests use controlled database/provider substitutes.
- Production build: passed. The existing large-browser-bundle warning remains.
- Lint: passed. The existing lint configuration primarily targets TypeScript/React; it is not a complete JavaScript backend lint gate.
- Local HTTP smoke checks: **7/7 passed**: homepage, API health, signup preflight, signed-out project rejection, malformed JSON rejection, unknown route rejection, signup validation.
- Read-only live database checks: all 13 expected tables/column sets were reachable in the initial successful probe; both image buckets exist. A subsequent request returned `PGRST303: JWT issued at future`, so one transient authentication failure was observed without establishing its root cause.
- Live profile exposure and absence of the transactional save function were confirmed with read-only requests.
- Confirmed that `git diff -- src` is empty.
- Checked the production browser build for the configured backend service key and AI key; neither credential was present.

No production deployment, live database migration, real account creation, paid AI-provider request, complete browser workflow, or real-site end-to-end generation was performed. The passing local tests do not establish that those external workflows are healthy.

## Reproduce the checks

```text
npm test
npm run test:backend
npm run build
npm run lint
npm run audit:backend
npm run dev -- --host 127.0.0.1 --port 4510
node scripts/smoke-local.mjs
```

The live audit uses `.env.local`/`.env` and performs read-only requests. It prints configuration booleans and diagnostic results, never credentials or project/profile contents. Restart the development server after backend source edits; backend modules are loaded by Node and do not use frontend hot reload.
