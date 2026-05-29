import { Product } from '@prisma/client';

export abstract class SearchService {
  abstract search(
    query: string,
    options?: { limit?: number; offset?: number; categoryId?: string; collectionId?: string },
  ): Promise<{ products: Product[]; total: number }>;
}
