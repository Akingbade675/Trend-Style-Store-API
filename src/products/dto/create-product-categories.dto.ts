import { IsArray, IsMongoId, IsString } from 'class-validator';

export class CreateProductCategoriesDto {
  @IsArray()
  @IsMongoId({ each: true })
  categoryIds: string[];
}
