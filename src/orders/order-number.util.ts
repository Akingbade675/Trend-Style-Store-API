import { randomBytes } from 'crypto';

/**
 * Generates a unique order number.
 * Example format: ORD-YYYYMMDD-HEXSTRING
 * Adjust format as needed.
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const randomPart = randomBytes(4).toString('hex').toUpperCase(); // 8 hex characters

  return `ORD-${year}${month}${day}-${randomPart}`;
}
