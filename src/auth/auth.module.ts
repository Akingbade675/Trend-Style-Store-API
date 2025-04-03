import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from './config/jwt.config';
import { ConfigModule } from '@nestjs/config';
import passwordConfig from './config/password.config';
import refreshTokenConfig from './config/refresh-token.config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionInfoMiddleware } from 'src/common/middleware/session-info.middleware';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    MailModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [passwordConfig, jwtConfig, refreshTokenConfig],
    }),
    JwtModule.registerAsync(jwtConfig.asProvider()),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionInfoMiddleware).forRoutes('*');
  }
}
