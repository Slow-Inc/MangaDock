import {createMobileShellInjectionScript} from '../src/webViewBridge';

describe('Mobile Shell WebView bridge', () => {
  it('seeds the web hardware ID and injects Mobile Shell headers into protected fetches', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const windowStub = {
      localStorage: {
        values: new Map<string, string>(),
        setItem(key: string, value: string) {
          this.values.set(key, value);
        },
      },
      fetch: jest.fn((url: string, init?: RequestInit) => {
        calls.push([url, init]);
        return Promise.resolve({ok: true});
      }),
    };

    // eslint-disable-next-line no-new-func
    Function(
      'window',
      `${createMobileShellInjectionScript(
        '11111111-2222-4333-8444-555555555555',
      )}`,
    )(windowStub);

    await windowStub.fetch('/api/proxy/books/translate/mit-health');

    expect(windowStub.localStorage.values.get('mangadock_device_id')).toBe(
      '11111111-2222-4333-8444-555555555555',
    );
    expect(calls[0][1]?.headers).toEqual({
      'x-hardware-id': '11111111-2222-4333-8444-555555555555',
      'x-manga-dock-client': 'android-mobile-shell',
    });
  });

  it('bridges web JavaScript errors to the Mobile Shell without posting non-error console logs', () => {
    const postMessage = jest.fn();
    const windowStub: {
      localStorage: {setItem: jest.Mock};
      fetch: jest.Mock;
      ReactNativeWebView: {postMessage: jest.Mock};
      console: {error: jest.Mock; log: jest.Mock};
      onerror?: (
        message: string,
        filename: string,
        lineNumber: number,
        columnNumber: number,
      ) => boolean;
    } = {
      localStorage: {
        setItem: jest.fn(),
      },
      fetch: jest.fn(),
      ReactNativeWebView: {
        postMessage,
      },
      console: {
        error: jest.fn(),
        log: jest.fn(),
      },
    };

    // eslint-disable-next-line no-new-func
    Function(
      'window',
      `${createMobileShellInjectionScript(
        '11111111-2222-4333-8444-555555555555',
      )}`,
    )(windowStub);

    windowStub.onerror?.('boom', 'app.js', 10, 2);
    windowStub.console.error('bad request', {status: 500});
    windowStub.console.log('normal log');

    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toMatchObject({
      source: 'mangadock-web',
      type: 'js_error',
      message: 'boom',
      filename: 'app.js',
      lineNumber: 10,
      columnNumber: 2,
    });
    expect(JSON.parse(postMessage.mock.calls[1][0])).toMatchObject({
      source: 'mangadock-web',
      type: 'console_error',
      message: 'bad request {"status":500}',
    });
  });
});
