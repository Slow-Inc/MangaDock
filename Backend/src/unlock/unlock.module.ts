import { Module } from '@nestjs/common';
import { UnlockController } from './unlock.controller';
import { UnlockService } from './unlock.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [UnlockController],
  providers: [UnlockService],
})
export class UnlockModule {}
