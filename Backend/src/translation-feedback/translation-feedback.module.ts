import { Module } from '@nestjs/common';
import { TranslationFeedbackController } from './translation-feedback.controller';
import { TranslationFeedbackService } from './translation-feedback.service';

@Module({
  controllers: [TranslationFeedbackController],
  providers: [TranslationFeedbackService],
})
export class TranslationFeedbackModule {}
