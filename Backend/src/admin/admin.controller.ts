import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

// ── DTOs ─────────────────────────────────────────────────────────────────────

class AdminListUsersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() role?: number;
  @IsOptional() @IsString() plan?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() banned?: boolean;
}

class AdminListPostsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() authorUid?: string;
}

class AdminListTxQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() uid?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

class ChangeRoleDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2])
  role: number;
}

class PinPostDto {
  @IsBoolean()
  pinned: boolean;
}

class AdminAuditLogsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() actorUid?: string;
}

class AdjustWalletDto {
  @Type(() => Number)
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  delta: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Overview ────────────────────────────────────────────────────────────────

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ── Users ────────────────────────────────────────────────────────────────────

  @Get('users')
  listUsers(@Query() query: AdminListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:uid')
  getUserDetail(@Param('uid') uid: string) {
    return this.adminService.getUserDetail(uid);
  }

  @Patch('users/:uid/role')
  changeRole(
    @Req() req: AuthenticatedRequest,
    @Param('uid') uid: string,
    @Body() body: ChangeRoleDto,
  ) {
    return this.adminService.changeRole(req.uid, uid, body.role);
  }

  @Post('users/:uid/ban')
  @HttpCode(200)
  banUser(@Req() req: AuthenticatedRequest, @Param('uid') uid: string) {
    return this.adminService.banUser(req.uid, uid);
  }

  @Post('users/:uid/unban')
  @HttpCode(200)
  unbanUser(@Req() req: AuthenticatedRequest, @Param('uid') uid: string) {
    return this.adminService.unbanUser(req.uid, uid);
  }

  @Patch('users/:uid/wallet')
  adjustWallet(
    @Req() req: AuthenticatedRequest,
    @Param('uid') uid: string,
    @Body() body: AdjustWalletDto,
  ) {
    return this.adminService.adjustWallet(
      req.uid,
      uid,
      body.delta,
      body.reason,
    );
  }

  // ── Content ──────────────────────────────────────────────────────────────────

  @Get('content/posts')
  listPosts(@Query() query: AdminListPostsQueryDto) {
    return this.adminService.listPosts(query);
  }

  @Delete('content/posts/:id')
  @HttpCode(204)
  deletePost(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.adminService.adminDeletePost(req.uid, id);
  }

  @Patch('content/posts/:id/pin')
  pinPost(@Param('id') id: string, @Body() body: PinPostDto) {
    return this.adminService.pinPost(id, body.pinned);
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  @Get('transactions')
  listTransactions(@Query() query: AdminListTxQueryDto) {
    return this.adminService.listTransactions(query);
  }

  @Get('transactions/:id')
  getTransaction(@Param('id') id: string) {
    return this.adminService.getTransaction(id);
  }

  // ── Audit log ─────────────────────────────────────────────────────────────

  @Get('audit')
  getAuditLogs(@Query() query: AdminAuditLogsQueryDto) {
    return this.adminService.getAuditLogs({
      limit: Math.min(query.limit ?? 50, 200),
      offset: query.offset ?? 0,
      action: query.action || undefined,
      actorUid: query.actorUid || undefined,
    });
  }
}
