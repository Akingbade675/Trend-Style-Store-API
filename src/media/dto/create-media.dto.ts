import { MediaFolder } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// export enum MediaFolder {
//   banners,
//   brands,
//   categories,
//   products,
//   users,
// }

export class CreateMediaDto {
  @IsOptional()
  @IsString()
  altText?: string;

  @IsEnum(MediaFolder)
  @IsNotEmpty()
  folder: MediaFolder;
}
