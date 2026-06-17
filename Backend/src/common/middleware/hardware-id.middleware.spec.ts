import {
  HardwareIdMiddleware,
  isValidHardwareId,
} from './hardware-id.middleware';
import { Request, Response, NextFunction } from 'express';

describe('HardwareIdMiddleware', () => {
  let middleware: HardwareIdMiddleware;
  // Express `Request.path` is read-only; use a mutable shape so the per-case
  // `mockRequest.path = …` assignments type-check, then cast at the call site.
  let mockRequest: Partial<Omit<Request, 'path'>> & { path: string };
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    middleware = new HardwareIdMiddleware();
    mockRequest = { path: '', headers: {}, method: 'GET' };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  // ─── Routes NOT protected by HWID (pass through to AuthGuard) ───────────────
  // Wallet, forum, unlock, auth, and general API routes use AuthGuard instead.

  it.each([
    '/status/health',
    '/auth/login',
    '/auth/callback',
    '/books/search',
    '/books/manga/abc/cover',
    '/books/manga/abc/chapters',
    '/books/verify-captcha',
    '/wallet/balance',
    '/wallet/earnings',
    '/wallet/transactions',
    '/unlock/abc123',
    '/forum/posts',
    '/forum/posts/123/comments',
  ])(
    'should pass through %s without HWID (guarded by AuthGuard, not HWID)',
    (path) => {
      mockRequest.path = path;
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    },
  );

  // ─── Routes that DO require HWID (protected content) ────────────────────────

  it.each([
    '/books/chapters/ch1/pages',
    '/books/chapters/ch1/pages/1',
    '/books/chapters/ch1/en-translate',
    '/books/chapters/ch1/th-translate',
    '/books/translate/mit-health',
    '/versions/v1',
    '/versions/v1/',
    '/upload/something',
  ])('should reject %s without HWID header', (path) => {
    mockRequest.path = path;
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing or malformed hardware ID' }),
    );
    expect(nextFunction).not.toHaveBeenCalled();
  });

  // ─── Malformed HWID on a protected route is rejected (shape check) ───────────

  it.each([
    ['too short', 'short'],
    ['contains a space', 'device abc 123'],
    ['injection-ish chars', 'dev<script>'],
    ['newline / control char', 'line\nbreak'],
    ['too long (>128)', 'a'.repeat(129)],
  ])('should reject a protected route when HWID is %s', (_label, value) => {
    mockRequest.path = '/books/chapters/ch1/pages';
    mockRequest.headers = { 'x-hardware-id': value };
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject a duplicate (array) HWID header on a protected route', () => {
    mockRequest.path = '/books/chapters/ch1/pages';
    mockRequest.headers = {
      'x-hardware-id': ['device-abc123', 'device-xyz789'],
    };
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it.each([
    '/books/chapters/ch1/pages',
    '/books/chapters/ch1/en-translate',
    '/versions/v1',
    '/upload/something',
  ])(
    'should allow %s when HWID header is present and attach it to request',
    (path) => {
      mockRequest.path = path;
      mockRequest.headers = { 'x-hardware-id': 'device-abc123' };
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect((mockRequest as any).hardwareId).toBe('device-abc123');
    },
  );

  it('should allow the real generator shape (mdock_ + base64) on a protected route', () => {
    const realHwid = 'mdock_' + 'aB3+/xY9zZ0123456789abcdefghij=='.slice(0, 32);
    mockRequest.path = '/books/chapters/ch1/pages';
    mockRequest.headers = { 'x-hardware-id': realHwid };
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect((mockRequest as any).hardwareId).toBe(realHwid);
  });
});

describe('isValidHardwareId', () => {
  it.each([
    'device-abc123',
    'mdock_aB3+/xY9zZ0123456789abcdefghij==',
    '550e8400-e29b-41d4-a716-446655440000',
  ])('accepts well-formed id %s', (value) => {
    expect(isValidHardwareId(value)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['too short (<8)', 'short'],
    ['too long (>128)', 'a'.repeat(129)],
    ['has whitespace', 'device abc'],
    ['injection chars', 'dev<script>'],
    ['control char', 'line\nbreak'],
  ])('rejects %s', (_label, value) => {
    expect(isValidHardwareId(value)).toBe(false);
  });

  it('rejects non-string values (array / undefined / number)', () => {
    expect(isValidHardwareId(['a', 'b'])).toBe(false);
    expect(isValidHardwareId(undefined)).toBe(false);
    expect(isValidHardwareId(12345678)).toBe(false);
  });
});
