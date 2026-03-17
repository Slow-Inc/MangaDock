import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { BooksModule } from './books/books.module';
import { UsersModule } from './users/users.module';
import { CacheModule } from './cache/cache.module';
import { StatusModule } from './status/status.module';
import { VersionsModule } from './versions/versions.module';
import { UploadModule } from './upload/upload.module';
import { WalletModule } from './wallet/wallet.module';
import { UnlockModule } from './unlock/unlock.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    CacheModule,
    BooksModule,
    UsersModule,
    StatusModule,
    VersionsModule,
    UploadModule,
    WalletModule,
    UnlockModule,
  ],
})
export class AppModule {}
