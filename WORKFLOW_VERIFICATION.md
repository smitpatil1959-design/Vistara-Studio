# Current backend and workflow verification

Updated 5 November 2026. This supersedes the historical initial `BACKEND_REVIEW.md`.

The website's visual design, colours, typography and component layouts were preserved. Frontend changes address saving, navigation and pipeline completion behaviour.

## Changes delivered

| Area | Current behaviour |
| --- | --- |
| Real page content | `www` sites discover internal pages correctly. The crawler prioritizes explanatory pages, retains bounded subpage text and attaches evidence to its actual source. Browser fallback notices, copyright fragments and duplicate passages are filtered. |
| NVIDIA | Server-side Nemotron Ultra support, explicit provider selection and a no-model mode. Truncated responses are rejected. Validated provider/model details are recorded accurately; rules fallbacks are labelled as rules. A duplicated AI rewrite pass was removed. |
| Autosave | A serial queue retains the newest document during slow/failed saves. Database version checks reject stale writes. Pending saves flush before presentation, export, sharing, report navigation and editor unmount; closing the page with unsaved work triggers a guard. |
| Research refresh | Sources, evidence and claims belong to a research-run ID. Current research and generation read only that run. Historical runs are retained separately. |
| Pipeline reliability | Concurrent jobs use a database lease. Failed generation preserves the previous deck. Slides and canonical presentation save in one database transaction. The research screen no longer repeats the elapsed research time as a second delay; refreshed running jobs wait for completion. |
| Private images | Storage buckets are private. Managed image URLs pass through the deck access gate; private decks require their owner. Browser image requests use a restricted session cookie. Direct storage policies no longer expose managed buckets. |
| PowerPoint | Text, cards, images, positioned elements, groups, icons, shapes, buttons and charts are rendered. Videos use a poster/link. Protected images load through the server with project ownership checks. |
| Security dependencies | Compatible updates and scoped dependency overrides remove the reported npm vulnerabilities. Unused Vercel CLI dependencies were removed from the application package. |
| Other backend repairs | Signup routing, local API routing, owner-only workspace chat, private visibility failures, image upload/crop error handling, canonical theme/content synchronization and export image validation were repaired. |

## Live database

The following migrations were applied to the connected **Vistara Studio** project and verified:

- `20261105_backend_reliability.sql`
- `20261105_workflow_integrity.sql`
- `20261105144642_align_evidence_claim_types.sql`

Checks confirmed the transactional save function, research-run columns, private image buckets and blocked anonymous workspace/profile reads. No existing projects or evidence were deleted. A separate test account/project was used for the browser workflow.

## Browser acceptance run

Source URL: `https://www.python.org/`.

The URL passed through the landing page and sign-in into study creation. The final crawl collected five official pages: home, About, Downloads, Documentation and Applications. It saved **78 evidence passages and 56 claims with zero extraction errors**. Public knowledge searches supplied no additional evidence, so the study correctly records crawl-only research; NVIDIA still performs the interpretation and presentation writing.

NVIDIA's stored interpretation is schema-validated, uses `nvidia/nemotron-3-ultra-550b-a55b`, has no fallback note and succeeded on the first attempt. The generation log confirmed an actual NVIDIA copy pass across five content slides, followed by a six-slide deck saved transactionally.

Final browser checks passed: refreshed generation recovered into the editor, an edited title persisted into presentation view, private visibility saved, and the export centre downloaded a real PowerPoint to `C:\Users\yashp\Downloads\python-vistara.pptx`. Inline text editing was also repaired so a stationary double-click no longer commits a spurious element move.

Presentation animation now includes the fit-to-window scale instead of overwriting it, preventing slides from being cropped in narrow windows while preserving the same transitions.

`scripts/verify-workflow.mjs` passed 13 live checks: validated NVIDIA output, owner access, saved edits, current-run citations, denied anonymous deck/document/export reads, denied private image access, owner image access through the session cookie, denied legacy public storage URLs, export readiness and the real PowerPoint response. The 200,215-byte archive contains six slide XML files, the edited title and embedded media.

Local proof files are kept under ignored `.test-build/backend/`: `workflow-verification.json`, `browser-export.pptx`, and `workflow-proof.jpg`. These are test outputs rather than committed source.

## Automated validation

- Existing engine/security suite: 117 tests passed.
- Backend, database and workflow suite: 38 tests passed, including real PostgreSQL rollback and stale-version rejection on fresh/upgraded databases, research isolation, image permissions, autosave races and a real PowerPoint archive with custom elements.
- Production build and lint passed. The existing browser bundle-size warning remains.
- Local HTTP smoke checks: 7 passed.
- `npm audit`: zero vulnerabilities.
- Built browser files were checked for configured server credentials; no server key was present.

## Limits and deployment status

Changes are in the local checkout; **the website has not been deployed**. Database protections are already installed on the connected live project. Deploy this backend and configure the server-side NVIDIA settings on the hosting provider so production image delivery and AI use the updated code.

Native PowerPoint uses Office font substitutions and approximates gradients/motion; videos export as posters/links. Conversational editor commands still use the existing supported-operation interpreter. Rate limits remain per server process. This test establishes the Python.org workflow, not universal access to every website; authentication, bot blocking and unavailable source pages can limit a crawl.

Supabase still reports **leaked-password protection disabled**. Its connector does not expose the Auth configuration setting. Enable it in the project's Auth settings if available on the plan: [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

See `AI_SETUP.md` for provider settings and the no-model option. Keep keys in `.env.local`, never in chat or frontend environment variables.
