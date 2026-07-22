import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { StorageModule } from './common/storage/storage.module';
import { BooksModule } from './books/books.module';
import { UsersModule } from './users/users.module';
import { StatusModule } from './status/status.module';
import { CacheModule } from './cache/cache.module';
import { VersionsModule } from './versions/versions.module';
import { UploadModule } from './upload/upload.module';
import { WalletModule } from './wallet/wallet.module';
import { UnlockModule } from './unlock/unlock.module';
import { HardwareIdMiddleware } from './common/middleware/hardware-id.middleware';
import { ForumModule } from './forum/forum.module';
import { AdminModule } from './admin/admin.module';
import { ReviewsModule } from './reviews/reviews.module';

import { validate } from './common/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    SupabaseModule,
    StorageModule,
    CacheModule,
    BooksModule,
    UsersModule,
    StatusModule,
    VersionsModule,
    UploadModule,
    WalletModule,
    UnlockModule,
    ForumModule,
    AdminModule,
    ReviewsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HardwareIdMiddleware)
      .exclude({ path: 'wallet/xendit/webhook', method: RequestMethod.POST })
      .forRoutes('*');
  }
}
