import {createMobileShellHeaders} from '../src/mobileHeaders';

describe('Mobile Header Injection', () => {
  it('prepares Zero-Trust headers for Mobile Shell WebView requests', () => {
    expect(
      createMobileShellHeaders('11111111-2222-4333-8444-555555555555'),
    ).toEqual({
      'x-hardware-id': '11111111-2222-4333-8444-555555555555',
      'x-manga-dock-client': 'android-mobile-shell',
    });
  });
});
