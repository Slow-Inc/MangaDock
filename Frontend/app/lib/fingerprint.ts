/**
 * Simple Fingerprinting Stub for Phase 1.5 Readiness.
 * This generates a persistent unique ID for the device and stores it in localStorage.
 * In a production environment, this should be replaced with a more robust library like FingerprintJS.
 */

const FINGERPRINT_KEY = "mangadock_device_id";

export function getHardwareId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(FINGERPRINT_KEY);
  if (!id) {
    // Generate a simple unique ID
    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const ua = navigator.userAgent;
    const random = Math.random().toString(36).substring(2, 15);
    id = `mdock_${btoa(`${ua}|${screenInfo}|${random}`).substring(0, 32)}`;
    localStorage.setItem(FINGERPRINT_KEY, id);
  }
  return id;
}
