import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { backendApi } from './server/devMiddleware.js'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // Only the public prefixes below are included in browser definitions.
  const serverEnv = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(serverEnv)) process.env[key] ??= value;
  const plugins: PluginOption[] = [react(), tailwindcss(), backendApi()];
  try {
    // @ts-expect-error — untyped arena dev plugin, present only in preview builds
    const m = (await import('./.vite-source-tags.js')) as { sourceTags(): PluginOption };
    plugins.push(m.sourceTags());
  } catch {
    // source-tags plugin is only present inside the arena dev environment
  }

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
  };
})
