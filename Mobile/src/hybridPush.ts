import {AppState, NativeModules} from 'react-native';
import {getMobileHardwareId} from './mobileIdentity';

export const hybridPushEnabled = NativeModules.MangaDockAuthConfig?.pushEnabled === true;
const OWNER_KEY = 'mangadock_hybrid_push_owner';
const CHANNEL = 'mangadock-updates';

export type PushRequest = {type: 'push_request'; source: 'mangadock-web'; id: string; action: string; uid?: string | null; prompt?: boolean; on?: boolean; data?: Record<string, unknown>};

export function parsePushRequest(value: unknown): PushRequest | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as PushRequest;
  if (message.type !== 'push_request' || message.source !== 'mangadock-web' ||
      typeof message.id !== 'string' || !message.id || message.id.length > 128 ||
      !['connect', 'ready', 'session', 'permission', 'token', 'reset', 'presentation', 'preview'].includes(message.action)) return null;
  if (message.action === 'session' && message.uid !== null &&
      (typeof message.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(message.uid))) return null;
  if (message.action === 'permission' && typeof message.prompt !== 'boolean') return null;
  if (message.action === 'presentation' && typeof message.on !== 'boolean') return null;
  return message;
}

export function createHybridPushHost(send: (event: Record<string, unknown>) => void) {
  // Load Expo only in configured builds. A normal hybrid build never requests a token.
  const AsyncStorage: typeof import('@react-native-async-storage/async-storage').default = require('@react-native-async-storage/async-storage').default;
  const notifications: typeof import('expo-notifications') = require('expo-notifications');
  let owner: string | null = null;
  let present = false;
  let connected = false;
  let revision = 0;
  let pending: Record<string, unknown> | null = null;
  let queue = Promise.resolve();
  let lastDeviceToken: string | null = null;
  const reset = async () => {
    present = false;
    lastDeviceToken = null;
    // Expo otherwise retains a background mapping from a rotated FCM token.
    let mappingFailure: unknown;
    try { await notifications.setAutoServerRegistrationEnabledAsync(false); }
    catch (error) { mappingFailure = error; }
    try { await notifications.unregisterForNotificationsAsync(); }
    finally { await notifications.dismissAllNotificationsAsync(); }
    if (mappingFailure) throw mappingFailure;
    await AsyncStorage.setItem(OWNER_KEY, '');
  };
  notifications.setNotificationHandler({handleNotification: async notification => {
    const data = notification.request.content.data;
    const show = present && !!owner && data?.version === '1' && data?.recipientUid === owner;
    return {shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false};
  }});
  const receive = (response: import('expo-notifications').NotificationResponse) => {
    if (response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
    pending = {event: 'open', data: response.notification.request.content.data, responseId: response.notification.request.identifier};
    if (connected) { send(pending); pending = null; }
    notifications.clearLastNotificationResponse();
  };
  const responses = notifications.addNotificationResponseReceivedListener(receive);
  const tokens = notifications.addPushTokenListener(token => {
    const next = String(token.data);
    const previous = lastDeviceToken;
    lastDeviceToken = next;
    // Reading the existing FCM token also emits this event. Refresh only on rotation.
    if (connected && previous !== null && previous !== next) send({event: 'refresh'});
  });
  const foreground = AppState.addEventListener('change', state => { if (state === 'active' && connected) send({event: 'refresh'}); });
  const initial = notifications.getLastNotificationResponse();
  if (initial) receive(initial);

  async function execute(message: PushRequest, expected: number): Promise<unknown> {
    switch (message.action) {
      case 'connect': return {deviceId: await getMobileHardwareId(), registrationOwner: await AsyncStorage.getItem(OWNER_KEY)};
      case 'ready':
        connected = true;
        if (pending) { send(pending); pending = null; }
        return null;
      case 'session': {
        const previous = await AsyncStorage.getItem(OWNER_KEY);
        if (previous && previous !== message.uid) await reset();
        return null;
      }
      case 'permission': {
        if (!owner) return false;
        await notifications.setNotificationChannelAsync(CHANNEL, {name: 'ข่าวสาร MangaDock', importance: notifications.AndroidImportance.DEFAULT});
        let permission = await notifications.getPermissionsAsync();
        if (!permission.granted && message.prompt && permission.canAskAgain && expected === revision)
          permission = await notifications.requestPermissionsAsync();
        return permission.granted;
      }
      case 'token': {
        if (!owner || expected !== revision) throw new Error('No current owner');
        await AsyncStorage.setItem(OWNER_KEY, owner);
        const token = await notifications.getExpoPushTokenAsync({projectId: NativeModules.MangaDockAuthConfig.easProjectId});
        if (expected !== revision) throw new Error('Account changed');
        if (token.type !== 'expo' || typeof token.data !== 'string') throw new Error('Invalid token');
        return token.data;
      }
      case 'reset': await reset(); return null;
      case 'presentation': present = message.on === true && !!owner; return null;
      case 'preview':
        if (!present || !owner) return null;
        await notifications.scheduleNotificationAsync({content: {title: 'แจ้งเตือนทดสอบ MangaDock', body: 'แตะเพื่อเปิด MangaDock', data: {version: '1', recipientUid: owner, notificationId: 'local-preview', link: '/'}}, trigger: {channelId: CHANNEL}});
        return null;
    }
  }
  return {
    handle(message: PushRequest) {
      if (message.action === 'session') {
        const next = message.uid ?? null;
        if (owner !== next) { owner = next; revision++; present = false; }
      }
      if (message.action === 'reset' || (message.action === 'presentation' && !message.on)) present = false;
      const expected = revision;
      queue = queue.then(async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          if (expected !== revision && !['session', 'reset'].includes(message.action)) throw new Error('Stale request');
          const result = await Promise.race([execute(message, expected), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Timeout')), 7000); })]);
          if (expected !== revision && !['session', 'reset'].includes(message.action)) throw new Error('Account changed');
          send({id: message.id, ok: true, result});
        } catch { send({id: message.id, ok: false}); }
        finally { clearTimeout(timer); }
      });
      return queue;
    },
    suspend() { connected = false; present = false; revision++; owner = null; },
    dispose() { connected = false; present = false; revision++; responses.remove(); tokens.remove(); foreground.remove(); notifications.setNotificationHandler(null); },
  };
}
