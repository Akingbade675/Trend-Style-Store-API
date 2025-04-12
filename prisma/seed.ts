// // prisma/seed.ts
// import { PrismaClient, Prisma, Role, MediaFolder } from '@prisma/client'; // Import Enums
// import * as argon2 from 'argon2'; // Or import * as bcrypt from 'bcrypt';

// const prisma = new PrismaClient();

// // Helper function to hash passwords (use the SAME method as your AuthService)
// async function hashPassword(password: string): Promise<string> {
//   // Using Argon2 (recommended)
//   return argon2.hash(password, {
//     memoryCost: 2 ** 16,
//     timeCost: 4,
//     parallelism: 2,
//     type: argon2.argon2id,
//   });
//   // OR using Bcrypt
//   // const saltRounds = 10;
//   // return bcrypt.hash(password, saltRounds);
// }

// async function main() {
//   console.log(`Start seeding ...`);

//   // --- Optional: Clean existing data (Use with caution!) ---
//   // Delete in an order that respects dependencies
//   console.log('Deleting existing data (optional step)...');
//   // await prisma.userReview.deleteMany();
//   // await prisma.orderItem.deleteMany();
//   // await prisma.order.deleteMany();
//   // await prisma.refreshToken.deleteMany();
//   // await prisma.userAddress.deleteMany();
//   await prisma.productItemAttribute.deleteMany();
//   await prisma.productItemImage.deleteMany(); // New
//   // await prisma.productItem.deleteMany();
//   // await prisma.productAttribute.deleteMany();
//   await prisma.productCategory.deleteMany();
//   await prisma.productTag.deleteMany();
//   await prisma.productImage.deleteMany();
//   // await prisma.product.deleteMany();
//   // await prisma.brandCategory.deleteMany();
//   // await prisma.category.deleteMany(); // Handle self-relation carefully
//   // await prisma.brand.deleteMany();
//   // await prisma.tag.deleteMany();
//   // await prisma.attributeType.deleteMany();
//   // await prisma.orderStatus.deleteMany();
//   await prisma.banner.deleteMany(); // New
//   // await prisma.user.deleteMany();
//   await prisma.media.deleteMany(); // New (Delete before things that link to it if not using cascade/restrict properly)
//   // await prisma.country.deleteMany();
//   // console.log('Existing data deleted.');

//   // --- Seed Core Lookup Data ---

//   console.log('Seeding Countries...');
//   const nigeria = await prisma.country.upsert({
//     where: { countryName: 'Nigeria' },
//     update: {},
//     create: { countryName: 'Nigeria' },
//   });
//   const usa = await prisma.country.upsert({
//     where: { countryName: 'USA' },
//     update: {},
//     create: { countryName: 'USA' },
//   });
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

