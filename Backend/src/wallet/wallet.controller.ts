import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { WalletService } from './wallet.service';
import { CreateTopupDto } from './dto/create-topup.dto';
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

  @Post('topup/create')
  @UseGuards(AuthGuard)
  async createTopup(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body(new ValidationPipe({ whitelist: true })) body: CreateTopupDto,
  ) {
    return this.wallet.createTopup(req[USER_KEY].uid, body.amount);
  }

  @Get('topup/status/:paymentId')
  @UseGuards(AuthGuard)
  async getTopupStatus(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('paymentId') paymentId: string,
  ) {
    return this.wallet.getTopupStatus(paymentId, req[USER_KEY].uid);
  }

  @Post('topup/:paymentId/cancel')
  @UseGuards(AuthGuard)
  async cancelTopup(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('paymentId') paymentId: string,
  ) {
    return this.wallet.cancelTopup(paymentId, req[USER_KEY].uid);
  }

  @Post('topup/:paymentId/simulate')
  @UseGuards(AuthGuard)
  async simulateTopup(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('paymentId') paymentId: string,
  ) {
    return this.wallet.simulateTopup(paymentId, req[USER_KEY].uid);
  }

  @Post('xendit/webhook')
  async xenditWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: Record<string, any>,
    @Headers('x-callback-token') token: string,
    @Headers('x-xendit-webhook-signature') signature: string,
  ) {
    return this.wallet.processXenditWebhook(body, token, (req as any).rawBody, signature);
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
