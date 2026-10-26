import {createHybridPushHost, parsePushRequest, type PushRequest} from '../src/hybridPush';
import {NativeModules} from 'react-native';

const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({__esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {mockStore.set(key, value);}),
}}));
const mockNotifications = {
  setNotificationHandler: jest.fn(),
  unregisterForNotificationsAsync: jest.fn(async () => {}),
  setAutoServerRegistrationEnabledAsync: jest.fn(async (_enabled: boolean) => {}),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((_listener: (response: unknown) => void) => ({remove: jest.fn()})),
  addPushTokenListener: jest.fn((_listener: (token: {data: string}) => void) => ({remove: jest.fn()})),
  getLastNotificationResponse: jest.fn(() => null),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({granted: false, canAskAgain: true})),
  requestPermissionsAsync: jest.fn(async () => ({granted: true})),
  getExpoPushTokenAsync: jest.fn(async () => ({type: 'expo', data: 'ExponentPushToken[device]'})),
  scheduleNotificationAsync: jest.fn(async () => 'preview'),
  AndroidImportance: {DEFAULT: 3},
  DEFAULT_ACTION_IDENTIFIER: 'default',
};
jest.mock('expo-notifications', () => mockNotifications);
jest.mock('../src/mobileIdentity', () => ({getMobileHardwareId: async () => 'device-id'}));

beforeEach(() => {
  jest.clearAllMocks(); mockStore.clear();
  NativeModules.MangaDockAuthConfig = {easProjectId: '12345678-1234-4123-8123-123456789abc'};
});

function fixture() {
  const events: Record<string, unknown>[] = [];
  const host = createHybridPushHost(event => events.push(event));
  let sequence = 0;
  return {host, events, request: (action: string, data: Partial<PushRequest> = {}) => host.handle({source: 'mangadock-web', type: 'push_request', id: String(++sequence), action, ...data})};
}

test('the bridge rejects invalid requests and cannot accept a native bearer/session command', () => {
  for (const value of [null, {}, {type: 'push_request', source: 'elsewhere', id: '1', action: 'token'}, {type: 'push_request', source: 'mangadock-web', id: '1', action: 'session', uid: 12}, {type: 'push_request', source: 'mangadock-web', id: '1', action: 'login'}]) expect(parsePushRequest(value)).toBeNull();
  expect(parsePushRequest({type: 'push_request', source: 'mangadock-web', id: '1', action: 'permission', prompt: false})).not.toBeNull();
});

test('connecting and restoring a session never prompts for permission or obtains a token', async () => {
  const f = fixture();
  try {
    await f.request('connect');
    await f.request('session', {uid: 'reader-a'});
    await f.request('ready');
    expect(f.events[0]).toMatchObject({ok: true, result: {deviceId: 'device-id'}});
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  } finally { f.host.dispose(); }
});

test('native ownership is reported even if WebView storage was cleared', async () => {
  mockStore.set('mangadock_hybrid_push_owner', 'reader-a');
  const f = fixture();
  try {
    await f.request('connect');
    expect(f.events[0]).toMatchObject({ok: true, result: {registrationOwner: 'reader-a'}});
  } finally { f.host.dispose(); }
});

test('a mapping cleanup failure still attempts token invalidation and notification dismissal', async () => {
  mockNotifications.setAutoServerRegistrationEnabledAsync.mockRejectedValueOnce(new Error('offline'));
  mockStore.set('mangadock_hybrid_push_owner', 'reader-a');
  const f = fixture();
  try {
    await f.request('reset');
    expect(mockNotifications.unregisterForNotificationsAsync).toHaveBeenCalled();
    expect(mockNotifications.dismissAllNotificationsAsync).toHaveBeenCalled();
    expect(mockStore.get('mangadock_hybrid_push_owner')).toBe('reader-a');
    expect(f.events[0]).toMatchObject({ok: false});
  } finally { f.host.dispose(); }
});

test('permission prompts only on explicit opt in and token ownership survives process restart', async () => {
  const f = fixture();
  try {
    await f.request('session', {uid: 'reader-a'});
    await f.request('permission', {prompt: false});
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    await f.request('permission', {prompt: true});
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    await f.request('token');
    expect(mockStore.get('mangadock_hybrid_push_owner')).toBe('reader-a');
    await f.request('session', {uid: 'reader-b'});
    expect(mockNotifications.unregisterForNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.setAutoServerRegistrationEnabledAsync).toHaveBeenCalledWith(false);
    expect(mockStore.get('mangadock_hybrid_push_owner')).toBe('');
  } finally { f.host.dispose(); }
});

test('reading the same FCM token does not start an endless registration refresh loop', async () => {
  const f = fixture();
  try {
    await f.request('ready');
    const receive = mockNotifications.addPushTokenListener.mock.calls[0][0];
    receive({data: 'token-1'});
    receive({data: 'token-1'});
    expect(f.events.filter(event => event.event === 'refresh')).toHaveLength(0);
    receive({data: 'token-2'});
    receive({data: 'token-2'});
    expect(f.events.filter(event => event.event === 'refresh')).toHaveLength(1);
  } finally { f.host.dispose(); }
});

test('a late token after an account switch cannot be returned to the previous page', async () => {
  let finish!: (value: {type: string; data: string}) => void;
  mockNotifications.getExpoPushTokenAsync.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
  const f = fixture();
  try {
    await f.request('session', {uid: 'reader-a'});
    const token = f.request('token');
    for (let step = 0; !finish && step < 30; step++) await Promise.resolve();
    expect(finish).toBeDefined();
    const logout = f.request('session', {uid: null});
    finish({type: 'expo', data: 'old-owner-token'});
    await Promise.all([token, logout]);
    expect(f.events.find(event => event.id === '2')).toMatchObject({ok: false});
    expect(JSON.stringify(f.events)).not.toContain('old-owner-token');
    expect(mockNotifications.unregisterForNotificationsAsync).toHaveBeenCalled();
  } finally { f.host.dispose(); }
});

test('foreground notifications require acknowledged registration and the current recipient', async () => {
  const f = fixture();
  try {
    const handler = mockNotifications.setNotificationHandler.mock.calls[0][0].handleNotification;
    const notification = (uid: string) => ({request: {content: {data: {version: '1', recipientUid: uid}}}});
    await f.request('session', {uid: 'reader-a'});
    expect((await handler(notification('reader-a'))).shouldShowBanner).toBe(false);
    await f.request('presentation', {on: true});
    expect((await handler(notification('reader-a'))).shouldShowBanner).toBe(true);
    expect((await handler(notification('reader-b'))).shouldShowBanner).toBe(false);
    f.host.suspend();
    expect((await handler(notification('reader-a'))).shouldShowBanner).toBe(false);
  } finally { f.host.dispose(); }
});

test('a notification tap waits until the web controller announces that it is ready', async () => {
  const f = fixture();
  try {
    const receive = mockNotifications.addNotificationResponseReceivedListener.mock.calls[0][0];
    receive({actionIdentifier: 'default', notification: {request: {identifier: 'cold-response', content: {data: {version: '1', recipientUid: 'reader-a', link: '/feed'}}}}});
    expect(f.events).toHaveLength(0);
    await f.request('connect');
    expect(f.events.some(event => event.event === 'open')).toBe(false);
    await f.request('ready');
    expect(f.events.filter(event => event.event === 'open')).toHaveLength(1);
    await f.request('ready');
    expect(f.events.filter(event => event.event === 'open')).toHaveLength(1);
  } finally { f.host.dispose(); }
});
