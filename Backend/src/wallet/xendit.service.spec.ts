import { XenditService } from './xendit.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('XenditService.getPaymentRequest', () => {
  let service: XenditService;
  const realFetch = global.fetch;

  beforeEach(() => {
    service = new XenditService();
    process.env.XENDIT_SECRET_KEY = 'xnd_test_key';
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns status, amount and currency on 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pr-1', status: 'SUCCEEDED', amount: 100, currency: 'THB' }),
    }) as any;

    const res = await service.getPaymentRequest('pr-1');
    expect(res).toEqual({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/payment_requests/pr-1');
  });

  it('throws InternalServerErrorException on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'not found',
    }) as any;

    await expect(service.getPaymentRequest('pr-x')).rejects.toThrow(InternalServerErrorException);
  });
});
