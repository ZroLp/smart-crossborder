import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db/init';
import { ShopRepository } from '@/lib/db/shop-repository';
import { ProductRepository } from '@/lib/db/product-repository';
import { OrderRepository } from '@/lib/db/order-repository';
import { AgentType } from '@/lib/framework/types';

export const EMPTY_PRODUCT_LIBRARY = 'EMPTY_PRODUCT_LIBRARY';
export const EMPTY_ORDER_LIBRARY = 'EMPTY_ORDER_LIBRARY';

export const EMPTY_PRODUCT_HINT =
  '请先在 Shopify 授权同步商品，或在店铺/数据模块创建商品后重试。';
export const EMPTY_ORDER_HINT =
  '请先同步 Shopify 订单，或创建一笔订单后再执行履约任务。';

export class AgentInputError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly hint: string
  ) {
    super(message);
    this.name = 'AgentInputError';
  }
}

export interface AdaptedInput {
  input: Record<string, unknown>;
  /** 命中的适配规则；null 表示原样透传。 */
  adapted: string | null;
}

const REGION_MAP: Record<string, string> = {
  sea: 'SEA',
  eu: 'EUROPE',
  us: 'NORTH_AMERICA',
  jp: 'JP',
};

function hasOwn(input: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function userShops(userId: number, db: Database.Database) {
  return new ShopRepository(db).findByUserId(userId);
}

function userProducts(userId: number, db: Database.Database) {
  const productRepo = new ProductRepository(db);
  return userShops(userId, db).flatMap((shop) => productRepo.findByShopId(shop.id));
}

function userOrders(userId: number, db: Database.Database) {
  const orderRepo = new OrderRepository(db);
  return userShops(userId, db)
    .flatMap((shop) => orderRepo.findByShopId(shop.id))
    .sort((a, b) => b.id - a.id);
}

function requireProductLibrary(userId: number, db: Database.Database) {
  const products = userProducts(userId, db);
  if (products.length === 0) {
    throw new AgentInputError(
      EMPTY_PRODUCT_LIBRARY,
      '商品库为空，无法执行该任务',
      EMPTY_PRODUCT_HINT
    );
  }
  return products;
}

function requireOrderLibrary(userId: number, db: Database.Database) {
  const orders = userOrders(userId, db);
  if (orders.length === 0) {
    throw new AgentInputError(
      EMPTY_ORDER_LIBRARY,
      '订单库为空，无法执行履约任务',
      EMPTY_ORDER_HINT
    );
  }
  return orders;
}

function adaptSelection(raw: Record<string, unknown>, userId: number, db: Database.Database): AdaptedInput {
  const products = requireProductLibrary(userId, db);
  const requestedCategory = typeof raw.category === 'string' ? raw.category.trim() : '';
  const requestedKeyword = typeof raw.keyword === 'string' ? raw.keyword.trim().toLowerCase() : '';

  // 优先按页面筛选条件收窄候选；筛选后为空时回退到全量商品库（库本身非空）。
  let candidates = products;
  if (requestedCategory) {
    const byCategory = products.filter((p) => (p.category || '') === requestedCategory);
    if (byCategory.length > 0) candidates = byCategory;
  }
  if (requestedKeyword) {
    const byKeyword = candidates.filter((p) =>
      `${p.name} ${p.category ?? ''}`.toLowerCase().includes(requestedKeyword)
    );
    if (byKeyword.length > 0) candidates = byKeyword;
  }

  const region = typeof raw.region === 'string' ? REGION_MAP[raw.region.trim().toLowerCase()] ?? raw.region.trim() : undefined;

  return {
    adapted: 'selection:product-library',
    input: {
      ...raw,
      products: candidates.slice(0, 20).map((product) => ({
        name: product.name,
        category: product.category ?? 'general',
        price: product.price ?? 0,
        cost: product.cost ?? 0,
        sales: product.sales ?? 0,
        region,
        productId: product.id,
      })),
    },
  };
}

function adaptStoreBuilder(raw: Record<string, unknown>, userId: number, db: Database.Database): AdaptedInput {
  const products = requireProductLibrary(userId, db);
  const top = [...products].sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0)).slice(0, 3);

  return {
    adapted: 'store-builder:top-products',
    input: {
      ...raw,
      selectedProducts: top.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category ?? 'general',
        price: product.price ?? 0,
        cost: product.cost ?? 0,
        sales: product.sales ?? 0,
      })),
    },
  };
}

function adaptContent(raw: Record<string, unknown>, userId: number, db: Database.Database): AdaptedInput {
  const products = requireProductLibrary(userId, db);
  const rawProductId = raw.productId;
  const wantedId = rawProductId === undefined || rawProductId === null ? NaN : Number(rawProductId);

  let picked = products.find((product) => product.id === wantedId);
  if (!picked) {
    // 指定商品不存在时按销量取 Top1（只读真实库，不伪造商品）。
    picked = [...products].sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0))[0];
  }

  return {
    adapted: 'content:product-by-id',
    input: {
      ...raw,
      products: [
        {
          id: picked.id,
          name: picked.name,
          category: picked.category ?? 'general',
          price: picked.price ?? 0,
        },
      ],
    },
  };
}

function adaptFulfillment(raw: Record<string, unknown>, userId: number, db: Database.Database): AdaptedInput {
  const orders = requireOrderLibrary(userId, db);
  const latest = orders[0];

  return {
    adapted: 'fulfillment:latest-order',
    input: {
      ...raw,
      order: {
        orderNumber: latest.order_number ?? '',
        shippingRegion: latest.shipping_region ?? 'US',
        shippingWeight: latest.shipping_weight ?? 1,
        totalAmount: latest.total_amount ?? 0,
        items: [],
      },
    },
  };
}

/**
 * 把前端页面的真实提交载荷适配为各 Agent 需要的最小输入。
 * 只读取当前会话用户的商品/订单库，库为空时抛 AgentInputError（400）。
 * 已经是 Agent 原生入参的载荷原样透传。
 */
export function adaptAgentInput(
  agentType: AgentType,
  rawInput: Record<string, unknown>,
  userId: number,
  db: Database.Database = getDb()
): AdaptedInput {
  const raw = rawInput ?? {};

  if (agentType === 'selection') {
    if (Array.isArray(raw.products)) return { input: raw, adapted: null };
    if (hasOwn(raw, 'category') || hasOwn(raw, 'region') || hasOwn(raw, 'keyword')) {
      return adaptSelection(raw, userId, db);
    }
    return { input: raw, adapted: null };
  }

  if (agentType === 'store-builder') {
    if (Array.isArray(raw.selectedProducts)) return { input: raw, adapted: null };
    if (raw.action === 'create' || hasOwn(raw, 'templateId')) {
      return adaptStoreBuilder(raw, userId, db);
    }
    return { input: raw, adapted: null };
  }

  if (agentType === 'content') {
    if (Array.isArray(raw.products)) return { input: raw, adapted: null };
    if (hasOwn(raw, 'language') || hasOwn(raw, 'productId')) {
      return adaptContent(raw, userId, db);
    }
    return { input: raw, adapted: null };
  }

  if (agentType === 'fulfillment') {
    if (raw.order && typeof raw.order === 'object') return { input: raw, adapted: null };
    if (raw.action === 'sync') {
      return adaptFulfillment(raw, userId, db);
    }
    return { input: raw, adapted: null };
  }

  // ad-optimizer / customer-service 的入参本就是 Agent 契约，原样透传。
  return { input: raw, adapted: null };
}
