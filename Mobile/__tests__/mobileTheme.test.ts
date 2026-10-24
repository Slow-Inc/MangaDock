import {mobileTheme} from '../src/theme/mobileTheme';

describe('Mobile native theme', () => {
  it('adapts MangaDock Frontend visual source colors for native surfaces', () => {
    expect(mobileTheme.colors.background).toBe('#0b0b0d');
    expect(mobileTheme.colors.surface).toBe('#151518');
    expect(mobileTheme.colors.foreground).toBe('#f1f1f3');
    expect(mobileTheme.colors.primary).toBe('#5aa2ff');
    expect(mobileTheme.colors.secondary).toBe('#f59e0b');
  });

  it('defines safe touch targets for native controls', () => {
    expect(mobileTheme.touchTarget.minHeight).toBeGreaterThanOrEqual(44);
    expect(mobileTheme.spacing.safeScreenPadding).toBe(16);
  });
});
