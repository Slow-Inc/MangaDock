import { Module } from '@nestjs/common';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';

@Module({ controllers: [RetentionController], providers: [RetentionService] })
export class RetentionModule {}
