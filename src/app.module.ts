import { BadRequestException, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { S3Module } from 'nestjs-s3';
import { AddressesModule } from './addresses/addresses.module';
import { AttributeTypesModule } from './attribute-types/attribute-types.module';
import { AuthModule } from './auth/auth.module';
import jwtConfig from './auth/config/jwt.config';
import passwordConfig from './auth/config/password.config';
import refreshTokenConfig from './auth/config/refresh-token.config';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { BannersModule } from './banners/banners.module';
import { BrandsModule } from './brands/brands.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { RolesGuard } from './common/guards/role.guard';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SearchModule } from './search/search.module';
import { UserModule } from './user/user.module';

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
    EventEmitterModule.forRoot(),
    CategoriesModule,
    ProductsModule,
    MediaModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024 * 10 }, // 10 MB limit
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          return callback(new BadRequestException('Only image files (JPG, PNG, GIF, WEBP) are allowed!'), false);
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
    // ElasticsearchModule.registerAsync({
    //   imports: [ConfigModule],
    //   useFactory: async (configService: ConfigService) => ({
    //     node: configService.getOrThrow('ELASTICSEARCH_NODE_URL'),
    //     auth: {
    //       apiKey: configService.getOrThrow('ELASTICSEARCH_API_KEY'),
    //     },
    //     maxRetries: 3,
    //     requestTimeout: 60000,
    //   }),
    //   inject: [ConfigService],
    // }),
    AttributeTypesModule,
    BrandsModule,
    BannersModule,
    CartModule,
    OrdersModule,
    OrdersModule,
    SearchModule,
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
