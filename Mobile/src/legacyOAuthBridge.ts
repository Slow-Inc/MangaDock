export type NativeAuthPublicConfig = {url: string; publicKey: string};

/** Adapt the deployed web session protocol to the CLI shell's bound PKCE callback. */
export function createLegacyOAuthInjectionScript(config?: NativeAuthPublicConfig) {
  return `
    (function () {
      var config = ${JSON.stringify({url: config?.url ?? '', publicKey: config?.publicKey ?? ''})};
      var requests = Object.create(null);
      var post = function (payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      };
      var finish = function (id, state, result) {
        if (requests[id] !== state) return;
        delete requests[id];
        clearTimeout(state.timer);
        state.controller.abort();
        post({source: 'mangadock-web', type: 'oauth_callback_consumed', request_id: id});
        window.dispatchEvent(new MessageEvent('message', {
          data: Object.assign({type: 'mangadock:native-auth:session', requestId: id}, result)
        }));
      };
      var encode = function (bytes) {
        return btoa(Array.from(bytes, function (value) {return String.fromCharCode(value);}).join(''))
          .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
      };
      window.__MANGA_DOCK_LEGACY_AUTH__ = {
        start: async function (provider, id) {
          if ((provider !== 'google' && provider !== 'facebook') || typeof id !== 'string' || !id || id.length > 128) return;
          Object.keys(requests).forEach(function (previousId) {
            finish(previousId, requests[previousId], {error: 'คำขอเข้าสู่ระบบถูกแทนที่'});
          });
          var state = {controller: new AbortController(), exchanging: false};
          requests[id] = state;
          state.timer = setTimeout(function () {finish(id, state, {error: 'การเข้าสู่ระบบหมดเวลา กรุณาลองอีกครั้ง'});}, 120000);
          try {
            if (!config.url || !config.publicKey) throw new Error('ยังไม่ได้ตั้งค่า native auth ใน APK');
            var project = new URL(config.url);
            if (project.protocol !== 'https:') throw new Error('Native auth endpoint is invalid');
            state.verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
            var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state.verifier));
            if (requests[id] !== state) return;
            var redirect = new URL('mangadock://auth/callback');
            redirect.searchParams.set('request_id', id);
            var authorize = new URL('/auth/v1/authorize', project);
            authorize.searchParams.set('provider', provider);
            authorize.searchParams.set('redirect_to', redirect.href);
            authorize.searchParams.set('code_challenge', encode(new Uint8Array(digest)));
            authorize.searchParams.set('code_challenge_method', 's256');
            post({source: 'mangadock-web', type: 'oauth_start', protocol: 'expo', provider: provider, request_id: id, url: authorize.href});
          } catch (error) {
            finish(id, state, {error: error.message || 'ไม่สามารถเปิดเบราว์เซอร์เพื่อเข้าสู่ระบบได้'});
          }
        },
        receive: async function (payload) {
          var id = payload.request_id;
          var state = requests[id];
          if (!state) return;
          if (payload.error || payload.error_code) {
            finish(id, state, {error: payload.error || 'ยกเลิกการเข้าสู่ระบบแล้ว'});
            return;
          }
          if (state.exchanging) return;
          if (typeof payload.code !== 'string' || !payload.code) {
            finish(id, state, {error: 'ผล callback ไม่ถูกต้อง กรุณาลองเข้าสู่ระบบใหม่'});
            return;
          }
          state.exchanging = true;
          clearTimeout(state.timer);
          state.timer = setTimeout(function () {finish(id, state, {error: 'เครือข่ายตอบกลับช้า กรุณาลองเข้าสู่ระบบใหม่'});}, 20000);
          try {
            var response = await fetch(new URL('/auth/v1/token?grant_type=pkce', config.url).href, {
              method: 'POST',
              headers: {'Content-Type': 'application/json', apikey: config.publicKey, Authorization: 'Bearer ' + config.publicKey},
              body: JSON.stringify({auth_code: payload.code, code_verifier: state.verifier}),
              signal: state.controller.signal
            });
            var session = await response.json();
            if (requests[id] !== state) return;
            if (!response.ok || typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string') {
              throw new Error('ไม่สามารถยืนยันผลการเข้าสู่ระบบได้ กรุณาเริ่มใหม่');
            }
            finish(id, state, {access_token: session.access_token, refresh_token: session.refresh_token});
          } catch (error) {
            finish(id, state, {error: error.message || 'ไม่สามารถยืนยันผลการเข้าสู่ระบบได้'});
          }
        }
      };
    })();
    true;
  `;
}