//   // --- Seed Media Items ---
//   console.log('Seeding Media...');
//   // Use upsert for media if filename+folder should be unique, otherwise use create
//   const mediaAvatarAdmin = await prisma.media.create({
//     data: {
//       filename: 'admin_avatar.png',
//       url: '/uploads/users/admin_avatar.png',
//       folder: MediaFolder.users,
//       altText: 'Admin Avatar',
//       mimeType: 'image/png',
//       size: 10240,
//     },
//   });
//   const mediaAvatarUser = await prisma.media.create({
//     data: {
//       filename: 'user_avatar.png',
//       url: '/uploads/users/user_avatar.png',
//       folder: MediaFolder.users,
//       altText: 'User Avatar',
//       mimeType: 'image/png',
//       size: 9870,
//     },
//   });
//   const mediaBanner1 = await prisma.media.create({
//     data: {
//       filename: 'summer_sale.jpg',
//       url: '/uploads/banners/summer_sale.jpg',
//       folder: MediaFolder.banners,
//       altText: 'Summer Sale Banner',
//       mimeType: 'image/jpeg',
//       size: 150123,
//     },
//   });
//   const mediaBanner2 = await prisma.media.create({
//     data: {
//       filename: 'new_arrivals.webp',
//       url: '/uploads/banners/new_arrivals.webp',
//       folder: MediaFolder.banners,
//       altText: 'New Arrivals Banner',
//       mimeType: 'image/webp',
//       size: 120456,
//     },
//   });
//   const mediaCatMen = await prisma.media.create({
//     data: {
//       filename: 'cat_men.jpg',
//       url: '/uploads/categories/cat_men.jpg',
//       folder: MediaFolder.categories,
//       altText: 'Men Category Image',
//       mimeType: 'image/jpeg',
//       size: 50000,
//     },
//   });
//   const mediaCatWomen = await prisma.media.create({
//     data: {
//       filename: 'cat_women.jpg',
//       url: '/uploads/categories/cat_women.jpg',
//       folder: MediaFolder.categories,
//       altText: 'Women Category Image',
//       mimeType: 'image/jpeg',
//       size: 55000,
//     },
//   });
//   const mediaBrandNike = await prisma.media.create({
//     data: {
//       filename: 'brand_nike.svg',
//       url: '/uploads/brands/brand_nike.svg',
//       folder: MediaFolder.brands,
//       altText: 'Nike Logo',
//       mimeType: 'image/svg+xml',
//       size: 5000,
//     },
//   });
//   const mediaBrandAnkara = await prisma.media.create({
//     data: {
//       filename: 'brand_ankara.png',
//       url: '/uploads/brands/brand_ankara.png',
//       folder: MediaFolder.brands,
//       altText: 'Ankara Styles Logo',
//       mimeType: 'image/png',
//       size: 15000,
//     },
//   });
//   const mediaTshirtWhite = await prisma.media.create({
//     data: {
//       filename: 'tshirt_white.jpg',
//       url: '/uploads/products/tshirt_white.jpg',
//       folder: MediaFolder.products,
//       altText: 'White T-Shirt',
//       mimeType: 'image/jpeg',
//       size: 30000,
//     },
//   });
//   const mediaTshirtBlack = await prisma.media.create({
//     data: {
//       filename: 'tshirt_black.jpg',
//       url: '/uploads/products/tshirt_black.jpg',
//       folder: MediaFolder.products,
//       altText: 'Black T-Shirt',
//       mimeType: 'image/jpeg',
//       size: 31000,
//     },
//   });
//   const mediaTshirtBlue = await prisma.media.create({
//     data: {
//       filename: 'tshirt_blue.jpg',
//       url: '/uploads/products/tshirt_blue.jpg',
//       folder: MediaFolder.products,
//       altText: 'Blue T-Shirt',
//       mimeType: 'image/jpeg',
//       size: 32000,
//     },
//   });
//   const mediaAnkaraDress = await prisma.media.create({
//     data: {
//       filename: 'ankara_dress_main.jpg',
//       url: '/uploads/products/ankara_dress_main.jpg',
//       folder: MediaFolder.products,
//       altText: 'Ankara Print Dress',
//       mimeType: 'image/jpeg',
//       size: 65000,
//     },
//   });
//   console.log('Media seeded.');

//   // --- Seed Brands ---
//   console.log('Seeding Brands...');
//   const brandNike = await prisma.brand.upsert({
//     where: { name: 'Nike' },
//     update: { logoId: mediaBrandNike.id },
//     create: {
//       name: 'Nike',
//       description: 'Sportswear and apparel',
//       isFeatured: true,
//       logoId: mediaBrandNike.id,
//     },
//   });
//   const brandAnkara = await prisma.brand.upsert({
//     where: { name: 'Ankara Styles' },
//     update: { logoId: mediaBrandAnkara.id },
//     create: {
//       name: 'Ankara Styles',
//       description: 'Traditional African prints',
//       isFeatured: true,
//       logoId: mediaBrandAnkara.id,
//     },
//   });
//   const brandGeneric = await prisma.brand.upsert({
//     where: { name: 'Generic Apparel' },
//     update: {},
//     create: { name: 'Generic Apparel', description: 'Basic clothing items' },
//   });
//   console.log('Brands seeded.');

