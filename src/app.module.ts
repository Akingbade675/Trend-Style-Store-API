import { BadRequestException, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import passwordConfig from './auth/config/password.config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MailModule } from './mail/mail.module';
import jwtConfig from './auth/config/jwt.config';
import refreshTokenConfig from './auth/config/refresh-token.config';
import { RolesGuard } from './common/guards/role.guard';
import { AddressesModule } from './addresses/addresses.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { MediaModule } from './media/media.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { S3Module } from 'nestjs-s3';

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
    ProductsModule,
    MediaModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024 * 10 }, // 10 MB limit
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          return callback(
            new BadRequestException(
              'Only image files (JPG, PNG, GIF, WEBP) are allowed!',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
    S3Module.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        config: {
          credentials: {
            accessKeyId: configService.getOrThrow('AWS_ACCESS_KEY_ID'),
            secretAccessKey: configService.getOrThrow('AWS_SECRET_ACCESS_KEY'),
          },
          region: configService.getOrThrow('AWS_REGION'),
        },
      }),
      imports: [ConfigModule],
      inject: [ConfigService],
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
