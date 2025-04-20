import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserAddress } from '@prisma/client';
import { CartService } from 'src/cart/cart.service';
import { CalculatedCart } from 'src/cart/types/cart.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatusEnum } from './enums/order-status.enum';
import { generateOrderNumber } from './order-number.util';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  // Define includes for detailed order fetching
  private readonly orderIncludeDetails: Prisma.OrderInclude = {
    items: {
      include: {
        productItem: {
          select: {
            id: true,
            sku: true,
            // Optionally include product details if needed (depends on OrderItem snapshot)
            // product: { select: { name: true, slug: true } }
          },
        },
      },
    },
    orderStatus: true,
    user: { select: { id: true, email: true, firstName: true, lastName: true } }, // Include more user details
  };

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    this.logger.log(`[createOrder] User: ${userId} attempting to create order.`);

    // 1. Fetch User's Cart
    this.logger.log(`[createOrder] Fetching cart for user: ${userId}`);
    const cart = await this.cartService.getCart(userId);

    // Type guard to ensure cart is not EmptyCart
    if (!cart || !('items' in cart) || cart.items.length === 0) {
      this.logger.warn(`[createOrder] User: ${userId} attempted to create order with an empty cart.`);
      throw new BadRequestException('Cannot create order with an empty cart.');
    }
    this.logger.log(`[createOrder] Cart ID: ${cart.id} fetched with ${cart.totalItems} items.`);

    // Ensure cart is of type CalculatedCart for further processing
    const calculatedCart = cart as CalculatedCart;

    // 2. Fetch Shipping and Billing Addresses
    this.logger.log(
      `[createOrder] Fetching addresses for user: ${userId}. Shipping ID: ${createOrderDto.shippingAddressId}, Billing ID: ${createOrderDto.billingAddressId ?? 'N/A'}`,
    );
    const addresses = await this.prisma.userAddress.findMany({
      where: {
        userId: userId,
        id: {
          in: [createOrderDto.shippingAddressId, createOrderDto.billingAddressId].filter(Boolean) as string[],
        },
      },
      include: { country: true }, // Include country details
    });

    const shippingAddress = addresses.find((addr) => addr.id === createOrderDto.shippingAddressId);
    const billingAddress = createOrderDto.billingAddressId
      ? addresses.find((addr) => addr.id === createOrderDto.billingAddressId)
      : shippingAddress; // Use shipping address if billing is not provided

    if (!shippingAddress) {
      this.logger.warn(
        `[createOrder] Shipping address ID: ${createOrderDto.shippingAddressId} not found for user: ${userId}.`,
      );
      throw new NotFoundException(`Shipping address with ID ${createOrderDto.shippingAddressId} not found.`);
    }
    if (createOrderDto.billingAddressId && !billingAddress) {
      this.logger.warn(
        `[createOrder] Billing address ID: ${createOrderDto.billingAddressId} specified but not found for user: ${userId}.`,
      );
      throw new NotFoundException(`Billing address with ID ${createOrderDto.billingAddressId} not found.`);
    }
    this.logger.log(`[createOrder] Addresses validated successfully for user: ${userId}.`);

    // Convert addresses to JSON for snapshotting (excluding sensitive fields if necessary)
    const shippingAddressJson = this.addressToJson(shippingAddress);
    const billingAddressJson = this.addressToJson(billingAddress);

    // 3. Get Default Order Status (e.g., "PENDING")
    this.logger.log(`[createOrder] Fetching default order status: ${OrderStatusEnum.PENDING}.`);
    const defaultStatus = await this.prisma.orderStatus.findUnique({
      where: { status: OrderStatusEnum.PENDING },
      select: { id: true },
    });
    if (!defaultStatus) {
      this.logger.error(`[createOrder] Default order status '${OrderStatusEnum.PENDING}' not found in database.`);
      throw new InternalServerErrorException('Could not initialize order status.');
    }
    this.logger.log(`[createOrder] Default order status ID: ${defaultStatus.id}`);

    // 4. Generate Unique Order Number
    const orderNumber = generateOrderNumber();
    this.logger.log(`[createOrder] Generated order number: ${orderNumber}`);

    // 5. Start Prisma Transaction
    this.logger.log(`[createOrder] Starting transaction for user ${userId}, cart ${cart.id}.`);
    try {
      const createdOrder = await this.prisma.$transaction(async (tx) => {
        this.logger.log(`[createOrder TX] Verifying stock and preparing order items.`);
        const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = [];
        const stockUpdates: Promise<any>[] = [];

        for (const cartItem of calculatedCart.items) {
          const productItem = await tx.productItem.findUnique({
            where: { id: cartItem.productItemId },
            select: {
              stock: true,
              salePrice: true,
              originalPrice: true,
              sku: true,
              product: { select: { name: true } },
              images: { where: { isPrimary: true }, select: { image: { select: { url: true } } }, take: 1 },
            }, // Fetch necessary fields for snapshot and stock check
          });

          if (!productItem || productItem.stock < cartItem.quantity) {
            this.logger.warn(
              `[createOrder TX] Insufficient stock for item ${cartItem.productItemId} during transaction. Required: ${cartItem.quantity}, Available: ${productItem?.stock ?? 0}`,
            );
            throw new BadRequestException(
              `Insufficient stock for product ${cartItem.productItem.product.name} (Item ID: ${cartItem.productItemId}). Available: ${productItem?.stock ?? 0}`,
            );
          }

          // Prepare OrderItem data (snapshot)
          const pricePerItem = productItem.salePrice ?? productItem.originalPrice;
          const totalPrice = Number(pricePerItem) * cartItem.quantity;
          const primaryImageUrl = productItem.images?.[0]?.image?.url;

          orderItemsData.push({
            productItemId: cartItem.productItemId,
            quantity: cartItem.quantity,
            pricePerItem: Number(pricePerItem),
            totalPrice: totalPrice,
            // Snapshots
            productName: cartItem.productItem.product.name,
            productSku: productItem.sku,
            productImage: primaryImageUrl,
          });

          // Prepare stock decrement operation
          stockUpdates.push(
            tx.productItem.update({
              where: { id: cartItem.productItemId },
              data: { stock: { decrement: cartItem.quantity } },
            }),
          );
        }
        this.logger.log(`[createOrder TX] Stock verified for all ${orderItemsData.length} items.`);

        // b. Create Order
        this.logger.log(`[createOrder TX] Creating Order record.`);
        const order = await tx.order.create({
          data: {
            userId: userId,
            orderNumber: orderNumber,
            orderStatusId: defaultStatus.id,
            subTotal: calculatedCart.subTotal,
            totalAmount: calculatedCart.subTotal, // Recalculate properly later
            shippingCost: 0,
            taxAmount: 0,
            discountAmount: 0,
            paymentStatus: 'PENDING',
            shippingAddress: shippingAddressJson,
            billingAddress: billingAddressJson,
            items: {
              createMany: {
                data: orderItemsData,
              },
            },
          },
          include: this.orderIncludeDetails,
        });
        this.logger.log(`[createOrder TX] Order record created with ID: ${order.id}`);

        // c. Decrement Stock
        this.logger.log(`[createOrder TX] Executing ${stockUpdates.length} stock decrement operations.`);
        await Promise.all(stockUpdates);
        this.logger.log(`[createOrder TX] Stock decremented successfully.`);

        // d. Clear User's Cart
        this.logger.log(`[createOrder TX] Clearing cart ID: ${calculatedCart.id} for user: ${userId}`);
        // Using the base clearCart logic which deletes items and the cart
        await this.cartService.clearCart(userId); // Note: This makes a separate DB call outside the TX scope by default.
        // For full atomicity, cart clearing logic should ideally be passed the transaction client (tx)
        // await tx.cartItem.deleteMany({ where: { cartId: calculatedCart.id } });
        // await tx.cart.delete({ where: { id: calculatedCart.id } });
        this.logger.log(`[createOrder TX] Cart cleared.`);

        this.logger.log(`[createOrder TX] Transaction completed successfully for order ID: ${order.id}`);
        return order;
      }); // End of transaction

      this.logger.log(`[createOrder] Order ${createdOrder.id} created successfully for user ${userId}.`);
      return createdOrder;
    } catch (error) {
      this.logger.error(`[createOrder] Transaction failed for user ${userId}. Error: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error; // Re-throw client errors
      }
      // TODO: Implement more sophisticated error handling/rollback notification if needed
      throw new InternalServerErrorException('Failed to create order due to an internal error.', error.message);
    }
  }

  async findUserOrders(userId: string) {
    this.logger.log(`[findUserOrders] Fetching orders for user: ${userId}`);
    const orders = await this.prisma.order.findMany({
      where: { userId: userId },
      include: {
        orderStatus: { select: { id: true, status: true } },
        _count: { select: { items: true } },
      },
      orderBy: { orderDate: 'desc' }, // Show newest first
    });
    this.logger.log(`[findUserOrders] Found ${orders.length} orders for user: ${userId}`);
    return orders;
  }

  async findUserOrderById(userId: string, orderId: string) {
    this.logger.log(`[findUserOrderById] Fetching order ID: ${orderId} for user: ${userId}`);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId, userId: userId }, // Ensure user owns the order
      include: this.orderIncludeDetails, // Use the detailed include
    });

    if (!order) {
      this.logger.warn(`[findUserOrderById] Order ID: ${orderId} not found for user: ${userId}.`);
      throw new NotFoundException(`Order with ID ${orderId} not found.`);
    }
    this.logger.log(`[findUserOrderById] Order ID: ${orderId} found for user: ${userId}.`);
    return order;
  }

  // Helper to convert address entity to JSON, potentially excluding fields
  private addressToJson(address: UserAddress & { country?: { countryName: string } }): Prisma.JsonValue {
    if (!address) return null;
    // Destructure only the fields defined in UserAddress, excluding relations like 'user'
    const { id, userId, countryId, country, ...addressData } = address;
    // Add countryName if country relation was included
    const result = { ...addressData, countryName: address.country?.countryName };
    // Remove null/undefined values if desired (optional)
    Object.keys(result).forEach((key) => result[key] == null && delete result[key]);
    return result as unknown as Prisma.JsonValue;
  }

  async cancelOrder(userId: string, orderId: string) {
    this.logger.log(`[cancelOrder] User: ${userId} attempting to cancel order ID: ${orderId}`);

    // Fetch target status IDs (Consider caching these)
    const targetStatuses = await this.prisma.orderStatus.findMany({
      where: { status: { in: [OrderStatusEnum.PENDING, OrderStatusEnum.CANCELLED] } },
      select: { id: true, status: true },
    });
    const pendingStatusId = targetStatuses.find((s) => s.status === OrderStatusEnum.PENDING)?.id;
    const cancelledStatusId = targetStatuses.find((s) => s.status === OrderStatusEnum.CANCELLED)?.id;

    if (!pendingStatusId || !cancelledStatusId) {
      this.logger.error(`[cancelOrder] Required order statuses (PENDING or CANCELLED) not found in database.`);
      throw new InternalServerErrorException('Cannot process cancellation due to missing status configuration.');
    }
    this.logger.log(
      `[cancelOrder] Required status IDs fetched: PENDING=${pendingStatusId}, CANCELLED=${cancelledStatusId}`,
    );

    try {
      const cancelledOrder = await this.prisma.$transaction(async (tx) => {
        this.logger.log(`[cancelOrder TX] Starting transaction for order ID: ${orderId}`);

        // 1. Find the order, ensure it belongs to the user and is PENDING
        const order = await tx.order.findUnique({
          where: { id: orderId, userId: userId },
          select: {
            id: true,
            orderStatusId: true,
            items: {
              // Fetch items for stock restoration
              select: { productItemId: true, quantity: true },
            },
          },
        });

        if (!order) {
          this.logger.warn(`[cancelOrder TX] Order ID: ${orderId} not found for user: ${userId}.`);
          // No need to throw NotFoundException here, transaction will rollback gracefully if needed
          // But throwing helps stop the process early if order genuinely doesn't exist for user
          throw new NotFoundException(`Order with ID ${orderId} not found.`);
        }

        if (order.orderStatusId !== pendingStatusId) {
          this.logger.warn(
            `[cancelOrder TX] Order ID: ${orderId} is not in PENDING status (Status ID: ${order.orderStatusId}). Cannot cancel.`,
          );
          throw new BadRequestException(`Order is not in a cancellable state.`);
        }
        this.logger.log(`[cancelOrder TX] Order ${orderId} found and is PENDING.`);

        // 2. Update order status to CANCELLED
        this.logger.log(`[cancelOrder TX] Updating order ${orderId} status to CANCELLED (ID: ${cancelledStatusId}).`);
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { orderStatusId: cancelledStatusId },
          include: this.orderIncludeDetails, // Return full details
        });
        this.logger.log(`[cancelOrder TX] Order ${orderId} status updated.`);

        // 3. Restore stock
        this.logger.log(`[cancelOrder TX] Restoring stock for ${order.items.length} items in order ${orderId}.`);
        const stockRestorePromises = order.items.map((item) =>
          tx.productItem.update({
            where: { id: item.productItemId },
            data: { stock: { increment: item.quantity } },
            select: { id: true }, // Select minimal field
          }),
        );
        await Promise.all(stockRestorePromises);
        this.logger.log(`[cancelOrder TX] Stock restored for order ${orderId}.`);

        this.logger.log(`[cancelOrder TX] Transaction successful for cancelling order ${orderId}.`);
        return updatedOrder;
      }); // End Transaction

      this.logger.log(`[cancelOrder] Order ${orderId} successfully cancelled for user ${userId}.`);
      return cancelledOrder;
    } catch (error) {
      this.logger.error(
        `[cancelOrder] Failed to cancel order ${orderId} for user ${userId}. Error: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error; // Re-throw known client errors
      }
      throw new InternalServerErrorException('Could not cancel order due to an internal error.');
    }
  }

  async updateOrderStatus(orderId: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    const { statusId } = updateOrderStatusDto;
    this.logger.log(`[updateOrderStatus ADMIN] Attempting to update order ID: ${orderId} to status ID: ${statusId}`);

    // 1. Verify the target status ID exists
    const targetStatusExists = await this.prisma.orderStatus.findUnique({
      where: { id: statusId },
      select: { id: true, status: true },
    });

    if (!targetStatusExists) {
      this.logger.warn(`[updateOrderStatus ADMIN] Target status ID: ${statusId} does not exist.`);
      throw new BadRequestException(`Invalid target status ID: ${statusId}.`);
    }
    this.logger.log(
      `[updateOrderStatus ADMIN] Target status ${targetStatusExists.status} (ID: ${statusId}) confirmed valid.`,
    );

    // 2. Find the order (without user check - admin context assumed)
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderStatus: { select: { status: true } } },
    });

    if (!order) {
      this.logger.warn(`[updateOrderStatus ADMIN] Order ID: ${orderId} not found.`);
      throw new NotFoundException(`Order with ID ${orderId} not found.`);
    }

    // TODO: Add business logic here to validate the status transition if needed
    // e.g., check if order.currentStatus allows transition to targetStatusExists.status
    if (
      targetStatusExists.status === OrderStatusEnum.CANCELLED ||
      targetStatusExists.status === OrderStatusEnum.RETURNED
    ) {
      this.logger.warn(`[updateOrderStatus ADMIN] Order ID: ${orderId} cannot be cancelled or returned.`);
      throw new BadRequestException(`Order cannot be cancelled or returned.`);
    }

    if (order.orderStatus.status === OrderStatusEnum.DELIVERED) {
      this.logger.warn(`[updateOrderStatus ADMIN] Order ID: ${orderId} is already delivered. Cannot be updated.`);
      throw new BadRequestException(`Order is already delivered. Cannot be updated.`);
    }

    this.logger.log(`[updateOrderStatus ADMIN] Updating order ${orderId} to status ID: ${statusId}.`);

    // 3. Update the order status
    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: { orderStatusId: statusId },
        include: this.orderIncludeDetails, // Return full details
      });
      this.logger.log(
        `[updateOrderStatus ADMIN] Order ${orderId} status successfully updated to ${targetStatusExists.status} (ID: ${statusId}).`,
      );
      return updatedOrder;
    } catch (error) {
      this.logger.error(
        `[updateOrderStatus ADMIN] Failed to update status for order ${orderId}. Error: ${error.message}`,
        error.stack,
      );
      // Handle potential errors during update (e.g., concurrent modification?)
      throw new InternalServerErrorException('Failed to update order status.');
    }
  }

  // TODO:
  // - Add logic for handling payment status updates.
  // - Add logic for calculating shipping, taxes, discounts properly.
  // - Consider making cart clearing within the transaction truly atomic.
}
