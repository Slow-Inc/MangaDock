import { Module } from '@nestjs/common';
import { UnlockController } from './unlock.controller';
import { UnlockService } from './unlock.service';
import { WalletModule } from '../wallet/wallet.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [WalletModule, MetricsModule],
  controllers: [UnlockController],
  providers: [UnlockService],
})
export class UnlockModule {}
