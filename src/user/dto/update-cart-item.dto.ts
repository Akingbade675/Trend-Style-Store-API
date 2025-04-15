import { IsNotEmpty, IsPositive, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsNotEmpty()
  @IsPositive()
  @Min(1)
  quantity: number;
}
