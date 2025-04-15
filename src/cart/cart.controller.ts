import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserWithoutPassword } from 'src/auth/auth.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/roles-enum';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Roles(Role.CUSTOMER)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  addToCart(@CurrentUser() user: UserWithoutPassword, @Body() addToCartDto: AddToCartDto) {
    return this.cartService.addItemToCart(user.id, addToCartDto);
  }

  @Get()
  getCart(@CurrentUser() user: UserWithoutPassword) {
    return this.cartService.getCart(user.id);
  }

  @Patch('item/:itemId')
  updateCartItem(
    @CurrentUser() user: UserWithoutPassword,
    @Param('itemId') itemId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(user.id, itemId, updateCartItemDto);
  }

  @Delete('item/:itemId')
  removeCartItem(@CurrentUser() user: UserWithoutPassword, @Param('itemId') itemId: string) {
    return this.cartService.removeItemFromCart(user.id, itemId);
  }

  @Delete()
  clearCart(@CurrentUser() user: UserWithoutPassword) {
    return this.cartService.clearCart(user.id);
  }
}
