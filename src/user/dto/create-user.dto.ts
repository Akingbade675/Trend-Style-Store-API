import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEmpty,
  IsEnum,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email should not be empty.' })
  email: string;

  @IsString({ message: 'Username must be a string.' })
  @IsNotEmpty({ message: 'Username should not be empty.' })
  username: string;

  @IsString({ message: 'First name must be a string.' })
  @IsNotEmpty({ message: 'First name should not be empty.' })
  firstName: string;

  @IsString({ message: 'Last name must be a string.' })
  @IsNotEmpty({ message: 'Last name should not be empty.' })
  lastName: string;

  @IsStrongPassword(
    {},
    {
      message:
        'Password must be strong (include uppercase, lowercase, numbers, and symbols).',
    },
  )
  @IsNotEmpty({ message: 'Password should not be empty.' })
  password: string;

  @IsPhoneNumber('NG', {
    message: 'Please provide a valid Nigerian phone number.',
  })
  @IsNotEmpty({ message: 'Phone number should not be empty.' })
  phoneNumber: string;

  @IsString({ message: 'Avatar must be a string.' })
  @IsNotEmpty({ message: 'Avatar should not be empty.' })
  avatar: string;

  @IsEnum(Role, { message: 'Role must be either CUSTOMER or ADMIN.' })
  role?: Role = Role.CUSTOMER; // Default to CUSTOMER if not provided
}
