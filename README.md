# Vistara Studio

**Website intelligence, presented.** Vistara reads a live website end to end — crawl, five-axis audit, AI creative brief — then composes a premium 11-section presentation you can edit by hand or by sentence, present, and share.

URL → analysis → audit → AI understanding → generation → manual + AI editing → interactive presentation → export/share.

## Stack

Vite + React 19 · TypeScript (strict) · Tailwind CSS v4 · Framer Motion · Lucide React · Supabase (PostgreSQL) · Vercel serverless functions.

## Architecture

```
app/            router + route map (src/app/App.tsx)
pages/          route-level pages (Landing, AuthPage, Dashboard, CreatePage,
                SettingsPage, Studio, Present)
components/
  ui/           primitives — Spinner, ScoreRing, Pill, EditableText, EmptyState, SectionHead
  layout/       Logo, Ambient, TopNav
  deck/         SlideRenderer + SlideCanvas (themable 1280×720 deck surface)
  UrlStudyForm  single URL-intake form (landing / dashboard / create)
studio/         pipeline stages — CrawlStage, AnalysisView, AuditView,
                UnderstandView, EditorStage
landing/        marketing sections (Sections, Showcase)
services/       typed API client — http, projects, slides, chat, ai
                (UI never calls fetch() against /api directly)
hooks/          useSession, useProjects, useProjectDetail, useCreateStudy,
                useChat, useToast
lib/            supabase client, prefs, formatters, deck theme tokens
types/          canonical domain models (mirrors supabase/schema.sql)
api/            Vercel serverless routes — projects, analyze, generate,
                slides, chat, ai  (server/ holds the engine: crawler, audit,
                understanding, deck generation, NL command processor)
supabase/       schema.sql — tables, constraints, indexes
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing surface with live interactive demos |
| `/login` `/signup` | Email auth (Supabase); guest mode preserved |
| `/dashboard` | Workspace — list / create / delete studies |
| `/create` | Dedicated new-study intake |
| `/settings` | Account, default theme for new studies, data notes |
| `/project/:id` | Project workspace (crawl → report → editor) |
| `/project/:id/audit` | Workspace opened on the audit report |
| `/project/:id/presentation` | Workspace opened in the deck studio |
| `/present/:id` · `/p/:id` | Fullscreen present mode + PDF print sheet |

## Crawler security boundary

`server/security.js` treats every submitted URL as untrusted: http/https only,
ports 80/443 only, no embedded credentials, no localhost / private / loopback /
link-local / CGNAT / multicast / metadata targets — enforced by DNS resolution
on every validated host and on every redirect hop (walked manually). The
rendered capture (`server/browserCrawl.js`, Playwright on serverless Chromium)
additionally firewalls *every* request the page makes through a per-host cached
verdict, blocks `media` weight, and caps pages / navigation time / total budget /
HTML bytes / screenshot bytes / captured console errors and failed requests.
Document-level fallback capture reuses the same validation. Scan output stores
summaries only — HTML bodies and raw screenshots never touch the database
(screenshots go to the public `screenshots` storage bucket).

Status lifecycle: `queued → crawling → processing → completed | failed`
(+ `generating → generated` for deck composition).

## Environment

Defined in `vercel.json` / `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client auth).

## Scripts

`npm run dev` · `npm run build` (tsc -b + vite build) · `npm run lint`
