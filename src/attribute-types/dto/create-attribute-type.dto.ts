import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateAttributeTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100) // Add reasonable length limit
  name: string; // e.g., "Color", "Size", "Material"

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
