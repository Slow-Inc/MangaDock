import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { BooksController } from './books.controller';
import { verifyTurnstileToken } from '../auth/turnstile.verify';
import { generateClearanceToken } from '../auth/turnstile.guard';
import { resolveTurnstileConfig } from '../auth/turnstile.config';

jest.mock('../auth/turnstile.verify');
jest.mock('../auth/turnstile.guard');
jest.mock('../auth/turnstile.config');

const mockVerifyTurnstileToken = verifyTurnstileToken as jest.MockedFunction<
  typeof verifyTurnstileToken
>;
const mockGenerateClearanceToken =
  generateClearanceToken as jest.MockedFunction<typeof generateClearanceToken>;
const mockResolveTurnstileConfig =
  resolveTurnstileConfig as jest.MockedFunction<typeof resolveTurnstileConfig>;

describe('BooksController.verifyCaptcha', () => {
  let controller: BooksController;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new BooksController({} as any, {} as any);
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('throws 400 "Token is required" when body.token is missing, without calling verifyTurnstileToken', async () => {
    await expect(
      controller.verifyCaptcha('hwid-1', { token: '' }),
    ).rejects.toMatchObject(
      new HttpException('Token is required', HttpStatus.BAD_REQUEST),
    );
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('throws 400 "Hardware ID is required" when enabled and hwid is missing', async () => {
    mockResolveTurnstileConfig.mockReturnValue({
      enabled: true,
      secret: 'secret-1',
    });

    await expect(
      controller.verifyCaptcha('', { token: 'tok' }),
    ).rejects.toMatchObject(
      new HttpException('Hardware ID is required', HttpStatus.BAD_REQUEST),
    );
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('returns clearanceToken and skips verification when turnstile is disabled', async () => {
    mockResolveTurnstileConfig.mockReturnValue({
      enabled: false,
      secret: 'secret-2',
    });
    mockGenerateClearanceToken.mockReturnValue('clearance-disabled');

    const result = await controller.verifyCaptcha('hwid-1', { token: 'tok' });

    expect(result).toEqual({ clearanceToken: 'clearance-disabled' });
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('returns clearanceToken when enabled and verifyTurnstileToken succeeds', async () => {
    mockResolveTurnstileConfig.mockReturnValue({
      enabled: true,
      secret: 'secret-3',
    });
    mockVerifyTurnstileToken.mockResolvedValue({ success: true });
    mockGenerateClearanceToken.mockReturnValue('clearance-ok');

    const result = await controller.verifyCaptcha('hwid-1', { token: 'tok' });

    expect(result).toEqual({ clearanceToken: 'clearance-ok' });
    expect(mockVerifyTurnstileToken).toHaveBeenCalledWith('tok', 'secret-3');
  });

  it('throws 401 and logs when verifyTurnstileToken resolves success: false', async () => {
    mockResolveTurnstileConfig.mockReturnValue({
      enabled: true,
      secret: 'secret-4',
    });
    mockVerifyTurnstileToken.mockResolvedValue({
      success: false,
      errorCodes: ['x'],
    });

    await expect(
      controller.verifyCaptcha('hwid-1', { token: 'tok' }),
    ).rejects.toMatchObject(
      new HttpException('Invalid Captcha token', HttpStatus.UNAUTHORIZED),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Turnstile verification failed'),
    );
  });

  it('throws 401 and logs when verifyTurnstileToken rejects', async () => {
    mockResolveTurnstileConfig.mockReturnValue({
      enabled: true,
      secret: 'secret-5',
    });
    mockVerifyTurnstileToken.mockRejectedValue(new Error('network down'));

    await expect(
      controller.verifyCaptcha('hwid-1', { token: 'tok' }),
    ).rejects.toMatchObject(
      new HttpException('Invalid Captcha token', HttpStatus.UNAUTHORIZED),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Turnstile API request failed'),
    );
  });
});
