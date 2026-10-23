import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createPushNotifications } from "../src/push-notifications.ts";
import { fixture } from "./support/auth.ts";

type Response = {
  actionIdentifier: string;
  notification: { request: { identifier: string; content: { data: unknown } } };
};
const os = {
  events: [] as string[],
  granted: false,
  canAskAgain: true,
  token: "fcm-token",
  initial: null as Response | null,
  responses: new Set<(response: Response) => void>(),
  tokens: new Set<() => void>(),
  handler: null as null | {
    handleNotification(notification: unknown): Promise<Record<string, boolean>>;
  },
  scheduled: [] as Array<{
    content: { data: unknown };
    trigger: { channelId: string };
  }>,
};
Object.assign(globalThis, { __mangaPushBoundary: os });
const source = `
  const os = globalThis.__mangaPushBoundary;
  export const AndroidImportance={DEFAULT:3}, DEFAULT_ACTION_IDENTIFIER='default';
  export const setNotificationChannelAsync=async()=>{os.events.push('channel')};
  export const getPermissionsAsync=async()=>{os.events.push('permission');return {granted:os.granted,canAskAgain:os.canAskAgain}};
  export const requestPermissionsAsync=async()=>{os.events.push('prompt');os.granted=true;return {granted:true}};
  export const getDevicePushTokenAsync=async()=>({type:'android',data:os.token});
  export const getExpoPushTokenAsync=async(options)=>{os.events.push('expo:'+options.projectId);return {type:'expo',data:os.token}};
  export const unregisterForNotificationsAsync=async()=>{os.events.push('unregister')};
  export const dismissAllNotificationsAsync=async()=>{os.events.push('dismiss')};
  export const scheduleNotificationAsync=async(value)=>{os.scheduled.push(value);return 'preview-1'};
  export const setNotificationHandler=(value)=>{os.handler=value};
  export const addNotificationResponseReceivedListener=(fn)=>{os.responses.add(fn);return {remove(){os.responses.delete(fn)}}};
  export const addPushTokenListener=(fn)=>{os.tokens.add(fn);return {remove(){os.tokens.delete(fn)}}};
  export const getLastNotificationResponse=()=>os.initial;
  export const clearLastNotificationResponse=()=>{os.initial=null;os.events.push('clear')};
`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "expo-constants")
      return {
        url: `data:text/javascript,${encodeURIComponent("export default {easConfig:{projectId:'00000000-0000-4000-8000-000000000001'}}")}`,
        shortCircuit: true,
      };
    return specifier === "expo-notifications"
      ? {
          url: `data:text/javascript,${encodeURIComponent(source)}`,
          shortCircuit: true,
        }
      : next(specifier, context);
  },
});
const { pushPlatform, connectNativePush, PUSH_CHANNEL } =
  await import("../src/native-push.ts");

test("Expo creates the Android channel before permission and prompts only on explicit consent", async () => {
  os.events = [];
  os.granted = false;
  os.canAskAgain = true;
  assert.equal(await pushPlatform.permission(false), false);
  assert.deepEqual(os.events, ["channel", "permission"]);
  assert.equal(await pushPlatform.permission(true), true);
  assert.deepEqual(os.events.slice(2), ["channel", "permission", "prompt"]);
  os.granted = false;
  os.canAskAgain = false;
  os.events = [];
  assert.equal(await pushPlatform.permission(true), false);
  assert.deepEqual(os.events, ["channel", "permission"]);
});

test("real push controller receives a cold notification through Expo, navigates once after Auth and cleans up listeners", async () => {
  const auth = fixture({
    externalFetch: async () => globalThis.Response.json({ registered: true }),
  });
  const storage = new Map<string, string>();
  const destinations: unknown[] = [];
  const data = {
    version: "1",
    recipientUid: "reader-1",
    notificationId: "1",
    link: "/book/manga-1",
  };
  const response: Response = {
    actionIdentifier: "default",
    notification: { request: { identifier: "response-1", content: { data } } },
  };
  os.initial = response;
  os.granted = true;
  os.events = [];
  os.scheduled = [];
  const push = createPushNotifications({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
    enabled: true,
    platform: pushPlatform,
    storage: {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => {
        storage.set(key, value);
      },
    },
    navigate: (destination) => {
      destinations.push(destination);
    },
  });
  const disconnect = connectNativePush(push);
  try {
    assert.equal(os.initial, null);
    assert.deepEqual(destinations, []);
    await auth.app.signIn("reader@example.test", "correct-test-password");
    await push.enable();
    assert.ok(os.events.includes("expo:00000000-0000-4000-8000-000000000001"));
    for (const listener of os.responses) listener(response);
    assert.deepEqual(destinations, [{ kind: "book", id: "manga-1" }]);
    const behavior = await os.handler!.handleNotification(
      response.notification,
    );
    assert.equal(behavior.shouldShowBanner, true);
    assert.equal(behavior.shouldSetBadge, false);
    assert.equal(
      (
        await os.handler!.handleNotification({
          request: {
            content: { data: { ...data, recipientUid: "other-reader" } },
          },
        })
      ).shouldShowBanner,
      false,
    );
    await push.preview();
    assert.equal(os.scheduled[0].trigger.channelId, PUSH_CHANNEL);
    assert.equal(
      (os.scheduled[0].content.data as { recipientUid: string }).recipientUid,
      "reader-1",
    );
    os.token = "rotated-fcm-token";
    for (const listener of os.tokens) listener();
    await push.refresh();
    assert.equal(push.snapshot().status, "on");
  } finally {
    disconnect();
    push.dispose();
    auth.app.dispose();
  }
  assert.equal(os.responses.size, 0);
  assert.equal(os.tokens.size, 0);
  assert.equal(os.handler, null);
});
