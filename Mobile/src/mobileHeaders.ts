export const MANGA_DOCK_ANDROID_CLIENT = 'android-mobile-shell';

export function createMobileShellHeaders(hardwareId: string) {
  return {
    'x-hardware-id': hardwareId,
    'x-manga-dock-client': MANGA_DOCK_ANDROID_CLIENT,
  };
}