//   // --- Seed Categories ---
//   console.log('Seeding Categories...');
//   const catMen = await prisma.category.upsert({
//     where: { name: 'Men' },
//     update: { imageId: mediaCatMen.id },
//     create: {
//       name: 'Men',
//       description: 'Menswear Collection',
//       isFeatured: true,
//       imageId: mediaCatMen.id,
//     },
//   });
//   const catWomen = await prisma.category.upsert({
//     where: { name: 'Women' },
//     update: { imageId: mediaCatWomen.id },
//     create: {
//       name: 'Women',
//       description: 'Womenswear Collection',
//       isFeatured: true,
//       imageId: mediaCatWomen.id,
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
//     update: { parentId: catMen.id },
//     create: { name: 'Men Shirts', parentId: catMen.id },
//   });
//   const catWomenDresses = await prisma.category.upsert({
//     where: { name: 'Women Dresses' },
//     update: { parentId: catWomen.id },
//     create: { name: 'Women Dresses', parentId: catWomen.id },
//   });
//   console.log('Categories seeded.');

//   // --- Seed Banners ---
//   console.log('Seeding Banners...');
//   await prisma.banner.createMany({
//     data: [
//       { imageId: mediaBanner1.id, targetScreen: 'SalesScreen', isActive: true }, // Example target screen identifier
//       {
//         imageId: mediaBanner2.id,
//         targetScreen: 'NewArrivalsScreen',
//         isActive: true,
//       },
//     ],
//     // Skip if banner with same imageId exists (adjust based on needs)
//   });
//   console.log('Banners seeded.');

//   // --- Seed Users ---
//   console.log('Seeding Users...');
//   const adminPassword = await hashPassword('AdminPass123!');
//   const userPassword = await hashPassword('UserPass123!');

//   const adminUser = await prisma.user.upsert({
//     where: { email: 'admin@trendstyle.com' },
//     update: {
//       // Ensure role and avatar are set if user exists
//       role: Role.ADMIN,
//       avatarId: mediaAvatarAdmin.id,
//     },
//     create: {
//       email: 'admin@trendstyle.com',
//       username: 'admin_trend',
//       password: adminPassword,
//       firstName: 'Admin',
//       lastName: 'User',
//       isEmailVerified: true,
//       role: Role.ADMIN, // Assign ADMIN role
//       avatarId: mediaAvatarAdmin.id, // Link to media avatar
//       phoneNumber: '+2348000000001',
//     },
//   });

//   const regularUser = await prisma.user.upsert({
//     where: { email: 'user@example.com' },
//     update: { avatarId: mediaAvatarUser.id },
//     create: {
//       email: 'user@example.com',
//       username: 'regular_user',
//       password: userPassword,
//       firstName: 'Regular',
//       lastName: 'Customer',
//       isEmailVerified: true,
//       role: Role.CUSTOMER, // Default role
//       avatarId: mediaAvatarUser.id, // Link to media avatar
//       phoneNumber: '+2348000000002',
//     },
//   });
//   console.log('Users seeded.');

//   // --- Seed User Addresses ---
//   console.log('Seeding Addresses...');
//   // Check if address exists before creating to avoid duplicates if script runs multiple times without cleaning
//   const existingAddress1 = await prisma.userAddress.findFirst({
//     where: {
//       userId: regularUser.id,
//       addressLine1: '123 Main Street',
//       city: 'Lagos',
//     },
//   });
//   if (!existingAddress1) {
//     await prisma.userAddress.create({
//       data: {
//         userId: regularUser.id,
//         countryId: nigeria.id,
//         addressLine1: '123 Main Street',
//         city: 'Lagos',
//         region: 'Lagos',
//         postalCode: '100001',
//         isDefault: true,
//         phoneNumber: regularUser.phoneNumber, // Use user's phone if desired
//       },
//     });
//   }
//   const existingAddress2 = await prisma.userAddress.findFirst({
//     where: {
//       userId: regularUser.id,
//       addressLine1: '456 Oak Avenue',
//       city: 'New York',
//     },
//   });
//   if (!existingAddress2) {
//     await prisma.userAddress.create({
//       data: {
//         userId: regularUser.id,
//         countryId: usa.id,
//         addressLine1: '456 Oak Avenue',
//         city: 'New York',
//         region: 'NY',
//         postalCode: '10001',
//         isDefault: false,
//         phoneNumber: '+15551234567',
//       },
//     });
//   }
//   console.log('Addresses seeded.');

