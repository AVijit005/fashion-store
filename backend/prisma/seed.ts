import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = [
  { name: 'Bone', hex: '#f5f3ee' },
  { name: 'Fog', hex: '#e8e4dd' },
  { name: 'Graphite', hex: '#2d2d2d' },
  { name: 'Ink', hex: '#0d0d0d' },
  { name: 'Ember', hex: '#c84b1e' },
  { name: 'Forest', hex: '#2f4a3a' },
];

const CATEGORIES = [
  { name: 'Oversized Tees', slug: 'oversized-tees' },
  { name: 'Graphic Tees', slug: 'graphic-tees' },
  { name: 'Hoodies', slug: 'hoodies' },
  { name: 'Sweatshirts', slug: 'sweatshirts' },
  { name: 'Jackets', slug: 'jackets' },
  { name: 'Anime', slug: 'anime' },
  { name: 'Mobile Covers', slug: 'mobile-covers' },
  { name: 'Mugs', slug: 'mugs' },
  { name: 'Tote Bags', slug: 'tote-bags' },
  { name: 'Posters', slug: 'posters' },
];

const PHOTO_IDS = [
  "luIWvCbY27Y","bO3S03I2Aw8","J-YQ36vC2F8","YsiSAp3ccvk","VYCs2WnAdc0","QW9FrzPj70U","I6zJ-SYLJYY","2GHCdtW45Uw","KtWQNkFTzyY","dwvtsZsyTZw",
  "4TQJPykwpR0","-7oth7kZEo8","Tt3niyJNIfI","N-t9hvcMTK0","yf50syI_Dwg","20Bxjm6XrYM","xTqR2Js61lY","aNj8Hvbrss8","Zbrz62vBmb0","WcwCGMETMaM",
  "zEIcgD9ByFQ","PKMvkg7vnUo","UqT55tGBqzI","FO-zQd7Wqio","Ou_qAxGXgAw","4_90zmmdo_4","HbAddptme1Q","bWUOx0SaSAk","XLGp2f98j5s","qUp0UsT89BY",
  "6ugQ978v-zg","1tjMpBTvFAA","2fmeu4TM0s8","DQP03Vq78Z4","HlVjI5WmoQY","J4TEzb9mb3A","ODxDFR5eSF8","aWQOX_2cLMo","WJ85c_l6JSE","XIzZ0eRDUuo",
  "FWhedlR-NB0","kJXGTOY1wLQ","a_KC8ocB650","SXpun7pdECU","QsnEj9MHsR8","ZCoqcrWp9GY","ggcJKGpx3pI","REOoETloFqE","5kDousA_mFI","mWSXyWe2H9Q",
  "QWlXPidIgI8","ikLELWYbyxk","NvgnUnlHuu0","T_8gjuk1Weo","AGwMgxZs1L0","YjxcPMb7JGw","SUA238ozrU4","N6BP12FB_XU","E3NUmCScugo","eIjEDkRzbOQ",
  "CNfL-6ryEMg","GREEBEtyR9Y","mlKE8dEMc_8","TysFvOl78u0","-RCEPHyCrfU","tT6k5S0fvxs","3h-390a18dE","jeeVeM86xKw","oAjRnndSIbs","BRDiOWVhfyA",
  "4BZqOyWyWzg","J69l0Z2c-h0","_NTxalBDieo","VAKgOEborN8","EfWgpl_bkYI","ryVx7NgAzys","B0VeVVsosQw","9ldWUhmhQ98","y8JrDRdwO0M","ZQqpq882kpk",
  "_1RHO9z8veg","UbpugDwd7aU","A-jQFU_YBj4","-upHwnSlzgU","nR_7ouIp4MQ","BrgWLDXXDRY","nxTGK83K_0g","NqQ5vQfIks8","By6VIlRdSUM","APruJbRC2Ws",
  "x-qrFAMZgyA","LY7bAU7-Km0","LZO4U6Z86og","i-oDmoREEMY","EK1vH8JhI_4","qoKjMBMWRrU","1Q9BUQL7v1w","Bl05nJb1xyU","wawa1fW57zA","dhOqw0S_4bQ",
  "1-6q3sT4zuA","TS--uNw-JqE","5gkYsrH_ebY","QZGQO3NvsLo","z_U3jYqOpTw","fr0J5-GIVyg","A2M4F2Ryk10","Tqv3noCldRc","iRw6IKXn7gY","oa7pqZmmhuA",
  "rz3sw-8VNCw","AKqGrt7Q1DU","Aqr_bPlqj-o","1WV-QdVf5V8","Apw4z0D9xVE","x8Llz_0QhDk","VJeK3RPK8y4","oLSnyhU2BVU","2122jrt79G8","SnlmvzWKNqM",
  "ft2UhxkefwE","164_6wVEHfI","kP6knT7tjn4","jvoZ-Aux9aw","gKEp40qEezc","su7PjvuQ-1c","SD9Jyl1xNQ4","a-QH9MAAVNI","xw-Wr37B_gQ","dwKiHoqqxk8",
  "LxVxPA1LOVM","sYbEa40YhWQ","fHp119FuLlE","SxAXphIPWeg","J2-wAQDckus","PqbL_mxmaUE","kYfWXbyuh-s","NOpsC3nWTzY","mV54HFd3xOQ","aDZ5YIuedQg"
];

