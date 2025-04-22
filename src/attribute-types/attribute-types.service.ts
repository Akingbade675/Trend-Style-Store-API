// src/attribute-types/attribute-types.service.ts
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException, // Import ConflictException
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AttributeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path
import { CreateAttributeTypeDto } from './dto/create-attribute-type.dto';
import { UpdateAttributeTypeDto } from './dto/update-attribute-type.dto';

@Injectable()
export class AttributeTypesService {
  private readonly logger = new Logger(AttributeTypesService.name);
  private readonly cacheKey = 'attributeTypes';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createAttributeTypeDto: CreateAttributeTypeDto): Promise<AttributeType> {
    try {
      const attributeType = await this.prisma.attributeType.create({
        data: createAttributeTypeDto,
      });

      await this.invalidateCache();

      this.logger.log(`Attribute Type created: ${attributeType.name} (ID: ${attributeType.id})`);
      return attributeType;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation (likely 'name')
          throw new ConflictException(`Attribute Type with name "${createAttributeTypeDto.name}" already exists.`);
        }
      }
      this.logger.error(`Failed to create Attribute Type: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not create attribute type.');
    }
  }

  private async invalidateCache() {
    await Promise.all([this.cacheManager.del(this.cacheKey), this.cacheManager.del(`${this.cacheKey}-ids`)]);
  }

  async findAll(): Promise<{ data: AttributeType[]; count: number }> {
    const cachedData = await this.cacheManager.get<{ data: AttributeType[]; count: number }>(this.cacheKey);

    if (cachedData) {
      this.logger.log(`Cache hit for attribute types list: ${this.cacheKey}`);
      return cachedData;
    }

    try {
      const [attributeTypes, totalCount] = await this.prisma.$transaction([
        this.prisma.attributeType.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.attributeType.count(),
      ]);
      const result = { count: totalCount, data: attributeTypes };
      await this.cacheManager.set(this.cacheKey, result); // Cache the result object
      // Cache the ids of the attribute types
      await this.cacheManager.set(
        `${this.cacheKey}-ids`,
        attributeTypes.map((type) => type.id),
        0, // Never expire
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to find attribute types: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not retrieve attribute types.');
    }
  }

  async findOne(id: string): Promise<AttributeType> {
    const attributeType = await this.prisma.attributeType.findUnique({
      where: { id },
    });

    if (!attributeType) {
      throw new NotFoundException(`Attribute Type with ID "${id}" not found.`);
    }
    return attributeType;
  }

  async update(id: string, updateAttributeTypeDto: UpdateAttributeTypeDto): Promise<AttributeType> {
    try {
      const updatedAttributeType = await this.prisma.attributeType.update({
        where: { id },
        data: updateAttributeTypeDto,
      });

      await this.invalidateCache();

      this.logger.log(`Attribute Type updated: ${updatedAttributeType.name} (ID: ${updatedAttributeType.id})`);
      return updatedAttributeType;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(`Attribute Type with name "${updateAttributeTypeDto.name}" already exists.`);
        }
        if (error.code === 'P2025') {
          // Should be caught by findOne, but good failsafe
          throw new NotFoundException(`Attribute Type with ID "${id}" not found during update.`);
        }
      }
      this.logger.error(`Failed to update Attribute Type ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not update attribute type.');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    // 1. Ensure it exists
    const attributeType = await this.findOne(id);

    // 2. Check if it's used by any Product Attributes
    const usageCount = await this.prisma.productAttribute.count({
      where: { attributeTypeId: id },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        `Attribute Type "${attributeType.name}" cannot be deleted because it is currently assigned to ${usageCount} product attribute value(s).`,
      );
    }

    // 3. Proceed with deletion
    try {
      await this.prisma.attributeType.delete({
        where: { id },
      });

      await this.invalidateCache();

      this.logger.log(`Attribute Type deleted: ${attributeType.name} (ID: ${id})`);
      return {
        message: `Attribute Type "${attributeType.name}" successfully deleted.`,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Attribute Type with ID "${id}" not found.`);
      }
      this.logger.error(`Failed to delete Attribute Type ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not delete attribute type.');
    }
  }
}
