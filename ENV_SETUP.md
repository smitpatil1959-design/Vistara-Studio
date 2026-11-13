# Environment Configuration Guide

## Required Variables

These environment variables **must** be configured on your Vercel/hosting platform:

### Supabase
```
SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get these from:
- **Supabase Dashboard** → Settings → API → Project URL
- **Supabase Dashboard** → Settings → API → Service Role Secret (keep private!)
- **Supabase Dashboard** → Settings → API → Publishable/anon key (browser-safe)

Use the **same Supabase project URL** for `SUPABASE_URL` and `VITE_SUPABASE_URL`.

### Google Sign-In

Google sign-in does not require Google credentials in `.env`. Configure them in Supabase:

1. In Google Cloud Console, create a Google OAuth client and add the callback URL shown by Supabase.
2. In **Supabase Dashboard → Authentication → Providers → Google**, enable Google and enter the Google client ID and secret.
3. In **Authentication → URL Configuration**, set the site URL and add your local and deployed app URLs to the redirect allow list (for example, `http://localhost:5173/**` and `https://your-domain.example/**`).
4. Keep the Google client secret in Supabase; do not add it to `.env`, frontend variables, or source control.

## Optional Variables

### OpenAI Integration (Recommended)
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

Get from:
- **OpenAI API Keys** → https://platform.openai.com/account/api-keys
- **Keep your API key secret** — never commit to Git

**Important**: Without `OPENAI_API_KEY`, web research will be unavailable, but basic website crawling and analysis will still work.

### Research & Crawl Limits (Optional)
```
MAX_CRAWL_PAGES=50              # Max pages to crawl per study (default: 50)
MAX_SEARCH_QUERIES=10           # Max OpenAI web searches per study (default: 10)
MAX_RESEARCH_SOURCES=100        # Max total sources collected (default: 100)
MAX_AI_CALLS_PER_STUDY=20       # Max AI calls per study (default: 20)
CRAWL_TIMEOUT_MS=30000          # Crawl timeout in milliseconds (default: 30000)
SEARCH_TIMEOUT_MS=10000         # Search timeout in milliseconds (default: 10000)
```

### Application Environment
```
NODE_ENV=production            # or 'development'
```

## How to Set Environment Variables

### Vercel
1. Go to **Project Settings** → **Environment Variables**
2. Add each key-value pair
3. Select environments (Production/Preview/Development as needed)
4. Redeploy after changes

### Local Development (`.env.local`)
Create a `.env.local` file in the project root:

```bash
SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
MAX_CRAWL_PAGES=50
MAX_SEARCH_QUERIES=10
```

**⚠️ WARNING**: Never commit `.env.local` to Git. Add it to `.gitignore`.

## Validation

The application validates all required variables on startup. If any are missing:

```
Error: Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

Configuration is checked by `/server/config.js` and exported to all API routes.

## Client and Server Keys

The Supabase anon/publishable key is intended for browser use and is exposed through `VITE_SUPABASE_ANON_KEY`. Protect data with Supabase RLS policies.
Never expose `SUPABASE_SERVICE_ROLE_KEY`, Google OAuth client secrets, or AI provider keys to the browser or a `VITE_*`/`NEXT_PUBLIC_*` variable.

AI and research operations go through the Vistara backend API.

## Troubleshooting

**"Database schema is not initialized"**
→ Run Supabase migrations: `supabase db push` or manually execute `/supabase/schema.sql`

**"Web research is not configured"**
→ Set `OPENAI_API_KEY` to enable OpenAI web search. Without it, only website crawling works.

**"Permission denied" on Supabase operations**
→ Check `SUPABASE_SERVICE_ROLE_KEY` is correct and has full permissions

**API key shows in errors**
→ Report the issue with redacted keys — we never log secrets directly
