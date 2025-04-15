import { IsNotEmpty, IsPositive, IsString, Min } from 'class-validator';

export class AddToCartDto {
  @IsNotEmpty()
  @IsString()
  productItemId: string;

  @IsNotEmpty()
  @IsPositive()
  @Min(1)
  quantity: number;
}
