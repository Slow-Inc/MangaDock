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
});
