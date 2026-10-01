const WEB_HARDWARE_ID_KEY = 'mangadock_device_id';

export function createMobileShellInjectionScript(hardwareId: string) {
  const serializedHardwareId = JSON.stringify(hardwareId);
  const serializedHardwareIdKey = JSON.stringify(WEB_HARDWARE_ID_KEY);

  return `
    (function () {
      try {
        var postDiagnosticsEvent = function (event) {
          try {
            if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
              return;
            }

            window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({
              source: 'mangadock-web'
            }, event)));
          } catch (error) {}
        };
        var stringifyDiagnosticPart = function (part) {
          if (typeof part === 'string') {
            return part;
          }

          try {
            return JSON.stringify(part);
          } catch (error) {
            return String(part);
          }
        };
        var previousOnError = window.onerror;
        window.onerror = function (message, filename, lineNumber, columnNumber, error) {
          postDiagnosticsEvent({
            type: 'js_error',
            message: stringifyDiagnosticPart(message),
            filename: filename,
            lineNumber: lineNumber,
            columnNumber: columnNumber,
            errorName: error && error.name ? error.name : undefined
          });

          if (typeof previousOnError === 'function') {
            return previousOnError.apply(this, arguments);
          }

          return false;
        };
        var previousOnUnhandledRejection = window.onunhandledrejection;
        window.onunhandledrejection = function (event) {
          postDiagnosticsEvent({
            type: 'unhandled_rejection',
            message: stringifyDiagnosticPart(event && event.reason ? event.reason : event)
          });

          if (typeof previousOnUnhandledRejection === 'function') {
            return previousOnUnhandledRejection.apply(this, arguments);
          }
        };
        if (window.console && typeof window.console.error === 'function') {
          var originalConsoleError = window.console.error;
          window.console.error = function () {
            var parts = Array.prototype.slice.call(arguments).map(stringifyDiagnosticPart);
            postDiagnosticsEvent({
              type: 'console_error',
              message: parts.join(' ')
            });

            return originalConsoleError.apply(this, arguments);
          };
        }
        window.localStorage.setItem(${serializedHardwareIdKey}, ${serializedHardwareId});
        window.__MANGA_DOCK_CLIENT__ = 'android-mobile-shell';
        window.__MANGA_DOCK_NATIVE_AUTH__ = {
          startOAuth: function (provider, url, requestId) {
            postDiagnosticsEvent({
              type: 'oauth_start',
              provider: provider,
              request_id: requestId,
              url: url
            });
          }
        };
        var originalFetch = window.fetch;
        window.fetch = function (input, init) {
          var url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
          var target;
          try {
            target = new URL(url, window.location.href);
          } catch (error) {
            return originalFetch.apply(this, arguments);
          }
          var shouldInjectHeaders =
            (target.origin === window.location.origin && target.pathname.indexOf('/api/') === 0) ||
            target.origin === 'https://api.hayateotsu.space';

          if (!shouldInjectHeaders) {
            return originalFetch.apply(this, arguments);
          }

          var nextHeaders = new Headers(input && input.headers ? input.headers : undefined);
          if (init && init.headers) {
            new Headers(init.headers).forEach(function (value, key) {
              nextHeaders.set(key, value);
            });
          }
          nextHeaders.set('x-hardware-id', ${serializedHardwareId});
          nextHeaders.set('x-manga-dock-client', 'android-mobile-shell');

          return originalFetch.call(this, input, Object.assign({}, init, {
            headers: nextHeaders
          }));
        };
      } catch (error) {}
    })();
    true;
  `;
}
