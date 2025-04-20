import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

// Helper to transform comma-separated strings to array
const TransformToArray = () =>
  Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : (value
          ?.split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0) ?? []),
  );

export class FindProductsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string; // Search name/description

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsMongoId()
  brandId?: string;

  @IsOptional()
  @TransformToArray()
  @IsString({ each: true }) // Validate each item in the array
  tags?: string[]; // Allow filtering by multiple tag IDs (e.g., /products?tags=id1,id2)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean = true;

  @IsOptional()
  @IsString()
  @IsIn(['price_asc', 'price_desc', 'name_asc', 'name_desc', 'createdAt_asc', 'createdAt_desc']) // Allowed sort values
  sortBy?: string = 'createdAt_desc'; // Default sort order
}
