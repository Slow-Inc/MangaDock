import {NativeModules} from 'react-native';

const DEFAULT_MOBILE_SHELL_URL = 'https://hayateotsu.space';

export const MOBILE_DIAGNOSTICS_ENABLED = __DEV__ || NativeModules.MangaDockAuthConfig?.qaBuild === true;
export const MOBILE_BETA_SESSION_ONBOARDING_ENABLED = true;
export const MOBILE_BETA_VERSION_CODE = 8;
export const MOBILE_BETA_VERSION_NAME = '1.2.0-phase5-beta.1';

type MobileShellConfig = {
  frontendUrl?: string;
};

export function getMobileShellUrl(config: MobileShellConfig = {}) {
  return config.frontendUrl || NativeModules.MangaDockAuthConfig?.frontendUrl || DEFAULT_MOBILE_SHELL_URL;
}
