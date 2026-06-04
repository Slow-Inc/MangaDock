const DEFAULT_MOBILE_SHELL_URL = 'https://hayateotsu.space';

type MobileShellConfig = {
  frontendUrl?: string;
};

export function getMobileShellUrl(config: MobileShellConfig = {}) {
  return config.frontendUrl ?? DEFAULT_MOBILE_SHELL_URL;
}
