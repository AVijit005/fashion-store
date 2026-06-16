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
    slug: "void-oversized-tee",
    title: "Void Oversized Tee",
    categorySlug: "oversized-tees",
    description:
      "Heavyweight 240gsm cotton. Cut for drape. Combed cotton, garment-dyed for a lived-in feel.",
    price: 1299,
    imgIds: ["photo-1581655353564-df123a1eb820", "photo-1503341504253-dff4815485f1"],
    tags: ["oversized", "bestseller"],
    isFeatured: true,
  },
  {
    slug: "shogun-anime-tee",
    title: "Shogun Anime Tee",
    categorySlug: "anime",
    description:
      "Limited art collab. Original poster art from the Shogun series, screen-printed on heavyweight cotton.",
    price: 1499,
    imgIds: ["photo-1554568218-0f1715e72254", "photo-1583743814966-8936f5b7be1a"],
    tags: ["anime", "limited", "trending"],
    isFeatured: true,
  },
  {
    slug: "static-noise-tee",
    title: "Static Noise Graphic Tee",
    categorySlug: "graphic-tees",
    description:
      "Glitch print, soft hand-feel. A glitch-inspired print, soft to the touch with a fade that improves with wear.",
    price: 999,
    imgIds: ["photo-1503342217505-b0a15ec3261c", "photo-1521572163474-6864f9cf17ab"],
    tags: ["new", "trending"],
    isFeatured: false,
  },
  {
    slug: "core-fleece-hoodie",
    title: "Core Fleece Hoodie",
    categorySlug: "hoodies",
    description:
      "400gsm brushed fleece. Heavyweight fleece with kangaroo pocket and self-fabric drawcord.",
    price: 2299,
    imgIds: ["photo-1556821840-3a63f95609a7", "photo-1620799139507-2a76f79a2f4d"],
    tags: ["bestseller", "oversized"],
    isFeatured: true,
  },
  {
    slug: "paper-crew-sweatshirt",
    title: "Paper Crew Sweatshirt",
    categorySlug: "sweatshirts",
    description: "Boxy crewneck. A clean, boxy crewneck in our signature paper bone colorway.",
    price: 1799,
    imgIds: ["photo-1620799140408-edc6dcb6d633", "photo-1556905055-8f358a7a47b2"],
    tags: ["new"],
    isFeatured: false,
  },
  {
    slug: "field-coach-jacket",
    title: "Field Coach Jacket",
    categorySlug: "jackets",
    description:
      "Water-resistant shell. A modern coach jacket cut from a water-resistant cotton-blend shell.",
    price: 3499,
    imgIds: ["photo-1551028719-00167b16eac5", "photo-1591047139829-d91aecb6caea"],
    tags: ["new", "limited"],
    isFeatured: false,
  },
  {
    slug: "ronin-anime-tee",
    title: "Ronin Anime Tee",
    categorySlug: "anime",
    description: "Editorial collab drop. A modern take on the lone wanderer archetype.",
    price: 1499,
    imgIds: ["photo-1583743814966-8936f5b7be1a", "photo-1554568218-0f1715e72254"],
    tags: ["anime", "trending"],
    isFeatured: false,
  },
  {
    slug: "monolith-oversized-tee",
    title: "Monolith Oversized Tee",
    categorySlug: "oversized-tees",
    description: "Heavyweight oversized. Boxy fit, dropped shoulder, true-to-art print placement.",
    price: 1299,
    imgIds: ["photo-1503341504253-dff4815485f1", "photo-1581655353564-df123a1eb820"],
    tags: ["oversized", "new"],
    isFeatured: false,
  },
  {
    slug: "halftone-graphic-tee",
    title: "Halftone Graphic Tee",
    categorySlug: "graphic-tees",
    description:
      "Editorial print series. Editorial halftone print from our in-house design studio.",
    price: 999,
    imgIds: ["photo-1521572163474-6864f9cf17ab", "photo-1503342217505-b0a15ec3261c"],
    tags: ["new"],
    isFeatured: false,
  },
  {
    slug: "atlas-hoodie",
    title: "Atlas Hoodie",
    categorySlug: "hoodies",
    description: "Tonal embroidery. Subtle tonal embroidery on a heavyweight fleece body.",
    price: 2499,
    imgIds: ["photo-1620799139507-2a76f79a2f4d", "photo-1556821840-3a63f95609a7"],
    tags: ["bestseller"],
    isFeatured: false,
  },
  {
    slug: "harbor-coach-jacket",
    title: "Harbor Coach Jacket",
    categorySlug: "jackets",
    description: "Boxy unlined cut. An unlined coach jacket built for layering.",
    price: 3199,
    imgIds: ["photo-1591047139829-d91aecb6caea", "photo-1551028719-00167b16eac5"],
    tags: ["new"],
    isFeatured: false,
  },
  {
    slug: "noir-mobile-cover",
    title: "Noir Mobile Cover",
    categorySlug: "mobile-covers",
    description: "Soft-touch matte. A precision-fit case with a soft-touch matte finish.",
    price: 599,
    imgIds: ["photo-1592434134753-a70baf7979d5", "photo-1601593346740-925612772716"],
    tags: ["bestseller"],
    isFeatured: false,
  },
  {
    slug: "studio-ceramic-mug",
    title: "Studio Ceramic Mug",
    categorySlug: "mugs",
    description:
      "350ml, dishwasher safe. A 350ml ceramic mug, kiln-fired with a clean satin glaze.",
    price: 349,
    imgIds: ["photo-1514228742587-6b1558fcca3d", "photo-1572119865084-43c285814d63"],
    tags: ["new"],
    isFeatured: false,
  },
  {
    slug: "everyday-tote",
    title: "Everyday Tote",
    categorySlug: "tote-bags",
    description: "16oz natural canvas. Sturdy 16oz natural canvas with reinforced straps.",
    price: 599,
    imgIds: ["photo-1544816155-12df9643f363", "photo-1591561954557-26941169b49e"],
    tags: ["bestseller"],
    isFeatured: false,
  },
  {
    slug: "manifesto-poster",
    title: "Manifesto Poster A2",
    categorySlug: "posters",
    description: "Matte 200gsm. An A2 print on heavyweight matte stock.",
    price: 449,
    imgIds: ["photo-1513519245088-0e12902e5a38", "photo-1547333590-47fae5f58d21"],
    tags: ["new"],
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
