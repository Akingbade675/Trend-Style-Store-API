import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateProductItemImageDto {
  @IsMongoId()
  @IsNotEmpty()
  imageId: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean = false;
}
