import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CalculatedCart, CartWithDetails, EmptyCart } from './types/cart.type';

@Injectable()
export class CartService {
  // Instantiate Logger with service context
  private readonly logger = new Logger(CartService.name);

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
      orderBy: { addedAt: 'asc' as Prisma.SortOrder }, // Explicit type
    },
  } satisfies Prisma.CartInclude;

  private async _getOrCreateCart(userId: string): Promise<CartWithDetails> {
    this.logger.log(`[_getOrCreateCart] Attempting to find or create cart for user: ${userId}`);
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: this.cartInclude,
    });

    if (!cart) {
      this.logger.log(`[_getOrCreateCart] No cart found for user ${userId}. Creating a new one.`);
      cart = await this.prisma.cart.create({
        data: { userId },
        include: this.cartInclude,
      });
      this.logger.log(`[_getOrCreateCart] Created new cart with ID: ${cart.id} for user: ${userId}`);
    } else {
      this.logger.log(`[_getOrCreateCart] Found existing cart with ID: ${cart.id} for user: ${userId}`);
    }
    // Cast needed for TS; Prisma guarantees structure based on include
    return cart as CartWithDetails;
  }

  private calculateCartTotals(cart: CartWithDetails): CalculatedCart {
    this.logger.log(`[calculateCartTotals] Calculating totals for cart ID: ${cart.id}`);
    const subTotal = cart.items.reduce((sum, item) => {
      const price = item.productItem.salePrice ?? item.productItem.originalPrice;
      return sum + Number(price) * item.quantity;
    }, 0);

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    this.logger.log(`[calculateCartTotals] Cart ID: ${cart.id} - Subtotal: ${subTotal}, Total Items: ${totalItems}`);

    return {
      ...cart,
      subTotal,
      totalItems,
    };
  }

  async addItemToCart(userId: string, addToCartDto: AddToCartDto): Promise<CalculatedCart> {
    const { productItemId, quantity } = addToCartDto;
    this.logger.log(
      `[addItemToCart] User: ${userId}, Attempting to add item ID: ${productItemId}, Quantity: ${quantity}`,
    );

    const cart = await this._getOrCreateCart(userId);
    this.logger.log(`[addItemToCart] User: ${userId}, Using cart ID: ${cart.id}`);

    this.logger.log(`[addItemToCart] Validating product item ID: ${productItemId}`);
    const productItem = await this.prisma.productItem.findUnique({
      where: { id: productItemId, isActive: true },
      select: { id: true, stock: true },
    });

    if (!productItem) {
      this.logger.warn(
        `[addItemToCart] Product item ID: ${productItemId} not found or not active for user: ${userId}.`,
      );
      throw new NotFoundException(`Product item with ID ${productItemId} not found or not active.`);
    }
    this.logger.log(`[addItemToCart] Product item ID: ${productItemId} found. Stock: ${productItem.stock}`);

    this.logger.log(`[addItemToCart] Checking if item ${productItemId} already exists in cart ${cart.id}`);
    const existingCartItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productItemId: {
          cartId: cart.id,
          productItemId: productItemId,
        },
      },
    });

    const updatedQuantity = existingCartItem ? existingCartItem.quantity + quantity : quantity;
    this.logger.log(
      `[addItemToCart] Target quantity for item ${productItemId} in cart ${cart.id}: ${updatedQuantity} (Existing: ${existingCartItem?.quantity ?? 0}, Adding: ${quantity})`,
    );

    this.logger.log(
      `[addItemToCart] Validating stock for item ${productItemId}. Required: ${updatedQuantity}, Available: ${productItem.stock}`,
    );
    if (productItem.stock < updatedQuantity) {
      this.logger.warn(
        `[addItemToCart] Insufficient stock for item ${productItemId}. User: ${userId}, Required: ${updatedQuantity}, Available: ${productItem.stock}`,
      );
      throw new BadRequestException(
        `Not enough stock for product item ${productItemId}. Available: ${productItem.stock}`,
      );
    }

    this.logger.log(
      `[addItemToCart] Upserting item ${productItemId} in cart ${cart.id} with quantity ${updatedQuantity}`,
    );
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
    this.logger.log(`[addItemToCart] Item ${productItemId} upserted successfully in cart ${cart.id}.`);

    const updatedCart = await this.getCart(userId);
    return this.calculateCartTotals(updatedCart);
  }

  async getCart(userId: string): Promise<CalculatedCart | EmptyCart> {
    this.logger.log(`[getCart] Attempting to retrieve cart for user: ${userId}`);
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: this.cartInclude,
    });

    if (!cart) {
      this.logger.log(`[getCart] No cart found for user: ${userId}. Returning empty cart structure.`);
      return { id: null, userId, items: [], subTotal: 0, totalItems: 0, createdAt: null, updatedAt: null };
    }
    this.logger.log(`[getCart] Cart found for user: ${userId}, Cart ID: ${cart.id}. Calculating totals.`);
    return this.calculateCartTotals(cart as CartWithDetails);
  }

  async updateCartItem(
    userId: string,
    cartItemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CalculatedCart | EmptyCart> {
    // Return EmptyCart if quantity becomes 0
    const { quantity } = updateCartItemDto;
    this.logger.log(
      `[updateCartItem] User: ${userId}, Attempting to update cart item ID: ${cartItemId} to quantity: ${quantity}`,
    );

    if (quantity <= 0) {
      this.logger.log(
        `[updateCartItem] Quantity is ${quantity}. Treating as item removal for cart item ID: ${cartItemId}`,
      );
      return this.removeItemFromCart(userId, cartItemId);
    }

    this.logger.log(`[updateCartItem] Finding cart item ${cartItemId} for user ${userId}`);
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId: userId,
        },
      },
      select: {
        id: true,
        productItemId: true,
        cartId: true,
        productItem: { select: { stock: true } }, // Select only stock from ProductItem
      },
    });

    if (!cartItem) {
      this.logger.warn(`[updateCartItem] Cart item ID: ${cartItemId} not found in cart for user: ${userId}.`);
      throw new NotFoundException(`Cart item with ID ${cartItemId} not found in your cart.`);
    }
    this.logger.log(
      `[updateCartItem] Cart item ${cartItemId} found (ProductItem ID: ${cartItem.productItemId}). Checking stock.`,
    );

    this.logger.log(
      `[updateCartItem] Validating stock for item ${cartItem.productItemId}. Required: ${quantity}, Available: ${cartItem.productItem.stock}`,
    );
    if (cartItem.productItem.stock < quantity) {
      this.logger.warn(
        `[updateCartItem] Insufficient stock for item ${cartItem.productItemId}. User: ${userId}, Required: ${quantity}, Available: ${cartItem.productItem.stock}`,
      );
      throw new BadRequestException(
        `Not enough stock for product item ${cartItem.productItemId}. Available: ${cartItem.productItem.stock}`,
      );
    }

    this.logger.log(`[updateCartItem] Updating quantity for cart item ${cartItemId} to ${quantity}`);
    await this.prisma.cartItem.update({
      where: {
        id: cartItemId,
      },
      data: {
        quantity: quantity,
        addedAt: new Date(), // Update timestamp
      },
    });
    this.logger.log(`[updateCartItem] Cart item ${cartItemId} quantity updated successfully.`);

    const updatedCart = await this.getCart(userId);

    return this.calculateCartTotals(updatedCart as CartWithDetails);
  }

  async removeItemFromCart(userId: string, cartItemId: string): Promise<CalculatedCart | EmptyCart> {
    this.logger.log(`[removeItemFromCart] User: ${userId}, Attempting to remove cart item ID: ${cartItemId}`);

    const itemToDelete = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: { userId: userId },
      },
      select: { id: true, cartId: true },
    });

    if (!itemToDelete) {
      this.logger.warn(`[removeItemFromCart] Cart item ID: ${cartItemId} not found in cart for user: ${userId}.`);
      throw new NotFoundException(`Cart item with ID ${cartItemId} not found in your cart.`);
    }
    this.logger.log(
      `[removeItemFromCart] Cart item ${cartItemId} found in cart ${itemToDelete.cartId}. Proceeding with deletion.`,
    );

    await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });
    this.logger.log(`[removeItemFromCart] Cart item ${cartItemId} deleted successfully.`);

    this.logger.log(`[removeItemFromCart] Checking state of cart ${itemToDelete.cartId} after item removal.`);
    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: itemToDelete.cartId },
      include: this.cartInclude,
    });

    if (!updatedCart || updatedCart.items.length === 0) {
      return { id: null, userId, items: [], subTotal: 0, totalItems: 0, createdAt: null, updatedAt: null };
    }

    this.logger.log(`[removeItemFromCart] Cart ${itemToDelete.cartId} still contains items. Calculating totals.`);
    return this.calculateCartTotals(updatedCart as CartWithDetails);
  }

  async clearCart(userId: string): Promise<EmptyCart> {
    this.logger.log(`[clearCart] Attempting to clear cart for user: ${userId}`);
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      this.logger.log(`[clearCart] No cart found for user: ${userId}. Nothing to clear.`);
      return { id: null, userId, items: [], subTotal: 0, totalItems: 0, createdAt: null, updatedAt: null };
    }
    this.logger.log(`[clearCart] Found cart ID: ${cart.id} for user: ${userId}. Deleting all items.`);

    const deleteResult = await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
    this.logger.log(`[clearCart] Deleted ${deleteResult.count} items from cart ID: ${cart.id}.`);

    // Delete the cart itself after clearing items
    this.logger.log(`[clearCart] Deleting the empty cart record ID: ${cart.id}.`);
    await this.prisma.cart.delete({ where: { id: cart.id } });

    this.logger.log(`[clearCart] Cart cleared successfully for user: ${userId}. Returning empty structure.`);
    return { id: null, userId, items: [], subTotal: 0, totalItems: 0, createdAt: null, updatedAt: null };
  }
}
