import {mobileTheme} from '../src/theme/mobileTheme';

describe('Mobile native theme', () => {
  it('adapts MangaDock Frontend visual source colors for native surfaces', () => {
    expect(mobileTheme.colors.background).toBe('#08090d');
    expect(mobileTheme.colors.surface).toBe('#1a1a1a');
    expect(mobileTheme.colors.foreground).toBe('#f8f9fb');
    expect(mobileTheme.colors.primary).toBe('#6366f1');
    expect(mobileTheme.colors.secondary).toBe('#f59e0b');
  });

  it('defines safe touch targets for native controls', () => {
    expect(mobileTheme.touchTarget.minHeight).toBeGreaterThanOrEqual(44);
    expect(mobileTheme.spacing.safeScreenPadding).toBe(16);
  });
});
