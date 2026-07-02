import { IsInt, IsPositive } from 'class-validator';

export class InitiateRefundDto {
  /**
   * Amount in paise (₹1 = 100). The admin computes this from the order
   * total — the controller surfaces the order summary to make this
   * explicit.
   */
  @IsInt()
  @IsPositive()
  amountInPaise!: number;
}