//   // --- Seed Products and related data ---
//   console.log('Seeding Products...');

//   // == Product 1: Men's T-Shirt ==
//   // Use upsert to avoid creating duplicate products if seed runs again
//   const productTShirt = await prisma.product.upsert({
//     where: { slug: 'mens-classic-cotton-tshirt' },
//     update: {}, // Define what fields to update if it exists
//     create: {
//       name: "Men's Classic Cotton T-Shirt",
//       slug: 'mens-classic-cotton-tshirt', // Ensure slug is unique
//       description: 'A comfortable and stylish round-neck cotton t-shirt.',
//       originalPrice: 25.0,
//       salePrice: 19.99,
//       isFeatured: true,
//       isActive: true,
//       brandId: brandGeneric.id,
//       // Define Attributes available for this product type *inline*
//       attributes: {
//         create: [
//           { attributeTypeId: attrColor.id, value: 'White' },
//           { attributeTypeId: attrColor.id, value: 'Black' },
//           { attributeTypeId: attrColor.id, value: 'Blue' },
//           { attributeTypeId: attrSize.id, value: 'M' },
//           { attributeTypeId: attrSize.id, value: 'L' },
//           { attributeTypeId: attrSize.id, value: 'XL' },
//           { attributeTypeId: attrMaterial.id, value: 'Cotton' },
//         ],
//       },
//     },
//     include: { attributes: true }, // Include attributes to get IDs later
//   });

//   // Link Categories & Tags separately after upsert to handle potential existing product
//   await prisma.productCategory.createMany({
//     data: [
//       { productId: productTShirt.id, categoryId: catMen.id },
//       { productId: productTShirt.id, categoryId: catMenShirts.id },
//     ],
//   });
//   await prisma.productTag.createMany({
//     data: [
//       { productId: productTShirt.id, tagId: tagCotton.id },
//       { productId: productTShirt.id, tagId: tagSummer.id },
//       { productId: productTShirt.id, tagId: tagSale.id },
//     ],
//   });
//   // Link Product Images
//   await prisma.productImage.createMany({
//     data: [
//       {
//         productId: productTShirt.id,
//         imageId: mediaTshirtWhite.id,
//         isPrimary: true,
//         altText: "Men's Classic T-Shirt White",
//       },
//       {
//         productId: productTShirt.id,
//         imageId: mediaTshirtBlack.id,
//         isPrimary: false,
//         altText: "Men's Classic T-Shirt Black",
//       },
//       {
//         productId: productTShirt.id,
//         imageId: mediaTshirtBlue.id,
//         isPrimary: false,
//         altText: "Men's Classic T-Shirt Blue",
//       },
//     ],
//     // Based on implicit unique constraint between productId and imageId if needed
//   });

//   // Helper to find attribute ID (ensure attributes were fetched/included)
//   const getAttributeId = (
//     product: {
//       id: string;
//       attributes: { id: string; attributeTypeId: string; value: string }[];
//     },
//     typeId: string,
//     value: string,
//   ) => {
//     const attr = product.attributes.find(
//       (a) => a.attributeTypeId === typeId && a.value === value,
//     );
//     if (!attr)
//       throw new Error(
//         `Attribute ${value} for type ${typeId} not found for product ${product.id}`,
//       );
//     return attr.id;
//   };

