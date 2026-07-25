import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SubmitReportDto } from './content-reports.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ContentReportsService {
  private readonly logger = new Logger(ContentReportsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  /**
   * Reject reports against a post that does not exist or that the reporter owns
   * (#659). Only `post` targets live in our own tables — `manga`/`translation`
   * ids are external catalog ids with no local row to check against, so those
   * are accepted as before.
   */
  private async assertReportablePost(
    uid: string,
    postId: string,
  ): Promise<void> {
    if (!UUID_RE.test(postId)) {
      throw new BadRequestException('Invalid post id');
    }

    const { data, error } = await this.db
      .from('forum_posts')
      .select('author_uid')
      .eq('id', postId)
      .is('deleted_at', null)
      .maybeSingle<{ author_uid: string }>();

    if (error)
      throw new Error(`Failed to verify report target: ${error.message}`);
    if (!data) throw new NotFoundException('Post not found');
    if (data.author_uid === uid) {
      throw new ForbiddenException('Cannot report your own content');
    }
  }

  async submitReport(uid: string, data: SubmitReportDto): Promise<void> {
    // contentType / reason / lengths are enforced by SubmitReportDto (#654).
    if (data.contentType === 'post') {
      await this.assertReportablePost(uid, data.contentId);
    }

    // The (uid, content_type, content_id) unique constraint
    // `content_reports_uid_content_type_content_id_key` backs this upsert, so a
    // user can only hold one open report per target.
    const { error } = await this.db.from('content_reports').upsert(
      {
        uid,
        content_type: data.contentType,
        content_id: data.contentId,
        reason: data.reason,
        details: data.details?.trim() ?? '',
      },
      { onConflict: 'uid,content_type,content_id' },
    );

    if (error) throw new Error(`Failed to submit report: ${error.message}`);
    this.logger.log(
      `User ${uid} reported ${data.contentType}/${data.contentId}: ${data.reason}`,
    );
  }
}
