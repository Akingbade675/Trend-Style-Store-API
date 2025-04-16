import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({
    description: "ID of the user's saved shipping address.",
    example: '605c72ef967802e3a8e510c2',
  })
  @IsNotEmpty()
  @IsMongoId()
  shippingAddressId: string;

  @ApiProperty({
    description: "Optional ID of the user's saved billing address. If not provided, shipping address might be used.",
    example: '605c72ef967802e3a8e510c3',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  billingAddressId?: string;

  // Notes:
  // - Payment details (e.g., paymentMethodId, transactionReference) would typically be added here
  //   AFTER successful payment processing via a separate payment gateway integration.
  // - We assume the order items are derived from the user's current cart.
}
