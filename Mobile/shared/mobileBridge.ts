export type OAuthProvider = "google" | "facebook";
export type MobilePermission = "media-library";
export type MobilePermissionStatus = "granted" | "denied" | "blocked";

export type WebToNativeMessage =
  | {
      type: "mangadock:oauth:start";
      provider: OAuthProvider;
    }
  | {
      type: "mangadock:permission:request";
      permission: MobilePermission;
      requestId: string;
    };

export type NativeToWebMessage =
  | {
      type: "mangadock:native-auth:session";
      access_token: string;
      refresh_token: string;
    }
  | {
      type: "mangadock:native-auth:session";
      error: string;
    }
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

export function parseWebToNativeMessage(value: unknown): WebToNativeMessage | null {
  const message = decodeMessage(value);
  if (!isRecord(message)) return null;

  if (
    message.type === "mangadock:oauth:start" &&
    (message.provider === "google" || message.provider === "facebook")
  ) {
    return { type: message.type, provider: message.provider };
  }

  if (
    message.type === "mangadock:permission:request" &&
    message.permission === "media-library" &&
    typeof message.requestId === "string" &&
    message.requestId.length > 0
  ) {
    return {
      type: message.type,
      permission: message.permission,
      requestId: message.requestId,
    };
  }

  return null;
}

export function parseNativeToWebMessage(value: unknown): NativeToWebMessage | null {
  const message = decodeMessage(value);
  if (!isRecord(message)) return null;

  if (message.type === "mangadock:native-auth:session") {
    if (typeof message.error === "string") {
      return { type: message.type, error: message.error };
    }
    if (
      typeof message.access_token === "string" &&
      typeof message.refresh_token === "string"
    ) {
      return {
        type: message.type,
        access_token: message.access_token,
        refresh_token: message.refresh_token,
      };
    }
  }

  if (
    message.type === "mangadock:permission:result" &&
    message.permission === "media-library" &&
    typeof message.requestId === "string" &&
    (message.status === "granted" ||
      message.status === "denied" ||
      message.status === "blocked")
  ) {
    return {
      type: message.type,
      permission: message.permission,
      requestId: message.requestId,
      status: message.status,
    };
  }

  return null;
}
