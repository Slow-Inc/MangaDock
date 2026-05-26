import { generateClearanceToken, verifyClearanceToken } from './turnstile.guard';

const SECRET = 'test-secret-key';
const HWID = 'device-abc123';

describe('TurnstileGuard — token helpers', () => {
  describe('generateClearanceToken', () => {
    it('should return a string containing HWID and signature', () => {
      const token = generateClearanceToken(SECRET, HWID);
      expect(token).toContain(HWID);
      expect(token.split('.')).toHaveLength(2);
    });

    it('should have a timestamp in the future', () => {
      const token = generateClearanceToken(SECRET, HWID);
      const expiresAt = parseInt(token.split('.')[0].split(':')[0], 10);
      expect(expiresAt).toBeGreaterThan(Date.now());
    });

    it('should produce different tokens for different HWIDs', () => {
      const t1 = generateClearanceToken(SECRET, 'hwid-1');
      const t2 = generateClearanceToken(SECRET, 'hwid-2');
      expect(t1).not.toBe(t2);
    });
  });

  describe('verifyClearanceToken', () => {
    it('should pass for a valid token', () => {
      const token = generateClearanceToken(SECRET, HWID);
      expect(verifyClearanceToken(token, SECRET, HWID)).toBe(true);
    });

    it('should fail for a wrong HWID (Zero-Trust binding)', () => {
      const token = generateClearanceToken(SECRET, HWID);
      expect(verifyClearanceToken(token, SECRET, 'wrong-device')).toBe(false);
    });

    it('should fail for an expired token', () => {
      const expiredTime = Date.now() - 1000;
      const data = `${expiredTime}:${HWID}`;
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
      const token = `${data}.${hmac}`;
      expect(verifyClearanceToken(token, SECRET, HWID)).toBe(false);
    });

    it('should fail if signature is tampered', () => {
      const token = generateClearanceToken(SECRET, HWID);
      const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
      expect(verifyClearanceToken(tampered, SECRET, HWID)).toBe(false);
    });

    it('should fail if secret is different', () => {
      const token = generateClearanceToken(SECRET, HWID);
      expect(verifyClearanceToken(token, 'different-secret', HWID)).toBe(false);
    });

    it('should fail for malformed tokens', () => {
      expect(verifyClearanceToken('', SECRET, HWID)).toBe(false);
      expect(verifyClearanceToken('not-a-token', SECRET, HWID)).toBe(false);
    });
  });
});
