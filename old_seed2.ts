import { PrismaClient, ProductStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const COLORS = [
  { name: "Bone", hex: "#f5f3ee" },
  { name: "Fog", hex: "#e8e4dd" },
  { name: "Graphite", hex: "#2d2d2d" },
  { name: "Ink", hex: "#0d0d0d" },
  { name: "Ember", hex: "#c84b1e" },
  { name: "Forest", hex: "#2f4a3a" },
];

const CATEGORIES = [
  { name: "Oversized Tees", slug: "oversized-tees" },
  { name: "Graphic Tees", slug: "graphic-tees" },
  { name: "Hoodies", slug: "hoodies" },
  { name: "Sweatshirts", slug: "sweatshirts" },
  { name: "Jackets", slug: "jackets" },
  { name: "Anime", slug: "anime" },
  { name: "Mobile Covers", slug: "mobile-covers" },
  { name: "Mugs", slug: "mugs" },
  { name: "Tote Bags", slug: "tote-bags" },
  { name: "Posters", slug: "posters" },
];

const PRODUCTS_MOCK = [
  {
    slug: "monolith-oversized-hoodie",
    title: "Monolith Oversized Hoodie",
    categorySlug: "hoodies",
    description:
      "Heavyweight 400gsm brushed fleece. Dropped shoulders, boxy fit, tonal embroidery.",
    price: 3299,
    imgIds: ["photo-1550614000-4b95d466f2fb", "photo-1523398002811-999aa8d9511e"],
    tags: ["oversized", "bestseller", "trending"],
    isFeatured: true,
  },
  {
    slug: "void-heavyweight-tee",
    title: "Void Heavyweight Tee",
    categorySlug: "oversized-tees",
    description: "240gsm combed cotton. Garment-dyed for a lived-in feel and ultimate drape.",
    price: 1499,
    imgIds: ["photo-1539109136881-3be0616acf4b", "photo-1512436991641-6745cdb1723f"],
    tags: ["oversized", "new"],
    isFeatured: true,
  },
  {
    slug: "shogun-bomber-jacket",
    title: "Shogun Bomber Jacket",
    categorySlug: "jackets",
    description: "Satin finish with intricate back embroidery. Premium hardware and ribbed trims.",
    price: 5499,
    imgIds: ["photo-1492288991661-058aa541ff43", "photo-1552374196-1ab2a1c593e8"],
    tags: ["anime", "limited", "trending"],
    isFeatured: true,
  },
  {
    slug: "crimson-denim-jacket",
    title: "Crimson Denim Jacket",
    categorySlug: "jackets",
    description: "Overdyed 12oz denim. Cropped fit with raw hem detailing and silver hardware.",
    price: 4299,
    imgIds: ["photo-1529139574466-a303027c1d8b", "photo-1487222477894-8943e31ef7b2"],
    tags: ["limited", "new"],
    isFeatured: false,
  },
  {
    slug: "phantom-graphic-tee",
    title: "Phantom Graphic Tee",
    categorySlug: "graphic-tees",
    description: "Screen-printed vintage artwork on our signature washed cotton canvas.",
    price: 1699,
    imgIds: ["photo-1483985988355-763728e1935b", "photo-1503342217505-b0a15ec3261c"],
    tags: ["bestseller"],
    isFeatured: false,
  },
  {
    slug: "yurei-oversized-hoodie",
    title: "Yurei Oversized Hoodie",
    categorySlug: "hoodies",
    description:
      "Cocoon silhouette in ultra-soft fleece. Features elongated drawstrings and hidden pockets.",
    price: 3499,
    imgIds: ["photo-1507680434267-3236ca9eece4", "photo-1620799140408-edc6dcb6d633"],
    tags: ["oversized", "new"],
    isFeatured: false,
  },
  {
    slug: "noir-trench-coat",
    title: "Noir Trench Coat",
    categorySlug: "jackets",
    description:
      "A modern, draped take on the classic trench. Water-resistant and incredibly sharp.",
    price: 6499,
    imgIds: ["photo-1515886657613-9f3515b0c78f", "photo-1551028719-00167b16eac5"],
    tags: ["limited"],
    isFeatured: true,
  },
  {
    slug: "ronin-vintage-tee",
    title: "Ronin Vintage Tee",
    categorySlug: "graphic-tees",
    description:
      "Faded and distressed by hand. Features washed-out typography and dropped shoulders.",
    price: 1599,
    imgIds: ["photo-1517841905240-472988babdf9", "photo-1521572163474-6864f9cf17ab"],
    tags: ["trending"],
    isFeatured: false,
  },
];

async function main() {
  console.log("🌱 Seeding DB...");

  // Clean tables
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.drop.deleteMany({});

  // Seed Categories
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const record = await prisma.category.create({
      data: { name: cat.name, slug: cat.slug },
    });
    categoryMap.set(cat.slug, record.id);
  }
  console.log(`✅ Seeded ${categoryMap.size} categories.`);

  // Seed Collections
  const collection = await prisma.collection.create({
    data: {
      name: "Summer Collection",
      slug: "summer-collection",
      description: "Lightweight styles for hot seasons",
      isActive: true,
    },
  });
  console.log("✅ Seeded Summer Collection.");

  // Seed Drops
  const drop = await prisma.drop.create({
    data: {
      name: "Anime Capsule Vol. 03",
      slug: "anime-capsule-03",
      releaseDate: new Date(),
      isActive: true,
    },
  });
  console.log("✅ Seeded active Drop.");

  // Seed Products and Variants
  for (const p of PRODUCTS_MOCK) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) {
      console.warn(`Category not found for slug: ${p.categorySlug}`);
      continue;
    }

    const imageUrls = p.imgIds.map(
      (id) => `https://images.unsplash.com/${id}?w=1200&q=80&auto=format&fit=crop`,
    );

    const productRecord = await prisma.product.create({
      data: {
        title: p.title,
        slug: p.slug,
        description: p.description,
        basePrice: p.price,
        isFeatured: p.isFeatured,
        mediaUrls: imageUrls,
        status: ProductStatus.PUBLISHED,
        categoryId: categoryId,
        tags: p.tags,
        dropId: p.categorySlug === "anime" ? drop.id : null,
      },
    });

    // Create unique variants for sizes and colors
    // Use Bone, Graphite, Ink, Forest as default variants
    const colors = COLORS.slice(0, 3);
    for (const color of colors) {
      for (const size of SIZES) {
        await prisma.productVariant.create({
          data: {
            productId: productRecord.id,
            sku: `${p.slug.toUpperCase().slice(0, 10)}-${color.name.toUpperCase().slice(0, 3)}-${size}`,
            size,
            color: color.name,
            stockQuantity: 50, // 50 items stock
            mediaUrls: imageUrls,
            thumbnailUrl: imageUrls[0],
          },
        });
      }
    }
  }

  console.log(`✅ Seeded ${PRODUCTS_MOCK.length} products with variants.`);
  console.log("🌱 Database Seeding Completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
