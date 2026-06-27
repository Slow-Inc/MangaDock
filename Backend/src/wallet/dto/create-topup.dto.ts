import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_TOPUP_COINS } from '../wallet.service';

export class CreateTopupDto {
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(MAX_TOPUP_COINS)
  amount: number;
}
