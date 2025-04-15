// src/banners/banners.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Banner, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path
import { CreateBannerDto } from './dto/create-banner.dto';
import { FindBannersDto } from './dto/find-banners.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- Helper: Validate Media ID ---
  private async _validateMediaId(mediaId: string): Promise<void> {
    if (!mediaId) return; // Allow null/undefined if optional in some contexts (not create)
    const media = await this.prisma.media.findUnique({ where: { id: mediaId }, select: { id: true } });
    if (!media) {
      throw new BadRequestException(`Media with ID "${mediaId}" not found.`);
    }
  }

  async create(createBannerDto: CreateBannerDto): Promise<Banner> {
    const { imageId, ...bannerData } = createBannerDto;

    // await this._validateMediaId(imageId); // Ensure media exists

    try {
      const banner = await this.prisma.banner.create({
        data: {
          ...bannerData,
          image: { connect: { id: imageId } },
        },
        include: { image: { select: { id: true, url: true, altText: true } } }, // Include image details in response
      });
      this.logger.log(`Banner created: Target=${banner.targetScreen} (ID: ${banner.id})`);
      return banner;
    } catch (error) {
      // Handle potential foreign key errors if validation missed somehow
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new BadRequestException(`Related entity (Media) not found during creation.`);
      }
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to create banner: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not create banner.');
    }
  }

  async findAll(query: FindBannersDto): Promise<{ data: Banner[]; count: number }> {
    const { page, limit, skip, isActive } = query;
    const where: Prisma.BannerWhereInput = {};
    const orderBy: Prisma.BannerOrderByWithRelationInput = {}; //TODO: Add banners orderBy //{ createdAt: 'desc' };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    try {
      const [banners, totalCount] = await Promise.all([
        this.prisma.banner.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: { image: { select: { id: true, url: true, altText: true } } },
        }),
        this.prisma.banner.count({ where }),
      ]);
      return { count: totalCount, data: banners };
    } catch (error) {
      this.logger.error(`Failed to find banners: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not retrieve banners.');
    }
  }

  // Typically only needed for Admin UI, less common for public API
  async findOne(id: string): Promise<Banner> {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
      include: { image: { select: { id: true, url: true, altText: true } } },
    });
    if (!banner) {
      throw new NotFoundException(`Banner with ID "${id}" not found.`);
    }
    return banner;
  }

  async update(id: string, updateBannerDto: UpdateBannerDto): Promise<Banner> {
    // Ensure banner exists
    await this.findOne(id);

    const { imageId, ...bannerData } = updateBannerDto;

    // Validate new Media ID if provided
    if (imageId) await this._validateMediaId(imageId);

    try {
      const updatedBanner = await this.prisma.banner.update({
        where: { id },
        data: {
          ...bannerData,
          // Update image connection only if imageId is provided
          ...(imageId && { image: { connect: { id: imageId } } }),
        },
        include: { image: { select: { id: true, url: true, altText: true } } },
      });
      this.logger.log(`Banner updated: Target=${updatedBanner.targetScreen} (ID: ${updatedBanner.id})`);
      return updatedBanner;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Banner or related Media not found during update.`);
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to update banner ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not update banner.');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    // Ensure banner exists
    const banner = await this.findOne(id);

    // No complex dependencies to check for banner itself usually

    try {
      await this.prisma.banner.delete({ where: { id } });
      this.logger.log(`Banner deleted: Target=${banner.targetScreen} (ID: ${id})`);
      return { message: `Banner targeting "${banner.targetScreen}" successfully deleted.` };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Banner with ID "${id}" not found.`);
      }
      this.logger.error(`Failed to delete banner ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not delete banner.');
    }
  }
}
