import { IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateProductCategoriesDto {
  @IsNotEmpty()
  @IsArray()
  @IsMongoId({ each: true })
  categoryIds: string[];
}
