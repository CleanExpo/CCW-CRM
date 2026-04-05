import { NextResponse } from "next/server";

interface ShopifyVariant {
  price?: string;
  compare_at_price?: string | null;
  available?: boolean;
  sku?: string;
}

interface ShopifyImage {
  src?: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  tags?: string[] | string;
  body_html?: string;
  images?: ShopifyImage[];
  image?: ShopifyImage | null;
  variants?: ShopifyVariant[];
}

export interface CcwProduct {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  category: string;
  tags: string[];
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  sku: string;
  image: string | null;
  description: string;
  url: string;
}

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 250;
const STORE_URL = "https://www.ccwonline.com.au";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value?: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mapProduct(product: ShopifyProduct): CcwProduct {
  const variants = product.variants ?? [];
  const prices = variants
    .map((variant) => parsePrice(variant.price))
    .filter((price) => price > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;

  const comparePrices = variants
    .map((variant) => parsePrice(variant.compare_at_price ?? undefined))
    .filter((price) => price > 0);
  const maxComparePrice = comparePrices.length ? Math.max(...comparePrices) : null;

  const available = variants.some((variant) => Boolean(variant.available));
  const sku = variants.find((variant) => variant.sku)?.sku ?? "";
  const primaryImage =
    product.image?.src ??
    product.images?.[0]?.src ??
    null;
  const description = stripHtml(product.body_html ?? "");

  const tags = Array.isArray(product.tags)
    ? product.tags
    : typeof product.tags === "string"
      ? product.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

  return {
    id: String(product.id),
    title: product.title,
    handle: product.handle,
    vendor: product.vendor ?? "CCW",
    category: product.product_type ?? "Uncategorized",
    tags,
    price: minPrice,
    compareAtPrice: maxComparePrice,
    available,
    sku,
    image: primaryImage,
    description,
    url: `${STORE_URL}/products/${product.handle}`,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isNaN(limitParam)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(limitParam, 1), MAX_LIMIT);

  try {
    const response = await fetch(`${STORE_URL}/products.json?limit=${limit}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch CCW products" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { products?: ShopifyProduct[] };
    const products = Array.isArray(data.products) ? data.products : [];

    return NextResponse.json({
      source: "shopify",
      products: products.map(mapProduct),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load CCW products" },
      { status: 500 }
    );
  }
}
