import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProductItemImageDto } from './create-product-item-image.dto';
import { CreateProductItemAttributeLinkDto } from './create-product-item-attribute.dto';

export class CreateProductItemDto {
  @IsOptional() // SKU might be auto-generated based on prefix + attributes later
  @IsString()
  sku?: string;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number; // If different from base product

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number; // If different from base product

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  // References the attributes defined at the Product level
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1) // An item should typically be defined by at least one attribute variation
  @Type(() => CreateProductItemAttributeLinkDto)
  attributes: CreateProductItemAttributeLinkDto[];

  // Optional images specific to this item variation
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductItemImageDto)
  images?: CreateProductItemImageDto[];
}
