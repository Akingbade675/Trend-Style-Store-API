import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class ProductAttributeValueDto {
  @IsNotEmpty()
  @IsString()
  attributeTypeId: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  values: string[];
}

export class CreateProductAttributesDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  attributes: ProductAttributeValueDto[];
}
