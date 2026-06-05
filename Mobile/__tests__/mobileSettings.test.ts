import {
  createEndpointModeState,
  getEndpointWarning,
  resetEndpointModeToProduction,
} from '../src/settings/mobileSettings';

describe('Mobile Settings endpoint mode', () => {
  it('supports beta endpoint modes without storing secrets or tokens', () => {
    expect(
      createEndpointModeState({
        isBeta: true,
        mode: 'production',
      }),
    ).toMatchObject({
      editable: true,
      mode: 'production',
      url: 'https://hayateotsu.space',
    });

    expect(
      createEndpointModeState({
        isBeta: true,
        mode: 'localEmulator',
      }),
    ).toMatchObject({
      editable: true,
      mode: 'localEmulator',
      url: 'http://10.0.2.2:4000',
    });

    expect(
      createEndpointModeState({
        customUrl: 'http://192.168.1.25:4000',
        isBeta: true,
        mode: 'custom',
      }),
    ).toMatchObject({
      editable: true,
      mode: 'custom',
      storesSecrets: false,
      storesTokens: false,
      url: 'http://192.168.1.25:4000',
    });
  });

  it('locks production builds to the production endpoint', () => {
    expect(
      createEndpointModeState({
        customUrl: 'http://192.168.1.25:4000',
        isBeta: false,
        mode: 'custom',
      }),
    ).toMatchObject({
      editable: false,
      mode: 'production',
      url: 'https://hayateotsu.space',
    });
  });

  it('warns for non-production endpoints and resets to production', () => {
    const localMode = createEndpointModeState({
      isBeta: true,
      mode: 'localEmulator',
    });

    expect(getEndpointWarning(localMode)).toContain('non-production endpoint');
    expect(resetEndpointModeToProduction()).toMatchObject({
      mode: 'production',
      url: 'https://hayateotsu.space',
    });
  });
});
