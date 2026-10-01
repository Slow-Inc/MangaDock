import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import type { SupabaseAuthUser } from '../auth/auth.types';
import { UserFollowsService } from './user-follows.service';

@Controller('user-follows')
export class UserFollowsController {
  constructor(private readonly svc: UserFollowsService) {}

  @Get(':uid/counts')
  getCounts(@Param('uid') uid: string) {
    return this.svc.getCounts(uid);
  }

  @Get(':uid/followers')
  getFollowers(@Param('uid') uid: string) {
    return this.svc.getFollowers(uid);
  }

  @Get(':uid/following')
  getFollowing(@Param('uid') uid: string) {
    return this.svc.getFollowing(uid);
  }

  @Get(':uid/is-following')
  @UseGuards(AuthGuard)
  async isFollowing(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('uid') uid: string,
  ) {
    const result = await this.svc.isFollowing(req[USER_KEY].uid, uid);
    return { following: result };
  }

  @Post(':uid/follow')
  @UseGuards(AuthGuard)
  follow(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('uid') uid: string,
  ) {
    return this.svc.follow(req[USER_KEY].uid, uid);
  }

  @Delete(':uid/follow')
  @UseGuards(AuthGuard)
  unfollow(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('uid') uid: string,
  ) {
    return this.svc.unfollow(req[USER_KEY].uid, uid);
  }
}
