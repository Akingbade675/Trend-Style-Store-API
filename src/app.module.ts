import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import passwordConfig from './auth/config/password.config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MailService } from './mail/mail.service';
import { MailModule } from './mail/mail.module';
import jwtConfig from './auth/config/jwt.config';
import refreshTokenConfig from './auth/config/refresh-token.config';
import { RolesGuard } from './common/guards/role.guard';

@Module({
  imports: [
    AuthModule,
    UserModule,
    PrismaModule,
    MailModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [passwordConfig, jwtConfig, refreshTokenConfig],
    }),
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
