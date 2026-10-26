import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import type { SupabaseAuthUser } from '../auth/auth.types';
import { CollectionDto, CollectionItemDto, FeedQuery } from './retention.dto';
import { RetentionService } from './retention.service';

type AuthRequest = Request & { [USER_KEY]: SupabaseAuthUser };

@Controller()
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Get('feed')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard)
  feed(@Req() req: AuthRequest, @Query() query: FeedQuery) {
    return this.retention.feed(req[USER_KEY].uid, query);
  }

  @Get('collections/public/:id')
  @Header('Cache-Control', 'no-store')
  publicCollection(@Param('id', ParseUUIDPipe) id: string) {
    return this.retention.detail(id, null);
  }

  @Get('collections')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard)
  list(@Req() req: AuthRequest) {
    return this.retention.list(req[USER_KEY].uid);
  }

  @Post('collections')
  @UseGuards(AuthGuard)
  create(@Req() req: AuthRequest, @Body() dto: CollectionDto) {
    return this.retention.create(req[USER_KEY].uid, dto);
  }

  @Get('collections/:id')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard)
  detail(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.retention.detail(id, req[USER_KEY].uid);
  }

  @Put('collections/:id')
  @UseGuards(AuthGuard)
  update(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectionDto,
  ) {
    return this.retention.update(req[USER_KEY].uid, id, dto);
  }

  @Delete('collections/:id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  remove(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.retention.remove(req[USER_KEY].uid, id);
  }

  @Put('collections/:id/items')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  item(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectionItemDto,
  ) {
    return this.retention.item(req[USER_KEY].uid, id, dto);
  }

  @Delete('collections/:id/items')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  removeItem(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectionItemDto,
  ) {
    return this.retention.item(req[USER_KEY].uid, id, dto, true);
  }
}
