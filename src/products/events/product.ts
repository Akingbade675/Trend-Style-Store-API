import { Prisma } from '@prisma/client';

// Define a payload that includes necessary relations for indexing
export type ProductCreatedPayload = Prisma.ProductGetPayload<{
  include: {
    brand: { select: { id: true; name: true } };
    categories: { select: { category: { select: { id: true; name: true } } } };
    tags: { select: { tag: { select: { id: true; name: true } } } };
    attributes: { select: { value: true } };
    items: { select: { sku: true } };
    images: { where: { isPrimary: true }; take: 1; select: { image: { select: { url: true } } } };
  };
}>;

export class ProductCreatedEvent {
  constructor(public readonly product: ProductCreatedPayload) {}
}

export type ProductUpdatedPayload = Partial<ProductCreatedPayload>;
export class ProductUpdatedEvent {
  constructor(public readonly product: ProductUpdatedPayload) {}
}

export class ProductDeletedEvent {
  constructor(public readonly productId: string) {}
}
