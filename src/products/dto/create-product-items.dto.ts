import { Type } from 'class-transformer';
import {
  IsArray,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  IsMongoId,
  ValidateNested,
} from 'class-validator';

export class ProductItemAttributeDto {
  @IsString()
  attributeTypeId: string;

  @IsString()
  value: string;
}

export class ProductItemImageDto {
  @IsString()
  imageId: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false;
}

export class CreateProductItemDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @IsNotEmpty()
  stock: number;

  @IsNumber()
  @IsNotEmpty()
  originalPrice: number;

  @IsNumber()
  @IsNotEmpty()
  salePrice: number;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNotEmpty()
  @IsArray()
  @IsMongoId({ each: true })
  attributes: string[];

  @IsArray()
  @IsOptional()
  images?: ProductItemImageDto[];
}

export class CreateProductItemsDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductItemDto)
  items: CreateProductItemDto[];
}
