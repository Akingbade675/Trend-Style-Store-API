import { IsMongoId, IsNotEmpty } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsNotEmpty()
  @IsMongoId()
  statusId: string;
}
