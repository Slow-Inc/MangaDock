import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { XenditService } from './xendit.service';
import { WalletEventsService } from './wallet-events.service';
import { TopupThrottleGuard } from './topup-throttle.guard';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [WalletController],
  providers: [
    WalletService,
    XenditService,
    WalletEventsService,
    TopupThrottleGuard,
  ],
  exports: [WalletService],
})
export class WalletModule {}
