// src/banners/banners.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/roles-enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { FindBannersDto } from './dto/find-banners.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Roles(Role.ADMIN)
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  // --- Public Endpoint ---
  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Get()
  findAll(@Query() findBannersDto: FindBannersDto) {
    return this.bannersService.findAll(findBannersDto);
  }

  // --- Admin Endpoints ---
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createBannerDto: CreateBannerDto) {
    return this.bannersService.create(createBannerDto);
  }

  // Get specific banner - Admin only?

  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.bannersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() updateBannerDto: UpdateBannerDto) {
    return this.bannersService.update(id, updateBannerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.bannersService.remove(id);
  }
}
