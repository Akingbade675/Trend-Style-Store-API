// src/banners/dto/create-banner.dto.ts
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBannerDto {
  @IsMongoId()
  @IsNotEmpty()
  imageId: string; // ID of an existing Media item

  @IsString()
  @IsNotEmpty()
  targetScreen: string; // Identifier for where the banner links (e.g., 'CategoryScreen:id', 'ProductScreen:id', 'SalesScreen')

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
