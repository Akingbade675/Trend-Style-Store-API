import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MediaFolder } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Role } from 'src/common/enums/roles-enum';
import { RolesGuard } from 'src/common/guards/role.guard';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaService } from './media.service';

@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async create(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() createMediaDto: CreateMediaDto,
  ) {
    const { altText, folder } = createMediaDto;
    return await this.mediaService.createMultiple(files, folder, altText);
  }

  @Get()
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('folder', new ParseEnumPipe(MediaFolder)) folder: MediaFolder,
  ) {
    return this.mediaService.findAll(paginationDto, folder);
  }

  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateMediaDto: UpdateMediaDto,
  ) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.mediaService.remove(id);
  }
}
