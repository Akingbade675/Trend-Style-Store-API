// src/attribute-types/attribute-types.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/roles-enum';
import { RolesGuard } from 'src/common/guards/role.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { AttributeTypesService } from './attribute-types.service';
import { CreateAttributeTypeDto } from './dto/create-attribute-type.dto';
import { UpdateAttributeTypeDto } from './dto/update-attribute-type.dto';

@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('attribute-types')
export class AttributeTypesController {
  constructor(private readonly attributeTypesService: AttributeTypesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createAttributeTypeDto: CreateAttributeTypeDto) {
    return this.attributeTypesService.create(createAttributeTypeDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.attributeTypesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.attributeTypesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() updateAttributeTypeDto: UpdateAttributeTypeDto) {
    return this.attributeTypesService.update(id, updateAttributeTypeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK) // Or HttpStatus.NO_CONTENT (204)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.attributeTypesService.remove(id);
  }
}
