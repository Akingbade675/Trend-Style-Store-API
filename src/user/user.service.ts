import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { hash } from 'argon2';
import passwordConfig from 'src/auth/config/password.config';
import { ConfigType } from '@nestjs/config';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UserService {
  // Add a logger instance for better logging
  private readonly logger = new Logger(UserService.name);
  constructor(
    @Inject(passwordConfig.KEY)
    private passwordConfiguration: ConfigType<typeof passwordConfig>,
    private readonly prisma: PrismaService,
  ) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    try {
      const user = await this.prisma.user.create({ data: data });
      return user;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        if (e.meta.target.toString().includes('email')) {
          throw new BadRequestException('User with this email already exists!');
        }
        if (e.meta.target.toString().includes('username')) {
          throw new BadRequestException(
            'User with this username already exists!',
          );
        }

        this.logger.error(
          `User registration failed for ${data.email}: ${e.message}`,
          e.stack,
        );
        throw new InternalServerErrorException('Could not register user.');
      }
    }
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findOne(where: Prisma.UserWhereUniqueInput) {
    return this.prisma.user.findUnique({ where });
  }

  async findAllCustomers() {
    return this.prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        avatar: true,
        role: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        avatar: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findUserById(id); // Check if user exists

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: data,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          avatar: true,
          role: true,
        },
      });
      return user;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        if (e.meta.target.toString().includes('username')) {
          throw new ConflictException('Username already exists!');
        }
      }
      this.logger.error(
        `Failed to update user with ID ${id}: ${e.message}`,
        e.stack,
      );
      throw new InternalServerErrorException('Could not update user.');
    }
  }
}
