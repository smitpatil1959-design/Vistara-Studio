import { readFileSync } from 'node:fs';
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch { /* optional file */ }
}
const { llmComplete } = await import('../server/understanding/llm.js');
try {
  const result = await llmComplete('Return JSON only. Copy the supplied fact without adding facts.', 'Fact: Python is a programming language. Return {"fact":"..."}.');
  const parsed = JSON.parse(result.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, ''));
  if (!parsed.fact?.includes('Python')) throw new Error('Provider did not return the requested fact');
  console.log(JSON.stringify({ ok: true, engine: result.engine, model: result.model, jsonValidated: true }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
