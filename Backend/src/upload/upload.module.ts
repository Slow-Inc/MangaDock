import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { VersionsModule } from '../versions/versions.module';

@Module({
  imports: [VersionsModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
