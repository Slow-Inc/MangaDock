export const MOBILE_DIAGNOSTICS_LOG_PREFIX = 'MangaDockMobile';

export type MobileDiagnosticsEventInput = {
  type: string;
  hardwareId?: string;
  url?: string;
  statusCode?: number;
  message?: string;
  sequence?: number;
};

export type MobileDiagnosticsEvent = MobileDiagnosticsEventInput & {
  at: string;
};

const MAX_MOBILE_DIAGNOSTICS_EVENTS = 20;

export function maskMobileHardwareId(hardwareId?: string) {
  if (!hardwareId) {
    return undefined;
  }

  return `${hardwareId.slice(0, 8)}...${hardwareId.slice(-4)}`;
}

export function createMobileDiagnosticsEvent(
  input: MobileDiagnosticsEventInput,
  now = () => new Date().toISOString(),
): MobileDiagnosticsEvent {
  return {
    ...input,
    hardwareId: maskMobileHardwareId(input.hardwareId),
    at: now(),
  };
}

export function appendMobileDiagnosticsEvent(
  events: MobileDiagnosticsEvent[],
  event: MobileDiagnosticsEvent,
) {
  return [...events, event].slice(-MAX_MOBILE_DIAGNOSTICS_EVENTS);
}

export function formatMobileDiagnosticsLog(event: MobileDiagnosticsEvent) {
  return `${MOBILE_DIAGNOSTICS_LOG_PREFIX} ${JSON.stringify(event)}`;
}