//   // Create ProductItems (SKUs) for T-Shirt - Use upsert for idempotency
//   const itemTshirtWhiteM = await prisma.productItem.upsert({
//     where: { sku: 'GENTS-TSHIRT-WHT-M' },
//     update: {},
//     create: {
//       productId: productTShirt.id,
//       sku: 'GENTS-TSHIRT-WHT-M',
//       stock: 50,
//       originalPrice: 25.0,
//       salePrice: 19.99,
//       isActive: true,
//     },
//   });
//   const itemTshirtWhiteL = await prisma.productItem.upsert({
//     where: { sku: 'GENTS-TSHIRT-WHT-L' },
//     update: {},
//     create: {
//       productId: productTShirt.id,
//       sku: 'GENTS-TSHIRT-WHT-L',
//       stock: 40,
//       originalPrice: 25.0,
//       salePrice: 19.99,
//       isActive: true,
//     },
//   });
//   const itemTshirtBlackM = await prisma.productItem.upsert({
//     where: { sku: 'GENTS-TSHIRT-BLK-M' },
//     update: {},
//     create: {
//       productId: productTShirt.id,
//       sku: 'GENTS-TSHIRT-BLK-M',
//       stock: 60,
//       originalPrice: 25.0,
//       salePrice: 19.99,
//       isActive: true,
//     },
//   });
//   const itemTshirtBlackL = await prisma.productItem.upsert({
//     where: { sku: 'GENTS-TSHIRT-BLK-L' },
//     update: {},
//     create: {
//       productId: productTShirt.id,
//       sku: 'GENTS-TSHIRT-BLK-L',
//       stock: 35,
//       originalPrice: 25.0,
//       salePrice: 19.99,
//       isActive: true,
//     },
//   });
//   const itemTshirtBlueXL = await prisma.productItem.upsert({
//     where: { sku: 'GENTS-TSHIRT-BLU-XL' },
//     update: {},
//     create: {
//       productId: productTShirt.id,
//       sku: 'GENTS-TSHIRT-BLU-XL',
//       stock: 20,
//       originalPrice: 25.0,
//       salePrice: 21.99,
//       isActive: true,
//     },
//   });

//   // Link ProductItemAttributes
//   await prisma.productItemAttribute.createMany({
//     data: [
//       // White M Item
//       {
//         productItemId: itemTshirtWhiteM.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrColor.id,
//           'White',
//         ),
//       },
//       {
//         productItemId: itemTshirtWhiteM.id,
//         productAttributeId: getAttributeId(productTShirt, attrSize.id, 'M'),
//       },
//       {
//         productItemId: itemTshirtWhiteM.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrMaterial.id,
//           'Cotton',
//         ),
//       },
//       // White L Item
//       {
//         productItemId: itemTshirtWhiteL.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrColor.id,
//           'White',
//         ),
//       },
//       {
//         productItemId: itemTshirtWhiteL.id,
//         productAttributeId: getAttributeId(productTShirt, attrSize.id, 'L'),
//       },
//       {
//         productItemId: itemTshirtWhiteL.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrMaterial.id,
//           'Cotton',
//         ),
//       },
//       // Black M Item
//       {
//         productItemId: itemTshirtBlackM.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrColor.id,
//           'Black',
//         ),
//       },
//       {
//         productItemId: itemTshirtBlackM.id,
//         productAttributeId: getAttributeId(productTShirt, attrSize.id, 'M'),
//       },
//       {
//         productItemId: itemTshirtBlackM.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrMaterial.id,
//           'Cotton',
//         ),
//       },
//       // Black L Item
//       {
//         productItemId: itemTshirtBlackL.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrColor.id,
//           'Black',
//         ),
//       },
//       {
//         productItemId: itemTshirtBlackL.id,
//         productAttributeId: getAttributeId(productTShirt, attrSize.id, 'L'),
//       },
//       {
//         productItemId: itemTshirtBlackL.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrMaterial.id,
//           'Cotton',
//         ),
//       },
//       // Blue XL Item
//       {
//         productItemId: itemTshirtBlueXL.id,
//         productAttributeId: getAttributeId(productTShirt, attrColor.id, 'Blue'),
//       },
//       {
//         productItemId: itemTshirtBlueXL.id,
//         productAttributeId: getAttributeId(productTShirt, attrSize.id, 'XL'),
//       },
//       {
//         productItemId: itemTshirtBlueXL.id,
//         productAttributeId: getAttributeId(
//           productTShirt,
//           attrMaterial.id,
//           'Cotton',
//         ),
//       },
//     ],
//     // Skip if link already exists
//   });

