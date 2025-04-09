import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Module } from 'nestjs-s3';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule, S3Module],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
