import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { XenditService } from './xendit.service';
import { WalletEventsService } from './wallet-events.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, XenditService, WalletEventsService],
  exports: [WalletService],
})
export class WalletModule {}