//   // Link ProductItemImages
//   await prisma.productItemImage.createMany({
//     data: [
//       {
//         productItemId: itemTshirtWhiteM.id,
//         imageId: mediaTshirtWhite.id,
//         isPrimary: true,
//       },
//       {
//         productItemId: itemTshirtWhiteL.id,
//         imageId: mediaTshirtWhite.id,
//         isPrimary: true,
//       },
//       {
//         productItemId: itemTshirtBlackM.id,
//         imageId: mediaTshirtBlack.id,
//         isPrimary: true,
//       },
//       {
//         productItemId: itemTshirtBlackL.id,
//         imageId: mediaTshirtBlack.id,
//         isPrimary: true,
//       },
//       {
//         productItemId: itemTshirtBlueXL.id,
//         imageId: mediaTshirtBlue.id,
//         isPrimary: true,
//       },
//     ],
//   });

//   // == Product 2: Ankara Dress == (Similar structure using upsert and linking after)
//   const productAnkaraDress = await prisma.product.upsert({
//     where: { slug: 'womens-vibrant-ankara-print-dress' },
//     update: {},
//     create: {
//       name: "Women's Vibrant Ankara Print Dress",
//       slug: 'womens-vibrant-ankara-print-dress',
//       description:
//         'Beautiful knee-length dress featuring authentic Ankara patterns.',
//       originalPrice: 80.0,
//       salePrice: 69.99,
//       isFeatured: true,
//       isActive: true,
//       brandId: brandAnkara.id,
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

//   await prisma.productCategory.createMany({
//     data: [
//       { productId: productAnkaraDress.id, categoryId: catWomen.id },
//       { productId: productAnkaraDress.id, categoryId: catWomenDresses.id },
//     ],
//   });
//   await prisma.productTag.createMany({
//     data: [
//       { productId: productAnkaraDress.id, tagId: tagNew.id },
//       { productId: productAnkaraDress.id, tagId: tagSummer.id },
//     ],
//   });
//   await prisma.productImage.createMany({
//     data: [
//       {
//         productId: productAnkaraDress.id,
//         imageId: mediaAnkaraDress.id,
//         isPrimary: true,
//         altText: 'Ankara Dress Front',
//       },
//     ],
//   });

//   // Items
//   const itemAnkaraS = await prisma.productItem.upsert({
//     where: { sku: 'ANK-DRESS-S' },
//     update: {},
//     create: {
//       productId: productAnkaraDress.id,
//       sku: 'ANK-DRESS-S',
//       stock: 25,
//       originalPrice: 80.0,
//       salePrice: 69.99,
//     },
//   });
//   const itemAnkaraM = await prisma.productItem.upsert({
//     where: { sku: 'ANK-DRESS-M' },
//     update: {},
//     create: {
//       productId: productAnkaraDress.id,
//       sku: 'ANK-DRESS-M',
//       stock: 30,
//       originalPrice: 80.0,
//       salePrice: 69.99,
//     },
//   });

