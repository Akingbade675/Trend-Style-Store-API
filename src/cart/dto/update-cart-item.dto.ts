import { IsPositive, Min } from 'class-validator';

import { IsNotEmpty } from 'class-validator';

export class UpdateCartItemDto {
  @IsNotEmpty()
  @IsPositive()
  @Min(1)
  quantity: number;
}
