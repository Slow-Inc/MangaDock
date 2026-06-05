export type EndpointMode = 'production' | 'localEmulator' | 'custom';

export type EndpointModeInput = {
  customUrl?: string;
  isBeta: boolean;
  mode: EndpointMode;
};

export type EndpointModeState = {
  editable: boolean;
  mode: EndpointMode;
  storesSecrets: false;
  storesTokens: false;
  url: string;
};

export const PRODUCTION_FRONTEND_URL = 'https://hayateotsu.space';
export const LOCAL_EMULATOR_FRONTEND_URL = 'http://10.0.2.2:4000';

export function createEndpointModeState({
  customUrl,
  isBeta,
  mode,
}: EndpointModeInput): EndpointModeState {
  if (!isBeta) {
    return {
      editable: false,
      mode: 'production',
      storesSecrets: false,
      storesTokens: false,
      url: PRODUCTION_FRONTEND_URL,
    };
  }

  if (mode === 'localEmulator') {
    return {
      editable: true,
      mode,
      storesSecrets: false,
      storesTokens: false,
      url: LOCAL_EMULATOR_FRONTEND_URL,
    };
  }

  if (mode === 'custom') {
    return {
      editable: true,
      mode,
      storesSecrets: false,
      storesTokens: false,
      url: customUrl ?? PRODUCTION_FRONTEND_URL,
    };
  }

  return resetEndpointModeToProduction(true);
}

export function resetEndpointModeToProduction(
  editable = true,
): EndpointModeState {
  return {
    editable,
    mode: 'production',
    storesSecrets: false,
    storesTokens: false,
    url: PRODUCTION_FRONTEND_URL,
  };
}

export function getEndpointWarning(endpointMode: EndpointModeState) {
  if (endpointMode.mode === 'production') {
    return undefined;
  }

  return 'Using a non-production endpoint can separate auth/session state from production.';
}
