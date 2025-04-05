import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UserWithoutPassword } from 'src/auth/auth.service';
import { RolesGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/roles-enum';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';

@Public(false)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // --- Public Endpoints ---

  @Patch('profile')
  async update(
    @CurrentUser() user: UserWithoutPassword,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(user.id, updateUserDto);
  }

  // --- Admin Endpoints ---

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('customers')
  async getAllCustomers() {
    return this.userService.findAllCustomers();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  async getSpecificUser(@Param('id', ParseMongoIdPipe) id: string) {
    return this.userService.findUserById(id);
  }
}
