import { Role } from '@prisma/client';
import { Exclude, Expose, Transform } from 'class-transformer';

export class UserEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string | Role;
  avatar: string;
  isEmailVerified: boolean;
  createdAt: Date;

  @Exclude()
  password: string;
  @Exclude()
  verificationToken: string;
  @Exclude()
  passwordResetToken: string;
  @Exclude()
  passwordResetExpires: Date;
  @Exclude()
  updatedAt: Date;
}
