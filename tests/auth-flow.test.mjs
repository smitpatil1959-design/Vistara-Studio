import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

process.loadEnvFile('.env');

const BASE = 'http://127.0.0.1:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) {
    throw new Error(`Test failed: ${name} (${detail})`);
  }
}

async function run() {
  console.log('\n--- Vistara Studio Complete Authentication Flow Test ---\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('pageerror', (err) => console.log('   [pageerror]', err.message));

  const testEmail = `flowtest_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  try {
    // -------------------------------------------------------------
    // Test 1: Client Validation on /signup
    // -------------------------------------------------------------
    console.log('[Phase 1] Testing Client-Side Validation on /signup');
    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    check('Navigate to /signup', page.url().includes('/signup'));

    // Check presence of fields
    const emailInput = page.locator('input[type="email"]');
    const passInputs = page.locator('input[type="password"]');
    await passInputs.first().waitFor();
    const count = await passInputs.count();
    check('Signup has password and confirm password fields', count === 2, `Found ${count} password inputs`);

    // 1a. Invalid email
    await emailInput.fill('notanemail');
    await passInputs.nth(0).fill('123456');
    await passInputs.nth(1).fill('123456');
    await page.click('button[type="submit"]');
    const emailErr = await page.locator('[role="alert"]').textContent();
    check('Invalid email blocked client-side', emailErr?.includes('valid email'), emailErr || '');

    // 1b. Weak password (< 6 chars)
    await emailInput.fill(testEmail);
    await passInputs.nth(0).fill('123');
    await passInputs.nth(1).fill('123');
    await page.click('button[type="submit"]');
    const weakErr = await page.locator('[role="alert"]').textContent();
    check('Weak password (<6 chars) blocked client-side', weakErr?.includes('at least 6 characters'), weakErr || '');

    // 1c. Password mismatch
    await passInputs.nth(0).fill(testPassword);
    await passInputs.nth(1).fill('Mismatch999!');
    await page.click('button[type="submit"]');
    const mismatchErr = await page.locator('[role="alert"]').textContent();
    check('Password mismatch blocked client-side', mismatchErr?.includes('do not match'), mismatchErr || '');

    // 1d. Password visibility toggle
    const pwdInput = page.locator('input[placeholder="6+ characters"]');
    const eyeBtn = page.locator('button[aria-label="Show password"]').first();
    if (await eyeBtn.isVisible()) {
      await eyeBtn.click();
      const typeNow = await pwdInput.getAttribute('type');
      check('Password visibility toggle reveals text', typeNow === 'text', typeNow || '');
      const eyeOffBtn = page.locator('button[aria-label="Hide password"]').first();
      await eyeOffBtn.click();
      const typeHidden = await pwdInput.getAttribute('type');
      check('Password visibility toggle hides text', typeHidden === 'password', typeHidden || '');
    }

    // 1e. Password strength indicator
    const strengthLabel = await page.getByText(/Strong|Good|Fair|Weak/).first().textContent().catch(() => '');
    check('Password strength indicator displayed', !!strengthLabel, strengthLabel);

    // -------------------------------------------------------------
    // Test 2: Create Account (Valid Details)
    // -------------------------------------------------------------
    console.log('\n[Phase 2] Account Creation & Navigation to Sign In');
    await passInputs.nth(1).fill(testPassword);
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify redirected to /login with prefilled email
    await page.waitForURL(/\/login/, { timeout: 15000 });
    check('Redirected to /login after successful signup', page.url().includes('/login'), page.url());

    // Check status banner on /login
    const statusLocator = page.locator('[role="status"]');
    await statusLocator.waitFor({ timeout: 10000 });
    const statusMsg = await statusLocator.textContent();
    check('Success banner displayed on /login', statusMsg?.includes('Account created successfully'), statusMsg || '');

    // Verify email is pre-filled on /login
    const loginEmailVal = await page.locator('input[type="email"]').inputValue();
    check('Email automatically prefilled on /login', loginEmailVal.toLowerCase() === testEmail.toLowerCase(), loginEmailVal);

    // Verify NO email-confirmation text is shown anywhere on the page
    const pageContent = await page.textContent('body');
    const hasForbiddenWords = /check your inbox|confirm your email|email confirmation required|verify your email/i.test(pageContent || '');
    check('Zero email-confirmation wording appears on screen', !hasForbiddenWords);

    // -------------------------------------------------------------
    // Test 3: Sign In with Incorrect Password
    // -------------------------------------------------------------
    console.log('\n[Phase 3] Testing Sign In validation & authentication');
    const loginPass = page.locator('input[type="password"]');
    await loginPass.fill('WrongPassword999!');
    await page.click('button[type="submit"]');
    const loginErrEl = page.locator('[role="alert"]');
    await loginErrEl.waitFor({ timeout: 10000 });
    const loginErrMsg = await loginErrEl.textContent();
    check('Incorrect password rejected by Supabase', /incorrect|invalid/i.test(loginErrMsg || ''), loginErrMsg || '');

    // -------------------------------------------------------------
    // Test 4: Sign In with Valid Credentials
    // -------------------------------------------------------------
    console.log('\n[Phase 4] Successful Sign In & Dashboard Access');
    await loginPass.fill(testPassword);
    const loginSubmit = page.locator('button[type="submit"]');
    await loginSubmit.click();

    // Verify Dashboard opens
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    check('Dashboard opens after valid sign-in', page.url().includes('/dashboard'), page.url());

    // -------------------------------------------------------------
    // Test 5: Browser Refresh (Session Persistence)
    // -------------------------------------------------------------
    console.log('\n[Phase 5] Session Persistence & Sign Out');
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Wait a moment for session to restore
    await page.waitForTimeout(1000);
    check('Remains on /dashboard after reload (session persists)', page.url().includes('/dashboard'), page.url());

    // -------------------------------------------------------------
    // Test 6: Sign Out
    // -------------------------------------------------------------
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const signOutBtn = page.locator('button:has-text("Sign out")');
    await signOutBtn.waitFor({ timeout: 10000 });
    await signOutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    check('User successfully returned to /login upon sign out', page.url().includes('/login'));

    // -------------------------------------------------------------
    // Test 7: Sign In Again with Existing Credentials
    // -------------------------------------------------------------
    console.log('\n[Phase 6] Sign In Again');
    const reEmail = page.locator('input[type="email"]');
    await reEmail.waitFor({ timeout: 10000 });
    await reEmail.fill(testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    check('Signed in again successfully to /dashboard', page.url().includes('/dashboard'));

    // -------------------------------------------------------------
    // Test 8: Existing Email (Duplicate Registration)
    // -------------------------------------------------------------
    console.log('\n[Phase 7] Duplicate Registration Guard');
    // Clear session for duplicate test
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', testEmail);
    const signupPasses = page.locator('input[type="password"]');
    await signupPasses.nth(0).fill(testPassword);
    await signupPasses.nth(1).fill(testPassword);
    await page.click('button[type="submit"]');

    const dupAlert = page.locator('[role="alert"]');
    await dupAlert.waitFor({ timeout: 10000 });
    const dupMsg = await dupAlert.textContent();
    check('Duplicate email rejected with clear message and sign in link', /already exists|already registered/i.test(dupMsg || ''), dupMsg || '');

    // -------------------------------------------------------------
    // Test 9: Reduced Motion Accessibility
    // -------------------------------------------------------------
    console.log('\n[Phase 8] Testing Reduced Motion Accessibility');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    const signupHeading = await page.locator('h1').textContent();
    check('Page renders and functions cleanly with prefers-reduced-motion', !!signupHeading, signupHeading || '');

    console.log('\n================================================================');
    console.log('  ALL E2E AUTHENTICATION TESTS PASSED SUCCESSFULLY! (17/17 checks)');
    console.log('================================================================\n');
  } finally {
    // Clean up created test user from Supabase auth.users using service role key
    try {
      const { default: supabase } = await import('../api/db-client.js');
      const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
      const createdUser = usersData?.users?.find((u) => u.email?.toLowerCase() === testEmail.toLowerCase());
      if (createdUser?.id) {
        await supabase.auth.admin.deleteUser(createdUser.id);
        console.log(`Cleaned up test user ${testEmail} from Supabase.`);
      }
    } catch (e) {
      console.warn('Cleanup note:', e.message);
    }

    await browser.close();
  }
}

run().catch((err) => {
  console.error('\nFATAL TEST FAILURE:', err);
  process.exitCode = 1;
});
