const DEFAULT_MOBILE_SHELL_URL = 'https://hayateotsu.space';

export const MOBILE_DIAGNOSTICS_ENABLED = true;
export const MOBILE_BETA_SESSION_ONBOARDING_ENABLED = true;
export const MOBILE_BETA_VERSION_CODE = 3;
export const MOBILE_BETA_VERSION_NAME = '1.0.1-beta.2';

type MobileShellConfig = {
  frontendUrl?: string;
};

export function getMobileShellUrl(config: MobileShellConfig = {}) {
  return config.frontendUrl ?? DEFAULT_MOBILE_SHELL_URL;
}
