import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
envFile.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[k] = v;
  }
});

const key = process.env.OPENAI_API_KEY;
console.log('Testing OpenAI key:', key ? key.slice(0, 10) + '...' : 'NONE');

try {
  // Test chat completions
  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in 2 words' }],
    }),
  });
  console.log('Chat API status:', chatRes.status);
  const chatText = await chatRes.text();
  console.log('Chat API response:', chatText.slice(0, 300));
} catch (e) {
  console.error('Chat API exception:', e);
}

try {
  // Test responses API
  const respRes = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: 'Say hello in 2 words',
    }),
  });
  console.log('Responses API status:', respRes.status);
  const respText = await respRes.text();
  console.log('Responses API response:', respText.slice(0, 300));
} catch (e) {
  console.error('Responses API exception:', e);
}
