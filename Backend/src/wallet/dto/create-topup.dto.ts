import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTopupDto {
  @Type(() => Number)
  @IsInt()
  @Min(20)
  amount: number;
}
