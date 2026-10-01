import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ContentReportsService } from './content-reports.service';
import type { SubmitReportDto } from './content-reports.dto';
import type { SupabaseService } from '../supabase/supabase.service';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const REPORTER = 'reporter-uid';

type Chain = {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  maybeSingle: jest.Mock;
  upsert: jest.Mock;
};

/** Minimal PostgREST-ish builder: `.select().eq().is().maybeSingle()`. */
function makeDb(postRow: { author_uid: string } | null) {
  const chain: Chain = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: postRow, error: null }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);

  const from = jest.fn().mockReturnValue(chain);
  return { client: { from }, upsert: chain.upsert, chain };
}

function makeService(postRow: { author_uid: string } | null) {
  const db = makeDb(postRow);
  const service = new ContentReportsService({
    client: db.client,
  } as unknown as SupabaseService);
  return { service, db };
}

const postReport: SubmitReportDto = {
  contentType: 'post',
  contentId: POST_ID,
  reason: 'spam',
  details: 'looks like an ad',
};

describe('ContentReportsService.submitReport', () => {
  it('stores a report for someone else’s post', async () => {
    const { service, db } = makeService({ author_uid: 'other-uid' });

    await service.submitReport(REPORTER, postReport);

    expect(db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: REPORTER,
        content_type: 'post',
        content_id: POST_ID,
        reason: 'spam',
        details: 'looks like an ad',
      }),
      { onConflict: 'uid,content_type,content_id' },
    );
  });

  it('rejects a self-report (#659)', async () => {
    const { service, db } = makeService({ author_uid: REPORTER });

    await expect(service.submitReport(REPORTER, postReport)).rejects.toThrow(
      ForbiddenException,
    );
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('rejects a report against a post that does not exist (#659)', async () => {
    const { service, db } = makeService(null);

    await expect(service.submitReport(REPORTER, postReport)).rejects.toThrow(
      NotFoundException,
    );
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid post id instead of 500ing on the query (#659)', async () => {
    const { service, db } = makeService({ author_uid: 'other-uid' });

    await expect(
      service.submitReport(REPORTER, {
        ...postReport,
        contentId: 'not-a-uuid',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('skips the ownership check for external manga ids (no local row to check)', async () => {
    const { service, db } = makeService(null);

    await service.submitReport(REPORTER, {
      contentType: 'manga',
      contentId: 'mangadex-abc',
      reason: 'copyright',
    });

    expect(db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content_type: 'manga', details: '' }),
      { onConflict: 'uid,content_type,content_id' },
    );
  });
});
