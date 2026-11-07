import Database from 'better-sqlite3';
import { getDb } from '@/lib/db/init';
import { ProductRepository } from '@/lib/db/product-repository';
import { OrderRepository } from '@/lib/db/order-repository';

export const SHOPIFY_API_VERSION = '2024-10';

export interface ShopifySyncResult {
  shopSynced: boolean;
  products: number;
  orders: number;
  errors: string[];
}

interface ShopifyProduct {
  id: number;
  title: string;
  product_type?: string;
  status?: string;
  variants?: Array<{ price?: string; inventory_quantity?: number }>;
}

interface ShopifyOrder {
  id: number;
  name?: string;
  total_price?: string;
  financial_status?: string | null;
  shipping_address?: { name?: string | null; country_code?: string | null } | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };
}

export function mapShopifyProduct(product: ShopifyProduct, shopId: number) {
  const variant = product.variants?.[0];
  const price = variant?.price ? Number(variant.price) : null;
  return {
    shop_id: shopId,
    name: product.title || `Shopify Product ${product.id}`,
    category: product.product_type || null,
    price: Number.isFinite(price) ? price : null,
    cost: null,
    sales: 0,
    stock: variant?.inventory_quantity ?? 0,
    status: product.status || 'active',
  };
}

export function mapShopifyOrder(order: ShopifyOrder, shopId: number) {
  const addressName = order.shipping_address?.name;
  const customerName =
    addressName ||
    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') ||
    null;
  const amount = order.total_price ? Number(order.total_price) : null;

  return {
    shop_id: shopId,
    order_number: order.name || `SHOPIFY-${order.id}`,
    customer_name: customerName,
    total_amount: Number.isFinite(amount) ? amount : null,
    status: order.financial_status || 'pending',
    shipping_region: order.shipping_address?.country_code || null,
    shipping_weight: null,
    logistics_channel: null,
  };
}

/**
 * Pull shop metadata, products and orders from Shopify and upsert them.
 * Every remote call is best-effort: a failure is collected into `errors`
 * and never throws, so OAuth success is not blocked.
 */
export async function syncShopifyData(
  shopDomain: string,
  accessToken: string,
  shopId: number,
  db: Database.Database = getDb()
): Promise<ShopifySyncResult> {
  const result: ShopifySyncResult = { shopSynced: false, products: 0, orders: 0, errors: [] };
  const baseUrl = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;
  const productRepo = new ProductRepository(db);
  const orderRepo = new OrderRepository(db);

  try {
    const response = await fetch(`${baseUrl}/shop.json`, { headers: authHeaders(accessToken) });
    result.shopSynced = response.ok;
    if (!response.ok) result.errors.push(`shop.json: ${response.status}`);
  } catch (error) {
    result.errors.push(`shop.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const response = await fetch(`${baseUrl}/products.json?limit=50`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      result.errors.push(`products.json: ${response.status}`);
    } else {
      const payload = (await response.json()) as { products?: ShopifyProduct[] };
      const existingNames = new Set(productRepo.findByShopId(shopId).map((p) => p.name));
      for (const product of payload.products ?? []) {
        const mapped = mapShopifyProduct(product, shopId);
        if (existingNames.has(mapped.name)) continue;
        productRepo.create(mapped);
        existingNames.add(mapped.name);
        result.products += 1;
      }
    }
  } catch (error) {
    result.errors.push(`products.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const response = await fetch(`${baseUrl}/orders.json?status=any&limit=50`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      result.errors.push(`orders.json: ${response.status}`);
    } else {
      const payload = (await response.json()) as { orders?: ShopifyOrder[] };
      const existingNumbers = new Set(
        orderRepo.findByShopId(shopId).map((order) => order.order_number).filter(Boolean) as string[]
      );
      for (const order of payload.orders ?? []) {
        const mapped = mapShopifyOrder(order, shopId);
        if (existingNumbers.has(mapped.order_number)) continue;
        orderRepo.create(mapped);
        existingNumbers.add(mapped.order_number);
        result.orders += 1;
      }
    }
  } catch (error) {
    result.errors.push(`orders.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}
