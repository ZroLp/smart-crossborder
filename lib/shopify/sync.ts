import { DbClient } from '@/lib/db/client';
import { getDb } from '@/lib/db/init';
import { ProductRepository } from '@/lib/db/product-repository';
import { OrderRepository } from '@/lib/db/order-repository';

export const SHOPIFY_API_VERSION = '2024-10';

export interface ShopifySyncResult {
  shopSynced: boolean;
  products: number;
  orders: number;
  errors: string[];
  /** P5-05: true when the Shopify API returned 401 (token expired / revoked) */
  tokenExpired: boolean;
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
 *
 * P5-05 enhancements:
 * - `lastSyncAt` (ISO 8601 string or ms-epoch): when provided, uses Shopify's
 *   `updated_at_min` parameter for incremental sync (only records modified after
 *   the last successful sync). Omit for a full pull.
 * - 401 from any Shopify call sets `tokenExpired: true` so callers can mark the
 *   shop as needing re-authorization.
 * - Existing products (by name) are **updated** (price/stock), not skipped.
 * - Existing orders (by order_number) are **updated** (status), not skipped.
 */
export async function syncShopifyData(
  shopDomain: string,
  accessToken: string,
  shopId: number,
  db: DbClient = getDb(),
  lastSyncAt?: string
): Promise<ShopifySyncResult> {
  const result: ShopifySyncResult = {
    shopSynced: false,
    products: 0,
    orders: 0,
    errors: [],
    tokenExpired: false,
  };
  const baseUrl = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;
  const productRepo = new ProductRepository(db);
  const orderRepo = new OrderRepository(db);

  // P5-05: incremental filter — pass lastSyncAt as updated_at_min if provided
  const incrementalParam = lastSyncAt ? `&updated_at_min=${encodeURIComponent(lastSyncAt)}` : '';

  try {
    const response = await fetch(`${baseUrl}/shop.json`, { headers: authHeaders(accessToken) });
    if (response.status === 401) result.tokenExpired = true;
    result.shopSynced = response.ok;
    if (!response.ok) result.errors.push(`shop.json: ${response.status}`);
  } catch (error) {
    result.errors.push(`shop.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const response = await fetch(
      `${baseUrl}/products.json?limit=50${incrementalParam}`,
      { headers: authHeaders(accessToken) }
    );
    if (response.status === 401) result.tokenExpired = true;
    if (!response.ok) {
      result.errors.push(`products.json: ${response.status}`);
    } else {
      const payload = (await response.json()) as { products?: ShopifyProduct[] };
      const existing = await productRepo.findByShopId(shopId);
      const existingByShopId = new Map<number, (typeof existing)[0]>();
      for (const p of existing) existingByShopId.set(p.id, p);

      for (const product of payload.products ?? []) {
        const mapped = mapShopifyProduct(product, shopId);
        // P5-05: upsert — find by name, update existing OR create new
        const existingByName = existing.find((p) => p.name === mapped.name);
        if (existingByName) {
          // P5-05: 已存在 → 更新（不计入新建数，二次同步幂等计数为 0）
          const priceVariant = product.variants?.[0];
          const price = priceVariant?.price ? Number(priceVariant.price) : null;
          await productRepo.update(existingByName.id, {
            price: Number.isFinite(price) ? price : undefined,
            stock: priceVariant?.inventory_quantity ?? undefined,
            status: product.status || undefined,
          } as never);
        } else {
          await productRepo.create(mapped);
          result.products += 1;
        }
      }
    }
  } catch (error) {
    result.errors.push(`products.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const response = await fetch(
      `${baseUrl}/orders.json?status=any&limit=50${incrementalParam}`,
      { headers: authHeaders(accessToken) }
    );
    if (response.status === 401) result.tokenExpired = true;
    if (!response.ok) {
      result.errors.push(`orders.json: ${response.status}`);
    } else {
      const payload = (await response.json()) as { orders?: ShopifyOrder[] };
      const existing = await orderRepo.findByShopId(shopId);
      const existingByNumber = new Map<string, (typeof existing)[0]>();
      for (const o of existing) {
        if (o.order_number) existingByNumber.set(o.order_number, o);
      }

      for (const order of payload.orders ?? []) {
        const mapped = mapShopifyOrder(order, shopId);
        // P5-05: upsert — find by order_number, update status OR create new
        const existingOrder = mapped.order_number
          ? existingByNumber.get(mapped.order_number)
          : undefined;
        if (existingOrder) {
          // P5-05: 已存在 → 更新（不计入新建数，二次同步幂等计数为 0）
          await orderRepo.update(existingOrder.id, {
            status: mapped.status,
            total_amount: mapped.total_amount ?? undefined,
          } as never);
        } else {
          await orderRepo.create(mapped);
          result.orders += 1;
        }
      }
    }
  } catch (error) {
    result.errors.push(`orders.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}
