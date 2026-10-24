import {getMobileShellUrl} from '../src/config';

describe('Mobile Shell config', () => {
  it('uses the production Frontend URL by default', () => {
    expect(getMobileShellUrl()).toBe('https://hayateotsu.space');
  });

  it('uses an explicit Frontend URL override when provided', () => {
    expect(
      getMobileShellUrl({frontendUrl: 'http://192.168.1.10:4000'}),
    ).toBe('http://192.168.1.10:4000');
  });
});
