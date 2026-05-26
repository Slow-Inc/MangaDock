import { Module } from '@nestjs/common';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { ForumEventsService } from './forum-events.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ForumController],
  providers: [ForumService, ForumEventsService],
  exports: [ForumService, ForumEventsService],
})
export class ForumModule {}
