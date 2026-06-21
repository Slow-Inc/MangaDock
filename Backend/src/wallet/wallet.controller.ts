import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  MessageEvent,
  Param,
  Post,
  Req,
  Sse,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { EMPTY, Observable, of, timer } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { TopupThrottleGuard } from './topup-throttle.guard';
import { WalletService } from './wallet.service';
import { WalletEventsService } from './wallet-events.service';
import { CreateTopupDto } from './dto/create-topup.dto';
import type { SupabaseAuthUser } from '../auth/auth.types';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly walletEvents: WalletEventsService,
  ) {}

  @Get('balance')
  @UseGuards(AuthGuard)
  async getBalance(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    const balance = await this.wallet.getBalance(req[USER_KEY].uid);
    return { balance };
  }

  // DEV/TEST ONLY — direct credit without payment. Fail-closed: blocked unless
  // XENDIT_ALLOW_SIMULATE=true (never set in production).
  @Post('topup')
  @UseGuards(AuthGuard)
  async topup(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body(new ValidationPipe({ whitelist: true })) body: CreateTopupDto,
  ) {
    if (process.env.XENDIT_ALLOW_SIMULATE !== 'true') {
      throw new ForbiddenException('Direct topup is not available. Please use the payment gateway.');
    }
    return this.wallet.addCoins(req[USER_KEY].uid, body.amount, 'topup', 'เติมเหรียญ (ทดสอบ)');
  }

  @Post('topup/create')
  @UseGuards(AuthGuard, TopupThrottleGuard)
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

  @Sse('topup/:paymentId/stream')
  @UseGuards(AuthGuard)
  async streamTopupStatus(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('paymentId') paymentId: string,
  ): Promise<Observable<MessageEvent>> {
    const uid = req[USER_KEY].uid;

    // Ownership check — throws NotFoundException if uid mismatch
    const topup = await this.wallet.getTopupExpiry(paymentId, uid);

    // Already paid before client connected (race condition) — emit immediately
    if (topup.status === 'paid') {
      const balance = await this.wallet.getBalance(uid);
      return of({
        data: JSON.stringify({ event: 'payment.paid', balance }),
      } as MessageEvent);
    }

    // Expired or cancelled — close immediately with no events
    if (topup.status !== 'pending') {
      return EMPTY;
    }

    // Auto-close when QR expires
    const msUntilExpiry = Math.max(
      new Date(topup.expiresAt).getTime() - Date.now(),
      1000,
    );

    return this.walletEvents.stream$(paymentId).pipe(
      map(
        ({ balance }) =>
          ({
            data: JSON.stringify({ event: 'payment.paid', balance }),
          }) as MessageEvent,
      ),
      takeUntil(timer(msUntilExpiry)),
    );
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
