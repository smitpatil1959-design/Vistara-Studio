# Vistara Studio V2 verification

## Architecture

[The pre-implementation architecture audit](V2_ARCHITECTURE.md) maps the existing React and Vite app, Vercel routes, website research pipeline, Supabase tables and export path. The editor previously combined generated slide rows, a layout-specific preview and a separate set of editing controls. V2 uses one versioned presentation document for the editor, web presentation and PowerPoint.

The document adds element position, size, rotation, ordering, grouping, lock and visibility. Slides can carry layout, notes, source references and colour or typography overrides. Brand and asset records carry provenance. Old documents keep their identifiers and are normalized when opened. The editor saves with the existing transactional Supabase function, which checks the document version and saves the canonical document and legacy projection together. V2 itself requires no new database migration.

## Implementation

| Area | Main additions or changes |
| --- | --- |
| Editor | Added `src/studio/v2/` and `src/studio/SharePanel.tsx`. Integrated the new workspace through `src/studio/EditorStage.tsx` and `src/pages/Studio.tsx`. The editor has a tool dock, story outline, canvas, slide navigator, contextual properties, layers, notes, and status. |
| Shared model | Added `src/deck-spec/brand.ts`, `design.ts`, `geometry.ts`, `evidence.ts`, and `proposals.ts`. Updated the document types, normalizer, validation and edit operations. The catalog has 31 presets built from shared composition patterns. |
| Research and generation | Updated `server/browserCrawl.js`, `server/engine.js`, `server/webSearch.js`, `server/presentationPlanner.js`, and the subject, extraction and copy stages. The planner narrows product pages to relevant evidence when enough is available. The generator commits brand, notes, provenance and final layouts together through `server/deckStore.js`. |
| AI editing | Added `server/editorProposal.js` and `src/studio/v2/AssistantPanel.tsx`. Suggestions are scoped and validated. Preview changes do not write the deck. Applying a proposal creates one undoable edit. A proposal based on an older local draft must be refreshed. |
| Rendering and export | Updated `src/components/deck/SpecStage.tsx`, its element renderers and `src/pages/Present.tsx`. Updated `server/export/` and the export route for native slide objects, image cropping, source URLs and speaker notes. |
| Verification | Added `tests/v2.test.mjs`, `scripts/verify-v2-sites.mjs`, and `scripts/verify-v2-export.mjs`. Earlier autosave, research isolation, asset authorization and transactional-save checks still run in the main suite. |

Brand signals come from observed page styles and controls. The Brand Kit exposes those signals, supports deck or slide scope, and marks a fallback if no reliable brand signal is available. The design checks cover likely text overflow, low contrast, off-canvas placement, overlaps and repeated headings. They are estimates and can flag intentional overlaps. The check can fit text and repair contrast. It leaves the author in control of element positioning.

## Verification

- Production build and lint passed. The build reports one existing entry chunk larger than Vite’s 500 kB advisory threshold.
- All 169 automated checks passed, comprising 117 in the main runner and 52 in the backend, database, workflow and V2 suites. The npm audit reported zero known vulnerabilities.
- A real browser workflow entered the Apple iPhone URL, ran research with NVIDIA Nemotron, generated an editable deck, changed the title and notes, dragged and resized the title, exercised undo and redo, and confirmed the saved result after reopening.
- The browser verified slide addition, duplication, reorder, deletion, grouping and ungrouping. A colour change reached the saved document and the detected palette could be reapplied. The canvas fit at 732 px and the full desktop workspace was checked at 1440 px.
- A live NVIDIA title rewrite showed the original on the canvas until Apply. Apply changed the title, and Undo restored it. The presenter showed the edited slide and note, advanced by keyboard and returned to the editor with Escape.
- PowerPoint downloaded through the browser. The final export contained the saved title and notes, three slides and the embedded website screenshot. The presentation package was inspected and all three slides were rendered in a compatible renderer. Automated checks inspected native chart and table structures, editable diagram nodes, text rotation and notes. The signed-out request for the private deck’s stored screenshot returned 404. The signed-in owner could load it.

## Live website cases

All five sites produced editable V2 documents using live website data and NVIDIA. The Swiggy comparison used separate projects for college and investor to avoid changing either draft during generation. Claim counts refer to the current research results before slide selection.

| Website | Purpose | Slides | Research claims | Observed primary |
| --- | --- | ---: | ---: | --- |
| [Swiggy corporate](https://www.swiggy.com/corporate/) | College project | 7 | 22 | `#FF5200` |
| [Swiggy corporate](https://www.swiggy.com/corporate/) | Investor | 6 | 22 | `#FF5200` |
| [Apple iPhone](https://www.apple.com/iphone/) | Product demo | 3 | 100 | `#0071E3` |
| [Spotify newsroom](https://newsroom.spotify.com/company-info/) | Company overview | 5 | 52 | `#1ED760` |
| [MIT](https://www.mit.edu/) | College project | 7 | 27 | `#FF1423` |
| [Flour Bakery](https://www.flourbakery.com/) | Company overview | 5 | 69 | `#EED63E` |

Swiggy’s college draft opened with the company context and included a references slide. The investor draft brought delivery and market context forward. The Apple deck used the product page for slide citations after the first draft incorrectly selected MacBook evidence. The original Apple browser workflow and the fresh generation pass used separate test projects.

## Visual evidence

- [Editor before the rebuild](.test-build/backend/editor-before-v2.jpg)
- [Edited iPhone deck with the title selected](.test-build/backend/v2-apple-editor.jpg)
- [Fresh iPhone cover with a neutral background and blue accent](.test-build/backend/v2-apple-generated.jpg). The small product photo was removed from the disposable draft during visual review. Logo classification now distinguishes a logo asset from a product photo whose description mentions a logo.
- [Swiggy college deck and its orange cover](.test-build/backend/v2-swiggy-editor.jpg)
- [PowerPoint export from the browser-edited deck](.test-build/backend/v2-apple-workflow.pptx)
- [PowerPoint cover render](.test-build/backend/v2-pptx-final-render/slide-1.png) · [Slide 2 render](.test-build/backend/v2-pptx-final-render/slide-2.png) · [Slide 3 render](.test-build/backend/v2-pptx-final-render/slide-3.png)

## Limits and scope

- Coverage depends on the pages a site exposes, and source-backed copy still needs editorial review. A product-page draft can be short and overemphasize offers when those dominate the available evidence. A chart based on research requires comparable figures. Missing evidence does not create placeholder statistics.
- PowerPoint substitutes fonts where necessary. Web motion exports in its final state. Videos export as linked stills, gradients as bitmap backgrounds, and some complex objects stay upright to preserve editability.
- The in-app browser disables native fullscreen. The dedicated presenter, navigation, notes and Escape were verified there. True native fullscreen remains unverified.
- The Vercel configuration and 300-second function limit fit the documented Hobby limit with Fluid Compute. Production deployment and production payload limits were not exercised. [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
