import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const VALID_TYPES = ['post', 'manga', 'translation'] as const;
const VALID_REASONS = [
  'spam',
  'inappropriate',
  'misinformation',
  'copyright',
  'other',
] as const;

@Injectable()
export class ContentReportsService {
  private readonly logger = new Logger(ContentReportsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  async submitReport(
    uid: string,
    data: { contentType: string; contentId: string; reason: string; details?: string },
  ): Promise<void> {
    if (!VALID_TYPES.includes(data.contentType as typeof VALID_TYPES[number])) {
      throw new BadRequestException('Invalid content type');
    }
    if (!VALID_REASONS.includes(data.reason as typeof VALID_REASONS[number])) {
      throw new BadRequestException('Invalid reason');
    }
    if (!data.contentId?.trim()) throw new BadRequestException('contentId required');

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
    this.logger.log(`User ${uid} reported ${data.contentType}/${data.contentId}: ${data.reason}`);
  }
}
