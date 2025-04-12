// src/attribute-types/attribute-types.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ConflictException, // Import ConflictException
  Logger, // Import Logger
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path
import { CreateAttributeTypeDto } from './dto/create-attribute-type.dto';
import { UpdateAttributeTypeDto } from './dto/update-attribute-type.dto';
import { Prisma, AttributeType } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto'; // Adjust path

@Injectable()
export class AttributeTypesService {
  private readonly logger = new Logger(AttributeTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    createAttributeTypeDto: CreateAttributeTypeDto,
  ): Promise<AttributeType> {
    try {
      const attributeType = await this.prisma.attributeType.create({
        data: createAttributeTypeDto,
      });
      this.logger.log(
        `Attribute Type created: ${attributeType.name} (ID: ${attributeType.id})`,
      );
      return attributeType;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation (likely 'name')
          throw new ConflictException(
            `Attribute Type with name "${createAttributeTypeDto.name}" already exists.`,
          );
        }
      }
      this.logger.error(
        `Failed to create Attribute Type: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not create attribute type.',
      );
    }
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<{ data: AttributeType[]; count: number }> {
    const { page, limit, skip } = paginationDto;

    try {
      const [attributeTypes, totalCount] = await Promise.all([
        this.prisma.attributeType.findMany({
          skip,
          take: limit,
          orderBy: { name: 'asc' }, // Order alphabetically by name
        }),
        this.prisma.attributeType.count(),
      ]);
      return { count: totalCount, data: attributeTypes };
    } catch (error) {
      this.logger.error(
        `Failed to find attribute types: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not retrieve attribute types.',
      );
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

  async update(
    id: string,
    updateAttributeTypeDto: UpdateAttributeTypeDto,
  ): Promise<AttributeType> {
    try {
      const updatedAttributeType = await this.prisma.attributeType.update({
        where: { id },
        data: updateAttributeTypeDto,
      });
      this.logger.log(
        `Attribute Type updated: ${updatedAttributeType.name} (ID: ${updatedAttributeType.id})`,
      );
      return updatedAttributeType;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Attribute Type with name "${updateAttributeTypeDto.name}" already exists.`,
          );
        }
        if (error.code === 'P2025') {
          // Should be caught by findOne, but good failsafe
          throw new NotFoundException(
            `Attribute Type with ID "${id}" not found during update.`,
          );
        }
      }
      this.logger.error(
        `Failed to update Attribute Type ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not update attribute type.',
      );
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
      this.logger.log(
        `Attribute Type deleted: ${attributeType.name} (ID: ${id})`,
      );
      return {
        message: `Attribute Type "${attributeType.name}" successfully deleted.`,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Attribute Type with ID "${id}" not found.`,
        );
      }
      this.logger.error(
        `Failed to delete Attribute Type ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not delete attribute type.',
      );
    }
  }
}
