// Physical QA only. Attach to the app's forwarded WebView, never personal tabs.
// Records outcome flags only; no auth codes, tokens, emails or provider URLs.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {mkdirSync, writeFileSync} = require('node:fs');
const {resolve} = require('node:path');
const provider = process.argv[2] || 'google';
const webUrl = process.env.HYBRID_WEB_URL || 'http://localhost:4016';
if (!['google', 'facebook'].includes(provider)) throw new Error('Choose google or facebook');
(async () => {
  const browser = await chromium.connectOverCDP(process.env.HYBRID_CDP_URL || 'http://127.0.0.1:9226');
  try {
    const page = browser.contexts()[0].pages().find(p => new URL(p.url()).origin === new URL(webUrl).origin);
    if (!page) throw new Error('QA WebView is not open');
    await page.evaluate(() => {
      window.__qaOAuthResults = [];
      window.addEventListener('message', event => {
        if (event.data?.type === 'mangadock:native-auth:session') {
          window.__qaOAuthResults.push({success: !!event.data.access_token && !!event.data.refresh_token, error: !!event.data.error});
        }
      });
    });
    const name = provider === 'google' ? 'Google' : 'Facebook';
    const login = page.getByRole('button', {name: 'เข้าสู่ระบบ', exact: true});
    if (await login.count()) await login.first().click();
    await page.getByRole('button', {name: `เข้าสู่ระบบด้วย ${name}`, exact: true}).click();
    console.log(`${name} opened from the physical hybrid WebView; waiting for callback.`);
    let timedOut = false;
    try {await page.waitForFunction(() => window.__qaOAuthResults?.length > 0, null, {timeout: 125000});}
    catch {timedOut = true;}
    const events = await page.evaluate(() => window.__qaOAuthResults || []);
    const result = {provider, timedOut, events};
    mkdirSync(resolve(__dirname, '../build'), {recursive: true});
    writeFileSync(resolve(__dirname, `../build/oauth-${provider}-result.json`), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
    if (timedOut || !events.some(event => event.success)) process.exitCode = 1;
  } finally {await browser.close();}
})().catch(error => {console.error(error.message.split('\n')[0].replace(/https?:\/\/\S+/g, '[URL]')); process.exitCode = 1;});
