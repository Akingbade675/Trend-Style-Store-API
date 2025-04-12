import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateBaseProductDto } from './dto/create-base-product.dto';
import { CreateProductCategoriesDto } from './dto/create-product-categories.dto';
import { CreateProductTagsDto } from './dto/create-product-tags.dto';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { CreateProductAttributesDto } from './dto/create-product-attributes.dto';
import { CreateProductItemsDto } from './dto/create-product-items.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
import { RolesGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/roles-enum';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // --- Public Read Endpoints ---

  @Get()
  async findAll(@Query() findProductsDto: FindProductsDto) {
    return this.productsService.findAll(findProductsDto);
  }

  @Get(':idOrSlug') // Can accept ID or slug
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.productsService.findOne(idOrSlug);
  }

  @Get(':id/reviews')
  getProductReviews(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.getProductReviews(id);
  }

  // --- Admin Endpoints ---

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  createBaseProduct(@Body() createProductDto: CreateBaseProductDto) {
    return this.productsService.createBaseProduct(createProductDto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/categories')
  addCategories(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: CreateProductCategoriesDto,
  ) {
    return this.productsService.addCategories(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/tags')
  addTags(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: CreateProductTagsDto,
  ) {
    return this.productsService.addTags(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/images')
  addImages(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: CreateProductImagesDto,
  ) {
    return this.productsService.addImages(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/attributes')
  addAttributes(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: CreateProductAttributesDto,
  ) {
    return this.productsService.addAttributes(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/items')
  addItems(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: CreateProductItemsDto,
  ) {
    return this.productsService.addItems(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.remove(id);
  }

  // --- Product Item Endpoints ---

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id/items')
  getProductItems(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.getProductItems(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('items/:id')
  getProductItem(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.getProductItem(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProductItem(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.removeProductItem(id);
  }

  // --- Product Category Endpoints ---

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/categories')
  updateProductCategories(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() categoryIds: string[],
  ) {
    return this.productsService.updateProductCategories(id, categoryIds);
  }

  // --- Product Tag Endpoints ---

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/tags')
  updateProductTags(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() tagIds: string[],
  ) {
    return this.productsService.updateProductTags(id, tagIds);
  }

  // --- Featured/Active Status Endpoints ---

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/featured')
  setFeaturedStatus(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    return this.productsService.setFeaturedStatus(id, isFeatured);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/active')
  setActiveStatus(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.productsService.setActiveStatus(id, isActive);
  }
}
