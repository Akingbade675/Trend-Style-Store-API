import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto'; // Adjust path

export class FindBrandsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string; // Search name/description

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean) // Handles 'true'/'false' strings
  isFeatured?: boolean;
}
