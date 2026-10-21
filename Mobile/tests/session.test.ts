import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/auth.ts';


test('reader signs in and sees their existing Backend account through the native session', async () => {
  const { app, account } = fixture();
  await app.signIn('reader@example.test', 'correct-test-password');
  assert.deepEqual(app.snapshot(), { status: 'signedIn', account });
});

test('reader reopens native navigation and restores the existing authenticated account', async () => {
  const { app, reopen, account } = fixture();
  await app.signIn('reader@example.test', 'correct-test-password');
  const reopened = reopen();
  await reopened.restore();
  assert.deepEqual(reopened.snapshot(), { status: 'signedIn', account });
});

test('reader signs out and reopening the app cannot restore the previous account', async () => {
  const { app, reopen } = fixture();
  await app.signIn('reader@example.test', 'correct-test-password');
  await app.signOut();
  assert.deepEqual(app.snapshot(), { status: 'signedOut', account: null });
  const reopened = reopen();
  await reopened.restore();
  assert.deepEqual(reopened.snapshot(), { status: 'signedOut', account: null });
});

test('signing out while the Backend account is loading cannot sign the reader back in', async () => {
  let release!: (response: Response) => void;
  let started!: () => void;
  const loading = new Promise<void>((resolve) => { started = resolve; });
  const response = new Promise<Response>((resolve) => { release = resolve; });
  const { app, account } = fixture({ loadAccount: () => { started(); return response; } });
  const login = app.signIn('reader@example.test', 'correct-test-password');
  await loading;
  await app.signOut();
  release(Response.json(account));
  await login;
  assert.deepEqual(app.snapshot(), { status: 'signedOut', account: null });
});

test('native navigation observes sign-in and sign-out, and can unsubscribe', async () => {
  const { app, account } = fixture();
  const visible: unknown[] = [];
  const unsubscribe = app.subscribe(() => visible.push(app.snapshot()));
  await app.signIn('reader@example.test', 'correct-test-password');
  await app.signOut();
  unsubscribe();
  await app.signIn('reader@example.test', 'correct-test-password');
  assert.deepEqual(visible, [{ status: 'signedIn', account }, { status: 'signedOut', account: null }]);
});

test('a reader with verified TOTP sees the MFA gate instead of their protected account', async () => {
  const { app } = fixture({ mfa: true });
  await app.signIn('reader@example.test', 'correct-test-password');
  assert.deepEqual(app.snapshot(), { status: 'mfaRequired', account: null, factorId: 'factor-1' });
});

test('a reader completes TOTP and can access the existing Backend account', async () => {
  const { app, account } = fixture({ mfa: true });
  await app.signIn('reader@example.test', 'correct-test-password');
  await app.verifyTotp('123456');
  assert.deepEqual(app.snapshot(), { status: 'signedIn', account });
});

test('a profile belonging to another account is never exposed to native navigation', async () => {
  const { app } = fixture({ loadAccount: async () => Response.json({ uid: 'other-reader', email: 'other@example.test', displayName: 'Other', role: 9 }) });
  await assert.rejects(app.signIn('reader@example.test', 'correct-test-password'), /บัญชี/);
  assert.equal(app.snapshot().account, null);
});

test('Google browser OAuth returns to the native app and exposes the Backend account', async () => {
  const { app, account } = fixture({ browser: async () => ({ type: 'success', url: 'mangadock://auth/callback?code=provider-code' }) });
  await app.signInOAuth('google');
  assert.deepEqual(app.snapshot(), { status: 'signedIn', account });
});

test('an OAuth result from the captcha callback cannot authenticate the native app', async () => {
  const { app } = fixture({ browser: async () => ({ type: 'success', url: 'mangadock://captcha/callback?code=unexpected-code' }) });
  await assert.rejects(app.signInOAuth('facebook'), /callback/);
  assert.equal(app.snapshot().account, null);
});

test('when Supabase invalidates the session native navigation immediately hides the account', async () => {
  const { app, supabase } = fixture();
  await app.signIn('reader@example.test', 'correct-test-password');
  await supabase.auth.signOut({ scope: 'local' });
  assert.deepEqual(app.snapshot(), { status: 'signedOut', account: null });
});

test('a failed account switch clears the previous reader from native navigation', async () => {
  const { app } = fixture();
  await app.signIn('reader@example.test', 'correct-test-password');
  await assert.rejects(app.signIn('other@example.test', 'wrong-password'), /Invalid login credentials/);
  assert.deepEqual(app.snapshot(), { status: 'signedOut', account: null });
});

test('disposing a native session prevents an outstanding account load from returning', async () => {
  let release!: (response: Response) => void;
  let started!: () => void;
  const loading = new Promise<void>((resolve) => { started = resolve; });
  const response = new Promise<Response>((resolve) => { release = resolve; });
  const { app, account } = fixture({ loadAccount: () => { started(); return response; } });
  const login = app.signIn('reader@example.test', 'correct-test-password');
  await loading;
  app.dispose();
  release(Response.json(account));
  await login;
  assert.equal(app.snapshot().account, null);
});

test('protected native requests can obtain a current token only after full account sign-in', async () => {
  const { app } = fixture({ mfa: true });
  await app.signIn('reader@example.test', 'correct-test-password');
  await assert.rejects(app.accessToken(), /เข้าสู่ระบบ|ยืนยัน/);
  await app.verifyTotp('123456');
  assert.ok(await app.accessToken());
  await app.signOut();
  await assert.rejects(app.accessToken(), /เข้าสู่ระบบ|ยืนยัน/);
});

test('a failed account switch cannot restore the old account on a cold relaunch', async () => {
  const { app, reopen } = fixture();
  await app.signIn('reader@example.test', 'correct-test-password');
  await assert.rejects(app.signIn('other@example.test', 'wrong-password'));
  app.dispose();
  const restarted = reopen(); await restarted.restore();
  assert.equal(restarted.snapshot().status, 'signedOut');
});
