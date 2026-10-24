import {createLegacyOAuthInjectionScript, type NativeAuthPublicConfig} from './legacyOAuthBridge';
import {getMobileShellUrl} from './config';

const WEB_HARDWARE_ID_KEY = 'mangadock_device_id';

export function createMobileShellInjectionScript(hardwareId: string, authConfig?: NativeAuthPublicConfig) {
  const serializedHardwareId = JSON.stringify(hardwareId);
  const serializedHardwareIdKey = JSON.stringify(WEB_HARDWARE_ID_KEY);

  return `
    (function () {
    if (window.location.origin !== ${JSON.stringify(new URL(getMobileShellUrl()).origin)}) return;
    ${createLegacyOAuthInjectionScript(authConfig)}
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
        // Android WebView cannot download blob: links, so same-origin exports
        // go to the native share sheet. The request opens synchronously because
        // pages revoke the object URL right after click().
        var shareBlobDownload = function (anchor) {
          var href = String(anchor.href || '');
          if (!anchor.hasAttribute('download') || href.indexOf('blob:' + window.location.origin + '/') !== 0) {
            return false;
          }
          var request = new window.XMLHttpRequest();
          request.open('GET', href);
          request.responseType = 'blob';
          request.onload = function () {
            var blob = request.response;
            var reader = new window.FileReader();
            reader.onloadend = function () {
              var result = String(reader.result || '');
              postDiagnosticsEvent({
                type: 'file_download',
                filename: anchor.getAttribute('download') || '',
                mimeType: blob && blob.type ? blob.type : '',
                data: result.slice(result.indexOf(',') + 1)
              });
            };
            reader.readAsDataURL(blob);
          };
          request.send();
          return true;
        };
        if (window.HTMLAnchorElement && window.XMLHttpRequest && window.FileReader) {
          var originalAnchorClick = window.HTMLAnchorElement.prototype.click;
          window.HTMLAnchorElement.prototype.click = function () {
            if (shareBlobDownload(this)) return;
            return originalAnchorClick.apply(this, arguments);
          };
          window.document.addEventListener('click', function (event) {
            var anchor = event.target && event.target.closest ? event.target.closest('a[download]') : null;
            if (anchor && shareBlobDownload(anchor)) event.preventDefault();
          }, true);
        }
        // Lets Android Back close the top web dialog the way Escape does.
        // Observe the document node: at document start documentElement does not exist yet.
        if (window.MutationObserver && window.document) {
          var modalOpen = false;
          var reportModalState = function () {
            var dialogs = window.document.querySelectorAll ? window.document.querySelectorAll('[role="dialog"][aria-modal="true"]') : [];
            var open = Array.prototype.some.call(dialogs, function (dialog) {
              return dialog.getClientRects().length > 0;
            });
            if (open === modalOpen) return;
            modalOpen = open;
            postDiagnosticsEvent({type: 'modal_state', open: open});
          };
          new window.MutationObserver(reportModalState).observe(window.document, {
            subtree: true, childList: true, attributes: true, attributeFilter: ['role', 'aria-modal', 'class', 'style', 'hidden']
          });
        }
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
    })();
    true;
  `;
}
