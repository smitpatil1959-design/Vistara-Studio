# AI provider setup

Keep keys in `.env.local` on the server. Never use a `VITE_` or `NEXT_PUBLIC_` prefix for model keys, and never commit this file.

For NVIDIA, set:

```dotenv
AI_PROVIDER=nvidia
NVIDIA_API_KEY=your-key-here
NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

Restart the website after changing these values. Run `node scripts/verify-provider.mjs` to check a small real JSON response without printing the key. Model availability and free credits/rate limits depend on your NVIDIA account.

[Official NVIDIA model API reference](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-ultra-550b-a55b-infer).

For no model calls, set `AI_PROVIDER=none`. Crawling, evidence storage, presentation planning, editing and exports still work. Copy is produced by rules rather than generative AI. Hosted NVIDIA chat completions do not include OpenAI's web-search tool; crawled pages and public knowledge sources are still available.

`AI_PROVIDER=auto` prefers NVIDIA when configured, then other configured providers. Selecting `nvidia` prevents fallback calls to an old OpenAI key. Production hosting needs the same server-side variables configured separately from `.env.local`.
