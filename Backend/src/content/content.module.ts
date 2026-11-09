import { Global, Module } from '@nestjs/common';
import { ContentLevelService } from './content-level.service';

/** Global: the catalog (books) and the settings endpoints (users) must share one level cache (#1101). */
@Global()
@Module({
  providers: [ContentLevelService],
  exports: [ContentLevelService],
})
export class ContentModule {}
