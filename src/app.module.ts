import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import passwordConfig from './auth/config/password.config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MailModule } from './mail/mail.module';
import jwtConfig from './auth/config/jwt.config';
import refreshTokenConfig from './auth/config/refresh-token.config';
import { RolesGuard } from './common/guards/role.guard';
import { AddressesModule } from './addresses/addresses.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    PrismaModule,
    MailModule,
    AddressesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [passwordConfig, jwtConfig, refreshTokenConfig],
    }),
    CategoriesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
