import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchService } from 'src/search/search.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateBaseProductDto } from './dto/create-base-product.dto';
import { CreateProductAttributesDto } from './dto/create-product-attributes.dto';
import { CreateProductCategoriesDto } from './dto/create-product-categories.dto';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { CreateProductItemsDto } from './dto/create-product-items.dto';
import { CreateProductTagsDto } from './dto/create-product-tags.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { ProductCreatedEvent, ProductCreatedPayload, ProductDeletedEvent, ProductUpdatedEvent } from './events/product';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly searchService: SearchService,
  ) {}

  // --- Helper: Get Product Payload for Events ---
  private async _getProductPayloadForEvent(productId: string): Promise<ProductCreatedPayload | null> {
    this.logger.verbose(`Fetching product payload for event, ID: ${productId}`);
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        // Use the exact include structure matching ProductCreatedPayload
        include: {
          brand: { select: { id: true, name: true } },
          categories: { select: { category: { select: { id: true, name: true } } } },
          tags: { select: { tag: { select: { id: true, name: true } } } },
          attributes: { select: { value: true } },
          items: { select: { sku: true } },
          images: { where: { isPrimary: true }, take: 1, select: { image: { select: { url: true } } } },
        },
      });

      if (!product) {
        this.logger.warn(`Product payload for event not found, ID: ${productId}`);
        return null;
      }
      // Type assertion is likely needed here due to Prisma/TS type inference nuances
      return product as ProductCreatedPayload;
    } catch (error) {
      this.logger.error(`Failed to fetch product payload for event (ID: ${productId}): ${error.message}`);
      return null;
    }
  }

  private isValidMongoId(id: string): boolean {
    const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
    return mongoIdRegex.test(id);
  }

  // --- Helper: Generate and Check Slug ---
  // private async _generateUniqueSlug(
  //   name: string,
  //   retryCount = 0,
  // ): Promise<string> {
  //   const baseSlug = slugify(name, { lower: true, strict: true });
  //   const potentialSlug =
  //     retryCount > 0 ? `${baseSlug}-${retryCount}` : baseSlug;

  //   const existing = await this.prisma.product.findUnique({
  //     where: { slug: potentialSlug },
  //     select: { id: true }, // Only need to know if it exists
  //   });

  //   if (existing) {
  //     // If slug exists, try again with an incremented counter
  //     if (retryCount > 5) {
  //       // Safety break to prevent infinite loops
  //       throw new InternalServerErrorException(
  //         `Could not generate unique slug for "${name}" after several attempts.`,
  //       );
  //     }
  //     return this._generateUniqueSlug(name, retryCount + 1);
  //   }

  //   return potentialSlug;
  // }

  // --- Helper: Validate relation IDs ---
  private async _validateRelationIds(ids: string[] | undefined, model: 'category' | 'tag' | 'brand'): Promise<void> {
    if (!ids || ids.length === 0) return;

    let count: number;
    switch (model) {
      case 'category':
        count = await this.prisma.category.count({
          where: { id: { in: ids } },
        });
        break;
      case 'tag':
        count = await this.prisma.tag.count({
          where: { id: { in: ids } },
        });
        break;
      case 'brand':
        count = await this.prisma.brand.count({
          where: { id: { in: ids } },
        });
        break;
    }

    if (count !== ids.length) {
      throw new BadRequestException(`One or more provided ${model} IDs are invalid.`);
    }
  }

  private async _validateMediaIds(mediaIds: string[] | undefined, context: string): Promise<void> {
    if (!mediaIds || mediaIds.length === 0) return;
    const count = await this.prisma.media.count({
      where: { id: { in: mediaIds } },
    });
    if (count !== mediaIds.length) {
      throw new BadRequestException(`One or more invalid media IDs provided for ${context}.`);
    }
  }

  async findAll(query: FindProductsDto): Promise<{ data: Product[]; count: number }> {
    const { search } = query;

    // If a search term is provided, use Elasticsearch
    if (search && search.trim().length > 0) {
      this.logger.verbose(`Performing Elasticsearch search for: "${search}"`);
      // const { ids, count } = await this.searchService.searchProducts(query);
      const result = await this.searchService.searchProducts(query);
      return result;

      // if (ids.length === 0) {
      //   return { data: [], count: 0 }; // No results from search
      // }

      // // Hydrate results: Fetch full product data from DB based on IDs from ES
      // try {
      //   const products = await this.prisma.product.findMany({
      //     where: { id: { in: ids } },
      //     // Apply includes needed for list display (match what ES result implies or what FE needs)
      //     include: {
      //       brand: { select: { id: true, name: true } },
      //       images: {
      //         where: { isPrimary: true },
      //         take: 1,
      //         select: { image: { select: { id: true, url: true, altText: true } } },
      //       },
      //       categories: { take: 1, select: { category: true } }, // Example include
      //       // Note: Order might not match ES relevance score here. Re-ordering based on 'ids' array is needed if relevance order is critical.
      //     },
      //   });

      //   // Optional: Re-order DB results to match ES relevance order
      //   const orderedProducts = ids
      //     .map((id) => products.find((p) => p.id === id))
      //     .filter((p) => p !== undefined) as Product[];

      //   return { count: count, data: orderedProducts}; // Return hydrated, ordered data and ES total count
      // } catch (dbError) {
      //   this.logger.error(`Failed to hydrate products from DB after ES search: ${dbError.message}`, dbError.stack);
      //   throw new InternalServerErrorException('Could not retrieve product details after search.');
      // }
    } else {
      // If no search term, use the original Prisma database query
      this.logger.verbose(`Performing database query for product list`);
      return this.dbFindAll(query);
    }
  }

  async dbFindAll(findProductsDto: FindProductsDto) {
    const { page, limit, skip, search, categoryId, brandId, tags, minPrice, maxPrice, isFeatured, isActive, sortBy } =
      findProductsDto;

    // Build filter conditions
    const where: Prisma.ProductWhereInput = {};

    // Handle text search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by category
    if (categoryId) {
      where.categories = { some: { categoryId } };
    }

    // Filter by brand
    if (brandId) {
      where.brandId = brandId;
    }

    // Filter by tags
    if (tags?.length) {
      where.tags = {
        some: {
          tagId: {
            in: tags,
          },
        },
      };
    }

    // Filter by price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.salePrice = {};

      if (minPrice !== undefined) where.salePrice.gte = minPrice;

      if (maxPrice !== undefined) where.salePrice.lte = maxPrice;
    }

    // Filter by featured/active status
    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Build sorting
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };

    if (sortBy) {
      const [field, direction] = sortBy.split('_');
      orderBy = { [field]: direction as 'asc' | 'desc' };
    }

    try {
      const [totalCount, products] = await this.prisma.$transaction([
        // Get total count for pagination
        this.prisma.product.count({ where }),

        // Get products with relations
        this.prisma.product.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            brand: { select: { id: true, name: true } },
            images: {
              where: { isPrimary: true },
              take: 1,
              select: {
                image: { select: { id: true, url: true, altText: true } },
              },
            },
            categories: {
              take: 1,
              select: { category: { select: { id: true, name: true } } },
            },
          },
        }),
      ]);

      return {
        count: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        data: products,
      };
    } catch (error) {
      this.logger.error(`Error finding products: ${error}`);
      throw new InternalServerErrorException('Could not find products.');
    }
  }

  async findOne(idOrSlug: string) {
    // Determine if the provided value is an ID or a slug
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);

    const where = isMongoId ? { id: idOrSlug } : {};

    const product = await this.prisma.product.findUnique({
      where: {
        id: idOrSlug,
        isActive: true,
      },
      include: {
        brand: true,
        categories: { select: { category: true } },
        tags: { select: { tag: true } },
        attributes: { select: { id: true, value: true, attributeType: true } },
        images: { select: { id: true, isPrimary: true, image: true } },
        items: {
          where: { isActive: true },
          include: {
            attributes: {
              select: {
                id: true,
                productAttribute: {
                  select: { id: true, value: true, attributeType: true },
                },
              },
            },
            images: { select: { id: true, isPrimary: true, image: true } },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id/slug ${idOrSlug} not found`);
    }

    return product;
  }

  async removeProduct(id: string) {
    this.logger.log(`Attempting to remove product with ID: ${id}`);

    try {
      const deletedProduct = await this.prisma.product.delete({ where: { id } });

      // Emit event on successful deletion
      this.eventEmitter.emit('product.deleted', new ProductDeletedEvent(id));
      this.logger.log(`Emitted product.deleted event for ID: ${id}`);

      this.logger.log(`Successfully removed product "${deletedProduct.name}" (ID: ${id})`);
      return {
        message: `Product "${deletedProduct.name}" successfully deleted.`,
      };
    } catch (error) {
      this.logger.error(`Failed to delete product ${id}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Product with ID "${id}" not found.`);
      }
      throw new InternalServerErrorException('Could not delete product due to an unexpected error.');
    }
  }

  async getProductReviews(productId: string) {
    this.logger.log(`Fetching reviews for product ID: ${productId}`);

    // 1. Validate product exists
    const productExists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!productExists) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    try {
      // 2. Get reviews linked via OrderItems associated with the product's items
      // This avoids fetching all item IDs first if the relation allows direct traversal
      const reviews = await this.prisma.userReview.findMany({
        where: {
          orderItem: {
            productItem: {
              productId: productId, // Filter directly on the product ID
            },
          },
          // Add other review filters if needed (e.g., rating > x)
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true, // Consider if needed, maybe just username/avatar
              lastName: true, // Consider if needed
              avatar: { select: { url: true } }, // Select only URL if avatar is a relation
            },
          },
          orderItem: {
            select: {
              id: true,
              // Include minimal item details if needed, e.g., for context
              productItem: {
                select: {
                  id: true,
                  sku: true,
                  // Maybe include attributes relevant to the review context?
                  // attributes: { select: { productAttribute: { select: { value: true, attributeType: { select: { name: true }}}}} }
                },
              },
            },
          },
        },
        orderBy: {
          reviewDate: 'desc',
        },
        // Add pagination if necessary
        // take: 20,
        // skip: 0,
      });

      this.logger.log(`Found ${reviews.length} reviews for product ${productId}`);
      return reviews;
    } catch (error) {
      this.logger.error(`Error fetching reviews for product ${productId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not fetch product reviews.');
    }
  }

  async getProductItems(productId: string) {
    this.logger.log(`Fetching items for product ID: ${productId}`);

    // 1. Validate product exists
    const productExists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!productExists) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    try {
      // 2. Get active items with their attributes and images
      const items = await this.prisma.productItem.findMany({
        where: {
          productId: productId,
          isActive: true, // Typically fetch only active items
        },
        include: {
          // Assuming relation on ProductItemAttribute is 'productAttribute'
          attributes: {
            select: {
              id: true, // ID of the ProductItemAttribute link itself
              productAttribute: {
                // The actual ProductAttribute relation
                select: {
                  id: true, // ID of the ProductAttribute
                  value: true,
                  attributeType: {
                    // Include the linked AttributeType
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          images: {
            select: {
              id: true, // ID of the ProductItemImage link
              isPrimary: true,
              image: {
                // Include the linked Media object
                select: { id: true, url: true, altText: true },
              },
            },
            orderBy: { isPrimary: 'desc' }, // Optional: Ensure primary image comes first
          },
        },
        // Add orderBy for items if needed, e.g., by creation date or SKU
        // orderBy: { createdAt: 'asc' }
      });

      this.logger.log(`Found ${items.length} items for product ${productId}`);
      return items;
    } catch (error) {
      this.logger.error(`Error fetching items for product ${productId}: ${error.message}`, error.stack);
      // No specific Prisma errors expected here usually, unless DB issue
      throw new InternalServerErrorException('Could not fetch product items.');
    }
  }

  async getProductItem(id: string) {
    const item = await this.prisma.productItem.findUnique({
      where: { id },
      include: {
        product: true,
        attributes: {
          include: {
            productAttribute: {
              include: {
                attributeType: true,
              },
            },
          },
        },
        images: {
          include: {
            image: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Product item with id ${id} not found`);
    }

    return item;
  }

  async removeProductItem(id: string) {
    // Check if item exists
    const item = await this.prisma.productItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Product item with id ${id} not found`);
    }

    // Check if this is the only item for the product
    const itemCount = await this.prisma.productItem.count({
      where: { productId: item.productId },
    });

    if (itemCount <= 1) {
      throw new NotFoundException('Cannot delete the only item of a product. Delete the product instead.');
    }

    // Check if the item is referenced by any orders
    const orderItemCount = await this.prisma.orderItem.count({
      where: { productItemId: id },
    });

    if (orderItemCount > 0) {
      // If referenced by orders, just mark as inactive instead of deleting
      await this.prisma.productItem.update({
        where: { id },
        data: { isActive: false },
      });
      return null;
    }

    // If not referenced by orders, delete the item
    await this.prisma.productItem.delete({
      where: { id },
    });

    return null;
  }

  async updateProductCategories(productId: string, categoryIds: string[]) {
    this.logger.log(`Attempting to update categories for product ID: ${productId}`);

    // 1. Validate Product
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    // 2. Validate provided Category IDs
    if (categoryIds.length > 0) {
      await this._validateRelationIds(categoryIds, 'category');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 3. Get Current Category Links
        const currentLinks = await tx.productCategory.findMany({
          where: { productId: productId },
          select: { categoryId: true },
        });
        const currentCategoryIds = new Set(currentLinks.map((link) => link.categoryId));
        const incomingCategoryIds = new Set(categoryIds);

        // 4. Calculate Difference
        const idsToAdd = categoryIds.filter((id) => !currentCategoryIds.has(id));
        const idsToRemove = Array.from(currentCategoryIds).filter((id) => !incomingCategoryIds.has(id));

        this.logger.verbose(`Categories to add: ${idsToAdd.length}, Categories to remove: ${idsToRemove.length}`);

        // 5. Perform Deletions
        if (idsToRemove.length > 0) {
          await tx.productCategory.deleteMany({
            where: {
              productId: productId,
              categoryId: { in: idsToRemove },
            },
          });
          this.logger.verbose(`Removed ${idsToRemove.length} category links.`);
        }

        // 5. Perform Creations
        if (idsToAdd.length > 0) {
          await tx.productCategory.createMany({
            data: idsToAdd.map((categoryId) => ({
              productId: productId,
              categoryId,
            })),
          });
          this.logger.verbose(`Added ${idsToAdd.length} category links.`);
        }
      });

      // Emit partial update event for categories
      const updatedCategories = await this.prisma.productCategory.findMany({
        where: { productId: productId },
        select: { category: { select: { id: true, name: true } } },
      });
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: productId,
        categories: updatedCategories,
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.verbose(`Emitted partial product.updated event for ID: ${productId} after category update`);

      return { message: `Successfully updated categories for product ${productId}.` };
    } catch (error) {
      this.logger.error(`Error updating categories for product ${productId}: ${error.message}`, error.stack);

      // Handle specific errors as before
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') throw new BadRequestException(`Invalid category ID found during update.`);
        if (error.code === 'P2002') throw new ConflictException('A conflict occurred while updating categories.');
        if (error.code === 'P2025')
          this.logger.warn(`Record to delete not found during category update for product ${productId}.`);
      }
      throw new InternalServerErrorException('Failed to update product categories due to an unexpected error.');
    }
  }

  async updateProductImages(productId: string, dto: CreateProductImagesDto) {
    this.logger.log(`Attempting to update images for product ID: ${productId}`);
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException(`Product with ID "${productId}" not found.`);
    const incomingImageIds = dto.images.map((img) => img.imageId);
    if (incomingImageIds.length > 0) await this._validateMediaIds(incomingImageIds, `product update ${productId}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productImage.deleteMany({ where: { productId: productId } });
        if (dto.images.length > 0) {
          let primaryImageSet = false;
          const imageData = dto.images.map((img, index) => {
            let isPrimary = false;
            if (index === 0 && !dto.images.some((i) => i.isPrimary)) isPrimary = true;
            if (img.isPrimary && !primaryImageSet) {
              isPrimary = true;
              primaryImageSet = true;
            } else if (img.isPrimary && primaryImageSet) isPrimary = false;
            else if (!img.isPrimary && index !== 0) isPrimary = false;
            return { productId: productId, imageId: img.imageId, isPrimary: isPrimary };
          });
          const primaryIndex = imageData.findIndex((img) => img.isPrimary);
          imageData.forEach((img, index) => {
            img.isPrimary = index === primaryIndex;
          });
          if (primaryIndex === -1 && imageData.length > 0) imageData[0].isPrimary = true;
          await tx.productImage.createMany({ data: imageData });
        }
      });

      // Emit partial update event for images (fetch primary image URL)
      const primaryImageLink = await this.prisma.productImage.findFirst({
        where: { productId: productId, isPrimary: true },
        select: { image: { select: { url: true } } },
      });
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: productId,
        // Construct the expected nested structure for the payload
        images: primaryImageLink ? [primaryImageLink] : [],
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.verbose(`Emitted partial product.updated event for ID: ${productId} after image update`);

      return { message: `Successfully updated images for product ${productId}.` };
    } catch (error) {
      this.logger.error(`Error updating images for product ${productId}: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') throw new BadRequestException(`Invalid image ID found during update.`);
        if (error.code === 'P2002') throw new ConflictException('A conflict occurred while updating images.');
        if (error.code === 'P2025')
          throw new NotFoundException(`Product with ID "${productId}" was not found during the update operation.`);
      }
      throw new InternalServerErrorException('Failed to update product images due to an unexpected error.');
    }
  }

  async updateProductTags(id: string, tagIds: string[]) {
    this.logger.log(`Attempting to update tags for product ID: ${id}`);
    const product = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw new NotFoundException(`Product with id ${id} not found`);
    if (tagIds.length > 0) await this._validateRelationIds(tagIds, 'tag');

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productTag.deleteMany({ where: { productId: id } });
        if (tagIds.length > 0) {
          await tx.productTag.createMany({ data: tagIds.map((tagId) => ({ productId: id, tagId })) });
        }
      });

      // Emit partial update event for tags
      const updatedTags = await this.prisma.productTag.findMany({
        where: { productId: id },
        select: { tag: { select: { id: true, name: true } } },
      });
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: id,
        tags: updatedTags,
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.verbose(`Emitted partial product.updated event for ID: ${id} after tag update`);

      return { message: `Successfully updated tags for product ${id}.` };
    } catch (error) {
      this.logger.error(`Error updating tags for product ${id}: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') throw new BadRequestException(`Invalid tag ID found during update.`);
        if (error.code === 'P2002') throw new ConflictException('A conflict occurred while updating tags.');
        if (error.code === 'P2025') throw new NotFoundException(`Product or Tag not found during update.`);
      }
      throw new InternalServerErrorException('Failed to update product tags due to an unexpected error.');
    }
  }

  async setFeaturedStatus(id: string, isFeatured: boolean) {
    this.logger.log(`Setting featured status to ${isFeatured} for product ID: ${id}`);
    try {
      const updatedProductData = await this.prisma.product.update({
        where: { id },
        data: { isFeatured },
        select: { id: true },
      });

      // Emit partial update event for isFeatured
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: id,
        isFeatured: isFeatured,
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.log(`Emitted partial product.updated event for ID: ${id} after featured status update`);

      this.logger.log(`Successfully updated featured status for product ${id}`);
      return {
        message: `Successfully set featured status to ${isFeatured} for product ${id}.`,
        data: { id: updatedProductData.id, isFeatured },
      };
    } catch (error) {
      this.logger.error(`Failed to set featured status for product ${id}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Product with ID "${id}" not found.`);
      }
      throw new InternalServerErrorException('Could not update featured status.');
    }
  }

  async setActiveStatus(id: string, isActive: boolean) {
    this.logger.log(`Setting active status to ${isActive} for product ID: ${id}`);
    try {
      await this.prisma.product.update({
        where: { id },
        data: { isActive },
        select: { id: true },
      });

      // Emit partial update event for isActive
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: id,
        isActive: isActive,
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.log(`Emitted partial product.updated event for ID: ${id} after active status update`);

      this.logger.log(`Successfully updated active status for product ${id}`);
      return { message: `Successfully updated active status for product ${id}.` };
    } catch (error) {
      this.logger.error(`Failed to set active status for product ${id}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Product with ID "${id}" not found.`);
      }
      throw new InternalServerErrorException('Could not update active status.');
    }
  }

  async createBaseProduct(createProductDto: CreateBaseProductDto) {
    const { brandId, name, attributes, ...productData } = createProductDto;
    this.logger.log(`Attempting to create base product: ${name}`);

    // 1. --- Pre-validation ---
    await this._validateRelationIds([brandId], 'brand');

    // Validate Attribute Types if provided
    if (attributes && attributes.length > 0) {
      const attributeTypeIds = attributes.map((attr) => attr.attributeTypeId);
      const count = await this.prisma.attributeType.count({ where: { id: { in: attributeTypeIds } } });
      if (count !== attributeTypeIds.length)
        throw new BadRequestException('One or more provided attribute type IDs are invalid.');

      // Optional: Slug generation can be added here if needed
      // const slug = await this._generateUniqueSlug(name);
    }

    try {
      // 2. --- Create within Transaction ---
      const product = await this.prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
          data: {
            name,
            brand: { connect: { id: brandId } },
            ...productData,
            // Create attributes directly if provided
            ...(attributes && attributes.length > 0
              ? {
                  attributes: {
                    create: attributes.flatMap((attr) =>
                      attr.value.map((val) => ({ attributeTypeId: attr.attributeTypeId, value: val })),
                    ),
                  },
                }
              : {}),
          },
          // Select desired fields for the response
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            brand: { select: { id: true, name: true } },
            attributes: {
              select: {
                id: true,
                value: true,
                attributeType: { select: { id: true, name: true } },
              },
            },
          },
        });
        return createdProduct;
      });

      this.logger.log(`Successfully created base product ID: ${product.id}`);

      // Emit FULL event for product creation (Search service needs the full doc)
      const fullProductPayload = await this._getProductPayloadForEvent(product.id);
      if (fullProductPayload) {
        this.eventEmitter.emit('product.created', new ProductCreatedEvent(fullProductPayload));
        this.logger.log(`Emitted product.created event for ID: ${product.id}`);
      }

      return product;
    } catch (error) {
      this.logger.error(`Error creating base product "${name}": ${error.message}`, error.stack);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      )
        throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException(`A product with this name/slug already exists.`);
        if (error.code === 'P2003') throw new BadRequestException(`Invalid ID provided for related entity.`);
        if (error.code === 'P2025') throw new NotFoundException(`A required related record was not found.`);
      }
      throw new InternalServerErrorException('Failed to create base product due to an unexpected error.');
    }
  }

  async addCategories(productId: string, dto: CreateProductCategoriesDto) {
    this.logger.log(`Attempting to add categories to product ID: ${productId}`);

    // 1. Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true }, // Only need to know if it exists
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    // 2. Validate all category IDs exist
    if (dto.categoryIds.length > 0) {
      await this._validateRelationIds(dto.categoryIds, 'category');
    } else {
      // Nothing to add
      return { message: 'No category IDs provided to add.' };
    }

    try {
      const createResult = await this.prisma.productCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({ productId, categoryId })),
      });

      // Emit partial update event for added categories
      const updatedCategories = await this.prisma.productCategory.findMany({
        where: { productId: productId },
        select: { category: { select: { id: true, name: true } } },
      });
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: productId,
        categories: updatedCategories,
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.verbose(`Emitted partial product.updated event for ID: ${productId} after adding categories`);

      this.logger.log(`Successfully added ${createResult.count} new categories to product ID: ${productId}`);
      return { message: `Added ${createResult.count} new categories successfully.` };
    } catch (error) {
      this.logger.error(`Error adding categories to product ${productId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('An unexpected conflict occurred while adding categories.');
        if (error.code === 'P2003') throw new BadRequestException(`Invalid category ID found during creation.`);
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to add categories to product.');
    }
  }

  async addTags(productId: string, dto: CreateProductTagsDto) {
    this.logger.log(`Attempting to add tags to product ID: ${productId}`);
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException(`Product with id ${productId} not found`);

    try {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          tags: {
            deleteMany: {},
            create: dto.tagNames.map((tagName) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName.toLowerCase() },
                  create: { name: tagName.toLowerCase() },
                },
              },
            })),
          },
        },
      });

      // Emit partial update event for added tags
      const updatedTags = await this.prisma.productTag.findMany({
        where: { productId: productId },
        select: { tag: { select: { id: true, name: true } } },
      });
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: productId,
        tags: updatedTags,
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.verbose(`Emitted partial product.updated event for ID: ${productId} after adding tags`);

      return { message: 'Tags updated successfully' };
    } catch (error) {
      this.logger.error(`Error adding tags to product ${productId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('A conflict occurred while connecting tags.');
        if (error.code === 'P2025') throw new NotFoundException(`Product or Tag not found during update.`);
      }
      throw new InternalServerErrorException('Failed to update product tags.');
    }
  }

  async addImages(productId: string, dto: CreateProductImagesDto) {
    this.logger.log(`Attempting to add images to product ID: ${productId}`);
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException(`Product with ID "${productId}" not found.`);
    if (dto.images.length > 0) {
      const imageIds = dto.images.map((img) => img.imageId);
      await this._validateMediaIds(imageIds, `product ${productId}`);
    } else return { message: 'No images provided to add.' };

    try {
      let primaryImageSet = false;
      const imageData = dto.images.map((img, index) => {
        let isPrimary = false;
        if (index === 0 && !dto.images.some((i) => i.isPrimary)) isPrimary = true;
        if (img.isPrimary && !primaryImageSet) {
          isPrimary = true;
          primaryImageSet = true;
        } else if (img.isPrimary && primaryImageSet) isPrimary = false;
        else if (!img.isPrimary && index !== 0) isPrimary = false;
        return { productId, imageId: img.imageId, isPrimary };
      });
      const primaryIndex = imageData.findIndex((img) => img.isPrimary);
      imageData.forEach((img, index) => {
        img.isPrimary = index === primaryIndex;
      });
      if (primaryIndex === -1 && imageData.length > 0) imageData[0].isPrimary = true;

      const createResult = await this.prisma.productImage.createMany({
        data: imageData,
      });

      // Emit partial update event for added images (fetch primary image URL)
      const primaryImageLink = await this.prisma.productImage.findFirst({
        where: { productId: productId, isPrimary: true },
        select: { image: { select: { url: true } } },
      });
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: productId,
        images: primaryImageLink ? [primaryImageLink] : [],
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.verbose(`Emitted partial product.updated event for ID: ${productId} after adding images`);

      this.logger.log(`Successfully added ${createResult.count} new images to product ID: ${productId}`);
      return { message: `Added ${createResult.count} new images successfully.` };
    } catch (error) {
      this.logger.error(`Error adding images to product ${productId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('An unexpected conflict occurred while adding images.');
        if (error.code === 'P2003')
          throw new BadRequestException(
            `Invalid image ID found during creation. Please ensure the image ID is valid and belongs to a media record.`,
          );
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to add images to product.');
    }
  }

  async addAttributes(productId: string, dto: CreateProductAttributesDto) {
    this.logger.log(`Attempting to add attributes to product ID: ${productId}`);
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException(`Product with id ${productId} not found`);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productAttribute.deleteMany({ where: { productId } });
        if (dto.attributes.length > 0) {
          const createData = dto.attributes.flatMap((attr) =>
            attr.values.map((value) => ({
              productId,
              attributeTypeId: attr.attributeTypeId,
              value,
            })),
          );
          await tx.productAttribute.createMany({ data: createData });
        }
      });

      // Emit partial update event for added attributes (construct from DTO)
      // Note: This assumes dto.attributes contains the full desired state.
      const attributesPayload = dto.attributes.flatMap(
        (attr) => attr.values.map((value) => ({ value })), // Map to the structure expected by ProductCreatedPayload
      );
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: productId,
        attributes: attributesPayload,
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.verbose(`Emitted partial product.updated event for ID: ${productId} after adding attributes`);

      return { message: 'Attributes updated successfully' };
    } catch (error) {
      this.logger.error(`Error adding attributes to product ${productId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') throw new BadRequestException(`Invalid attribute type ID found during creation.`);
        if (error.code === 'P2002') throw new ConflictException('Unique constraint violation while adding attributes.');
      }
      throw new InternalServerErrorException('Failed to update product attributes.');
    }
  }

  async addItems(productId: string, dto: CreateProductItemsDto) {
    this.logger.log(`Attempting to add items to product ID: ${productId}`);

    if (!dto.items || dto.items.length === 0) {
      return { message: 'No items provided to add.' };
    }

    // Aggregate all unique IDs for upfront validation
    const allAttributeIds = [...new Set(dto.items.flatMap((item) => item.attributes ?? []))];
    const allImageIds = [...new Set(dto.items.flatMap((item) => item.images?.map((img) => img.imageId) ?? []))];

    try {
      const createdItemsResult = await this.prisma.$transaction(
        async (tx) => {
          // 1. Validate Product Exists
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { id: true, skuPrefix: true },
          });
          if (!product) {
            // Throw error that will be caught by the outer catch block
            throw new NotFoundException(`Product with id ${productId} not found`);
          }

          // 2. Validate Attribute IDs belong to this Product
          if (allAttributeIds.length > 0) {
            const validAttributes = await tx.productAttribute.findMany({
              where: {
                productId: productId,
                id: { in: allAttributeIds },
              },
              select: { id: true },
            });
            const validAttributeIds = new Set(validAttributes.map((attr) => attr.id));
            const invalidIds = allAttributeIds.filter((id) => !validAttributeIds.has(id));
            if (invalidIds.length > 0) {
              throw new BadRequestException(
                `Invalid ProductAttribute IDs provided for Product ${productId}: ${invalidIds.join(', ')}`,
              );
            }
          }

          // 3. Validate Image IDs exist (using helper outside transaction context is fine here)
          if (allImageIds.length > 0) {
            await this._validateMediaIds(allImageIds, `items for product ${productId}`);
          }

          // 4. Process and Create Items
          const createdItems = [];
          for (const itemDto of dto.items) {
            const { attributes, images, ...itemCoreData } = itemDto;
            const sku = itemDto.sku ?? `${product.skuPrefix ?? 'SKU'}-${uuidv4().substring(0, 8).toUpperCase()}`;
            const newItem = await tx.productItem.create({
              data: { ...itemCoreData, sku, productId },
              select: { id: true, sku: true },
            });
            this.logger.verbose(`Created new item ${newItem.id} with SKU: ${newItem.sku}`);
            createdItems.push(newItem);

            // -- Link Attributes --
            if (attributes && attributes.length > 0) {
              this.logger.verbose(`Linking ${attributes.length} attributes to item ${newItem.id}`);
              const itemAttrData = attributes.map((productAttributeId) => ({
                productItemId: newItem.id,
                productAttributeId: productAttributeId,
              }));
              await tx.productItemAttribute.createMany({ data: itemAttrData });
            }

            // --- Link Images ---
            if (images && images.length > 0) {
              this.logger.verbose(`Linking ${images.length} images to item ${newItem.id}`);
              // Prepare image data with primary logic per item
              let itemPrimaryImageSet = false;
              const itemImageData = images.map((img, index) => {
                let isPrimary = false;
                if (index === 0 && !images.some((i) => i.isPrimary)) isPrimary = true;
                if (img.isPrimary && !itemPrimaryImageSet) {
                  isPrimary = true;
                  itemPrimaryImageSet = true;
                } else if (img.isPrimary && itemPrimaryImageSet) isPrimary = false;
                else if (!img.isPrimary && index !== 0) isPrimary = false;
                return { productItemId: newItem.id, imageId: img.imageId, isPrimary };
              });
              const primaryIndex = itemImageData.findIndex((img) => img.isPrimary);
              itemImageData.forEach((img, index) => {
                img.isPrimary = index === primaryIndex;
              });
              if (primaryIndex === -1 && itemImageData.length > 0) itemImageData[0].isPrimary = true;
              await tx.productItemImage.createMany({ data: itemImageData });
            }
          }
          return createdItems;
        },
        { timeout: 30000 },
      );

      this.logger.log(`Successfully created ${createdItemsResult.length} items for product ${productId}`);

      // Emit partial update event for added items (fetch SKUs)
      const updatedItems = await this.prisma.productItem.findMany({
        where: { productId: productId },
        select: { sku: true },
      });
      const partialPayload: Partial<ProductCreatedPayload> = {
        id: productId,
        items: updatedItems, // Structure matches ProductCreatedPayload {items: {sku: string}[]}
      };
      this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(partialPayload));
      this.logger.verbose(`Emitted partial product.updated event for ID: ${productId} after adding items`);

      return {
        message: `Successfully created ${createdItemsResult.length} product items.`,
        data: createdItemsResult,
      };
    } catch (error) {
      this.logger.error(`Failed to add items to product ${productId}: ${error.message}`, error.stack);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      )
        throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException(`Unique constraint failed (SKU?).`);
        if (error.code === 'P2003') throw new BadRequestException(`Failed to link related entity (Attribute/Image?).`);
        if (error.code === 'P2025') throw new NotFoundException(`A related record was not found.`);
      }
      throw new InternalServerErrorException('Failed to create product items due to an unexpected error.');
    }
  }
}
