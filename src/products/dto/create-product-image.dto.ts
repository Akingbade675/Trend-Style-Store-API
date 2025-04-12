import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateProductImageDto {
  @IsNotEmpty()
  @IsMongoId()
  imageId: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
