import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { WalletService } from './wallet.service';
import type { SupabaseAuthUser } from '../auth/auth.types';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('balance')
  @UseGuards(AuthGuard)
  async getBalance(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    const balance = await this.wallet.getBalance(req[USER_KEY].uid);
    return { balance };
  }

  // DEV ONLY — no payment gateway yet; blocked in production until payment gateway is wired up per roadmap
  @Post('topup')
  @UseGuards(AuthGuard)
  async topup(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: { amount: number },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Direct topup is not available. Please use the payment gateway.');
    }
    return this.wallet.addCoins(req[USER_KEY].uid, body.amount, 'topup', 'เติมเหรียญ (ทดสอบ)');
  }

  @Get('transactions')
  @UseGuards(AuthGuard)
  async getTransactions(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.wallet.getTransactions(req[USER_KEY].uid);
  }

  @Get('earnings')
  @UseGuards(AuthGuard)
  async getCreatorEarnings(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.wallet.getCreatorEarnings(req[USER_KEY].uid);
  }
}
