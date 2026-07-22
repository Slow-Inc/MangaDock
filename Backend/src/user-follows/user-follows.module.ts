import { Module } from '@nestjs/common';
import { UserFollowsController } from './user-follows.controller';
import { UserFollowsService } from './user-follows.service';

@Module({
  controllers: [UserFollowsController],
  providers: [UserFollowsService],
})
export class UserFollowsModule {}