//   // Item Attributes
//   await prisma.productItemAttribute.createMany({
//     data: [
//       {
//         productItemId: itemAnkaraS.id,
//         productAttributeId: getAttributeId(
//           productAnkaraDress,
//           attrSize.id,
//           'S',
//         ),
//       },
//       {
//         productItemId: itemAnkaraS.id,
//         productAttributeId: getAttributeId(
//           productAnkaraDress,
//           attrMaterial.id,
//           'Wax Print Cotton',
//         ),
//       },
//       {
//         productItemId: itemAnkaraM.id,
//         productAttributeId: getAttributeId(
//           productAnkaraDress,
//           attrSize.id,
//           'M',
//         ),
//       },
//       {
//         productItemId: itemAnkaraM.id,
//         productAttributeId: getAttributeId(
//           productAnkaraDress,
//           attrMaterial.id,
//           'Wax Print Cotton',
//         ),
//       },
//     ],
//   });
//   // Item Images (assuming same image for both sizes here)
//   await prisma.productItemImage.createMany({
//     data: [
//       {
//         productItemId: itemAnkaraS.id,
//         imageId: mediaAnkaraDress.id,
//         isPrimary: true,
//       },
//       {
//         productItemId: itemAnkaraM.id,
//         imageId: mediaAnkaraDress.id,
//         isPrimary: true,
//       },
//     ],
//   });

//   console.log('Products, Items, and related data seeded.');

//   // --- Seed Orders/Reviews (Optional, example kept from previous version) ---
//   console.log('Seeding sample order...');
//   // Use previously created items if needed
//   const orderItemTshirt = itemTshirtWhiteM; // Use an upserted item
//   const orderItemDress = itemAnkaraM; // Use an upserted item

//   // Use create + check to avoid duplicate orders if seed runs multiple times
//   const orderNumber = `SEED-${Date.now()}`;
//   const existingOrder = await prisma.order.findUnique({
//     where: { orderNumber: orderNumber },
//   });
//   if (!existingOrder && orderItemTshirt && orderItemDress) {
//     const order1 = await prisma.order.create({
//       data: {
//         orderNumber: orderNumber,
//         userId: regularUser.id,
//         orderStatusId: statusProcessing.id,
//         totalAmount:
//           orderItemTshirt.salePrice * 1 + orderItemDress.salePrice * 1,
//         paymentStatus: 'Paid',
//         transactionId: `seed_txn_${Date.now()}`,
//         shippingAddress: {
//           addressLine1: '123 Main Street',
//           city: 'Lagos',
//           region: 'Lagos',
//           postalCode: '100001',
//           country: 'Nigeria',
//         },
//         items: {
//           create: [
//             {
//               productItemId: orderItemTshirt.id,
//               quantity: 1,
//               price: orderItemTshirt.salePrice,
//               productName: "Men's Classic Cotton T-Shirt",
//               productSku: orderItemTshirt.sku,
//             },
//             {
//               productItemId: orderItemDress.id,
//               quantity: 1,
//               price: orderItemDress.salePrice,
//               productName: "Women's Vibrant Ankara Print Dress",
//               productSku: orderItemDress.sku,
//             },
//           ],
//         },
//       },
//       include: { items: true },
//     });
//     console.log('Sample order seeded.');

//     // Seed Review
//     console.log('Seeding sample review...');
//     const orderItemToReview = order1.items.find(
//       (i) => i.productItemId === orderItemTshirt.id,
//     );
//     if (orderItemToReview) {
//       await prisma.userReview.create({
//         data: {
//           userId: regularUser.id,
//           orderItemId: orderItemToReview.id,
//           ratingValue: 5,
//           comment: 'Great quality t-shirt, very comfortable!',
//         },
//       });
//       console.log('Sample review seeded.');
//     }
//   } else {
//     console.log(
//       'Sample order already exists or items not found, skipping order seeding.',
//     );
//   }
// } // End of main function

// main()
//   .then(async () => {
//     await prisma.$disconnect();
//     console.log(`Seeding finished.`);
//   })
//   .catch(async (e) => {
//     console.error('Error during seeding:', e);
//     await prisma.$disconnect();
//     process.exit(1);
//   });
