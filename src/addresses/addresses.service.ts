import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UserAddress } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddressEntity } from './entities/address.entity';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AddressesService {
  private readonly _logger = new Logger(AddressesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates if a country exists. Throws BadRequestException if not.
   */
  private async _validateCountry(countryId: string) {
    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
    });
    if (!country) {
      throw new BadRequestException(
        `Country with ID "${countryId}" not found.`,
      );
    }
  }

  /**
   * Finds an address ensuring it belongs to the specified user.
   * Throws NotFoundException if not found or ForbiddenException if owner mismatch.
   */
  private async _getAddressByIdAndOwner(
    id: string,
    userId: string,
  ): Promise<UserAddress> {
    const address = await this.prisma.userAddress.findUnique({
      where: { id },
      include: { country: true },
    });

    if (!address) {
      throw new NotFoundException(`Address with ID "${id}" not found.`);
    }

    if (address.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this address.',
      );
    }

    return address;
  }

  /**
   * Sets all other addresses for a user to isDefault: false.
   * Meant to be used within a transaction.
   */
  private async _unsetOtherDefaults(userId: string): Promise<void> {
    await this.prisma.userAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  async create(
    userId: string,
    createAddressDto: CreateAddressDto,
  ): Promise<AddressEntity> {
    const { countryId, isDefault, ...addressData } = createAddressDto;

    // Check if the countryId is valid and exists in the database
    await this._validateCountry(countryId);

    try {
      if (isDefault) {
        return (await this.prisma.$transaction(async (prisma) => {
          // Set all other addresses to not default
          await this._unsetOtherDefaults(userId);

          // Create the new address and set it as default
          const newAddress = await prisma.userAddress.create({
            data: {
              ...addressData,
              userId,
              countryId,
              isDefault: true,
            },
            include: { country: true },
          });
          return newAddress;
        })) as unknown as AddressEntity;
      } else {
        const newAddress = await this.prisma.userAddress.create({
          data: {
            ...addressData,
            userId,
            countryId,
            isDefault: false,
          },
          include: { country: true },
        });
        return newAddress as unknown as AddressEntity;
      }
    } catch (error) {
      this._logger.error(
        `Failed to create address for user ${userId}: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) throw error; // Re-throw validation errors
      throw new InternalServerErrorException('Could not create address.');
    }
  }

  async findAll(userId: string): Promise<AddressEntity[]> {
    try {
      return (await this.prisma.userAddress.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { country: true },
      })) as unknown as AddressEntity[];
    } catch (error) {
      this._logger.error(
        `Failed to find addresses for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not retrieve addresses.');
    }
  }

  async findOne(id: string, userId: string): Promise<AddressEntity> {
    return (await this._getAddressByIdAndOwner(
      id,
      userId,
    )) as unknown as AddressEntity;
  }

  async update(
    id: string,
    userId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<AddressEntity> {
    // Ensure the address belongs to the user
    await this._getAddressByIdAndOwner(id, userId);

    const { countryId, isDefault, ...addressData } = updateAddressDto;

    // Validate new country if provided
    if (countryId) await this._validateCountry(countryId);

    try {
      if (isDefault === true) {
        return await this.prisma.$transaction(async (prisma) => {
          await this._unsetOtherDefaults(userId);

          // Update the address and set it as default
          const updatedAddress = await prisma.userAddress.update({
            where: { id },
            data: {
              ...addressData,
              isDefault: true,
              ...(countryId && { countryId }),
            },
            include: { country: true },
          });
          return updatedAddress as unknown as AddressEntity;
        });
      } else {
        const updatedAddress = await this.prisma.userAddress.update({
          where: { id },
          data: {
            ...addressData,
            ...(isDefault !== undefined && { isDefault }),
            ...(countryId && { countryId }),
          },
          include: { country: true },
        });
        return updatedAddress as unknown as AddressEntity;
      }
    } catch (error) {
      this._logger.error(
        `Failed to update address ${id} for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not update address.');
    }
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    // Ensure address exists and belongs to user first
    const addressToDelete = await this._getAddressByIdAndOwner(id, userId);

    // Optional: Add logic here if deleting the default address requires special handling
    // (e.g., prevent deletion, or automatically set another address as default)
    if (addressToDelete.isDefault) {
      throw new BadRequestException(
        'Cannot delete the default address. Please set another address as default first.',
      );
    }

    try {
      await this.prisma.userAddress.delete({
        where: { id },
      });
      return { message: 'Address deleted successfully.' };
    } catch (error) {
      this._logger.error(
        `Failed to delete address ${id} for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not delete address.');
    }
  }

  async setDefault(id: string, userId: string): Promise<AddressEntity> {
    // Ensure the address belongs to the user
    await this._getAddressByIdAndOwner(id, userId);

    try {
      return await this.prisma.$transaction(async (prisma) => {
        // Unset all other addresses as default
        await this._unsetOtherDefaults(userId);

        // Set the specified address as default
        const updatedAddress = await prisma.userAddress.update({
          where: { id },
          data: { isDefault: true },
          include: { country: true },
        });
        return updatedAddress as unknown as AddressEntity;
      });
    } catch (error) {
      this._logger.error(
        `Failed to set address ${id} as default for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not set address as default.',
      );
    }
  }
}