const NOUNS = [
  // Apparel
  { term: 'Oversized Hoodie', cat: 'hoodies' },
  { term: 'Heavyweight Tee', cat: 'oversized-tees' },
  { term: 'Bomber Jacket', cat: 'jackets' },
  { term: 'Denim Jacket', cat: 'jackets' },
  { term: 'Graphic Tee', cat: 'graphic-tees' },
  { term: 'Trench Coat', cat: 'jackets' },
  { term: 'Vintage Tee', cat: 'graphic-tees' },
  { term: 'Fleece Crew', cat: 'sweatshirts' },
  { term: 'Windbreaker', cat: 'jackets' },
  { term: 'Capsule Jacket', cat: 'anime' },
  { term: 'Distressed Hoodie', cat: 'hoodies' },
  { term: 'Utility Vest', cat: 'jackets' },
  { term: 'Boxy Tee', cat: 'oversized-tees' },
  { term: 'Zip-Up Hoodie', cat: 'hoodies' },
  { term: 'Varsity Jacket', cat: 'jackets' },
  { term: 'Cargo Jacket', cat: 'jackets' },
  { term: 'Mock Neck Crew', cat: 'sweatshirts' },
  { term: 'Anime Collab Tee', cat: 'anime' },
  { term: 'Essential Tee', cat: 'oversized-tees' },
  { term: 'Washed Hoodie', cat: 'hoodies' },
  // Accessories
  { term: 'Matte Mobile Cover', cat: 'mobile-covers' },
  { term: 'Armored Phone Case', cat: 'mobile-covers' },
  { term: 'Silicone Snap Case', cat: 'mobile-covers' },
  { term: 'Ceramic Studio Mug', cat: 'mugs' },
  { term: 'Matte Black Mug', cat: 'mugs' },
  { term: 'Heavyweight Canvas Tote', cat: 'tote-bags' },
  { term: 'Utility Tote Bag', cat: 'tote-bags' },
  { term: 'Manifesto Poster', cat: 'posters' },
  { term: 'Editorial Art Print', cat: 'posters' },
  { term: 'Archive Poster', cat: 'posters' }
];

const ADJECTIVES = ['Monolith', 'Void', 'Shogun', 'Crimson', 'Phantom', 'Yurei', 'Noir', 'Ronin', 'Strata', 'Echo', 'Horizon', 'Akira', 'Vortex', 'Nebula', 'Urban', 'Onyx', 'Cobalt', 'Apex', 'Nomad', 'Zenith', 'Kinetics', 'Aura', 'Ethereal', 'Paradox', 'Nova', 'Cyber', 'Neon', 'Lunar', 'Solstice', 'Eclipse', 'Vector', 'Quantum', 'Glitch', 'Kitsune', 'Mecha', 'Samurai', 'Drift', 'Ascent', 'Rebel', 'Rogue'];

const DESCRIPTIONS = [
  'Heavyweight 400gsm brushed fleece. Dropped shoulders, boxy fit, tonal embroidery.',
  '240gsm combed cotton. Garment-dyed for a lived-in feel and ultimate drape.',
  'Satin finish with intricate back embroidery. Premium hardware and ribbed trims.',
  'Overdyed 12oz denim. Cropped fit with raw hem detailing and silver hardware.',
  'Screen-printed vintage artwork on our signature washed cotton canvas.',
  'Cocoon silhouette in ultra-soft fleece. Features elongated drawstrings and hidden pockets.',
  'A modern, draped take on the classic trench. Water-resistant and incredibly sharp.',
  'Faded and distressed by hand. Features washed-out typography and dropped shoulders.',
  'Textured loopback fleece with a structured collar and paneled sleeves.',
  'Lightweight nylon shell. Technical design featuring utility pockets and mesh lining.',
  'Minimalist aesthetic. Premium weight cotton cut in an ultra-relaxed proportion.',
  'Neo-Tokyo inspired. High-collar mock neck jacket in technical water-repellent fabric.',
  'Sun-faded wash with hand-distressed edges. A vintage look that gets better with wear.',
  'Psychedelic back graphic print on washed black cotton.',
  'Tactical multi-pocket vest designed for layering over hoodies and tees.',
  'Garment washed for a vintage feel. Built to last through countless wears.',
  'Ultra-premium Japanese cotton blended with a touch of stretch for mobility.',
  'Architecturally structured with raw edges and subtle tonal branding.'
];

