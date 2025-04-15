import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CalculatedCart, CartWithDetails, EmptyCart } from './types/cart.type';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly cartInclude = {
    items: {
      include: {
        productItem: {
          include: {
            product: {
              select: { id: true, name: true, slug: true },
            },
            images: {
              where: { isPrimary: true },
              select: { image: { select: { url: true, altText: true } } },
              take: 1,
            },
            attributes: {
              include: {
                productAttribute: {
                  include: {
                    attributeType: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { addedAt: 'asc' },
    },
  } satisfies Prisma.CartInclude;

  private async _getOrCreateCart(userId: string): Promise<CartWithDetails> {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: this.cartInclude,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: this.cartInclude,
      });
    }
    return cart;
  }

  private calculateCartTotals(cart: CartWithDetails): CalculatedCart {
    const subTotal = cart.items.reduce((sum, item) => {
      const price = item.productItem.salePrice ?? item.productItem.originalPrice;
      return sum + Number(price) * item.quantity;
    }, 0);

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...cart,
      subTotal,
      totalItems,
    };
  }

  async addItemToCart(userId: string, addToCartDto: AddToCartDto): Promise<CalculatedCart> {
    const { productItemId, quantity } = addToCartDto;

    const cart = await this._getOrCreateCart(userId);

    const productItem = await this.prisma.productItem.findUnique({
      where: { id: productItemId, isActive: true },
      select: { id: true, stock: true },
    });

    if (!productItem) {
      throw new NotFoundException(`Product item with ID ${productItemId} not found or not active.`);
    }

    const existingCartItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productItemId: {
          cartId: cart.id,
          productItemId: productItemId,
        },
      },
    });

    const updatedQuantity = existingCartItem ? existingCartItem.quantity + quantity : quantity;

    if (productItem.stock < updatedQuantity) {
      throw new BadRequestException(
        `Not enough stock for product item ${productItemId}. Available: ${productItem.stock}`,
      );
    }

    await this.prisma.cartItem.upsert({
      where: {
        cartId_productItemId: {
          cartId: cart.id,
          productItemId: productItemId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
        addedAt: new Date(),
      },
      create: {
        cartId: cart.id,
        productItemId: productItemId,
        quantity: quantity,
      },
    });

    const updatedCart = await this.getCart(userId);
    return this.calculateCartTotals(updatedCart);
  }

  async getCart(userId: string): Promise<CalculatedCart | EmptyCart> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: this.cartInclude,
    });

    if (!cart) {
      return { id: null, userId, items: [], subTotal: 0, totalItems: 0, createdAt: null, updatedAt: null };
    }

    return this.calculateCartTotals(cart);
  }

  async updateCartItem(
    userId: string,
    cartItemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CalculatedCart> {
    const { quantity } = updateCartItemDto;

    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId: userId,
        },
      },
      include: { productItem: { select: { id: true, stock: true } } },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${cartItemId} not found in your cart.`);
    }

    if (cartItem.productItem.stock < quantity) {
      throw new BadRequestException(
        `Not enough stock for product item ${cartItem.productItemId}. Available: ${cartItem.productItem.stock}`,
      );
    }

    await this.prisma.cartItem.update({
      where: {
        id: cartItemId,

        cart: { userId: userId },
      },
      data: {
        quantity: quantity,
        addedAt: new Date(),
      },
    });

    const updatedCart = await this.getCart(userId);

    return this.calculateCartTotals(updatedCart as CartWithDetails);
  }

  async removeItemFromCart(userId: string, cartItemId: string): Promise<CalculatedCart | EmptyCart> {
    const itemToDelete = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: { userId: userId },
      },
      select: { id: true, cartId: true },
    });

    if (!itemToDelete) {
      throw new NotFoundException(`Cart item with ID ${cartItemId} not found in your cart.`);
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: itemToDelete.cartId },
      include: this.cartInclude,
    });

    if (!updatedCart || updatedCart.items.length === 0) {
      return { id: null, userId, items: [], subTotal: 0, totalItems: 0, createdAt: null, updatedAt: null };
    }

    return this.calculateCartTotals(updatedCart as CartWithDetails);
  }

  async clearCart(userId: string): Promise<EmptyCart> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      return { id: null, userId, items: [], subTotal: 0, totalItems: 0, createdAt: null, updatedAt: null };
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { id: null, userId, items: [], subTotal: 0, totalItems: 0, createdAt: null, updatedAt: null };
  }
}
