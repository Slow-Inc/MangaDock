const WEB_HARDWARE_ID_KEY = 'mangadock_device_id';

export function createMobileShellInjectionScript(hardwareId: string) {
  const serializedHardwareId = JSON.stringify(hardwareId);
  const serializedHardwareIdKey = JSON.stringify(WEB_HARDWARE_ID_KEY);

  return `
    (function () {
      try {
        window.localStorage.setItem(${serializedHardwareIdKey}, ${serializedHardwareId});
        window.__MANGA_DOCK_CLIENT__ = 'android-mobile-shell';
        var originalFetch = window.fetch;
        window.fetch = function (input, init) {
          var url = typeof input === 'string' ? input : String(input && input.url ? input.url : input);
          var shouldInjectHeaders =
            url.indexOf('/api/') === 0 ||
            url.indexOf('https://hayateotsu.space') === 0 ||
            url.indexOf('https://api.hayateotsu.space') === 0;

          if (!shouldInjectHeaders) {
            return originalFetch.apply(this, arguments);
          }

          var nextInit = init || {};
          var nextHeaders = {};

          if (nextInit.headers) {
            if (typeof Headers !== 'undefined' && nextInit.headers instanceof Headers) {
              nextInit.headers.forEach(function (value, key) {
                nextHeaders[key] = value;
              });
            } else {
              Object.assign(nextHeaders, nextInit.headers);
            }
          }

          if (!nextHeaders['x-hardware-id']) {
            nextHeaders['x-hardware-id'] = ${serializedHardwareId};
          }
          if (!nextHeaders['x-manga-dock-client']) {
            nextHeaders['x-manga-dock-client'] = 'android-mobile-shell';
          }

          return originalFetch.call(this, input, Object.assign({}, nextInit, {
            headers: nextHeaders
          }));
        };
      } catch (error) {}
    })();
    true;
  `;
}
