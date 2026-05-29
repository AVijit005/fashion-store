import { apiClient } from "./client";
import { type Product } from "@/lib/data/products";

// A lookup map to translate backend color names to hexadecimal values for color swatches.
const COLOR_HEX_MAP: Record<string, string> = {
  Bone: "#f5f3ee",
  Fog: "#e8e4dd",
  Graphite: "#2d2d2d",
  Ink: "#0d0d0d",
  Ember: "#c84b1e",
  Forest: "#2f4a3a",
  Red: "#c84b1e",
  Black: "#0d0d0d",
  White: "#ffffff",
  Stone: "#e8e4dd",
  Olive: "#2f4a3a",
  Charcoal: "#2d2d2d",
  Indigo: "#1d2a44",
  Natural: "#f5f3ee",
};

export interface BackendVariant {
  id: string;
  productId: string;
  sku: string;
  size: string;
  color: string;
  stockQuantity: number;
  priceOverride?: string | number | null;
  mediaUrls: string[];
  thumbnailUrl?: string | null;
}

export interface BackendCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface BackendCollection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface BackendDrop {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface BackendProduct {
  id: string;
  categoryId: string;
  category?: BackendCategory;
  dropId?: string | null;
  title: string;
  slug: string;
  description: string;
  basePrice: string | number;
  isFeatured: boolean;
  mediaUrls: string[];
  tags: string[];
  variants?: BackendVariant[];
}

// Maps a raw backend product response from NestJS (Prisma) to the frontend's Product type.
export function mapBackendProduct(p: BackendProduct): Product {
  const basePrice = Number(p.basePrice);
  const firstVariantPrice = p.variants?.[0]?.priceOverride
    ? Number(p.variants[0].priceOverride)
    : basePrice;

  // Derive unique colors and map them to swatches
  const colors = Array.from(
    new Map(
      p.variants?.map((v: BackendVariant) => [
        v.color,
        { name: v.color, hex: COLOR_HEX_MAP[v.color] || "#808080" },
      ]) || [],
    ).values(),
  );

  // Derive unique sizes
  const sizes = Array.from(new Set<string>(p.variants?.map((v: BackendVariant) => v.size) || []));

  // Handle fallback images if mediaUrls array is empty
  const images =
    p.mediaUrls && p.mediaUrls.length > 0
      ? p.mediaUrls
      : p.variants?.flatMap((v: BackendVariant) => v.mediaUrls || []).filter(Boolean) || [];
  if (images.length === 0) {
    images.push(
      "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=1200&q=80&auto=format&fit=crop",
    );
  }

  // Derive deterministic rating and review count from the product ID
  const ratingSum = p.id
    .split("")
    .reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
  const rating = 4.0 + (ratingSum % 10) / 10; // 4.0 - 4.9 range
  const reviews = 50 + (ratingSum % 250);

  return {
    id: p.id,
    slug: p.slug,
    name: p.title,
    category: p.category?.slug || p.categoryId,
    tagline: p.description?.split(".")[0] || "Premium streetwear piece",
    price: firstVariantPrice,
    mrp: Math.round(firstVariantPrice * 1.4), // Simulated MRP for frontend discount calculations
    rating,
    reviews,
    colors: colors.length > 0 ? colors : [{ name: "Standard", hex: "#000000" }],
    sizes: sizes.length > 0 ? sizes : ["S", "M", "L", "XL"],
    images,
    badges: (p.tags || []) as Product["badges"],
    story: p.description || "Designed for durability and style.",
  };
}

export const catalogApi = {
  async getCategories() {
    return apiClient.get<BackendCategory[]>("/catalog/categories");
  },

  async getCollections() {
    return apiClient.get<BackendCollection[]>("/catalog/collections");
  },

  async getProducts(params?: {
    category?: string;
    collection?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const res = await apiClient.get<{ products: BackendProduct[]; total: number }>(
      "/catalog/products",
      {
        category: params?.category,
        collection: params?.collection,
        featured: params?.featured ? "true" : undefined,
        limit: params?.limit,
        offset: params?.offset,
      },
    );
    return {
      products: res.products.map(mapBackendProduct),
      total: res.total,
    };
  },

  async getProductBySlug(slug: string) {
    const raw = await apiClient.get<BackendProduct>(`/catalog/products/${slug}`);
    return mapBackendProduct(raw);
  },

  async search(query: string, params?: { limit?: number; offset?: number }) {
    const res = await apiClient.get<BackendProduct[] | { products: BackendProduct[] }>(
      "/catalog/search",
      {
        q: query,
        limit: params?.limit,
        offset: params?.offset,
      },
    );
    // Typo-tolerant search endpoint returns array of products
    const rawProducts = Array.isArray(res) ? res : res.products || [];
    return rawProducts.map(mapBackendProduct);
  },

  async getActiveDrops() {
    return apiClient.get<BackendDrop[]>("/catalog/drops");
  },
};
