const DEFAULT_MOBILE_SHELL_URL = 'http://10.0.2.2:4000';

type MobileShellConfig = {
  frontendUrl?: string;
};

export function getMobileShellUrl(config: MobileShellConfig = {}) {
  return config.frontendUrl ?? DEFAULT_MOBILE_SHELL_URL;
}
