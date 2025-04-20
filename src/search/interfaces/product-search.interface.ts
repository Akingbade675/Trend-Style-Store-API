export interface ProductSearchDocument {
  id: string; // Product ID
  name: string;
  description: string | null;
  slug: string | null; // Use slug if available
  isActive: boolean;
  isFeatured: boolean;
  originalPrice: number;
  salePrice: number;
  skuPrefix: string | null;
  brandName: string | null; // Flattened brand name
  brandId: string | null; // Added Brand ID
  categoryNames: string[]; // Array of category names
  categoryIds: string[]; // Added Category IDs
  tagNames: string[]; // Array of tag names
  tagIds: string[]; // Added Tag IDs
  attributeValues: string[]; // Flattened simple attribute values (e.g., ["Red", "XL", "Cotton"])
  itemSkus: string[]; // SKUs of variations
  imageUrl: string | null; // URL of the primary image
  createdAt: Date;
  updatedAt: Date;
}
