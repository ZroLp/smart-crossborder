import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { ProductRepository } from '@/lib/db/product-repository';
import { OrderRepository } from '@/lib/db/order-repository';
import { mapShopifyProduct, mapShopifyOrder } from '@/lib/shopify/sync';

/**
 * P5-05：Shopify Webhook 基础接收端（MVP：无 HMAC 校验，P7 补齐）
 *
 * POST /api/webhooks/shopify
 *
 * Shopify 发送 `X-Shopify-Topic` 头标识事件类型，body 为事件 payload。
 * 支持的主题：
 * - `orders/create` → upsert 订单
 * - `orders/updated` → 更新订单状态
 * - `products/update` → upsert 商品
 *
 * 所有请求均返回 200（Shopify 要求 2xx 才确认接收，避免重发）；
 * 错误记录在响应体但不影响 200 状态。
 */
export async function POST(request: NextRequest) {
  const topic = request.headers.get('X-Shopify-Topic') ?? '';
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Basic shape validation
  if (!topic || !body.id) {
    return NextResponse.json({ success: false, error: 'Missing topic or id' });
  }

  try {
    const db = getDb();
    const shop = (body.shop ?? {}) as Record<string, unknown>;
    const shopId = Number(body.shop_id ?? shop.id ?? 0);

    if (shopId === 0) {
      return NextResponse.json({ success: true, data: { ignored: true, reason: 'no shop_id' } });
    }

    if (topic === 'orders/create' || topic === 'orders/updated') {
      const orderData = body as unknown as {
        id: number;
        name?: string;
        total_price?: string;
        financial_status?: string | null;
        shipping_address?: { name?: string | null; country_code?: string | null } | null;
        customer?: { first_name?: string | null; last_name?: string | null } | null;
      };
      const orderRepo = new OrderRepository(db);
      const mapped = mapShopifyOrder(orderData, shopId);
      const existing = await orderRepo.findByShopId(shopId);
      const found = existing.find((o) => o.order_number === mapped.order_number);
      if (found) {
        await orderRepo.update(found.id, {
          status: mapped.status,
          total_amount: mapped.total_amount ?? undefined,
        } as never);
      } else {
        await orderRepo.create(mapped);
      }
      return NextResponse.json({
        success: true,
        data: { topic, orderNumber: mapped.order_number, action: found ? 'updated' : 'created' },
      });
    }

    if (topic === 'products/update') {
      const productData = body as unknown as {
        id: number;
        title: string;
        product_type?: string;
        status?: string;
        variants?: Array<{ price?: string; inventory_quantity?: number }>;
      };
      const productRepo = new ProductRepository(db);
      const mapped = mapShopifyProduct(productData, shopId);
      const existing = await productRepo.findByShopId(shopId);
      const found = existing.find((p) => p.name === mapped.name);
      if (found) {
        const priceVariant = productData.variants?.[0];
        const price = priceVariant?.price ? Number(priceVariant.price) : null;
        await productRepo.update(found.id, {
          price: Number.isFinite(price) ? price : undefined,
          stock: priceVariant?.inventory_quantity ?? undefined,
          status: productData.status || undefined,
        } as never);
      } else {
        await productRepo.create(mapped);
      }
      return NextResponse.json({
        success: true,
        data: { topic, productName: mapped.name, action: found ? 'updated' : 'created' },
      });
    }

    // Unknown topic — acknowledge but ignore
    return NextResponse.json({ success: true, data: { topic, ignored: true } });
  } catch (error) {
    // Shopify requires 2xx to stop re-delivering; log error in body
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing error',
      topic,
    });
  }
}
