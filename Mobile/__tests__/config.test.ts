import {getMobileShellUrl} from '../src/config';

describe('Mobile Shell config', () => {
  it('uses the Android emulator Frontend URL by default', () => {
    expect(getMobileShellUrl()).toBe('http://10.0.2.2:4000');
  });

  it('uses an explicit Frontend URL override when provided', () => {
    expect(
      getMobileShellUrl({frontendUrl: 'http://192.168.1.10:4000'}),
    ).toBe('http://192.168.1.10:4000');
  });
});
