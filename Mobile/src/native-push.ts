import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { PushNotifications, PushPlatform } from "./push-notifications.ts";

export const PUSH_CHANNEL = "mangadock-updates";

export const pushPlatform: PushPlatform = {
  async permission(request) {
    // Android 13 needs a notification channel before asking for permission.
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
      name: "ข่าวสาร MangaDock",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && request && permission.canAskAgain)
      permission = await Notifications.requestPermissionsAsync();
    return permission.granted;
  },
  async token() {
    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error("บริการแจ้งเตือนยังไม่พร้อมในแอปรุ่นนี้");
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token.type !== "expo" || typeof token.data !== "string")
      throw new Error("อุปกรณ์นี้ยังไม่รองรับการแจ้งเตือน");
    return token.data;
  },
  async unregister() {
    try {
      await Notifications.unregisterForNotificationsAsync();
    } finally {
      await Notifications.dismissAllNotificationsAsync();
    }
  },
  async preview(data) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "แจ้งเตือนทดสอบ MangaDock",
        body: "แตะเพื่อกลับไปหน้าหลัก",
        data,
      },
      trigger: { channelId: PUSH_CHANNEL },
    });
  },
};

export function connectNativePush(push: PushNotifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const show = push.shouldPresent(notification.request.content.data);
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
      };
    },
  });
  const receive = (response: Notifications.NotificationResponse) => {
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
      return;
    push.open(
      response.notification.request.content.data,
      response.notification.request.identifier,
    );
    Notifications.clearLastNotificationResponse();
  };
  const responses =
    Notifications.addNotificationResponseReceivedListener(receive);
  const tokens = Notifications.addPushTokenListener(() => {
    void push.refresh();
  });
  // Subscribe before reading the cold-start response; the controller deduplicates.
  const initial = Notifications.getLastNotificationResponse();
  if (initial) receive(initial);
  return () => {
    responses.remove();
    tokens.remove();
    Notifications.setNotificationHandler(null);
  };
}