const TAGS_POOL = ['oversized', 'bestseller', 'trending', 'new', 'limited', 'anime', 'y2k', 'cyberpunk', 'essential'];

const PRODUCTS_MOCK: any[] = [];

// Generating 1000 aesthetic products
for (let i = 0; i < 1000; i++) {
  const adj = ADJECTIVES[i % ADJECTIVES.length];
  const nounObj = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const title = `${adj} ${nounObj.term}`;
  const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '') + '-' + i;
  
  const desc = DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)];
  const price = Math.floor(Math.random() * (7000 - 1200 + 1) + 1200);
  
  const img1 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)];
  let img2 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)];
  while(img2 === img1) { img2 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)]; }

  const numTags = Math.floor(Math.random() * 3) + 1;
  const tags = [];
  for(let j=0; j<numTags; j++) {
    tags.push(TAGS_POOL[Math.floor(Math.random() * TAGS_POOL.length)]);
  }

  PRODUCTS_MOCK.push({
    slug,
    title,
    categorySlug: nounObj.cat,
    description: desc,
    price,
    imgIds: [img1, img2],
    tags: [...new Set(tags)],
    isFeatured: Math.random() > 0.8
  });
}

const COLLECTIONS_SEED = [
  { name: 'Summer Collection', slug: 'summer-collection', desc: 'Lightweight styles for hot seasons' },
  { name: 'Winter Drop', slug: 'winter-drop', desc: 'Heavyweight fleece and outerwear' },
  { name: 'Cyberpunk Core', slug: 'cyberpunk-core', desc: 'Techwear and futuristic aesthetics' },
  { name: 'Y2K Archives', slug: 'y2k-archives', desc: 'Nostalgic 2000s inspired pieces' },
  { name: 'Essentials', slug: 'essentials', desc: 'Minimalist everyday basics' },
  { name: 'Anime Collabs', slug: 'anime-collabs', desc: 'Exclusive anime inspired designs' },
];

async function main() {
  console.log('🌱 Seeding DB...');

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
  const collectionIds: string[] = [];
  for (const col of COLLECTIONS_SEED) {
    const record = await prisma.collection.create({
      data: {
        name: col.name,
        slug: col.slug,
        description: col.desc,
        isActive: true,
      },
    });
    collectionIds.push(record.id);
  }
  console.log(`✅ Seeded ${collectionIds.length} Collections.`);

  // Seed Drops
  const drop = await prisma.drop.create({
    data: {
      name: 'Anime Capsule Vol. 03',
      slug: 'anime-capsule-03',
      releaseDate: new Date(),
      isActive: true,
    },
  });
  console.log('✅ Seeded active Drop.');

  // Seed Products and Variants
  for (const p of PRODUCTS_MOCK) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) {
      console.warn(`Category not found for slug: ${p.categorySlug}`);
      continue;
    }

    const imageUrls = p.imgIds.map(
      (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`,
    );

    // Pick 1-2 random collections
    const numCols = Math.floor(Math.random() * 2) + 1;
    const selectedCols = [];
    for(let j=0; j<numCols; j++) {
      selectedCols.push({ id: collectionIds[Math.floor(Math.random() * collectionIds.length)] });
    }

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
        dropId: p.categorySlug === 'anime' ? drop.id : null,
        collections: {
          connect: selectedCols
        }
      },
    });

    // Create unique variants for sizes and colors
    // Use Bone, Graphite, Ink, Forest as default variants
    const colors = COLORS.slice(0, 3);
    const variantsData = [];
    for (const color of colors) {
      for (const size of SIZES) {
        variantsData.push({
            productId: productRecord.id,
            sku: `${p.slug.toUpperCase().slice(0, 15)}-${Math.floor(Math.random()*100000)}-${color.name.toUpperCase().slice(0, 3)}-${size}`,
            size,
            color: color.name,
            stockQuantity: 50,
            mediaUrls: imageUrls,
            thumbnailUrl: imageUrls[0],
        });
      }
    }
    await prisma.productVariant.createMany({ data: variantsData });
  }

  console.log(`✅ Seeded ${PRODUCTS_MOCK.length} products with aesthetic images & collections.`);
  console.log('🌱 Database Seeding Completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
