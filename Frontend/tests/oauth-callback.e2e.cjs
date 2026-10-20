/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Playwright QA runner. */
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const base = process.env.AUTH_QA_URL || 'http://127.0.0.1:4010';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local placeholder-config build');
  const output = path.resolve(__dirname, '../../docs/reports/phase3-auth-20261001');
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.AUTH_QA_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    await page.goto(`${base}/auth/callback?error=access_denied&error_description=QA%20login%20cancelled`);
    await page.getByText('QA login cancelled', {exact: true}).waitFor();
    await page.getByRole('link', {name: /MangaDock/}).waitFor();
    await page.screenshot({path: path.join(output, 'callback-error.png')});
    console.log('PASS: callback URL error renders an error and a home link');

    await page.goto(`${base}/auth/callback`);
    await page.getByText('กำลังดำเนินการ กรุณารอสักครู่...', {exact: true}).waitFor();
    await page.getByRole('link', {name: /MangaDock/}).waitFor({timeout: 20_000});
    assert.equal(await page.getByText('กำลังดำเนินการ กรุณารอสักครู่...', {exact: true}).count(), 0);
    await page.screenshot({path: path.join(output, 'callback-timeout.png')});
    console.log('PASS: callback without a session leaves the spinner after timeout');

    // Synthetic credentials are restricted to this local placeholder Supabase project.
    const context = await browser.newContext({viewport: {width: 390, height: 844}});
    await context.route('https://qa-placeholder.supabase.co/**', route => route.fulfill({status: 401, contentType: 'application/json', body: '{}'}));
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const jwt = [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from(JSON.stringify({exp: expires, sub: 'qa-local-user', aal: 'aal1'})).toString('base64url'), 'qa-only'].join('.');
    await context.addInitScript(({jwt, expires}) => {
      localStorage.setItem('sb-qa-placeholder-auth-token', JSON.stringify({access_token: jwt, refresh_token: 'qa-local-only', token_type: 'bearer', expires_in: 3600, expires_at: expires, user: {id: 'qa-local-user', email: 'qa@example.test', user_metadata: {}, app_metadata: {}, identities: []}}));
    }, {jwt, expires});
    const sessionPage = await context.newPage();
    await sessionPage.goto(`${base}/auth/callback`);
    await sessionPage.getByText(/ยังส่งผลกลับไปยังแอปไม่ได้/).waitFor();
    await sessionPage.screenshot({path: path.join(output, 'callback-standalone-success.png')});
    console.log('PASS: an existing local session completes with an explicit standalone browser message');
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
