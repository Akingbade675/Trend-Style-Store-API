import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Category } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class CategoriesService {
  private readonly _logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async _checkIfParentExist(parentId: string) {
    if (parentId) {
      const parentCategory = await this.prisma.category.findUnique({
        where: { id: parentId },
      });

      if (!parentCategory) {
        throw new BadRequestException(
          `Parent category with ID "${parentId}" not found.`,
        );
      }
    }
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const { parentId, ...categoryData } = createCategoryDto;

    // Check if parent category exists if parentId is provided
    await this._checkIfParentExist(parentId);

    try {
      const category = await this.prisma.category.create({
        data: {
          ...categoryData,
          // Connect to parent if parentId exists
          ...(parentId && { parent: { connect: { id: parentId } } }),
        },
      });
      return category;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Category with this name already exists.`,
        );
      }
      this._logger.error(`Failed to create category: ${error.message}`);
      throw new InternalServerErrorException('Could not create category.');
    }
  }

  async findAll(includeChildren: boolean): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { parent: null },
      include: { children: includeChildren },
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        brands: { include: { brand: true } },
        products: {
          take: 10,
          select: { product: { include: { images: true } } },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found.`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    // await this.findOne(id)
    const { parentId, ...categoryData } = updateCategoryDto;

    // Prevent setting parentId to the category's own ID
    if (parentId === id) {
      throw new BadRequestException('A category cannot be its own parent.');
    }

    if (parentId) await this._checkIfParentExist(parentId);

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          ...categoryData,
          // Handle parent connection update carefully
          ...(parentId !== undefined && {
            // Check if parentId is explicitly part of the update
            parent:
              parentId === null
                ? { disconnect: true } // Set parent to null
                : { connect: { id: parentId } }, // Connect to new parent
          }),
        },
      });
      return updatedCategory;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            `Category with this name already exists.`,
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException(`Category with ID "${id}" not found.`);
        }
      }
      this._logger.error(`Failed to update category ${id}: ${error.message}`);
      throw new InternalServerErrorException('Could not update category.');
    }
  }

  async remove(id: string) {
    // Check if category exists and count its relationships
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            brands: true,
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category)
      throw new NotFoundException(`Category with ID "${id}" not found.`);

    // Check if category has subcategories
    if (category._count.children > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${category._count.children} subcategories. Delete or reassign subcategories first.`,
      );
    }

    // Check if category has associated products
    if (category._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${category._count.products} associated products. Reassign products to another category first.`,
      );
    }

    // Check if category has associated brands
    if (category._count.brands > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${category._count.brands} associated brands. Reassign brands to another category first.`,
      );
    }

    try {
      const deletedCategory = await this.prisma.category.delete({
        where: { id },
      });

      this._logger.log(
        `Category "${deletedCategory.name}" with ID "${id}" was successfully deleted.`,
      );

      return {
        message: `Category "${deletedCategory.name}" successfully deleted.`,
      };
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Category with ID "${id}" not found.`);
      }
      this._logger.error(`Failed to delete category ${id}: ${error.message}`);
      throw new InternalServerErrorException('Could not delete category.');
    }
  }
}
