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
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
import { CreateBaseProductDto } from './dto/create-base-product.dto';
import { CreateProductAttributesDto } from './dto/create-product-attributes.dto';
import { CreateProductCategoriesDto } from './dto/create-product-categories.dto';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { CreateProductItemsDto } from './dto/create-product-items.dto';
import { CreateProductTagsDto } from './dto/create-product-tags.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { ProductsService } from './products.service';

@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // --- Public Read Endpoints ---

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Get()
  async findAll(@Query() findProductsDto: FindProductsDto) {
    return this.productsService.findAll(findProductsDto);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Get(':idOrSlug') // Can accept ID or slug
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.productsService.findOne(idOrSlug);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Get(':id/reviews')
  getProductReviews(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.getProductReviews(id);
  }

  // --- Admin Endpoints ---

  @Post()
  createBaseProduct(@Body() createProductDto: CreateBaseProductDto) {
    return this.productsService.createBaseProduct(createProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.removeProduct(id);
  }

  @Post(':id/attributes')
  addAttributes(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: CreateProductAttributesDto) {
    return this.productsService.addAttributes(id, dto);
  }

  // --- Product Item Endpoints ---

  @Post(':id/items')
  addItems(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: CreateProductItemsDto) {
    return this.productsService.addItems(id, dto);
  }

  @Get(':id/items')
  getProductItems(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.getProductItems(id);
  }

  @Get('items/:id')
  getProductItem(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.getProductItem(id);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProductItem(@Param('id', ParseMongoIdPipe) id: string) {
    return this.productsService.removeProductItem(id);
  }

  // --- Product Category Endpoints ---

  @Post(':id/categories')
  addCategories(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: CreateProductCategoriesDto) {
    return this.productsService.addCategories(id, dto);
  }

  @Patch(':id/categories')
  updateProductCategories(@Param('id', ParseMongoIdPipe) id: string, @Body() categoryIds: string[]) {
    return this.productsService.updateProductCategories(id, categoryIds);
  }

  // --- Product Image Endpoints ---

  @Post(':id/images')
  addImages(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: CreateProductImagesDto) {
    return this.productsService.addImages(id, dto);
  }

  @Patch(':id/images')
  updateProductImages(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: CreateProductImagesDto) {
    return this.productsService.updateProductImages(id, dto);
  }

  // --- Product Tag Endpoints ---

  @Post(':id/tags')
  addTags(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: CreateProductTagsDto) {
    return this.productsService.addTags(id, dto);
  }

  @Patch(':id/tags')
  updateProductTags(@Param('id', ParseMongoIdPipe) id: string, @Body() tagIds: string[]) {
    return this.productsService.updateProductTags(id, tagIds);
  }

  // --- Featured/Active Status Endpoints ---

  @Patch(':id/featured')
  setFeaturedStatus(@Param('id', ParseMongoIdPipe) id: string, @Body('isFeatured') isFeatured: boolean) {
    return this.productsService.setFeaturedStatus(id, isFeatured);
  }

  @Patch(':id/active')
  setActiveStatus(@Param('id', ParseMongoIdPipe) id: string, @Body('isActive') isActive: boolean) {
    return this.productsService.setActiveStatus(id, isActive);
  }
}
