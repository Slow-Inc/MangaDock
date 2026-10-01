import {createNativeSdkLoginController} from '../src/nativeSdkLogin';

function setup() {
  const resolves: Array<(value: unknown) => void> = [];
  const module = {signIn: jest.fn(() => new Promise<unknown>(done => {resolves.push(done);})), cancel: jest.fn()};
  const result = jest.fn();
  const pending = jest.fn();
  const controller = createNativeSdkLoginController(module, {onResult: result, onPending: pending});
  return {module, result, pending, controller, resolves, resolve: (value: unknown) => resolves.at(-1)!(value)};
}
afterEach(() => {jest.useRealTimers();});

test('delivers the Supabase session bound to the SDK request', async () => {
  const h = setup();
  h.controller.start('google', 'request-1');
  h.resolve({access_token: 'qa-access', refresh_token: 'qa-refresh'});
  await Promise.resolve();
  expect(h.module.signIn).toHaveBeenCalledWith('google', 'request-1');
  expect(h.result).toHaveBeenCalledWith({request_id: 'request-1', access_token: 'qa-access', refresh_token: 'qa-refresh'});
  expect(h.pending).toHaveBeenLastCalledWith(null);
});

test('cancel settles the web request and discards late SDK success', async () => {
  const h = setup();
  h.controller.start('google', 'request-1');
  h.controller.cancel();
  h.resolve({access_token: 'late-access', refresh_token: 'late-refresh'});
  await Promise.resolve();
  expect(h.module.cancel).toHaveBeenCalledWith('request-1');
  expect(h.result).toHaveBeenCalledTimes(1);
  expect(h.result.mock.calls[0][0]).toEqual(expect.objectContaining({request_id: 'request-1', error: expect.any(String)}));
});

test('timeout cancels the native operation and clears waiting', () => {
  jest.useFakeTimers();
  const h = setup();
  h.controller.start('facebook', 'request-1');
  jest.advanceTimersByTime(120000);
  expect(h.module.cancel).toHaveBeenCalledWith('request-1');
  expect(h.result).toHaveBeenCalledWith(expect.objectContaining({error: expect.any(String)}));
  expect(h.pending).toHaveBeenLastCalledWith(null);
});

test('replacement discards an earlier completion', async () => {
  const h = setup();
  h.controller.start('google', 'old');
  const oldResolve = h.resolves[0];
  h.controller.start('google', 'new');
  oldResolve({access_token: 'old-access', refresh_token: 'old-refresh'});
  h.resolve({access_token: 'new-access', refresh_token: 'new-refresh'});
  await Promise.resolve();
  expect(h.module.cancel).toHaveBeenCalledWith('old');
  expect(h.result.mock.calls.filter(([value]) => value.access_token)).toEqual([
    [{request_id: 'new', access_token: 'new-access', refresh_token: 'new-refresh'}],
  ]);
});

test('rejects malformed session and settles SDK failures without exposing raw errors', async () => {
  const h = setup();
  h.controller.start('google', 'request-1');
  h.resolve({access_token: 'only-access'});
  await Promise.resolve();
  expect(h.result).toHaveBeenCalledWith(expect.objectContaining({error: expect.any(String)}));
  h.module.signIn.mockImplementationOnce(() => Promise.reject(new Error('sensitive SDK detail')));
  h.controller.start('facebook', 'request-2');
  await Promise.resolve();
  expect(h.result.mock.calls[1][0].error).not.toContain('sensitive');
});

test('dispose cancels without injecting into a destroyed or untrusted WebView', async () => {
  const h = setup();
  h.controller.start('google', 'request-1');
  h.controller.dispose();
  h.resolve({access_token: 'late-access', refresh_token: 'late-refresh'});
  await Promise.resolve();
  expect(h.module.cancel).toHaveBeenCalledWith('request-1');
  expect(h.result).not.toHaveBeenCalled();
});

test('Google SDK cancellation does not claim the user cancelled a failed reauthentication', async () => {
  const h = setup();
  h.module.signIn.mockImplementationOnce(() => Promise.reject({code: 'auth/sdk-cancelled', message: 'sensitive provider detail'}));
  h.controller.start('google', 'google-reauth');
  await Promise.resolve();
  expect(h.result).toHaveBeenCalledWith({request_id: 'google-reauth', error: 'Google ไม่สามารถดำเนินการเข้าสู่ระบบต่อได้ หรือหน้าล็อกอินถูกปิด กรุณาลองอีกครั้ง'});
  expect(h.module.signIn).toHaveBeenCalledTimes(1);
  expect(h.pending).toHaveBeenLastCalledWith(null);
});