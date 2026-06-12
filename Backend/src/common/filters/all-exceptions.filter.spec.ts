import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface Reply {
  body: { statusCode: number; message: string; code: string; path: string };
  status: number;
}

function setup() {
  const replies: Reply[] = [];
  const httpAdapter = {
    getRequestUrl: () => '/test/path',
    reply: (_res: unknown, body: Reply['body'], status: number) =>
      replies.push({ body, status }),
  };
  const filter = new AllExceptionsFilter({ httpAdapter } as never);
  const host = {
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as ArgumentsHost;
  return { filter, host, replies };
}

describe('AllExceptionsFilter', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Silence + capture server-side logging.
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('returns a generic message for an unexpected (non-HttpException) error and logs the real one', () => {
    const { filter, host, replies } = setup();
    filter.catch(new Error('Postgres password=hunter2 leaked detail'), host);

    expect(replies).toHaveLength(1);
    expect(replies[0].status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(replies[0].body.message).toBe('Internal server error');
    expect(replies[0].body.code).toBe('INTERNAL_ERROR');
    // The raw detail must never reach the client...
    expect(replies[0].body.message).not.toContain('hunter2');
    // ...but it must be logged server-side.
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toContain('hunter2');
  });

  it('passes an intentional HttpException message through unchanged', () => {
    const { filter, host, replies } = setup();
    filter.catch(
      new HttpException('Resource not found', HttpStatus.NOT_FOUND),
      host,
    );

    expect(replies[0].status).toBe(HttpStatus.NOT_FOUND);
    expect(replies[0].body.message).toBe('Resource not found');
  });

  it('maps a Supabase-offline error to 503 with its crafted message', () => {
    const { filter, host, replies } = setup();
    filter.catch(new Error('fetch failed'), host);

    expect(replies[0].status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(replies[0].body.code).toBe('SUPABASE_OFFLINE');
    expect(replies[0].body.message).toContain('SUPABASE_CONNECTION_ERROR');
  });
});
