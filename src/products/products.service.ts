import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import { CreateProductItemDto } from './dto/create-product-item.dto';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { CreateBaseProductDto } from './dto/create-base-product.dto';
import { CreateProductCategoriesDto } from './dto/create-product-categories.dto';
import { CreateProductTagsDto } from './dto/create-product-tags.dto';
import { CreateProductImagesDto } from './dto/create-product-images.dto';
import { CreateProductAttributesDto } from './dto/create-product-attributes.dto';
import { CreateProductItemsDto } from './dto/create-product-items.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  private async _validateRelationIds(
    ids: string[] | undefined,
    model: 'category' | 'tag' | 'brand',
  ): Promise<void> {
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
      throw new BadRequestException(
        `One or more provided ${model} IDs are invalid.`,
      );
    }
  }

  private async _validateMediaIds(
    mediaIds: string[] | undefined,
    context: string,
  ): Promise<void> {
    if (!mediaIds || mediaIds.length === 0) return;
    const count = await this.prisma.media.count({
      where: { id: { in: mediaIds } },
    });
    if (count !== mediaIds.length) {
      throw new BadRequestException(
        `One or more invalid media IDs provided for ${context}.`,
      );
    }
  }

  async findAll(findProductsDto: FindProductsDto) {
    const {
      page,
      limit,
      skip,
      search,
      categoryId,
      brandId,
      tags,
      minPrice,
      maxPrice,
      isFeatured,
      isActive,
      sortBy,
    } = findProductsDto;

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
      // Directly attempt deletion. Prisma will throw P2025 if not found.
      const deletedProduct = await this.prisma.product.delete({
        where: { id },
        select: { name: true }, // Select name to include in success message
      });

      this.logger.log(
        `Successfully removed product "${deletedProduct.name}" (ID: ${id})`,
      );
      return {
        message: `Product "${deletedProduct.name}" successfully deleted.`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete product ${id}: ${error.message}`,
        error.stack,
      );

      // Check if the error is because the record to delete was not found
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Product with ID "${id}" not found.`);
      }

      // Handle other potential errors (e.g., database connection issues)
      throw new InternalServerErrorException(
        'Could not delete product due to an unexpected error.',
      );
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

      this.logger.log(
        `Found ${reviews.length} reviews for product ${productId}`,
      );
      return reviews;
    } catch (error) {
      this.logger.error(
        `Error fetching reviews for product ${productId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not fetch product reviews.',
      );
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
      this.logger.error(
        `Error fetching items for product ${productId}: ${error.message}`,
        error.stack,
      );
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
      throw new NotFoundException(
        'Cannot delete the only item of a product. Delete the product instead.',
      );
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
    this.logger.log(
      `Attempting to update categories for product ID: ${productId}`,
    );

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
        const currentCategoryIds = new Set(
          currentLinks.map((link) => link.categoryId),
        );
        const incomingCategoryIds = new Set(categoryIds);

        // 4. Calculate Difference
        const idsToAdd = categoryIds.filter(
          (id) => !currentCategoryIds.has(id),
        );
        const idsToRemove = Array.from(currentCategoryIds).filter(
          (id) => !incomingCategoryIds.has(id),
        );

        this.logger.verbose(
          `Categories to add: ${idsToAdd.length}, Categories to remove: ${idsToRemove.length}`,
        );

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

      // Return the updated product data after transaction commits
      // return this.findOne(productId);
      return {
        message: `Successfully updated categories for product ${productId}.`,
      };
    } catch (error) {
      this.logger.error(
        `Error updating categories for product ${productId}: ${error.message}`,
        error.stack,
      );

      // Re-throw specific validation errors
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle potential Prisma errors during transaction
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2003: Foreign key constraint failed (less likely with validation, but safeguard)
        if (error.code === 'P2003') {
          throw new BadRequestException(
            `Invalid category ID found during update.`,
          );
        }
        // P2002: Unique constraint failed (if skipDuplicates isn't used/supported)
        if (error.code === 'P2002') {
          throw new ConflictException(
            'A conflict occurred while updating categories. A link might already exist.',
          );
        }
        // P2025: Record to delete not found (could happen in race conditions)
        if (error.code === 'P2025') {
          this.logger.warn(
            `Record to delete not found during category update for product ${productId}. Might indicate a race condition.`,
          );
        }
      }

      // Generic fallback
      throw new InternalServerErrorException(
        'Failed to update product categories due to an unexpected error.',
      );
    }
  }

  async updateProductImages(productId: string, dto: CreateProductImagesDto) {
    // Reuse Create DTO if structure matches
    this.logger.log(`Attempting to update images for product ID: ${productId}`);

    // 1. Validate Product
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    // 2. Validate incoming Image IDs
    const incomingImageIds = dto.images.map((img) => img.imageId);
    if (incomingImageIds.length > 0) {
      await this._validateMediaIds(
        incomingImageIds,
        `product update ${productId}`,
      );
    } else {
      // If empty array is provided, it means delete all images
      this.logger.log(
        `Received empty image list for product ${productId}. Deleting all existing images.`,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 3. Delete all existing image links for this product
        await tx.productImage.deleteMany({
          where: { productId: productId },
        });
        this.logger.verbose(`Deleted existing images for product ${productId}`);

        // 4. Prepare and Create new image links if any provided
        if (dto.images.length > 0) {
          let primaryImageSet = false;
          const imageData = dto.images.map((img, index) => {
            let isPrimary = false;
            // Determine primary: first marked true, or index 0 if none marked true
            if (index === 0 && !dto.images.some((i) => i.isPrimary)) {
              isPrimary = true;
            }
            if (img.isPrimary && !primaryImageSet) {
              isPrimary = true;
              primaryImageSet = true;
            } else if (img.isPrimary && primaryImageSet) {
              isPrimary = false;
            } else if (!img.isPrimary && index !== 0) {
              isPrimary = false;
            } // Handled by initial false state

            return {
              productId: productId,
              imageId: img.imageId,
              isPrimary: isPrimary,
            };
          });

          // Ensure exactly one primary after mapping
          const primaryIndex = imageData.findIndex((img) => img.isPrimary);
          imageData.forEach((img, index) => {
            img.isPrimary = index === primaryIndex;
          });
          // Fallback if somehow no primary was set (e.g., empty input array edge case, though handled earlier)
          if (primaryIndex === -1 && imageData.length > 0) {
            imageData[0].isPrimary = true;
          }

          const createResult = await tx.productImage.createMany({
            data: imageData,
          });
          this.logger.verbose(
            `Created ${createResult.count} new image links for product ${productId}`,
          );
        }
      });

      return {
        message: `Successfully updated images for product ${productId}.`,
      };
    } catch (error) {
      this.logger.error(
        `Error updating images for product ${productId}: ${error.message}`,
        error.stack,
      );

      // Re-throw specific validation errors
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle potential Prisma errors during transaction
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2003: Foreign key constraint failed (invalid imageId)
        if (error.code === 'P2003') {
          throw new BadRequestException(
            `Invalid image ID found during update.`,
          );
        }
        // P2002: Unique constraint failed (productId_imageId)
        if (error.code === 'P2002') {
          throw new ConflictException(
            'A conflict occurred while updating images. A link might already exist.',
          );
        }
        // P2025: Record to delete/update not found (product disappeared?)
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `Product with ID "${productId}" was not found during the update operation.`,
          );
        }
      }

      // Generic fallback
      throw new InternalServerErrorException(
        'Failed to update product images due to an unexpected error.',
      );
    }
  }

  async updateProductTags(id: string, tagIds: string[]) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete existing tags
      await tx.productTag.deleteMany({
        where: { productId: id },
      });

      // Create new tag relationships
      if (tagIds.length > 0) {
        await tx.productTag.createMany({
          data: tagIds.map((tagId) => ({
            productId: id,
            tagId,
          })),
        });
      }

      // Return updated product
      return this.findOne(id);
    });
  }

  async setFeaturedStatus(id: string, isFeatured: boolean) {
    this.logger.log(
      `Setting featured status to ${isFeatured} for product ID: ${id}`,
    );
    try {
      // Use update operation which inherently checks for existence
      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: { isFeatured },
        select: { id: true, isFeatured: true }, // Select only necessary fields
      });

      this.logger.log(`Successfully updated featured status for product ${id}`);
      return {
        message: `Successfully set featured status to ${isFeatured} for product ${id}.`,
        data: updatedProduct, // Return the updated status
      };
    } catch (error) {
      this.logger.error(
        `Failed to set featured status for product ${id}: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025' // Record to update not found
      ) {
        throw new NotFoundException(`Product with ID "${id}" not found.`);
      }
      throw new InternalServerErrorException(
        'Could not update featured status.',
      );
    }
  }

  async setActiveStatus(id: string, isActive: boolean) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Update the active status
    await this.prisma.product.update({
      where: { id },
      data: { isActive },
    });

    return {
      message: `Successfully updated active status for product ${id}.`,
    };
  }

  async createBaseProduct(createProductDto: CreateBaseProductDto) {
    const { brandId, name, attributes, ...productData } = createProductDto;
    this.logger.log(`Attempting to create base product: ${name}`);

    // 1. --- Pre-validation ---
    await this._validateRelationIds([brandId], 'brand');

    // Validate Attribute Types if provided
    if (attributes && attributes.length > 0) {
      const attributeTypeIds = attributes.map((attr) => attr.attributeTypeId);
      const count = await this.prisma.attributeType.count({
        where: { id: { in: attributeTypeIds } },
      });
      if (count !== attributeTypeIds.length) {
        throw new BadRequestException(
          'One or more provided attribute type IDs are invalid.',
        );
      }
    }

    // Optional: Slug generation can be added here if needed
    // const slug = await this._generateUniqueSlug(name);

    try {
      // 2. --- Create within Transaction ---
      const product = await this.prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
          data: {
            name,
            // slug, // Add if generated
            brand: { connect: { id: brandId } },
            ...productData,
            // Create attributes directly if provided
            ...(attributes && attributes.length > 0
              ? {
                  attributes: {
                    create: attributes.flatMap((attr) =>
                      // Assuming 'value' in DTO is correct, adjust if needed
                      attr.value.map((val) => ({
                        attributeTypeId: attr.attributeTypeId,
                        value: val,
                      })),
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
      return product;
    } catch (error) {
      this.logger.error(
        `Error creating base product "${name}": ${error.message}`,
        error.stack,
      );

      // 3. --- Refined Error Handling ---
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error; // Re-throw validation errors
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint violation (e.g., name or slug if unique)
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[] | undefined;
          throw new ConflictException(
            `A product with this name/slug already exists.${target ? ` Failed on field(s): ${target.join(', ')}` : ''}`,
          );
        }
        // Foreign key constraint failed (invalid brandId or attributeTypeId)
        if (error.code === 'P2003') {
          const field = error.meta?.field_name as string | undefined;
          const entity = field?.includes('brand')
            ? 'brand'
            : field?.includes('attributeTypeId')
              ? 'attribute type'
              : 'related entity';
          throw new BadRequestException(
            `Invalid ID provided for ${entity}${field ? ` (field: ${field})` : ''}.`,
          );
        }
        // Related record not found (less likely with pre-validation, but possible)
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `A required related record (e.g., Brand or AttributeType) was not found: ${error.meta?.cause ?? 'Record not found'}`,
          );
        }
      }
      // Generic fallback
      throw new InternalServerErrorException(
        'Failed to create base product due to an unexpected error.',
      );
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
      // 3. Create new category relationships
      const createResult = await this.prisma.productCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({
          productId,
          categoryId,
        })),
      });

      this.logger.log(
        `Successfully added ${createResult.count} new categories to product ID: ${productId}`,
      );
      return {
        message: `Added ${createResult.count} new categories successfully.`,
      };
    } catch (error) {
      this.logger.error(
        `Error adding categories to product ${productId}: ${error.message}`,
        error.stack,
      );

      // Handle unexpected errors (P2025 should be caught by upfront validation)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 should be handled by skipDuplicates, but catch just in case
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An unexpected conflict occurred while adding categories. Some may already exist.',
          );
        }
        // P2003 Foreign key constraint failure (e.g. on categoryId if validation missed somehow)
        if (error.code === 'P2003') {
          throw new BadRequestException(
            `Invalid category ID found during creation. Please check input.`,
          );
        }
      }

      // Fallback for other errors
      throw new InternalServerErrorException(
        'Failed to add categories to product.',
      );
    }
  }

  async addTags(productId: string, dto: CreateProductTagsDto) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    try {
      // Delete existing tags
      await this.prisma.productTag.deleteMany({
        where: { productId },
      });

      // Create new tag relationships
      if (dto.tagNames.length > 0) {
        await this.prisma.product.update({
          where: { id: productId },
          data: {
            tags: {
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
      }

      return { message: 'Tags updated successfully' };
    } catch (error) {
      throw new InternalServerErrorException('Failed to update product tags.');
    }
  }

  async addImages(productId: string, dto: CreateProductImagesDto) {
    this.logger.log(`Attempting to add images to product ID: ${productId}`);

    // 1. Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true }, // Only need to know if it exists
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    }

    // 2. Validate all media IDs exist
    if (dto.images.length > 0) {
      const imageIds = dto.images.map((img) => img.imageId);
      await this._validateMediaIds(imageIds, `product ${productId}`);
    } else {
      return { message: 'No images provided to add.' };
    }

    try {
      // 3. Prepare image data with refined primary logic
      let primaryImageSet = false;
      const imageData = dto.images.map((img, index) => {
        let isPrimary = false;
        // Set first image as primary if none is explicitly marked later
        if (index === 0) {
          isPrimary = true;
        }
        // If an image is marked primary in DTO and we haven't set one yet
        if (img.isPrimary && !primaryImageSet) {
          isPrimary = true;
          primaryImageSet = true;
          // If an image is marked primary but we already set one, unset it
        } else if (img.isPrimary && primaryImageSet) {
          isPrimary = false;
          // If not marked primary in DTO, it's not primary unless it's the first one
        } else if (!img.isPrimary && index !== 0) {
          isPrimary = false;
        }

        return {
          productId,
          imageId: img.imageId,
          isPrimary,
        };
      });

      // Ensure only one primary after mapping (if multiple were marked in DTO)
      const primaryIndex = imageData.findIndex((img) => img.isPrimary);
      imageData.forEach((img, index) => {
        img.isPrimary = index === primaryIndex;
      });
      // If primaryIndex is -1 (no primary set, possible if dto.images was empty, though caught earlier)
      // ensure the first image is primary if imageData is not empty
      if (primaryIndex === -1 && imageData.length > 0) {
        imageData[0].isPrimary = true;
      }

      // 4. Create new image relationships, skipping duplicates
      const createResult = await this.prisma.productImage.createMany({
        data: imageData,
      });

      this.logger.log(
        `Successfully added ${createResult.count} new images to product ID: ${productId}`,
      );
      return {
        message: `Added ${createResult.count} new images successfully.`,
      };
    } catch (error) {
      this.logger.error(
        `Error adding images to product ${productId}: ${error.message}`,
        error.stack,
      );

      // P2025 should be caught by upfront validation
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 Unique constraint (e.g., productId_imageId if not skipped)
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An unexpected conflict occurred while adding images. Some may already exist.',
          );
        }
        // P2003 Foreign key constraint (if validation missed somehow)
        if (error.code === 'P2003') {
          throw new BadRequestException(
            `Invalid image ID found during creation. Please check input.`,
          );
        }
      }
      // Re-throw validation errors
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Fallback for other errors
      throw new InternalServerErrorException(
        'Failed to add images to product.',
      );
    }
  }

  async addAttributes(productId: string, dto: CreateProductAttributesDto) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    try {
      // Delete existing attributes
      await this.prisma.productAttribute.deleteMany({
        where: { productId },
      });

      // Create new attributes
      if (dto.attributes.length > 0) {
        for (const attr of dto.attributes) {
          for (const value of attr.values) {
            await this.prisma.productAttribute.create({
              data: {
                productId,
                attributeTypeId: attr.attributeTypeId,
                value,
              },
            });
          }
        }
      }

      return { message: 'Attributes updated successfully' };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to update product attributes.',
      );
    }
  }

  async addItems(productId: string, dto: CreateProductItemsDto) {
    this.logger.log(`Attempting to add items to product ID: ${productId}`);

    if (!dto.items || dto.items.length === 0) {
      return { message: 'No items provided to add.' };
    }

    // Aggregate all unique IDs for upfront validation
    const allAttributeIds = [
      ...new Set(dto.items.flatMap((item) => item.attributes ?? [])),
    ];
    const allImageIds = [
      ...new Set(
        dto.items.flatMap(
          (item) => item.images?.map((img) => img.imageId) ?? [],
        ),
      ),
    ];

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
            throw new NotFoundException(
              `Product with id ${productId} not found`,
            );
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
            const validAttributeIds = new Set(
              validAttributes.map((attr) => attr.id),
            );
            const invalidIds = allAttributeIds.filter(
              (id) => !validAttributeIds.has(id),
            );
            if (invalidIds.length > 0) {
              throw new BadRequestException(
                `Invalid ProductAttribute IDs provided for Product ${productId}: ${invalidIds.join(', ')}`,
              );
            }
          }

          // 3. Validate Image IDs exist (using helper outside transaction context is fine here)
          if (allImageIds.length > 0) {
            await this._validateMediaIds(
              allImageIds,
              `items for product ${productId}`,
            );
          }

          // 4. Process and Create Items
          const createdItems = [];
          for (const itemDto of dto.items) {
            const { attributes, images, ...itemData } = itemDto;

            // --- Create Product Item ---
            const sku =
              itemDto.sku ??
              `${product.skuPrefix ?? 'SKU'}-${uuidv4().substring(0, 8).toUpperCase()}`;
            this.logger.verbose(`Creating item with SKU: ${sku}`);
            const createdItem = await tx.productItem.create({
              data: {
                ...itemData,
                productId,
                sku: sku, // Use generated or provided SKU
                // Add default values if needed from product, e.g., price
                // originalPrice: itemData.originalPrice ?? product.originalPrice,
                // salePrice: itemData.salePrice ?? product.salePrice,
              },
              select: { id: true, sku: true }, // Select needed fields
            });
            this.logger.verbose(
              `Created item ID: ${createdItem.id} (SKU: ${createdItem.sku})`,
            );

            // --- Link Attributes ---
            if (attributes && attributes.length > 0) {
              this.logger.verbose(
                `Linking ${attributes.length} attributes to item ${createdItem.id}`,
              );
              const itemAttrData = attributes.map((productAttributeId) => ({
                productItemId: createdItem.id,
                productAttributeId: productAttributeId, // Use the validated ID
              }));
              await tx.productItemAttribute.createMany({ data: itemAttrData });
            }

            // --- Link Images ---
            if (images && images.length > 0) {
              this.logger.verbose(
                `Linking ${images.length} images to item ${createdItem.id}`,
              );
              // Prepare image data with primary logic per item
              let itemPrimaryImageSet = false;
              const itemImageData = images.map((img, index) => {
                let isPrimary = false;
                if (index === 0 && !images.some((i) => i.isPrimary)) {
                  isPrimary = true;
                } // Default first if none marked
                if (img.isPrimary && !itemPrimaryImageSet) {
                  isPrimary = true;
                  itemPrimaryImageSet = true;
                } else if (img.isPrimary && itemPrimaryImageSet) {
                  isPrimary = false;
                } // Unset if another primary was already found
                else if (!img.isPrimary) {
                  isPrimary = false;
                }

                return {
                  productItemId: createdItem.id,
                  imageId: img.imageId,
                  isPrimary,
                };
              });
              // Ensure only one primary after mapping
              const primaryIndex = itemImageData.findIndex(
                (img) => img.isPrimary,
              );
              itemImageData.forEach((img, index) => {
                img.isPrimary = index === primaryIndex;
              });
              if (primaryIndex === -1 && itemImageData.length > 0) {
                itemImageData[0].isPrimary = true;
              } // Fallback ensure first is primary

              await tx.productItemImage.createMany({ data: itemImageData });
            }
            createdItems.push(createdItem);
          } // End loop through items

          return createdItems; // Return the result of the transaction
        },
        { timeout: 30000 },
      ); // Set appropriate timeout

      this.logger.log(
        `Successfully created ${createdItemsResult.length} items for product ${productId}`,
      );
      return {
        message: `Successfully created ${createdItemsResult.length} product items.`,
        data: createdItemsResult, // Optionally return created item IDs/SKUs
      };
    } catch (error) {
      this.logger.error(
        `Failed to add items to product ${productId}: ${error.message}`,
        error.stack,
      );

      // Re-throw specific validation errors
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      // Handle Prisma-specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint violation (likely SKU)
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[] | undefined;
          throw new ConflictException(
            `Unique constraint failed. An item with a similar SKU might already exist${target ? ` on field(s): ${target.join(', ')}` : ''}.`,
          );
        }
        // Foreign key constraint failed (productId, productAttributeId, imageId) - should be caught by validation, but safeguard
        if (error.code === 'P2003') {
          const field = error.meta?.field_name as string | undefined;
          throw new BadRequestException(
            `Failed to link related entity. Invalid ID provided${field ? ` for field: ${field}` : ''}.`,
          );
        }
        // Related record not found - should be caught by validation
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `A related record was not found during the operation: ${error.meta?.cause ?? 'Unknown cause'}`,
          );
        }
      }

      // Generic fallback
      throw new InternalServerErrorException(
        'Failed to create product items due to an unexpected error.',
      );
    }
  }
}
