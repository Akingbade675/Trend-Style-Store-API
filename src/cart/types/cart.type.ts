import {
  AttributeType,
  Cart,
  CartItem,
  Media,
  Product,
  ProductAttribute,
  ProductItem,
  ProductItemAttribute,
} from '@prisma/client';

export type CartWithDetails = Cart & {
  items: (CartItem & {
    productItem: ProductItem & {
      product: Pick<Product, 'id' | 'name' | 'slug'>;
      // images: (ProductImage & {
      //   image: Pick<Media, 'url' | 'altText'>;
      // })[];
      images: {
        image: Pick<Media, 'url' | 'altText'>;
      }[];
      attributes: (ProductItemAttribute & {
        productAttribute: ProductAttribute & {
          attributeType: Pick<AttributeType, 'name'>;
        };
      })[];
    };
  })[];
};

// Define a type for the calculated cart result
export type CalculatedCart = CartWithDetails & {
  subTotal: number;
  totalItems: number;
};

// Define a type for the empty cart structure
export type EmptyCart = {
  id: null;
  userId: string;
  items: [];
  subTotal: number;
  totalItems: number;
  createdAt: null;
  updatedAt: null;
};
