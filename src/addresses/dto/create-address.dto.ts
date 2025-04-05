import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsPhoneNumber('NG')
  phoneNumber?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  state: string;

  @IsMongoId()
  @IsNotEmpty()
  countryId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  postalCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;
}
