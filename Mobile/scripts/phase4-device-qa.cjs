// Read-only product acceptance on the physical shell. Session values remain in WebView.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {mkdirSync, writeFileSync} = require('node:fs');
const {resolve} = require('node:path');
const WEB = process.env.HYBRID_WEB_URL || 'https://hayateotsu.space';
const output = resolve(__dirname, '../../docs/reports/hybrid-phase4-2026-10-24');
mkdirSync(output, {recursive: true});
// The shell uses adjustResize: an open soft keyboard shrinks the viewport, so blur and let it settle before CDP clicks.
const hideKeyboard = async page => {
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(1000);
};
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  try {
    const page = browser.contexts()[0].pages().find(p => new URL(p.url()).origin === new URL(WEB).origin);
    if (!page) throw new Error('Physical hybrid WebView not found');
    if (process.argv[2] === 'inventory') {
      const results = await page.evaluate(async () => {
        const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        const session = key ? JSON.parse(localStorage.getItem(key)) : null;
        const paths = [
          'books/landing', 'books/search?q=one%20piece&limit=3&offset=0', 'books/models', 'books/translate/mit-health',
          'forum/posts?limit=3', 'forum/trending-manga?limit=3',
          'users/me', 'users/me/favorites', 'users/me/history', 'users/me/follows', 'users/me/liked',
          'notifications?limit=3', 'notifications/unread-count', 'wallet/balance', 'wallet/transactions',
          'wallet/earnings', 'versions/me/versions', 'studio/stats?days=7',
        ];
        const results = [];
        for (const path of paths) {
          try {
            const response = await fetch('/api/proxy/' + path, {
              headers: session?.access_token ? {Authorization: 'Bearer ' + session.access_token} : {},
              signal: AbortSignal.timeout(20000),
            });
            results.push({path: path.split('?')[0], status: response.status});
            await response.arrayBuffer();
          } catch (error) {results.push({path: path.split('?')[0], error: error.name});}
        }
        return results;
      });
      writeFileSync(resolve(output, 'product-read-results.json'), JSON.stringify({boundary: 'Physical Z Flip4 WebView -> deployed Next proxy -> deployed Backend, existing authenticated account; read requests only, no purchases, follows or notification state changed.', results}, null, 2) + '\n');
      console.log(JSON.stringify(results));
      if (results.some(result => result.status !== 200)) process.exitCode = 1;
    } else if (process.argv[2] === 'translate') {
      const reader = page.getByRole('dialog', {name: /^อ่าน /});
      await reader.waitFor({state: 'visible'});
      const next = reader.getByRole('button', {name: 'หน้าถัดไป', exact: true});
      if (await next.isVisible().catch(() => false)) await next.click();
      await reader.getByTitle('เพิ่มเติม', {exact: true}).click();
      const menu = reader.locator('#reader-more-menu');
      const english = menu.getByRole('button', {name: /^(อังกฤษ|English|→ EN)$/});
      if (await english.count()) await english.click();
      const responsePending = page.waitForResponse(response => response.url().includes('/translate-patches') && response.request().method() === 'POST', {timeout: 310000});
      const started = Date.now();
      await menu.getByRole('button', {name: 'แปลหน้านี้', exact: true}).click();
      console.log('Reader single-page translation requested through the physical mobile UI.');
      const response = await responsePending;
      const body = await response.json();
      const patches = Array.isArray(body.patches) ? body.patches : [];
      if (patches.length) {
        await reader.locator('img[aria-hidden="true"]').first().waitFor({state: 'visible', timeout: 20000});
        await page.waitForFunction(() => {
          const reader = document.querySelector('[role="dialog"][aria-label^="อ่าน "]');
          const images = [...reader.querySelectorAll('img[aria-hidden="true"]')];
          return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
        }, null, {timeout: 30000});
      }
      const overlays = await reader.locator('img[aria-hidden="true"]').evaluateAll(images => images.map(image => ({loaded: image.complete && image.naturalWidth > 0, left: image.style.left, top: image.style.top, width: image.style.width, height: image.style.height})));
      const geometryValid = overlays.length === patches.length && overlays.every((overlay, i) =>
        [['left','xPct'],['top','yPct'],['width','wPct'],['height','hPct']].every(([css, key]) => Math.abs(parseFloat(overlay[css]) - patches[i][key] * 100) < 0.1));
      const result = {status: response.status(), elapsedMs: Date.now() - started, patchCount: patches.length, geometryValid, overlays};
      writeFileSync(resolve(output, 'reader-translation-result.json'), JSON.stringify(result, null, 2) + '\n');
      await reader.screenshot({path: resolve(output, 'reader-translation-device.png')});
      console.log(JSON.stringify(result));
      if (!response.ok() || patches.length && (!geometryValid || !overlays.every(image => image.loaded))) process.exitCode = 1;
    } else if (process.argv[2] === 'library-writes') {
      // Owner-approved reversible writes: each toggle is turned on, checked on the server, then turned off again.
      const BOOK = '878634d2-ea39-4001-a4bf-31458020d16a';
      const authed = path => page.evaluate(async path => {
        const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        const token = JSON.parse(localStorage.getItem(key)).access_token;
        const response = await fetch('/api/proxy/' + path, {headers: {Authorization: 'Bearer ' + token}});
        return response.json();
      }, path);
      const contains = async path => JSON.stringify(await authed(path)).includes(BOOK);
      await page.goto(WEB + '/book/' + BOOK);
      const popup = page.getByRole('dialog', {name: /Akuyaku Reijou/});
      await popup.waitFor();
      await page.waitForTimeout(2000);
      const toggles = [
        // Favourites and likes are local-first with a 5 s batched sync (Frontend lib/userCache.ts).
        ['เพิ่มในรายการ', 'users/me/favorites', 7500],
        ['ติดตาม series นี้', 'users/me/follows', 2500],
        ['ถูกใจ', 'users/me/liked', 7500],
      ];
      const results = [];
      for (const [title, path, settle] of toggles) {
        // Same DOM node for on and off: its title changes once pressed.
        const control = await popup.locator('button').filter({visible: true}).and(popup.getByTitle(title, {exact: true})).first().elementHandle();
        const before = await contains(path);
        const writes = [];
        const onResponse = response => {
          const method = response.request().method();
          if (method !== 'GET' && response.url().includes('/api/proxy/')) writes.push(method + ' ' + new URL(response.url()).pathname.replace('/api/proxy', '') + ' ' + response.status());
        };
        page.on('response', onResponse);
        await control.click();
        await page.waitForTimeout(settle);
        const titleWhenOn = await control.getAttribute('title');
        const on = await contains(path);
        await control.click();
        await page.waitForTimeout(settle);
        const titleWhenOff = await control.getAttribute('title');
        const after = await contains(path);
        page.off('response', onResponse);
        results.push({control: title, serverBefore: before, serverAfterOn: on, titleWhenOn, serverAfterOff: after, titleWhenOff, writes});
        console.log(JSON.stringify(results.at(-1)));
      }
      writeFileSync(resolve(output, 'library-writes-result.json'), JSON.stringify({boundary: 'Owner-approved reversible writes on the signed-in reader account through the physical hybrid UI; every toggle restored.', book: BOOK, results}, null, 2) + '\n');
      if (results.some(r => r.serverBefore !== r.serverAfterOff || r.serverAfterOn === r.serverBefore)) process.exitCode = 1;
    } else if (process.argv[2] === 'review-write') {
      // Owner-approved: submit one review through the book popup, read it back, then delete it.
      const BOOK = '878634d2-ea39-4001-a4bf-31458020d16a';
      const api = (method, path) => page.evaluate(async ({method, path}) => {
        const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        const token = JSON.parse(localStorage.getItem(key)).access_token;
        const response = await fetch('/api/proxy/' + path, {method, headers: {Authorization: 'Bearer ' + token}});
        return {status: response.status, text: (await response.text()).slice(0, 300)};
      }, {method, path});
      const steps = [];
      const record = (step, data) => {steps.push({step, ...data}); console.log(JSON.stringify(steps.at(-1)));};
      record('own review before', await api('GET', 'reviews/' + BOOK + '/my'));
      try {
        await page.goto(WEB + '/book/' + BOOK);
        const popup = page.getByRole('dialog', {name: /Akuyaku Reijou/});
        await popup.getByRole('button', {name: 'เขียนรีวิว'}).click();
        await popup.getByRole('button', {name: '4 ดาว', exact: true}).click();
        await popup.getByLabel('แสดงความคิดเห็นเพิ่มเติม (ไม่บังคับ)').fill('[QA] รีวิวทดสอบจากแอป hybrid (จะลบ)');
        await hideKeyboard(page);
        const sent = page.waitForResponse(r => r.url().includes('/reviews/' + BOOK) && r.request().method() === 'POST');
        await popup.getByRole('button', {name: 'ส่งรีวิว'}).click();
        const response = await sent;
        await page.waitForTimeout(1500);
        record('submit review via UI', {status: response.status(), shownInPopup: await popup.getByText('[QA] รีวิวทดสอบจากแอป hybrid (จะลบ)').first().isVisible().catch(() => false)});
        const mine = await api('GET', 'reviews/' + BOOK + '/my');
        record('own review on server', {status: mine.status, hasQaText: mine.text.includes('[QA]'), rating4: /"rating":4/.test(mine.text)});
      } finally {
        record('delete review', {status: (await api('DELETE', 'reviews/' + BOOK)).status});
        const after = await api('GET', 'reviews/' + BOOK + '/my');
        record('own review after delete', {status: after.status, empty: after.text === '' || after.text === 'null'});
        writeFileSync(resolve(output, 'review-write-result.json'), JSON.stringify({boundary: 'Owner-approved reversible review through the physical hybrid shell; deleted afterwards.', book: BOOK, steps}, null, 2) + '\n');
      }
    } else if (process.argv[2] === 'community-writes') {
      // Owner-approved: one clearly-labelled post, its comments and a vote, deleted again in finally.
      // Pass an existing QA post id to resume a cycle whose post already exists.
      const {execFileSync} = require('node:child_process');
      const adb = (...args) => execFileSync(resolve(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe'), args, {encoding: 'utf8'}).trim();
      let current = page;
      let reconnected = null;
      const api = (method, path, body) => current.evaluate(async ({method, path, body}) => {
        const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        const token = JSON.parse(localStorage.getItem(key)).access_token;
        const response = await fetch('/api/proxy/' + path, {method, headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
        return {status: response.status, body: await response.json().catch(() => null)};
      }, {method, path, body});
      const steps = [];
      const record = (step, data) => {steps.push({step, ...data}); console.log(JSON.stringify(steps.at(-1)));};
      let postId = process.argv[3];
      const commentIds = [];
      try {
        if (!postId) {
          await current.goto(WEB + '/community');
          await current.getByRole('button', {name: 'สร้างโพสต์'}).click();
          const composer = current.getByRole('dialog', {name: 'สร้างโพสต์ใหม่'});
          await composer.getByRole('button', {name: 'ทั่วไป', exact: true}).click();
          await composer.getByLabel('หัวข้อ').fill('[QA] ทดสอบแอป MangaDock hybrid Phase 4 (จะลบอัตโนมัติ)');
          await composer.getByLabel('เนื้อหา').fill('โพสต์ทดสอบอัตโนมัติจากแอปมือถือ จะถูกลบภายในไม่กี่นาที');
          await hideKeyboard(current);
          const created = current.waitForResponse(r => r.url().includes('/forum/posts') && r.request().method() === 'POST');
          await composer.getByRole('button', {name: 'โพสต์เลย'}).click();
          const response = await created;
          postId = (await response.json()).id;
          record('create post via composer UI', {status: response.status(), postId});
        }
        const streams = [];
        current.on('response', r => {if (r.url().includes('/stream')) streams.push(r.status());});
        await current.goto(WEB + '/community/p/' + postId);
        await current.waitForTimeout(3000);
        record('open post page', {sseResponses: [...streams]});
        const voted = current.waitForResponse(r => r.url().includes('/forum/vote'));
        await current.getByRole('button', {name: 'โหวตขึ้น'}).click();
        const vote = await voted;
        await current.waitForTimeout(1500);
        record('upvote via UI', {status: vote.status(), upvoteLabel: await current.getByRole('button', {name: 'โหวตขึ้น'}).innerText()});
        const commented = current.waitForResponse(r => r.url().includes('/forum/comments') && r.request().method() === 'POST');
        await current.getByLabel('ความคิดเห็นของคุณ').fill('[QA] คอมเมนต์จาก UI');
        await hideKeyboard(current);
        await current.getByRole('button', {name: 'ส่งความคิดเห็น'}).click();
        const comment = await commented;
        commentIds.push((await comment.json()).id);
        await current.waitForTimeout(1500);
        const rendered = await current.getByText('[QA] คอมเมนต์จาก UI', {exact: true}).evaluateAll(nodes => nodes.map(n => ({tag: n.tagName, liveRegion: !!n.closest('[aria-live]'), visible: n.getClientRects().length > 0})));
        record('comment via UI', {status: comment.status(), rendered});
        // Written outside React state: it can only reach the screen through the SSE stream.
        const live = await api('POST', 'forum/comments', {postId, content: '[QA] คอมเมนต์ผ่าน SSE'});
        commentIds.push(live.body?.id);
        let liveVisible = false;
        try {await current.getByText('[QA] คอมเมนต์ผ่าน SSE', {exact: true}).first().waitFor({timeout: 15000}); liveVisible = true;} catch {}
        record('comment written outside the UI appears live', {status: live.status, liveVisible});
        await browser.close().catch(() => {});
        adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
        await new Promise(r => setTimeout(r, 20000));
        adb('shell', 'monkey', '-p', 'com.mobile', '-c', 'android.intent.category.LAUNCHER', '1');
        await new Promise(r => setTimeout(r, 3000));
        reconnected = await chromium.connectOverCDP('http://127.0.0.1:9226');
        current = reconnected.contexts()[0].pages()[0];
        const resumed = await api('POST', 'forum/comments', {postId, content: '[QA] หลังกลับจาก background'});
        commentIds.push(resumed.body?.id);
        let resumedVisible = false;
        try {await current.getByText('[QA] หลังกลับจาก background', {exact: true}).first().waitFor({timeout: 20000}); resumedVisible = true;} catch {}
        record('background 20 s, resume, live comment', {status: resumed.status, path: await current.evaluate(() => location.pathname), resumedVisible});
      } finally {
        const cleanup = [];
        for (const id of commentIds.filter(Boolean)) cleanup.push(['comment', (await api('DELETE', 'forum/comments/' + id)).status]);
        if (postId) cleanup.push(['post', (await api('DELETE', 'forum/posts/' + postId)).status]);
        const gone = postId ? (await api('GET', 'forum/posts/' + postId)).status : null;
        record('cleanup', {cleanup, postGetAfterDelete: gone});
        writeFileSync(resolve(output, 'community-writes-result.json'), JSON.stringify({boundary: 'Owner-approved reversible community writes through the physical hybrid shell; all created content deleted.', postId, steps}, null, 2) + '\n');
        if (reconnected) await reconnected.close().catch(() => {});
      }
    } else if (process.argv[2] === 'reader-modes') {
      // Real touch, hardware Back and rotation go through adb; state is read through CDP.
      const {execFileSync} = require('node:child_process');
      const adb = (...args) => execFileSync(resolve(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe'), args, {encoding: 'utf8'}).trim();
      const shot = name => {
        adb('shell', 'screencap', '-d', process.env.QA_DISPLAY_ID || '4630946784334733698', '-p', '/sdcard/md-qa.png');
        adb('pull', '/sdcard/md-qa.png', resolve(output, 'device', name));
      };
      mkdirSync(resolve(output, 'device'), {recursive: true});
      const reader = page.getByRole('dialog', {name: /^อ่าน /});
      const state = () => page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label^="อ่าน "]');
        if (!dialog) return {readerOpen: false, path: location.pathname};
        const centre = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        const image = centre && centre.closest('div') ? centre.closest('div').querySelector('img[alt^="หน้า"]') : null;
        const visible = [...dialog.querySelectorAll('img[alt^="หน้า"]')].filter(i => {
          const r = i.getBoundingClientRect();
          return r.bottom > innerHeight * 0.3 && r.top < innerHeight * 0.7 && r.width > 0;
        }).map(i => i.alt);
        const zoom = (dialog.innerText.match(/\d+%/) || [''])[0];
        return {readerOpen: true, path: location.pathname, chapter: dialog.querySelector('[title="เลือกตอน"]')?.textContent.trim(),
          visiblePage: visible[0] || (image && image.alt), zoom, viewport: [innerWidth, innerHeight]};
      });
      const steps = [];
      const record = async (step, extra = {}) => {steps.push({step, ...(await state()), ...extra}); console.log(JSON.stringify(steps.at(-1)));};
      const before = {accelerometer: adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation'), rotation: adb('shell', 'settings', 'get', 'system', 'user_rotation')};
      try {
        await page.goto(WEB + '/');
        await page.waitForTimeout(2000);
        await page.goto(WEB + '/book/878634d2-ea39-4001-a4bf-31458020d16a');
        await page.getByRole('dialog', {name: /Akuyaku Reijou/}).getByRole('button', {name: 'อ่านตอนที่ 0', exact: true}).click();
        await reader.waitFor({state: 'visible'});
        await page.waitForTimeout(2500);
        await record('opened');
        const more = async () => {await reader.getByTitle('เพิ่มเติม', {exact: true}).click(); await page.waitForTimeout(400);};
        const menu = reader.locator('#reader-more-menu');
        await more(); await menu.getByRole('button', {name: 'ทีละหน้า', exact: true}).click(); await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1500);
        await record('single-page mode');
        adb('shell', 'input', 'swipe', '900', '1300', '150', '1300', '250');
        await page.waitForTimeout(1500);
        // The web Reader has no swipe gesture; paging is by the tap zones and arrows.
        await record('swipe left (real touch, web Reader has no swipe handler)');
        adb('shell', 'input', 'tap', '960', '1300');
        await page.waitForTimeout(1500);
        await record('tap right zone (real touch)');
        shot('40-reader-single-page-after-tap.png');
        await more(); await menu.getByRole('button', {name: 'ขยาย'}).click(); await menu.getByRole('button', {name: 'ขยาย'}).click();
        await page.waitForTimeout(800);
        await record('zoom in twice');
        shot('41-reader-zoomed.png');
        await menu.getByRole('button', {name: 'ย่อ'}).click(); await menu.getByRole('button', {name: 'ย่อ'}).click();
        await menu.getByRole('button', {name: 'ต่อเนื่อง', exact: true}).click();
        await page.waitForTimeout(1500);
        await record('continuous mode, zoom restored');
        adb('shell', 'input', 'swipe', '540', '1900', '540', '500', '300');
        await page.waitForTimeout(1500);
        await record('scroll down (real touch)');
        await reader.getByTitle('ตอนถัดไป', {exact: true}).click();
        await page.waitForTimeout(4000);
        await record('next chapter');
        shot('42-reader-next-chapter.png');
        adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
        adb('shell', 'settings', 'put', 'system', 'user_rotation', '1');
        await page.waitForTimeout(3000);
        await record('landscape');
        shot('43-reader-landscape.png');
        adb('shell', 'settings', 'put', 'system', 'user_rotation', before.rotation);
        await page.waitForTimeout(3000);
        await record('portrait restored');
        adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
        await page.waitForTimeout(2000);
        await record('hardware Back 1 (expect Reader closed, book popup kept)', {bookPopupOpen: await page.getByRole('dialog', {name: /Akuyaku Reijou/}).isVisible().catch(() => false)});
        shot('44-after-hardware-back-1.png');
        adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
        await page.waitForTimeout(2000);
        await record('hardware Back 2 (expect book popup closed)', {bookPopupOpen: await page.getByRole('dialog', {name: /Akuyaku Reijou/}).isVisible().catch(() => false)});
        shot('45-after-hardware-back-2.png');
      } finally {
        adb('shell', 'settings', 'put', 'system', 'user_rotation', before.rotation);
        adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', before.accelerometer);
      }
      const restored = {accelerometer: adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation'), rotation: adb('shell', 'settings', 'get', 'system', 'user_rotation')};
      writeFileSync(resolve(output, 'reader-modes-result.json'), JSON.stringify({boundary: 'Physical Z Flip4 hybrid shell; adb touch/keys/rotation; public chapter; no writes.', settingsBefore: before, settingsRestored: restored, steps}, null, 2) + '\n');
    } else if (process.argv[2] === 'batch') {
      console.log('Batch SSE: two generated English fixtures (plus an unreachable page with --failure); disconnect then reattach. No personal image is uploaded.');
      const failure = process.argv.includes('--failure');
      const result = await page.evaluate(async failure => {
        const clearance = localStorage.getItem('cf_clearance_token');
        if (!clearance) return {blocked: 'Reader captcha clearance is required'};
        const fixture = (title, line) => {
          const canvas = document.createElement('canvas');
          canvas.width = 1000; canvas.height = 600;
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1000, 600);
          context.strokeStyle = '#000000'; context.lineWidth = 6;
          context.beginPath(); context.ellipse(500, 300, 420, 230, 0, 0, Math.PI * 2); context.stroke();
          context.fillStyle = '#000000'; context.textAlign = 'center'; context.font = 'bold 58px sans-serif';
          context.fillText(title, 500, 250);
          context.font = '48px sans-serif'; context.fillText(line, 500, 350);
          return canvas.toDataURL('image/jpeg', 0.9);
        };
        const chapterId = 'phase4-qa-batch-' + Date.now();
        const body = JSON.stringify({sourceLang: 'en', targetLang: 'th', pages: [
          {pageIndex: 0, pageUrl: fixture('WAIT FOR ME!', 'WE HAVE TO GO NOW.')},
          {pageIndex: 1, pageUrl: fixture('THANK YOU!', 'I WILL NEVER FORGET THIS.')},
          ...(failure ? [{pageIndex: 2, pageUrl: location.origin + '/phase4-qa-missing-page.jpg'}] : []),
        ]});
        const post = signal => fetch('/api/proxy/books/chapters/' + chapterId + '/batch-translate-patches', {
          method: 'POST', headers: {'Content-Type': 'application/json', 'x-captcha-clearance': clearance}, body, signal});
        // Reads SSE frames until `stop(events)` is true or the stream ends.
        const read = async (response, started, stop) => {
          const events = []; const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
          for (;;) {
            const {done, value} = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, {stream: true});
            const frames = buffer.split('\n\n'); buffer = frames.pop();
            for (const frame of frames) {
              const at = Math.round(performance.now() - started);
              if (frame.startsWith(':')) events.push({at, comment: frame.slice(1).trim()});
              else if (frame.startsWith('data: ')) {
                const data = JSON.parse(frame.slice(6));
                events.push(data.type === 'progress' ? {at, progress: data.stage, pageIndex: data.pageIndex}
                  : {at, pageIndex: data.pageIndex, patches: data.patches.length, error: data.error, urls: data.patches.map(p => p.url),
                    coordinatesValid: data.patches.every(p => ['xPct', 'yPct', 'wPct', 'hPct'].every(k => p[k] >= 0 && p[k] <= 1))});
              }
            }
            if (stop(events)) {await reader.cancel(); return {events, cancelled: true};}
          }
          return {events, cancelled: false};
        };
        // 1) First connection: drop it as soon as MIT reports progress or the first page completes.
        const controller = new AbortController(); let started = performance.now();
        const first = await post(controller.signal);
        const firstRead = await read(first, started, events => events.some(e => e.progress || e.pageIndex >= 0));
        controller.abort();
        // 2) Reattach to the still-running background job with the identical request.
        await new Promise(r => setTimeout(r, 1500));
        started = performance.now();
        const second = await post(AbortSignal.timeout(600000));
        const secondRead = await read(second, started, () => false);
        const completed = secondRead.events.filter(e => 'patches' in e);
        const images = [];
        for (const url of completed.flatMap(e => e.urls)) {
          const image = await fetch('/api/proxy' + new URL(url, location.origin).pathname);
          const bytes = new Uint8Array(await image.arrayBuffer());
          images.push({status: image.status, png: bytes[0] === 137 && bytes[1] === 80});
        }
        return {chapterId, firstStatus: first.status, firstConnection: firstRead, secondStatus: second.status,
          secondConnection: secondRead, completedPages: completed.map(e => e.pageIndex).sort(), images};
      }, failure);
      writeFileSync(resolve(output, failure ? 'batch-sse-failure-result.json' : 'batch-sse-result.json'), JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify(result));
      const pages = result.secondConnection?.events.filter(e => 'patches' in e) ?? [];
      // The backend loads every page before calling MIT, so one unreachable page fails the whole job with a pageIndex -1 error.
      const ok = failure ? pages.length > 0 && pages.every(e => e.pageIndex === -1 && e.error)
        : pages.some(e => e.pageIndex === 0 && e.patches > 0 && !e.error) && pages.some(e => e.pageIndex === 1 && e.patches > 0 && !e.error)
          && result.images.every(i => i.status === 200 && i.png);
      if (!ok) process.exitCode = 1;
    } else if (process.argv[2] === 'mit') {
      console.log('Submitting a generated English speech-bubble fixture to the deployed MIT pipeline. No personal screenshot is uploaded.');
      const result = await page.evaluate(async () => {
        const clearance = localStorage.getItem('cf_clearance_token');
        if (!clearance) return {blocked: 'Reader captcha clearance is required'};
        const canvas = document.createElement('canvas');
        canvas.width = 1000; canvas.height = 600;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1000, 600);
        context.strokeStyle = '#000000'; context.lineWidth = 6;
        context.beginPath(); context.ellipse(500, 300, 420, 230, 0, 0, Math.PI * 2); context.stroke();
        context.fillStyle = '#000000'; context.textAlign = 'center'; context.font = 'bold 58px sans-serif';
        context.fillText('HELLO!', 500, 250);
        context.font = '48px sans-serif'; context.fillText('HOW ARE YOU TODAY?', 500, 350);
        const started = performance.now();
        const response = await fetch('/api/proxy/books/chapters/phase4-qa-' + Date.now() + '/pages/0/translate-patches', {
          method: 'POST', headers: {'Content-Type': 'application/json', 'x-captcha-clearance': clearance},
          body: JSON.stringify({pageUrl: canvas.toDataURL('image/jpeg', 0.9), sourceLang: 'en', targetLang: 'th'}),
          signal: AbortSignal.timeout(310000),
        });
        const data = await response.json();
        const patches = Array.isArray(data.patches) ? data.patches : [];
        const images = [];
        for (const patch of patches) {
          const url = new URL(patch.url, location.origin);
          const relative = '/api/proxy' + url.pathname;
          const image = await fetch(relative);
          const bytes = new Uint8Array(await image.arrayBuffer());
          images.push({status: image.status, png: bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71});
        }
        return {status: response.status, elapsedMs: Math.round(performance.now() - started), patchCount: patches.length,
          coordinatesValid: patches.every(p => ['xPct','yPct','wPct','hPct'].every(key => Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 1)), images,
          failure: response.ok ? undefined : data.message};
      });
      writeFileSync(resolve(output, 'mit-live-result.json'), JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify(result));
      if (result.status !== 201 && result.status !== 200 || !result.patchCount || result.images.some(image => image.status !== 200 || !image.png)) process.exitCode = 1;
    } else {
      const chapter = '878634d2-ea39-4001-a4bf-31458020d16a';
      await page.goto(WEB + '/book/' + chapter);
      const book = page.getByRole('dialog', {name: /Akuyaku Reijou/});
      await book.waitFor({state: 'visible', timeout: 30000});
      await book.getByRole('button', {name: 'อ่านตอนที่ 0', exact: true}).click();
      const reader = page.getByRole('dialog', {name: /^อ่าน /});
      await reader.waitFor({state: 'visible'});
      let loaded = false;
      try {await page.waitForFunction(() => [...document.images].some(image => image.alt === 'หน้า 1' && image.complete && image.naturalWidth > 0), null, {timeout: 30000}); loaded = true;}
      catch {}
      const result = {
        readerVisible: await reader.isVisible(), firstPageLoaded: loaded,
        captchaVisible: await page.getByRole('heading', {name: 'ยืนยันตัวตน', exact: true}).isVisible().catch(() => false),
        translateButtons: await reader.getByRole('button').evaluateAll(buttons => buttons.filter(b => /แปล/.test(b.textContent)).map(b => b.textContent.trim().slice(0,80))),
      };
      writeFileSync(resolve(output, 'reader-result.json'), JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify(result));
      if (!loaded) process.exitCode = 1;
    }
  } finally {await browser.close();}
})().catch(error => {console.error(error.message.split('\n')[0]); process.exitCode = 1;});
