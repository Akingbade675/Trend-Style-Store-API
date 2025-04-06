// prisma/seed.ts
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2'; // Or import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper function to hash passwords (use the SAME method as your AuthService)
async function hashPassword(password: string): Promise<string> {
  console.log(process.env.PASSWORD_SECRET);
  // Using Argon2 (recommended)
  return argon2.hash(password, {
    // Use secrets/salts/params consistent with your AuthService if customized there
    secret: Buffer.from(process.env.PASSWORD_SECRET, 'utf-8'),
    memoryCost: 65536,
    timeCost: 4,
    parallelism: 1,
    type: 2,
  });

  // OR using Bcrypt
  // const saltRounds = 10;
  // return bcrypt.hash(password, saltRounds);
}

async function main() {
  console.log(`Start seeding ...`);

  // --- Optional: Clean existing data (Use with caution!) ---
  // Delete in reverse order of dependency or handle relations carefully
  // console.log('Deleting existing data (optional step)...');
  // await prisma.userReview.deleteMany(); // Depends on OrderItem, User
  // await prisma.orderItem.deleteMany(); // Depends on Order, ProductItem
  // await prisma.order.deleteMany(); // Depends on User, OrderStatus
  // await prisma.refreshToken.deleteMany(); // Depends on User
  // await prisma.userAddress.deleteMany(); // Depends on User, Country
  // await prisma.productItemAttribute.deleteMany(); // Depends on ProductItem, ProductAttribute
  // await prisma.productItem.deleteMany(); // Depends on Product
  // await prisma.productAttribute.deleteMany(); // Depends on Product, AttributeType
  // await prisma.productCategory.deleteMany(); // Depends on Product, Category
  // await prisma.productTag.deleteMany(); // Depends on Product, Tag
  // await prisma.productImage.deleteMany(); // Depends on Product
  // await prisma.product.deleteMany(); // Depends on Brand
  // await prisma.brandCategory.deleteMany(); // Depends on Brand, Category
  // await prisma.category.deleteMany(); // Handle self-relation carefully if clearing
  // await prisma.brand.deleteMany();
  // await prisma.tag.deleteMany();
  // await prisma.attributeType.deleteMany();
  // await prisma.orderStatus.deleteMany();
  // await prisma.user.deleteMany(); // Depends on nothing fundamental
  // await prisma.country.deleteMany();
  // console.log('Existing data deleted.');

  //   // --- Seed Core Lookup Data ---

  console.log('Seeding Countries...');
  const nigeria = await prisma.country.upsert({
    where: { countryName: 'Nigeria' },
    update: {},
    create: { countryName: 'Nigeria' },
  });
  const usa = await prisma.country.upsert({
    where: { countryName: 'USA' },
    update: {},
    create: { countryName: 'USA' },
  });
  //   const uk = await prisma.country.upsert({
  //     where: { countryName: 'UK' },
  //     update: {},
  //     create: { countryName: 'UK' },
  //   });
  //   console.log('Countries seeded.');

  //   console.log('Seeding Order Statuses...');
  //   const statusPending = await prisma.orderStatus.upsert({
  //     where: { status: 'Pending' },
  //     update: {},
  //     create: { status: 'Pending' },
  //   });
  //   const statusProcessing = await prisma.orderStatus.upsert({
  //     where: { status: 'Processing' },
  //     update: {},
  //     create: { status: 'Processing' },
  //   });
  //   const statusShipped = await prisma.orderStatus.upsert({
  //     where: { status: 'Shipped' },
  //     update: {},
  //     create: { status: 'Shipped' },
  //   });
  //   const statusDelivered = await prisma.orderStatus.upsert({
  //     where: { status: 'Delivered' },
  //     update: {},
  //     create: { status: 'Delivered' },
  //   });
  //   const statusCancelled = await prisma.orderStatus.upsert({
  //     where: { status: 'Cancelled' },
  //     update: {},
  //     create: { status: 'Cancelled' },
  //   });
  //   console.log('Order Statuses seeded.');

  //   console.log('Seeding Attribute Types...');
  //   const attrColor = await prisma.attributeType.upsert({
  //     where: { name: 'Color' },
  //     update: {},
  //     create: { name: 'Color', description: 'Product Color' },
  //   });
  //   const attrSize = await prisma.attributeType.upsert({
  //     where: { name: 'Size' },
  //     update: {},
  //     create: { name: 'Size', description: 'Product Size (e.g., S, M, L, XL)' },
  //   });
  //   const attrMaterial = await prisma.attributeType.upsert({
  //     where: { name: 'Material' },
  //     update: {},
  //     create: { name: 'Material', description: 'Main material used' },
  //   });
  //   console.log('Attribute Types seeded.');

  //   console.log('Seeding Tags...');
  //   const tagSale = await prisma.tag.upsert({
  //     where: { name: 'Sale' },
  //     update: {},
  //     create: { name: 'Sale' },
  //   });
  //   const tagNew = await prisma.tag.upsert({
  //     where: { name: 'New Arrival' },
  //     update: {},
  //     create: { name: 'New Arrival' },
  //   });
  //   const tagSummer = await prisma.tag.upsert({
  //     where: { name: 'Summer' },
  //     update: {},
  //     create: { name: 'Summer' },
  //   });
  //   const tagCotton = await prisma.tag.upsert({
  //     where: { name: 'Cotton' },
  //     update: {},
  //     create: { name: 'Cotton' },
  //   });
  //   console.log('Tags seeded.');

  //   console.log('Seeding Brands...');
  //   const brandNike = await prisma.brand.upsert({
  //     where: { name: 'Nike' },
  //     update: {},
  //     create: {
  //       name: 'Nike',
  //       description: 'Sportswear and apparel',
  //       isFeatured: true,
  //     },
  //   });
  //   const brandAnkara = await prisma.brand.upsert({
  //     where: { name: 'Ankara Styles' },
  //     update: {},
  //     create: {
  //       name: 'Ankara Styles',
  //       description: 'Traditional African prints',
  //       isFeatured: true,
  //     },
  //   });
  //   const brandGeneric = await prisma.brand.upsert({
  //     where: { name: 'Generic Apparel' },
  //     update: {},
  //     create: { name: 'Generic Apparel', description: 'Basic clothing items' },
  //   });
  //   console.log('Brands seeded.');

  //   console.log('Seeding Categories...');
  //   const catMen = await prisma.category.upsert({
  //     where: { name: 'Men' },
  //     update: {},
  //     create: {
  //       name: 'Men',
  //       description: 'Menswear Collection',
  //       isFeatured: true,
  //     },
  //   });
  //   const catWomen = await prisma.category.upsert({
  //     where: { name: 'Women' },
  //     update: {},
  //     create: {
  //       name: 'Women',
  //       description: 'Womenswear Collection',
  //       isFeatured: true,
  //     },
  //   });
  //   const catElectronics = await prisma.category.upsert({
  //     where: { name: 'Electronics' },
  //     update: {},
  //     create: { name: 'Electronics', description: 'Gadgets and Devices' },
  //   });

  //   // Subcategories
  //   const catMenShirts = await prisma.category.upsert({
  //     where: { name: 'Men Shirts' },
  //     update: {},
  //     create: { name: 'Men Shirts', parentId: catMen.id },
  //   });
  //   const catWomenDresses = await prisma.category.upsert({
  //     where: { name: 'Women Dresses' },
  //     update: {},
  //     create: { name: 'Women Dresses', parentId: catWomen.id },
  //   });
  //   console.log('Categories seeded.');

  // --- Seed Users ---
  console.log('Seeding Users...');
  const adminPassword = await hashPassword('AdminPass123!'); // Use strong passwords
  const userPassword = await hashPassword('UserPass123!');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@trendstyle.com' },
    update: {}, // Update fields if user exists, e.g., ensure password hash is updated
    create: {
      email: 'admin@trendstyle.com',
      username: 'admin_trend',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      isEmailVerified: true, // Assume admin is pre-verified
      phoneNumber: '+2348000000001',
      avatar: 'https://example.com/avatar/admin.png',
      role: 'ADMIN',
    },
  });

  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      username: 'regular_user',
      password: userPassword,
      firstName: 'Regular',
      lastName: 'Customer',
      isEmailVerified: true, // Seed as verified for easier testing
      phoneNumber: '+2348000000002',
      avatar: 'https://example.com/avatar/user.png',
    },
  });
  console.log('Users seeded.');

  // --- Seed User Addresses ---
  console.log('Seeding Addresses...');
  await prisma.userAddress.create({
    data: {
      userId: regularUser.id,
      countryId: nigeria.id,
      addressLine1: '123 Main Street',
      city: 'Lagos',
      region: 'Lagos',
      postalCode: '100001',
      isDefault: false,
    },
  });
  await prisma.userAddress.create({
    data: {
      userId: regularUser.id,
      countryId: usa.id,
      addressLine1: '456 Oak Avenue',
      city: 'New York',
      region: 'NY',
      postalCode: '10001',
      isDefault: false,
    },
  });
  console.log('Addresses seeded.');

  //   // --- Seed Products and related data ---
  //   console.log('Seeding Products...');

  //   // == Product 1: Men's T-Shirt ==
  //   const productTShirt = await prisma.product.create({
  //     data: {
  //       name: "Men's Classic Cotton T-Shirt",
  //       slug: 'mens-classic-cotton-tshirt',
  //       description: 'A comfortable and stylish round-neck cotton t-shirt.',
  //       originalPrice: 25.0,
  //       salePrice: 19.99,
  //       isFeatured: true,
  //       isActive: true,
  //       brandId: brandGeneric.id,
  //       // Categories (using join table)
  //       categoryId: catMen.id,
  //       // Tags (using join table)
  //       tags: {
  //         create: [
  //           { tagId: tagCotton.id },
  //           { tagId: tagSummer.id },
  //           { tagId: tagSale.id },
  //         ],
  //       },
  //       // Images
  //       images: {
  //         create: [
  //           {
  //             imageUrl: 'https://example.com/images/tshirt_default.jpg',
  //             isPrimary: true,
  //             altText: "Men's Classic T-Shirt",
  //           },
  //           {
  //             imageUrl: 'https://example.com/images/tshirt_back.jpg',
  //             altText: "Men's Classic T-Shirt Back View",
  //           },
  //         ],
  //       },
  //       // Define Attributes available for this product type
  //       attributes: {
  //         create: [
  //           // Colors
  //           { attributeTypeId: attrColor.id, value: 'White' },
  //           { attributeTypeId: attrColor.id, value: 'Black' },
  //           { attributeTypeId: attrColor.id, value: 'Blue' },
  //           // Sizes
  //           { attributeTypeId: attrSize.id, value: 'M' },
  //           { attributeTypeId: attrSize.id, value: 'L' },
  //           { attributeTypeId: attrSize.id, value: 'XL' },
  //           // Material
  //           { attributeTypeId: attrMaterial.id, value: 'Cotton' },
  //         ],
  //       },
  //     },
  //     // Include created attributes to get their IDs for linking items
  //     include: { attributes: true },
  //   });

  //   // Helper to find attribute ID based on type and value for *this specific product*
  //   const getAttributeId = (typeId: string, value: string) => {
  //     const attr = productTShirt.attributes.find(
  //       (a) => a.attributeTypeId === typeId && a.value === value,
  //     );
  //     if (!attr)
  //       throw new Error(
  //         `Attribute ${value} for type ${typeId} not found for product ${productTShirt.id}`,
  //       );
  //     return attr.id;
  //   };

  //   // Create ProductItems (SKUs) for T-Shirt
  //   await prisma.productItem.createMany({
  //     data: [
  //       // White M
  //       {
  //         productId: productTShirt.id,
  //         sku: 'GENTS-TSHIRT-WHT-M',
  //         stock: 50,
  //         originalPrice: 25.0,
  //         salePrice: 19.99,
  //         isActive: true,
  //       },
  //       // White L
  //       {
  //         productId: productTShirt.id,
  //         sku: 'GENTS-TSHIRT-WHT-L',
  //         stock: 40,
  //         originalPrice: 25.0,
  //         salePrice: 19.99,
  //         isActive: true,
  //       },
  //       // Black M
  //       {
  //         productId: productTShirt.id,
  //         sku: 'GENTS-TSHIRT-BLK-M',
  //         stock: 60,
  //         originalPrice: 25.0,
  //         salePrice: 19.99,
  //         isActive: true,
  //       },
  //       // Black L
  //       {
  //         productId: productTShirt.id,
  //         sku: 'GENTS-TSHIRT-BLK-L',
  //         stock: 35,
  //         originalPrice: 25.0,
  //         salePrice: 19.99,
  //         isActive: true,
  //       },
  //       // Blue XL
  //       {
  //         productId: productTShirt.id,
  //         sku: 'GENTS-TSHIRT-BLU-XL',
  //         stock: 20,
  //         originalPrice: 25.0,
  //         salePrice: 21.99,
  //         isActive: true,
  //       }, // Slightly different price
  //     ],
  //   });

  //   // Find the created items to link attributes
  //   const tShirtItems = await prisma.productItem.findMany({
  //     where: { productId: productTShirt.id },
  //   });

  //   // Link ProductItemAttributes
  //   await prisma.productItemAttribute.createMany({
  //     data: [
  //       // White M Item
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-WHT-M')!
  //           .id,
  //         productAttributeId: getAttributeId(attrColor.id, 'White'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-WHT-M')!
  //           .id,
  //         productAttributeId: getAttributeId(attrSize.id, 'M'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-WHT-M')!
  //           .id,
  //         productAttributeId: getAttributeId(attrMaterial.id, 'Cotton'),
  //       },
  //       // White L Item
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-WHT-L')!
  //           .id,
  //         productAttributeId: getAttributeId(attrColor.id, 'White'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-WHT-L')!
  //           .id,
  //         productAttributeId: getAttributeId(attrSize.id, 'L'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-WHT-L')!
  //           .id,
  //         productAttributeId: getAttributeId(attrMaterial.id, 'Cotton'),
  //       },
  //       // Black M Item
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLK-M')!
  //           .id,
  //         productAttributeId: getAttributeId(attrColor.id, 'Black'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLK-M')!
  //           .id,
  //         productAttributeId: getAttributeId(attrSize.id, 'M'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLK-M')!
  //           .id,
  //         productAttributeId: getAttributeId(attrMaterial.id, 'Cotton'),
  //       },
  //       // Black L Item
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLK-L')!
  //           .id,
  //         productAttributeId: getAttributeId(attrColor.id, 'Black'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLK-L')!
  //           .id,
  //         productAttributeId: getAttributeId(attrSize.id, 'L'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLK-L')!
  //           .id,
  //         productAttributeId: getAttributeId(attrMaterial.id, 'Cotton'),
  //       },
  //       // Blue XL Item
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLU-XL')!
  //           .id,
  //         productAttributeId: getAttributeId(attrColor.id, 'Blue'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLU-XL')!
  //           .id,
  //         productAttributeId: getAttributeId(attrSize.id, 'XL'),
  //       },
  //       {
  //         productItemId: tShirtItems.find((i) => i.sku === 'GENTS-TSHIRT-BLU-XL')!
  //           .id,
  //         productAttributeId: getAttributeId(attrMaterial.id, 'Cotton'),
  //       },
  //     ],
  //   });

  //   // == Product 2: Ankara Dress ==
  //   const productAnkaraDress = await prisma.product.create({
  //     data: {
  //       name: "Women's Vibrant Ankara Print Dress",
  //       slug: 'womens-vibrant-ankara-print-dress',
  //       description:
  //         'Beautiful knee-length dress featuring authentic Ankara patterns.',
  //       originalPrice: 80.0,
  //       salePrice: 69.99,
  //       isFeatured: true,
  //       isActive: true,
  //       brandId: brandAnkara.id,
  //       //  categories: { create: [{ categoryId: catWomen.id }, { categoryId: catWomenDresses.id }] },
  //       categoryId: catWomen.id, // Connect to subcategory directly
  //       tags: { create: [{ tagId: tagNew.id }, { tagId: tagSummer.id }] },
  //       images: {
  //         create: [
  //           {
  //             imageUrl: 'https://example.com/images/ankara_dress.jpg',
  //             isPrimary: true,
  //             altText: 'Ankara Dress',
  //           },
  //         ],
  //       },
  //       attributes: {
  //         create: [
  //           { attributeTypeId: attrSize.id, value: 'S' },
  //           { attributeTypeId: attrSize.id, value: 'M' },
  //           { attributeTypeId: attrMaterial.id, value: 'Wax Print Cotton' },
  //         ],
  //       },
  //     },
  //     include: { attributes: true },
  //   });

  //   const getAnkaraAttributeId = (typeId: string, value: string) => {
  //     const attr = productAnkaraDress.attributes.find(
  //       (a) => a.attributeTypeId === typeId && a.value === value,
  //     );
  //     if (!attr)
  //       throw new Error(
  //         `Attribute ${value} for type ${typeId} not found for product ${productAnkaraDress.id}`,
  //       );
  //     return attr.id;
  //   };

  //   await prisma.productItem.createMany({
  //     data: [
  //       {
  //         productId: productAnkaraDress.id,
  //         sku: 'ANK-DRESS-S',
  //         stock: 25,
  //         originalPrice: 80.0,
  //         salePrice: 69.99,
  //       },
  //       {
  //         productId: productAnkaraDress.id,
  //         sku: 'ANK-DRESS-M',
  //         stock: 30,
  //         originalPrice: 80.0,
  //         salePrice: 69.99,
  //       },
  //     ],
  //   });

  //   const ankaraItems = await prisma.productItem.findMany({
  //     where: { productId: productAnkaraDress.id },
  //   });

  //   await prisma.productItemAttribute.createMany({
  //     data: [
  //       // S Item
  //       {
  //         productItemId: ankaraItems.find((i) => i.sku === 'ANK-DRESS-S')!.id,
  //         productAttributeId: getAnkaraAttributeId(attrSize.id, 'S'),
  //       },
  //       {
  //         productItemId: ankaraItems.find((i) => i.sku === 'ANK-DRESS-S')!.id,
  //         productAttributeId: getAnkaraAttributeId(
  //           attrMaterial.id,
  //           'Wax Print Cotton',
  //         ),
  //       },
  //       // M Item
  //       {
  //         productItemId: ankaraItems.find((i) => i.sku === 'ANK-DRESS-M')!.id,
  //         productAttributeId: getAnkaraAttributeId(attrSize.id, 'M'),
  //       },
  //       {
  //         productItemId: ankaraItems.find((i) => i.sku === 'ANK-DRESS-M')!.id,
  //         productAttributeId: getAnkaraAttributeId(
  //           attrMaterial.id,
  //           'Wax Print Cotton',
  //         ),
  //       },
  //     ],
  //   });

  //   console.log('Products, Items, and related data seeded.');

  //   // --- Seed other data as needed (e.g., Orders, Reviews for testing) ---
  //   // Example: Create an order
  //   console.log('Seeding sample order...');
  //   const orderItemTshirt = tShirtItems.find(
  //     (i) => i.sku === 'GENTS-TSHIRT-WHT-M',
  //   )!;
  //   const orderItemDress = ankaraItems.find((i) => i.sku === 'ANK-DRESS-M')!;

  //   const order1 = await prisma.order.create({
  //     data: {
  //       userId: regularUser.id,
  //       orderStatusId: statusProcessing.id, // Set initial status
  //       totalAmount: orderItemTshirt.salePrice * 1 + orderItemDress.salePrice * 1,
  //       paymentStatus: 'Paid', // Assume paid for seeding
  //       orderNumber: `ORD-${Date.now()}`, // Unique order number
  //       transactionId: `seed_txn_${Date.now()}`,
  //       shippingAddress: {
  //         // Snapshot of address
  //         addressLine1: '123 Main Street',
  //         city: 'Lagos',
  //         region: 'Lagos',
  //         postalCode: '100001',
  //         country: 'Nigeria', // Could store country name or ID
  //       },
  //       items: {
  //         create: [
  //           {
  //             productItemId: orderItemTshirt.id,
  //             quantity: 1,
  //             price: orderItemTshirt.salePrice, // Price at time of order
  //             productName: productTShirt.name,
  //             productSku: orderItemTshirt.sku,
  //           },
  //           {
  //             productItemId: orderItemDress.id,
  //             quantity: 1,
  //             price: orderItemDress.salePrice,
  //             productName: productAnkaraDress.name,
  //             productSku: orderItemDress.sku,
  //           },
  //         ],
  //       },
  //     },
  //     include: { items: true }, // Include items to get their IDs for review
  //   });
  //   console.log('Sample order seeded.');

  //   // Example: Create a review for an item in the order
  //   console.log('Seeding sample review...');
  //   const orderItemToReview = order1.items.find(
  //     (i) => i.productItemId === orderItemTshirt.id,
  //   );
  //   if (orderItemToReview) {
  //     await prisma.userReview.create({
  //       data: {
  //         userId: regularUser.id,
  //         orderItemId: orderItemToReview.id, // Link review to specific order item
  //         ratingValue: 5,
  //         comment: 'Great quality t-shirt, very comfortable!',
  //       },
  //     });
  //     console.log('Sample review seeded.');
  //   }
} // End of main function

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log(`Seeding finished.`);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
