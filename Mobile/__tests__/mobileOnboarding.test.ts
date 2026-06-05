import {
  getNativeShellInitialRoute,
  getViewOnboardingRoute,
  MOBILE_ONBOARDING_COMPLETED_KEY,
  shouldPersistOnboardingCompletion,
} from '../src/onboarding/mobileOnboarding';

describe('Mobile onboarding policy', () => {
  it('shows Native Onboarding once per fresh beta app session', () => {
    expect(
      getNativeShellInitialRoute({
        isBeta: true,
        sessionCompleted: false,
        persistedCompleted: true,
      }),
    ).toBe('Onboarding');

    expect(
      getNativeShellInitialRoute({
        isBeta: true,
        sessionCompleted: true,
        persistedCompleted: false,
      }),
    ).toBe('Home');
  });

  it('uses first-run onboarding per install for production builds', () => {
    expect(
      getNativeShellInitialRoute({
        isBeta: false,
        sessionCompleted: false,
        persistedCompleted: false,
      }),
    ).toBe('Onboarding');

    expect(
      getNativeShellInitialRoute({
        isBeta: false,
        sessionCompleted: false,
        persistedCompleted: true,
      }),
    ).toBe('Home');
  });

  it('persists completion only for production first-run onboarding', () => {
    expect(shouldPersistOnboardingCompletion({isBeta: true})).toBe(false);
    expect(shouldPersistOnboardingCompletion({isBeta: false})).toBe(true);
  });

  it('exposes settings-facing onboarding controls', () => {
    expect(getViewOnboardingRoute()).toBe('Onboarding');
    expect(MOBILE_ONBOARDING_COMPLETED_KEY).toBe(
      'mangadock.mobile.onboardingCompleted',
    );
  });
});
