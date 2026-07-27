export type OAuthProvider = "google" | "facebook";
export type MobilePermission = "media-library";
export type MobilePermissionStatus = "granted" | "denied" | "blocked";

export type WebToNativeMessage =
  | {
      type: "mangadock:oauth:start";
      provider: OAuthProvider;
      requestId: string;
    }
  | {
      type: "mangadock:permission:request";
      permission: MobilePermission;
      requestId: string;
    };

export type NativeAuthSessionMessage =
  | {
      type: "mangadock:native-auth:session";
      requestId: string;
      access_token: string;
      refresh_token: string;
    }
  | {
      type: "mangadock:native-auth:session";
      requestId: string;
      error: string;
    };

export type NativeToWebMessage =
  | NativeAuthSessionMessage
  | {
      type: "mangadock:permission:result";
      permission: MobilePermission;
      requestId: string;
      status: MobilePermissionStatus;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function decodeMessage(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isAllowedWebViewUrl(candidateUrl: string, applicationUrl: string): boolean {
  if (candidateUrl === "about:blank") return true;
  try {
    const candidate = new URL(candidateUrl);
    const application = new URL(applicationUrl);
    return (candidate.protocol === "http:" || candidate.protocol === "https:") &&
      candidate.origin === application.origin;
  } catch {
    return false;
  }
}

export function parseWebToNativeMessage(value: unknown): WebToNativeMessage | null {
  const message = decodeMessage(value);
  if (!isRecord(message)) return null;
  if (
    message.type === "mangadock:oauth:start" &&
    (message.provider === "google" || message.provider === "facebook") &&
    isNonEmptyString(message.requestId)
  ) {
    return { type: message.type, provider: message.provider, requestId: message.requestId };
  }
  if (
    message.type === "mangadock:permission:request" &&
    message.permission === "media-library" &&
    isNonEmptyString(message.requestId)
  ) {
    return { type: message.type, permission: message.permission, requestId: message.requestId };
  }
  return null;
}

export function parseNativeToWebMessage(value: unknown): NativeToWebMessage | null {
  const message = decodeMessage(value);
  if (!isRecord(message)) return null;
  if (message.type === "mangadock:native-auth:session") {
    if (!isNonEmptyString(message.requestId)) return null;
    if (isNonEmptyString(message.error)) {
      return { type: message.type, requestId: message.requestId, error: message.error };
    }
    if (isNonEmptyString(message.access_token) && isNonEmptyString(message.refresh_token)) {
      return { type: message.type, requestId: message.requestId, access_token: message.access_token, refresh_token: message.refresh_token };
    }
  }
  if (
    message.type === "mangadock:permission:result" &&
    message.permission === "media-library" &&
    isNonEmptyString(message.requestId) &&
    (message.status === "granted" || message.status === "denied" || message.status === "blocked")
  ) {
    return { type: message.type, permission: message.permission, requestId: message.requestId, status: message.status };
  }
  return null;
}

export function isExpectedNativeAuthMessage(
  message: NativeToWebMessage | null,
  pendingRequestId: string | null,
): message is NativeAuthSessionMessage {
  return !!pendingRequestId &&
    message?.type === "mangadock:native-auth:session" &&
    message.requestId === pendingRequestId;
}
