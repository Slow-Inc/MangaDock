import type {NativeShellRouteName} from '../navigation/NativeShellNavigator';

export const MOBILE_ONBOARDING_COMPLETED_KEY =
  'mangadock.mobile.onboardingCompleted';

export type MobileOnboardingState = {
  isBeta: boolean;
  sessionCompleted: boolean;
  persistedCompleted: boolean;
};

export function getNativeShellInitialRoute({
  isBeta,
  sessionCompleted,
  persistedCompleted,
}: MobileOnboardingState): NativeShellRouteName {
  if (isBeta) {
    return sessionCompleted ? 'Home' : 'Onboarding';
  }

  return persistedCompleted ? 'Home' : 'Onboarding';
}

export function shouldPersistOnboardingCompletion({
  isBeta,
}: {
  isBeta: boolean;
}) {
  return !isBeta;
}

export function getViewOnboardingRoute(): NativeShellRouteName {
  return 'Onboarding';
}
