import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import { BooksModule } from './books/books.module';
import { UsersModule } from './users/users.module';
import { CacheModule } from './cache/cache.module';
import { StatusModule } from './status/status.module';
import { VersionsModule } from './versions/versions.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    CacheModule,
    BooksModule,
    UsersModule,
    StatusModule,
    VersionsModule,
    UploadModule,
  ],
})
export class AppModule {}
