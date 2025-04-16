import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserWithoutPassword } from 'src/auth/auth.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/roles-enum';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService } from './orders.service';

@ApiTags('User Orders')
@ApiBearerAuth()
@Roles(Role.CUSTOMER)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new order from the user's cart" })
  @ApiResponse({ status: 201, description: 'Order successfully created.' /* type: Order */ })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., empty cart, insufficient stock, invalid address ID).' })
  @ApiResponse({ status: 404, description: 'Not Found (e.g., address not found).' })
  @ApiResponse({ status: 500, description: 'Internal Server Error (e.g., transaction failure).' })
  createOrder(@CurrentUser() user: UserWithoutPassword, @Body() createOrderDto: CreateOrderDto) {
    return this.orderService.createOrder(user.id, createOrderDto);
  }

  @Get('my')
  @ApiOperation({ summary: "Get a list of the current user's orders" })
  @ApiResponse({ status: 200, description: 'List of user orders retrieved.' /* type: [OrderSummaryDto] */ })
  getUserOrders(@CurrentUser() user: UserWithoutPassword) {
    return this.orderService.findUserOrders(user.id);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get details of a specific order' })
  @ApiParam({ name: 'orderId', description: 'ID of the order to retrieve', type: String })
  @ApiResponse({ status: 200, description: 'Order details retrieved.' /* type: Order */ })
  @ApiResponse({ status: 404, description: 'Order not found or does not belong to the user.' })
  getUserOrderById(@CurrentUser() user: UserWithoutPassword, @Param('orderId', ParseMongoIdPipe) orderId: string) {
    return this.orderService.findUserOrderById(user.id, orderId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({ name: 'id', description: 'ID of the order to cancel', type: String })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully.' })
  @ApiResponse({ status: 404, description: 'Order not found or does not belong to the user.' })
  cancelOrder(@CurrentUser() user: UserWithoutPassword, @Param('id', ParseMongoIdPipe) id: string) {
    return this.orderService.cancelOrder(user.id, id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update the status of an order' })
  @ApiParam({ name: 'id', description: 'ID of the order to update', type: String })
  @ApiResponse({ status: 200, description: 'Order status updated successfully.' })
  @ApiResponse({ status: 404, description: 'Order not found or does not belong to the user.' })
  updateOrderStatus(@Param('id', ParseMongoIdPipe) id: string, @Body() updateOrderStatusDto: UpdateOrderStatusDto) {
    return this.orderService.updateOrderStatus(id, updateOrderStatusDto);
  }
}
