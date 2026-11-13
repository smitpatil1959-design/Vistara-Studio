// Run the actual crawler and configured AI provider against a public website.
// Output contains source content and provider diagnostics, never credentials.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);
const { llmComplete } = await import('../server/understanding/llm.js');
const { analyzeWebsite } = await import('../server/engine.js');
mkdirSync('.test-build/backend', { recursive: true });
try {
  const reply = await llmComplete('Return a single JSON object. Use only the supplied fact.', 'Fact: Python is a programming language. Return {"subject":"Python","description":"..."}.');
  console.log(JSON.stringify({ aiProvider: reply.engine, model: reply.model, ok: true, result: reply.text }));
} catch (error) { console.log(JSON.stringify({ aiProvider: 'configured-provider', ok: false, message: error.message })); }
const result = await analyzeWebsite('https://www.python.org/');
const { screenshotBuffer, pageShots, ...content } = result;
writeFileSync('.test-build/backend/python-crawl.json', JSON.stringify(content, null, 2));
if (screenshotBuffer) writeFileSync('.test-build/backend/python-source.jpg', screenshotBuffer);
console.log(JSON.stringify({ crawl: true, title: content.analysis?.title, pages: content.analysis?.pages?.length, paragraphs: content.analysis?.paragraphs?.length, headings: content.analysis?.headings?.length, understandingEngine: content.understanding?.meta?.engine, screenshot: !!screenshotBuffer, extraScreenshots: pageShots?.length || 0 }));
