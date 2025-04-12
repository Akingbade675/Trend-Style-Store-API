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

  private _validateItemAttributesAgainstProductAttributes(
    productAttributes: CreateProductAttributeDto[] | undefined,
    productItems: CreateProductItemDto[] | undefined,
  ): void {
    if (!productItems || productItems.length === 0) return;

    // Create a set of available product attribute combinations for quick lookup
    const availableProductAttrs = new Set(
      productAttributes?.flatMap((pa) =>
        pa.value.map((v) => `${pa.attributeTypeId}_${v.toLowerCase()}`),
      ) ?? [],
    );

    for (const item of productItems) {
      if (!item.attributes || item.attributes.length === 0) {
        throw new BadRequestException(
          `Product item with SKU "${item.sku ?? 'N/A'}" must have at least one attribute defined.`,
        );
      }
      for (const itemAttr of item.attributes) {
        const itemAttrKey = `${itemAttr.attributeTypeId}_${itemAttr.value.toLowerCase()}`;
        if (!availableProductAttrs.has(itemAttrKey)) {
          throw new BadRequestException(
            `Attribute Type ID ${itemAttr.attributeTypeId} with Value "${itemAttr.value}" used in item SKU "${item.sku ?? 'N/A'}" was not defined in the main product attributes.`,
          );
        }
      }
      // Optional: Check if item attribute combinations are unique across items
      // const itemAttrCombo = item.attributes.map(a => `${a.attributeTypeId}_${a.value}`).sort().join('|');
      // Check uniqueness of itemAttrCombo among items
    }
  }

  async create(createProductDto: CreateProductDto) {
    const {
      brandId,
      categoryIds,
      tags,
      name,
      images,
      attributes,
      items,
      ...productData
    } = createProductDto;

    // Validate attribute definitions provided for items match those defined for the product
    this._validateItemAttributesAgainstProductAttributes(attributes, items);

    // Generate Slug
    // const slug = await this._generateUniqueSlug(name);

    try {
      const newProduct = await this.prisma.$transaction(
        async (tx) => {
          // 1. Create Base Product
          this.logger.log(`Creating base product: ${name}`);
          const createdProduct = await tx.product.create({
            data: {
              ...productData,
              name,
              // slug,
              brand: { connect: { id: brandId } },
              ...(tags?.length > 0
                ? {
                    tags: {
                      create: tags.map((tagName) => ({
                        tag: {
                          connectOrCreate: {
                            where: { name: tagName.toLowerCase() },
                            create: { name: tagName.toLowerCase() },
                          },
                        },
                      })),
                    },
                  }
                : {}),
              ...(categoryIds?.length > 0
                ? {
                    categories: {
                      create: categoryIds.map((categoryId) => ({
                        category: {
                          connect: {
                            id: categoryId,
                          },
                        },
                      })),
                    },
                  }
                : {}),
            },
          });
          this.logger.log(`Created base product ID: ${createdProduct.id}`);

          // 2. Link Categories
          // if (categoryIds && categoryIds.length > 0) {
          //   this.logger.log(`Linking ${categoryIds.length} categories...`);
          //   await tx.productCategory.createMany({
          //     data: categoryIds.map((categoryId) => ({
          //       productId: createdProduct.id,
          //       categoryId,
          //     })),
          //   });
          // }

          // 4. Create Product Images (linking to Media)
          if (images && images.length > 0) {
            this.logger.log(`Creating ${images.length} product image links...`);
            let hasDefault = images.some((img) => img.isPrimary); // Use isPrimary from schema
            await tx.productImage.createMany({
              data: images.map((img, index) => ({
                productId: createdProduct.id,
                imageId: img.imageId, // Use imageId from schema
                isPrimary:
                  !hasDefault && index === 0 ? true : (img.isPrimary ?? false),
                // altText can be inherited from Media, or add field here if needed
              })),
            });
          }

          // 5. Create Product Attributes
          const createdAttributesMap = new Map<string, string>(); // Map key: "typeId_value", value: productAttributeId
          if (attributes && attributes.length > 0) {
            this.logger.log(
              `Creating ${attributes.length} product attributes...`,
            );
            // Cannot use createMany easily if we need the returned IDs immediately
            for (const attrDto of attributes) {
              for (const value of attrDto.value) {
                const createdAttr = await tx.productAttribute.create({
                  data: {
                    productId: createdProduct.id,
                    attributeTypeId: attrDto.attributeTypeId,
                    value: value,
                  },
                });
                createdAttributesMap.set(
                  `${attrDto.attributeTypeId}_${value.toLowerCase()}`,
                  createdAttr.id,
                );
                this.logger.verbose(
                  `Created attribute: ${value} (ID: ${createdAttr.id})`,
                );
              }
            }
          }

          // 6. Create Product Items and Link Item Attributes/Images
          if (items && items.length > 0) {
            this.logger.log(`Creating ${items.length} product items...`);
            for (const itemDto of items) {
              const {
                attributes: itemAttributeLinks,
                images: itemImages,
                ...itemData
              } = itemDto;

              // Create the ProductItem
              const createdItem = await tx.productItem.create({
                data: {
                  ...itemData,
                  productId: createdProduct.id,
                  originalPrice:
                    itemData.originalPrice ?? createdProduct.originalPrice,
                  salePrice: itemData.salePrice ?? createdProduct.salePrice,
                  // Generate SKU if needed, e.g., `${createdProduct.skuPrefix}-${attrValues.join('-')}`
                  sku:
                    itemDto.sku ??
                    `${createdProduct.skuPrefix ?? 'SKU'}-${uuidv4().substring(0, 6)}`, // Example SKU generation
                },
              });
              this.logger.verbose(
                `Created item SKU: ${createdItem.sku} (ID: ${createdItem.id})`,
              );

              // Link Item Attributes
              if (itemAttributeLinks && itemAttributeLinks.length > 0) {
                const itemAttrData = itemAttributeLinks.map((link) => {
                  const mapKey = `${link.attributeTypeId}_${link.value.toLowerCase()}`;
                  const productAttributeId = createdAttributesMap.get(mapKey);
                  if (!productAttributeId) {
                    // This should have been caught by pre-validation, but double-check
                    throw new InternalServerErrorException(
                      `Cannot link item attribute: Attribute Type ID ${link.attributeTypeId} with Value "${link.value}" not found for product ${createdProduct.id}.`,
                    );
                  }
                  return {
                    productItemId: createdItem.id,
                    productAttributeId: productAttributeId,
                  };
                });
                this.logger.verbose(
                  `Linking ${itemAttrData.length} attributes to item ${createdItem.id}`,
                );
                await tx.productItemAttribute.createMany({
                  data: itemAttrData,
                });
              }

              // Link Item Images
              if (itemImages && itemImages.length > 0) {
                this.logger.verbose(
                  `Linking ${itemImages.length} images to item ${createdItem.id}`,
                );
                let hasDefaultItemImg = itemImages.some((img) => img.isPrimary);
                await tx.productItemImage.createMany({
                  data: itemImages.map((img, index) => ({
                    productItemId: createdItem.id,
                    imageId: img.imageId, // Use imageId from schema
                    isPrimary:
                      !hasDefaultItemImg && index === 0
                        ? true
                        : (img.isPrimary ?? false),
                  })),
                });
              }
            } // end loop through items
          }
          return createdProduct;
        },
        { timeout: 20000 },
      ); // End Transaction

      this.logger.log(`Transaction committed for product ${newProduct.id}`);
      return newProduct;
    } catch (error) {
      // Log specific Prisma errors if helpful
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Prisma Error: ${JSON.stringify(error)}`);
        if (error.code === 'P2002') {
          // Identify which field caused the unique constraint violation if possible
          const target = error.meta?.target;
          throw new ConflictException(
            `Unique constraint failed on field(s): ${target ?? 'Unknown'}. Product name/slug might already exist.`,
          );
        }
        if (error.code === 'P2025') {
          // Record to connect not found (e.g., invalid brandId, categoryId etc.)
          throw new BadRequestException(
            `Related entity not found: ${error.meta?.cause ?? 'Invalid relation ID'}`,
          );
        }
      }
      // Re-throw specific exceptions caught during pre-validation
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        throw error;

      // Generic fallback
      this.logger.error(
        `Failed to create product: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not create product due to an unexpected error.',
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
                productArrribute: {
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

  async remove(id: string) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // 3. Proceed with deletion (Cascades should handle related data based on schema)
    try {
      await this.prisma.product.delete({
        where: { id },
      });
      return { message: `Product "${product.name}" successfully deleted.` };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Product with ID "${id}" not found.`); // Should be caught earlier, but safeguard
      }
      this.logger.error(
        `Failed to delete product ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not delete product.');
    }
  }

  async getProductReviews(id: string) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Get all product items
    const productItems = await this.prisma.productItem.findMany({
      where: { productId: id },
      select: { id: true },
    });

    const productItemIds = productItems.map((item) => item.id);

    // Get reviews for all items
    const reviews = await this.prisma.userReview.findMany({
      where: {
        orderItem: {
          productItemId: {
            in: productItemIds,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        orderItem: {
          include: {
            productItem: true,
          },
        },
      },
      orderBy: {
        reviewDate: 'desc',
      },
    });

    return reviews;
  }

  async getProductItems(id: string) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Get all items with their attributes and images
    const items = await this.prisma.productItem.findMany({
      where: { productId: id },
      include: {
        attributes: {
          include: {
            productArrribute: {
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

    return items;
  }

  async getProductItem(id: string) {
    const item = await this.prisma.productItem.findUnique({
      where: { id },
      include: {
        product: true,
        attributes: {
          include: {
            productArrribute: {
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

  async updateProductCategories(id: string, categoryIds: string[]) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete existing categories
      await tx.productCategory.deleteMany({
        where: { productId: id },
      });

      // Create new category relationships
      if (categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            productId: id,
            categoryId,
          })),
        });
      }

      // Return updated product
      return this.findOne(id);
    });
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
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Update the featured status
    await this.prisma.product.update({
      where: { id },
      data: { isFeatured },
    });

    return this.findOne(id);
  }

  async setActiveStatus(id: string, isActive: boolean) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Update the active status
    await this.prisma.product.update({
      where: { id },
      data: { isActive },
    });

    return this.findOne(id);
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
          // Add other ProductImage fields if necessary, e.g., altText override
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
