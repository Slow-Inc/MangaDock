import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaptchaCallback } from '../captcha/protocol.mjs';

test('the hosted captcha page returns its request state and token to the fixed native callback', () => {
  const url = buildCaptchaCallback('https://captcha.example.test/?state=abcdef1234567890abcdef1234567890&returnTo=https://attacker.example.test', 'turnstile+test/token');
  const result = new URL(url);
  assert.equal(`${result.protocol}//${result.host}${result.pathname}`, 'mangadock://captcha/callback');
  assert.equal(result.searchParams.get('state'), 'abcdef1234567890abcdef1234567890');
  assert.equal(result.searchParams.get('token'), 'turnstile+test/token');
});

test('the hosted captcha page cannot return a result without a valid native request', () => {
  assert.throws(() => buildCaptchaCallback('https://captcha.example.test/', 'token'), /คำขอ/);
  assert.throws(() => buildCaptchaCallback('https://captcha.example.test/?state=abcdef1234567890abcdef1234567890', ''), /ตรวจสอบ/);
});
