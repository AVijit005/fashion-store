import { PrismaService } from '../../src/config/prisma.service';

let counter = 0;

export async function createCategory(prisma: PrismaService, name?: string) {
  counter++;
  const suffix = counter;
  return prisma.category.create({
    data: {
      name: name ?? `Category ${suffix}`,
      slug: name ? name.toLowerCase().replace(/\s+/g, '-') : `category-${suffix}`,
    },
  });
}
