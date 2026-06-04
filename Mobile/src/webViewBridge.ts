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
