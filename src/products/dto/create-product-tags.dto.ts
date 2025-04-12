import { IsArray, IsString } from 'class-validator';

export class CreateProductTagsDto {
  @IsArray()
  @IsString({ each: true })
  tagNames: string[];
}
