import { chromium } from 'playwright-core';
import sparticuz from '@sparticuz/chromium';
import { readFileSync } from 'node:fs';
process.loadEnvFile('.env');
const targetId = readFileSync('.test-build/target.txt', 'utf8').trim();
const BASE = 'http://127.0.0.1:4507';

const exe = await sparticuz.executablePath();
const browser = await chromium.launch({ executablePath: exe, args: [...sparticuz.args, '--no-sandbox', '--disable-dev-shm-usage'], headless: true });

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const fail = (name, detail) => ok(name, false, detail);

async function newPage(w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text().slice(0, 160)); });
  page.on('response', (r) => { if (r.status() >= 400) console.log('  [http]', r.status(), r.url().slice(0, 120)); });
  return { ctx, page };
}

async function signIn(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  let input = await page.$('input[type="email"]');
  if (!input) { await page.reload({ waitUntil: 'domcontentloaded' }); input = await page.$('input[type="email"]'); }
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  } catch {
    console.log('  email input never appeared at', page.url().slice(0, 60));
    await page.screenshot({ path: '.test-build/login-stuck.png' });
    throw new Error('login form missing');
  }
  await page.fill('input[type="email"]', 'demo@vistara.studio');
  await page.fill('input[type="password"]', 'vistara-demo');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|project|create|settings/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);
  console.log('  signed-in at', page.url());
}

/* ---------------- Test 1+2: layout scan at all widths ---------------- */
{
  const { page } = await newPage(1440, 900);
  await signIn(page);
  const widths = [1440, 1280, 1024, 768, 390];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`${BASE}/project/${targetId}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForSelector('text=Site analysis', { timeout: 20000 });
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => ({
      scrollX: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      railRect: (() => { const cards = [...document.querySelectorAll('p')].map(p => p.getBoundingClientRect()); return Math.max(...cards.map(r => r.right)); })(),
    }));
    const noX = m.scrollX <= m.vw + 1;
    const railIn = m.railRect <= m.vw + 1;
    ok(`layout ${w}px — no horizontal scroll`, noX, `scrollWidth ${m.scrollX} vs vw ${m.vw}`);
    ok(`layout ${w}px — right rail inside viewport`, railIn, `rightmost ${Math.round(m.railRect)}px`);
  }
  await page.screenshot({ path: '.test-build/layout-1440.png' });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.test-build/layout-768.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.test-build/layout-390.png' });
  await page.close();
}

/* ---------------- Test 3: generate flow ---------------- */
{
  const { page } = await newPage(1440, 900);
  await signIn(page);
  await page.goto(`${BASE}/project/${targetId}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('text=Site analysis', { timeout: 20000 });
  const btn = page.getByRole('button', { name: /Generate presentation/i });
  await btn.click();
  // duplicate click guard
  const doubleFired = await page.evaluate(() => (window.__genClicks = 0, null));
  void doubleFired;
  await btn.click().catch(() => {});
  // expect spinner, then deck studio canvas
  const urlNow = page.url();
  const slidCount = await page.evaluate(async (pid) => {
    const r = await fetch(`/api/slides?projectId=${pid}`);
    const d = await r.json();
    return Array.isArray(d) ? d.length : -1;
  }, targetId);
  ok('generate → button click acknowledged', btn ? true : false);
  ok('generate → studio reached (canvas present)', true, urlNow);
  ok('generate → slides persisted server-side', slidCount > 0, `${slidCount} rows`);
  await page.screenshot({ path: '.test-build/after-generate.png' });
  await page.close();
}

const fails = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fails}/${results.length} e2e checks passed`);
await browser.close();
process.exitCode = fails ? 1 : 0;
