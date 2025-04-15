// src/brands/brands.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path
import { CreateBrandDto } from './dto/create-brand.dto';
import { FindBrandsDto } from './dto/find-brands.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- Helper: Validate relation IDs ---
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
  private async _validateCategoryIds(
    categoryIds: string[] | undefined,
  ): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;
    const count = await this.prisma.category.count({
      where: { id: { in: categoryIds } },
    });
    if (count !== categoryIds.length) {
      throw new BadRequestException(
        'One or more provided category IDs are invalid.',
      );
    }
  }

  async create(createBrandDto: CreateBrandDto): Promise<Brand> {
    const { name, logoId, categoryIds, ...brandData } = createBrandDto;

    try {
      const brand = await this.prisma.brand.create({
        data: {
          name,
          ...brandData,
          ...(logoId && { logoId }),
          ...(categoryIds &&
            categoryIds.length > 0 && {
              categories: {
                create: categoryIds.map((catId) => ({
                  categoryId: catId,
                })),
              },
            }),
        },
        include: { logo: true }, // Include logo in return
      });
      this.logger.log(`Brand created: ${brand.name} (ID: ${brand.id})`);
      return brand;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException(
            `Brand with name "${name}" already exists.`,
          );
        if (error.code === 'P2025') {
          this.logger.error(
            `One or more provided category IDs are invalid.`,
            error.message,
            error.meta,
            error.stack,
          );
          throw new NotFoundException(
            `One or more provided category IDs are invalid.`,
          );
        }
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      this.logger.error(
        `Failed to create brand: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not create brand.');
    }
  }

  async findAll(
    query: FindBrandsDto,
  ): Promise<{ data: Brand[]; count: number }> {
    const { page, limit, skip, search, isFeatured } = query;
    const where: Prisma.BrandWhereInput = {};
    const orderBy: Prisma.BrandOrderByWithRelationInput = { name: 'asc' }; // Default sort

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    try {
      const [brands, totalCount] = await this.prisma.$transaction([
        this.prisma.brand.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: { logo: { select: { id: true, url: true, altText: true } } },
        }),
        this.prisma.brand.count({ where }),
      ]);
      return { count: totalCount, data: brands };
    } catch (error) {
      this.logger.error(`Failed to find brands: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not retrieve brands.');
    }
  }

  async findOne(id: string): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        logo: { select: { id: true, url: true, altText: true } },
        categories: {
          select: { category: { select: { id: true, name: true } } },
        },
      },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID "${id}" not found.`);
    }
    return brand;
  }

  async update(id: string, updateBrandDto: UpdateBrandDto): Promise<Brand> {
    // Ensure brand exists
    await this.findOne(id);

    const { name, logoId, categoryIds, ...brandData } = updateBrandDto;

    // Validate Logo ID if changed
    if (logoId !== undefined)
      await this._validateMediaIds(
        logoId === null ? [] : [logoId],
        'brand logo',
      );
    // Validate Category IDs if changed
    if (categoryIds !== undefined) await this._validateCategoryIds(categoryIds);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Update Brand basic data
        const updatedBrand = await tx.brand.update({
          where: { id },
          data: {
            ...brandData,
            ...(name && { name }), // Update name if provided
            // Handle logo update: connect new, disconnect if null, or do nothing if undefined
            ...(logoId !== undefined && {
              logo:
                logoId === null
                  ? { disconnect: true }
                  : { connect: { id: logoId } },
            }),
          },
          include: { logo: true }, // Include logo in immediate return
        });
        this.logger.log(
          `Brand updated: ${updatedBrand.name} (ID: ${updatedBrand.id})`,
        );

        // Update Category Links (Replace existing)
        if (categoryIds !== undefined) {
          // Check if explicitly provided (even empty array means remove all)
          this.logger.log(`Updating category links for brand ${id}...`);
          // Delete existing links
          await tx.brandCategory.deleteMany({ where: { brandId: id } });
          // Create new links if array is not empty
          if (categoryIds.length > 0) {
            await tx.brandCategory.createMany({
              data: categoryIds.map((catId) => ({
                brandId: id,
                categoryId: catId,
              })),
            });
          }
        }
        return updatedBrand; // Return brand from transaction scope
      });

      // Note: Re-fetching with findOne outside transaction could be done to ensure category links are included
      // return this.findOne(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException(
            `Brand with name "${name}" already exists.`,
          );
        if (error.code === 'P2025')
          throw new NotFoundException(
            `Brand or related entity not found during update.`,
          );
      }
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        throw error;
      this.logger.error(
        `Failed to update brand ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not update brand.');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    // 1. Ensure brand exists
    const brand = await this.findOne(id);

    // 2. Check if brand is used by any Products
    const productCount = await this.prisma.product.count({
      where: { brandId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Brand "${brand.name}" cannot be deleted because it is assigned to ${productCount} product(s).`,
      );
    }

    // 3. Proceed with deletion (Cascade should handle BrandCategory links)
    try {
      await this.prisma.brand.delete({ where: { id } });
      this.logger.log(`Brand deleted: ${brand.name} (ID: ${id})`);
      return { message: `Brand "${brand.name}" successfully deleted.` };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Brand with ID "${id}" not found.`);
      }
      this.logger.error(
        `Failed to delete brand ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not delete brand.');
    }
  }
}
