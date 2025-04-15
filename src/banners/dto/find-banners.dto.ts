import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class FindBannersDto extends PaginationDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean) // Handles 'true'/'false' strings
  isActive?: boolean; // Filter by active status (e.g., only show active banners publicly)
}
