/**
 * Represents the possible statuses of an order.
 * These should ideally correspond to the 'status' field
 * in the OrderStatus table in the database.
 */
export enum OrderStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  // Add any other statuses you have
}
