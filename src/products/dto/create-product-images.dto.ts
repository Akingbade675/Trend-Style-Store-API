import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsMongoId,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';

export class ProductImageDto {
  @IsNotEmpty()
  @IsMongoId()
  imageId: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateProductImagesDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images: ProductImageDto[];
}
