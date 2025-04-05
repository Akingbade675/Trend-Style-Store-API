import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';

@Public(false)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createAddressDto: CreateAddressDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.addressesService.create(userId, createAddressDto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.addressesService.findAll(userId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseMongoIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.addressesService.findOne(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateAddressDto: UpdateAddressDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.addressesService.update(id, userId, updateAddressDto);
  }

  @Patch(':id/set-default')
  setDefault(
    @Param('id', ParseMongoIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.addressesService.setDefault(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseMongoIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    // Check if the address belongs to the user
    return this.addressesService.remove(id, userId);
  }
}
