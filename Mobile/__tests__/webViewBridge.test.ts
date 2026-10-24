import {createMobileShellInjectionScript} from '../src/webViewBridge';

describe('Mobile Shell WebView bridge', () => {
  it('seeds the web hardware ID and injects Mobile Shell headers into protected fetches', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const windowStub = {
      location: {href: 'https://hayateotsu.space/', origin: 'https://hayateotsu.space'},
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
    expect(new Headers(calls[0][1]?.headers).get('x-hardware-id')).toBe(
      '11111111-2222-4333-8444-555555555555',
    );
    expect(new Headers(calls[0][1]?.headers).get('x-manga-dock-client')).toBe(
      'android-mobile-shell',
    );
  });

  it('keeps native identity on API requests and does not send it to other origins', async () => {
    const originalFetch = jest.fn((_input: unknown, _init?: RequestInit) =>
      Promise.resolve({ok: true}),
    );
    const windowStub = {
      location: {href: 'https://hayateotsu.space/', origin: 'https://hayateotsu.space'},
      localStorage: {setItem: jest.fn()},
      fetch: originalFetch,
    };

    // eslint-disable-next-line no-new-func
    Function('window', createMobileShellInjectionScript('native-id'))(windowStub);

    await windowStub.fetch('https://hayateotsu.space.evil.test/api/private');
    expect(originalFetch.mock.calls[0]).toHaveLength(1);

    await windowStub.fetch('/api/proxy/books', {
      headers: {'X-Hardware-ID': 'web-id', Authorization: 'Bearer test'},
    });
    const headers = new Headers(originalFetch.mock.calls[1][1]?.headers);
    expect(headers.get('x-hardware-id')).toBe('native-id');
    expect(headers.get('x-manga-dock-client')).toBe('android-mobile-shell');
    expect(headers.get('authorization')).toBe('Bearer test');

    await windowStub.fetch({
      url: 'https://api.hayateotsu.space/books/chapter',
      headers: new Headers({'x-existing': 'kept'}),
    });
    const requestHeaders = new Headers(originalFetch.mock.calls[2][1]?.headers);
    expect(requestHeaders.get('x-existing')).toBe('kept');
    expect(requestHeaders.get('x-hardware-id')).toBe('native-id');
  });

  it('bridges web JavaScript errors to the Mobile Shell without posting non-error console logs', () => {
    const postMessage = jest.fn();
    const windowStub: {
      location: {href: string; origin: string};
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
      location: {href: 'https://hayateotsu.space/', origin: 'https://hayateotsu.space'},
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

  it('hands blob downloads to the native share bridge before the page revokes them', () => {
    const postMessage = jest.fn();
    const originalClick = jest.fn();
    const opened: string[] = [];
    class Anchor {
      attributes: Record<string, string> = {};
      href = '';
      getAttribute(name: string) {return this.attributes[name] ?? null;}
      hasAttribute(name: string) {return name in this.attributes;}
    }
    (Anchor.prototype as unknown as {click: jest.Mock}).click = originalClick;
    class FakeXhr {
      responseType = '';
      response: unknown;
      onload?: () => void;
      url = '';
      open(_method: string, url: string) {opened.push(url); this.url = url;}
      send() {this.response = {type: 'text/csv; charset=utf-8'}; this.onload?.();}
    }
    class FakeReader {
      result = '';
      onloadend?: () => void;
      readAsDataURL() {this.result = 'data:text/csv;base64,dGl0bGUK'; this.onloadend?.();}
    }
    const windowStub = {
      location: {href: 'https://hayateotsu.space/mylist', origin: 'https://hayateotsu.space'},
      localStorage: {setItem: jest.fn()},
      fetch: jest.fn(),
      ReactNativeWebView: {postMessage},
      HTMLAnchorElement: Anchor,
      XMLHttpRequest: FakeXhr,
      FileReader: FakeReader,
      document: {addEventListener: jest.fn()},
    };

    // eslint-disable-next-line no-new-func
    Function('window', createMobileShellInjectionScript('native-id'))(windowStub);

    const blobLink = new Anchor() as Anchor & {click: () => void};
    blobLink.href = 'blob:https://hayateotsu.space/1234';
    blobLink.attributes.download = 'reading-history.csv';
    blobLink.click();
    expect(opened).toEqual(['blob:https://hayateotsu.space/1234']);
    expect(originalClick).not.toHaveBeenCalled();
    expect(JSON.parse(postMessage.mock.calls.at(-1)[0])).toEqual({
      source: 'mangadock-web', type: 'file_download', filename: 'reading-history.csv',
      mimeType: 'text/csv; charset=utf-8', data: 'dGl0bGUK',
    });

    const ordinaryLink = new Anchor() as Anchor & {click: () => void};
    ordinaryLink.href = 'https://hayateotsu.space/book/1';
    ordinaryLink.click();
    const foreignBlob = new Anchor() as Anchor & {click: () => void};
    foreignBlob.href = 'blob:https://evil.example/1';
    foreignBlob.attributes.download = 'x.csv';
    foreignBlob.click();
    expect(originalClick).toHaveBeenCalledTimes(2);
    expect(opened).toHaveLength(1);
  });

  it('exposes a native OAuth bridge for mobile social login', () => {
    const postMessage = jest.fn();
    const windowStub: {
      location: {href: string; origin: string};
      __MANGA_DOCK_CLIENT__?: string;
      __MANGA_DOCK_NATIVE_AUTH__?: {
        startOAuth: (provider: 'google' | 'facebook', url: string) => void;
      };
      localStorage: {setItem: jest.Mock};
      fetch: jest.Mock;
      ReactNativeWebView: {postMessage: jest.Mock};
    } = {
      location: {href: 'https://hayateotsu.space/', origin: 'https://hayateotsu.space'},
      localStorage: {
        setItem: jest.fn(),
      },
      fetch: jest.fn(),
      ReactNativeWebView: {
        postMessage,
      },
    };

    // eslint-disable-next-line no-new-func
    Function(
      'window',
      `${createMobileShellInjectionScript(
        '11111111-2222-4333-8444-555555555555',
      )}`,
    )(windowStub);

    windowStub.__MANGA_DOCK_NATIVE_AUTH__?.startOAuth(
      'google',
      'https://supabase.example/auth/v1/authorize',
    );

    expect(windowStub.__MANGA_DOCK_CLIENT__).toBe('android-mobile-shell');
    expect(JSON.parse(postMessage.mock.calls[0][0])).toMatchObject({
      source: 'mangadock-web',
      type: 'oauth_start',
      provider: 'google',
      url: 'https://supabase.example/auth/v1/authorize',
    });
  });
});

describe('dialog layer reporting', () => {
  it('reports when an aria-modal dialog opens and closes', () => {
    const postMessage = jest.fn();
    let observer: (() => void) | undefined;
    let dialogOpen = false;
    const windowStub = {
      location: {href: 'https://hayateotsu.space/', origin: 'https://hayateotsu.space'},
      localStorage: {setItem: jest.fn()},
      fetch: jest.fn(),
      ReactNativeWebView: {postMessage},
      MutationObserver: class {
        constructor(callback: () => void) {observer = callback;}
        observe() {}
      },
      document: {
        documentElement: null,
        addEventListener: jest.fn(),
        querySelectorAll: (selector: string) => (dialogOpen && selector.includes('aria-modal') ? [{getClientRects: () => [{}]}, {getClientRects: () => []}] : []),
      },
    };
    // eslint-disable-next-line no-new-func
    Function('window', createMobileShellInjectionScript('native-id'))(windowStub);
    const states = () => postMessage.mock.calls.map(([raw]) => JSON.parse(raw)).filter(m => m.type === 'modal_state').map(m => m.open);
    dialogOpen = true; observer!();
    observer!();
    dialogOpen = false; observer!();
    expect(states()).toEqual([true, false]);
  });
});
