import { DbClient } from './client';
import { ShopRepository } from './shop-repository';
import { ProductRepository } from './product-repository';
import { OrderRepository } from './order-repository';
import { OrderItemRepository, TrackingEventRepository } from './order-detail-repository';

export interface SeedResult {
  seeded: boolean;
  shops: number;
  products: number;
  orders: number;
  compliance: number;
  adCampaigns: number;
  adSuggestions: number;
  adPlatformConnections: number;
}

interface SeedUserRow {
  id: number;
  username: string;
}

const DEMO_PRODUCTS = [
  { name: '便携折叠收纳箱', category: 'home', price: 39.9, cost: 12.5, sales: 1280, stock: 320 },
  { name: '无线蓝牙运动耳机', category: 'electronics', price: 129, cost: 48, sales: 860, stock: 180 },
  { name: '多功能宠物梳毛器', category: 'pet', price: 29.9, cost: 8.8, sales: 2400, stock: 540 },
];

const DEMO_ORDERS = [
  { suffix: '001', customer: 'Alice Chen', amount: 79.8, status: 'completed', region: 'US', weight: 1.2, channel: 'DHL Express' },
  { suffix: '002', customer: 'Bruno Silva', amount: 129, status: 'pending', region: 'BR', weight: 0.6, channel: '拉美专线' },
  { suffix: '003', customer: 'Yuki Tanaka', amount: 29.9, status: 'shipped', region: 'JP', weight: 0.4, channel: '中邮小包' },
];

const COMPLIANCE_SEED: Array<{ kind: string; items: Array<Record<string, unknown>> }> = [
  {
    kind: 'policy',
    items: [
      {
        title: '欧盟《通用产品安全条例》(GPSR) 已生效',
        summary: '在欧盟销售的商品需指定 EU 责任人，标注 CE 标识与可追溯信息，并建立召回流程。',
        level: 'high',
        status: 'action_required',
        effectiveDate: '2024-12-13',
        source: 'EU Regulation 2023/988',
      },
      {
        title: '美国 CPSC 锂电池航空运输新规',
        summary: '含锂电池产品空运需提供 UN38.3 测试报告与 MSDS，包装须符合 UN 3480/3481。',
        level: 'high',
        status: 'action_required',
        effectiveDate: '2024-10-01',
        source: 'US CPSC / IATA',
      },
      {
        title: '欧盟包装与包装废弃物法规 (PPWR) 分阶段生效',
        summary: '2025 年起对包装可回收比例、最小化设计与再生材料含量提出明确要求。',
        level: 'medium',
        status: 'monitor',
        effectiveDate: '2025-01-01',
        source: 'EU Regulation 2025/40',
      },
      {
        title: '日本《消费品安全法》标签修订',
        summary: '进口消费品需标注日文警示、原产国与进口商信息，否则可能被扣关。',
        level: 'medium',
        status: 'monitor',
        effectiveDate: '2024-06-01',
        source: '日本经济产业省',
      },
      {
        title: '英国 UKCA 标识过渡期延长',
        summary: '部分品类在 2025 年后仍可接受 CE 标识，需关注具体品类清单与过渡截止日。',
        level: 'low',
        status: 'monitor',
        effectiveDate: '2025-01-01',
        source: 'UK GOV',
      },
    ],
  },
  {
    kind: 'tax',
    items: [
      {
        title: '欧盟 IOSS 增值税月度申报',
        summary: '通过 IOSS 申报的 B2C 订单需在次月 20 日前完成申报与缴税，逾期将产生滞纳金。',
        level: 'high',
        status: 'action_required',
        dueDate: '每月 20 日',
        source: 'EU IOSS',
      },
      {
        title: '美国各州销售税经济关联门槛',
        summary: '多数州以年销售额 10 万美元或 200 笔交易为门槛，达标后需注册并代收销售税。',
        level: 'medium',
        status: 'monitor',
        source: 'US State DOR',
      },
      {
        title: '英国 VAT 季度申报与远程销售门槛',
        summary: '英国远程销售超过 £85,000 需注册 VAT，并按季度提交申报表。',
        level: 'medium',
        status: 'monitor',
        dueDate: '每季度末',
        source: 'HMRC',
      },
      {
        title: '日本 JCT 合规发票制度',
        summary: '2024 年 10 月起，采购方需取得合格发票才能抵扣消费税，卖家需完成 JCT 登记。',
        level: 'high',
        status: 'action_required',
        source: '日本国税厅',
      },
    ],
  },
  {
    kind: 'check',
    items: [
      { title: '产品标签合规检查', summary: '3 个 SKU 缺少 CE 标识或 EU 责任人信息。', level: 'high', status: 'pending', category: 'labeling' },
      { title: '锂电池运输文件检查', summary: '2 个 SKU 未上传 UN38.3 测试报告。', level: 'high', status: 'pending', category: 'logistics' },
      { title: '化妆品成分备案检查', summary: '1 个 SKU 尚未完成欧盟 CPNP 备案。', level: 'medium', status: 'pending', category: 'formula' },
      { title: '儿童玩具 EN71 检测', summary: '检测报告将于 60 天后过期，建议提前复检。', level: 'medium', status: 'scheduled', category: 'testing' },
      { title: '纺织品纤维成分标注', summary: '2 个 SKU 成分标签缺失或与实际不符。', level: 'low', status: 'pending', category: 'labeling' },
    ],
  },
  {
    kind: 'risk',
    items: [
      { title: '商标侵权风险', summary: '1 个商品标题包含疑似品牌词，存在下架风险。', level: 'high', status: 'open', category: 'trademark' },
      { title: '外观专利侵权风险', summary: '同类目存在相似外观专利，建议做专利检索后再上架。', level: 'medium', status: 'open', category: 'patent' },
      { title: '产品召回风险', summary: '某批次抽检不合格，可能触发召回与罚款。', level: 'high', status: 'open', category: 'recall' },
      { title: '物流延误风险', summary: '旺季清关时效下降，可能触发平台履约考核。', level: 'medium', status: 'monitor', category: 'logistics' },
      { title: '支付拒付风险', summary: '近 30 天拒付率上升，需关注高风险订单。', level: 'medium', status: 'monitor', category: 'payment' },
    ],
  },
  {
    kind: 'suggestion',
    items: [
      { title: '建立产品合规档案', summary: '为每个 SKU 建立检测报告、标签与备案文件档案，便于平台抽查。', level: 'high', status: 'pending', action: 'create_compliance_archive' },
      { title: '接入 IOSS 税务代理', summary: '通过税务代理完成 IOSS 注册与月度申报，降低增值税合规成本。', level: 'high', status: 'pending', action: 'connect_tax_agent' },
      { title: '上架前完成 EN71 检测', summary: '儿童玩具类目需提前 4-6 周安排检测，避免影响上新计划。', level: 'medium', status: 'pending', action: 'schedule_testing' },
      { title: '定期进行商标检索', summary: '每季度对新品标题与图形进行商标检索，降低侵权下架风险。', level: 'medium', status: 'pending', action: 'trademark_search' },
      { title: '使用可回收包装', summary: '逐步替换为可回收材料包装，以满足 PPWR 与平台绿色要求。', level: 'low', status: 'pending', action: 'switch_packaging' },
    ],
  },
];

interface SeedCampaign {
  external_id: string;
  name: string;
  platform: string;
  status: string;
  budget: number;
  spent: number;
  roas: number;
  clicks: number;
  conversions: number;
  ctr: number;
  audience: Record<string, unknown>;
  creatives: Array<Record<string, unknown>>;
}

const AD_CAMPAIGNS: SeedCampaign[] = [
  {
    external_id: 'camp-fb-001',
    name: '春季新品 · Facebook 拉新',
    platform: 'facebook',
    status: 'active',
    budget: 3000,
    spent: 1860,
    roas: 3.2,
    clicks: 1240,
    conversions: 86,
    ctr: 0.028,
    audience: { ageRange: '25-34', gender: 'all', countries: ['US', 'CA'], interests: ['home', 'storage'] },
    creatives: [
      { id: 'cr-fb-1', type: 'image', name: '主图 A', language: 'en' },
      { id: 'cr-fb-2', type: 'video', name: '场景视频 15s', language: 'en' },
    ],
  },
  {
    external_id: 'camp-google-002',
    name: 'Google 搜索 · 收纳箱关键词',
    platform: 'google',
    status: 'active',
    budget: 5000,
    spent: 2400,
    roas: 4.1,
    clicks: 980,
    conversions: 64,
    ctr: 0.035,
    audience: { keywords: ['storage box', 'foldable organizer'], countries: ['US'], device: 'mobile' },
    creatives: [
      { id: 'cr-gg-1', type: 'text', name: '响应式搜索广告', language: 'en' },
    ],
  },
  {
    external_id: 'camp-tiktok-003',
    name: 'TikTok 短视频 · 宠物用品',
    platform: 'tiktok',
    status: 'paused',
    budget: 2000,
    spent: 750,
    roas: 2.4,
    clicks: 1560,
    conversions: 42,
    ctr: 0.041,
    audience: { ageRange: '18-30', interests: ['pets', 'grooming'], countries: ['US', 'GB'] },
    creatives: [
      { id: 'cr-tt-1', type: 'video', name: '萌宠梳毛 UGC', language: 'en' },
      { id: 'cr-tt-2', type: 'video', name: '痛点口播 20s', language: 'en' },
    ],
  },
];

const AD_SUGGESTIONS = [
  {
    campaign_external_id: 'camp-fb-001',
    type: 'budget',
    title: 'Facebook 预算上调 20%',
    description: '近 7 天 ROAS 稳定在 3.2，建议将日预算上调 20% 放量测试。',
    expected_impact: '预计转化 +15%',
    action: 'increase_budget',
    status: 'pending',
  },
  {
    campaign_external_id: 'camp-google-002',
    type: 'keyword',
    title: '否定 12 个低效搜索词',
    description: '搜索词报告显示部分关键词花费高且零转化，建议加入否定关键词。',
    expected_impact: '预计 CPA -12%',
    action: 'add_negative_keywords',
    status: 'pending',
  },
  {
    campaign_external_id: 'camp-tiktok-003',
    type: 'creative',
    title: '更换短视频前 3 秒钩子',
    description: '完播率低于同类均值，建议测试痛点开场与宠物出镜两种钩子。',
    expected_impact: '预计 CTR +25%',
    action: 'refresh_creative',
    status: 'pending',
  },
];

async function seedOrdersAndCatalog(
  db: DbClient,
  users: SeedUserRow[],
  shopRepo: ShopRepository,
  productRepo: ProductRepository,
  orderRepo: OrderRepository
) {
  if ((await productRepo.count()) > 0 || (await orderRepo.count()) > 0) {
    return { shops: 0, products: 0, orders: 0 };
  }

  let shops = 0;
  let products = 0;
  let orders = 0;

  await db.transaction(async () => {
    for (const user of users) {
      let shop = (await shopRepo.findByUserId(user.id))[0];
      if (!shop) {
        const result = await shopRepo.create({
          user_id: user.id,
          shop_name: `${user.username} 的演示店铺`,
          domain: `${user.username}.myshopify.com`,
          access_token: 'demo-access-token',
          scope: 'read_products,read_orders',
          status: 'active',
        });
        shops += 1;
        shop = (await shopRepo.findById(Number(result.lastInsertRowid)))!;
      }

      for (const product of DEMO_PRODUCTS) {
        await productRepo.create({
          shop_id: shop.id,
          name: product.name,
          category: product.category,
          price: product.price,
          cost: product.cost,
          sales: product.sales,
          stock: product.stock,
          status: 'active',
        });
        products += 1;
      }

      for (const order of DEMO_ORDERS) {
        await orderRepo.create({
          shop_id: shop.id,
          order_number: `${user.username}-ORD-${order.suffix}`,
          customer_name: order.customer,
          total_amount: order.amount,
          status: order.status,
          shipping_region: order.region,
          shipping_weight: order.weight,
          logistics_channel: order.channel,
        });
        orders += 1;
      }
    }
  }).immediate();

  return { shops, products, orders };
}

/**
 * P3-01：为已有订单补全行项目与物流轨迹（幂等：跳过已有 order_items 的订单）。
 * 行项目金额按订单总额的 6/4 分摊，保证明细之和与 total_amount 一致。
 */
const TRACKING_SEED_BY_STATUS: Record<string, Array<{ status: string; location: string; description: string; hoursAgo: number; carrier?: string; tracking_number?: string }>> = {
  completed: [
    { status: 'delivered', location: '洛杉矶, US', description: '包裹已签收', hoursAgo: 24, carrier: 'DHL Express', tracking_number: 'DHL-2024-US-001' },
    { status: 'in_transit', location: '奥克兰口岸, US', description: '清关完成，移交末端派送', hoursAgo: 48, carrier: 'DHL Express', tracking_number: 'DHL-2024-US-001' },
    { status: 'shipped', location: '深圳, CN', description: '仓库出库，承运商揽收', hoursAgo: 96, carrier: 'DHL Express', tracking_number: 'DHL-2024-US-001' },
  ],
  shipped: [
    { status: 'in_transit', location: '新加坡中转枢纽', description: '已抵达中转港，转运目的国', hoursAgo: 12, carrier: '中邮小包', tracking_number: 'CNPOST-2024-JP-003' },
    { status: 'shipped', location: '深圳, CN', description: '仓库出库，承运商揽收', hoursAgo: 48, carrier: '中邮小包', tracking_number: 'CNPOST-2024-JP-003' },
  ],
  pending: [
    { status: 'pending', location: '深圳, CN', description: '订单已确认，等待揽收', hoursAgo: 4, carrier: '拉美专线', tracking_number: 'LATAM-2024-BR-002' },
  ],
};

async function seedOrderDetails(db: DbClient): Promise<{ orderItems: number; trackingEvents: number }> {
  const itemRepo = new OrderItemRepository(db);
  const trackingRepo = new TrackingEventRepository(db);

  const pending = await db.query(
    `SELECT o.id, o.shop_id, o.status, o.total_amount
     FROM orders o
     WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)`
  );
  if (pending.rows.length === 0) {
    return { orderItems: 0, trackingEvents: 0 };
  }

  let orderItems = 0;
  let trackingEvents = 0;

  await db.transaction(async () => {
    for (const row of pending.rows) {
      const orderId = row.id as number;
      const status = String(row.status ?? 'pending');
      const total = Number(row.total_amount ?? 0);

      const products = (
        await db.prepare('SELECT id, name FROM products WHERE shop_id = ? ORDER BY id').all(row.shop_id as number)
      ) as Array<{ id: number; name: string }>;
      const p1 = products[0];
      const p2 = products[1] ?? products[0];

      if (p1) {
        const price1 = Math.round(total * 0.6 * 100) / 100;
        const price2 = Math.round((total - price1) * 100) / 100;
        await itemRepo.add({ order_id: orderId, product_id: p1.id, name: p1.name, quantity: 1, unit_price: price1, subtotal: price1 });
        orderItems += 1;
        if (p2) {
          await itemRepo.add({ order_id: orderId, product_id: p2.id, name: p2.name, quantity: 1, unit_price: price2, subtotal: price2 });
          orderItems += 1;
        }
      }

      const events = TRACKING_SEED_BY_STATUS[status] ?? [
        { status, location: '深圳, CN', description: '订单状态更新', hoursAgo: 1 },
      ];
      for (const event of events) {
        await trackingRepo.add({
          order_id: orderId,
          status: event.status,
          location: event.location,
          description: event.description,
          carrier: event.carrier ?? null,
          tracking_number: event.tracking_number ?? null,
          occurred_at: new Date(Date.now() - event.hoursAgo * 3600_000).toISOString(),
        });
        trackingEvents += 1;
      }
    }
  }).immediate();

  return { orderItems, trackingEvents };
}

/** Compliance / ad demo rows are deduplicated by (user_id + kind + title) and
 *  (user_id + external_id) respectively; existing rows are never deleted. */
async function seedComplianceAndAds(db: DbClient, users: SeedUserRow[]) {
  let compliance = 0;
  let adCampaigns = 0;
  let adSuggestions = 0;
  let adPlatformConnections = 0;

  await db.transaction(async () => {
    for (const user of users) {
      for (const group of COMPLIANCE_SEED) {
        const rows = await db
          .prepare('SELECT payload FROM compliance_items WHERE user_id = ? AND kind = ?')
          .all(user.id, group.kind) as Array<{ payload: string }>;
        const titles = new Set(
          rows.map((row) => {
            try {
              return String((JSON.parse(row.payload) as { title?: string }).title ?? '');
            } catch {
              return '';
            }
          })
        );

        for (const item of group.items) {
          if (titles.has(String(item.title))) continue;
          await db.prepare('INSERT INTO compliance_items (user_id, kind, payload) VALUES (?, ?, ?)').run(
            user.id,
            group.kind,
            JSON.stringify(item)
          );
          compliance += 1;
        }
      }

      for (const campaign of AD_CAMPAIGNS) {
        const result = await db
          .prepare(
            `INSERT INTO ad_campaigns
               (user_id, external_id, name, platform, status, budget, spent, roas, clicks, conversions, ctr, audience_json, creatives_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id, external_id) DO NOTHING`
          )
          .run(
            user.id,
            campaign.external_id,
            campaign.name,
            campaign.platform,
            campaign.status,
            campaign.budget,
            campaign.spent,
            campaign.roas,
            campaign.clicks,
            campaign.conversions,
            campaign.ctr,
            JSON.stringify(campaign.audience),
            JSON.stringify(campaign.creatives)
          );
        adCampaigns += result.changes;
      }

      for (const suggestion of AD_SUGGESTIONS) {
        const result = await db
          .prepare(
            `INSERT INTO ad_suggestions
               (user_id, campaign_external_id, type, title, description, expected_impact, action, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id, campaign_external_id, title) DO NOTHING`
          )
          .run(
            user.id,
            suggestion.campaign_external_id,
            suggestion.type,
            suggestion.title,
            suggestion.description,
            suggestion.expected_impact,
            suggestion.action,
            suggestion.status
          );
        adSuggestions += result.changes;
      }

      // P5-04: seed platform connections (all 3 platforms connected for demo)
      for (const platform of ['facebook', 'google', 'tiktok']) {
        const result = await db
          .prepare(
            `INSERT INTO ad_platform_connections (user_id, platform, status, connected_at)
             VALUES (?, ?, 'connected', now())
             ON CONFLICT (user_id, platform) DO NOTHING`
          )
          .run(user.id, platform);
        adPlatformConnections += result.changes;
      }
    }
  }).immediate();

  return { compliance, adCampaigns, adSuggestions, adPlatformConnections };
}

/**
 * Idempotent demo seed.
 * - Catalog (shop/products/orders) is only created when both tables are empty.
 * - Compliance and ad rows are filled per user by natural keys, so they can be
 *   seeded on existing databases without touching orders/products.
 */
export async function seedDemoData(db: DbClient): Promise<SeedResult> {
  const shopRepo = new ShopRepository(db);
  const productRepo = new ProductRepository(db);
  const orderRepo = new OrderRepository(db);

  const users = await db
    .prepare('SELECT id, username FROM users ORDER BY id')
    .all() as SeedUserRow[];

  if (users.length === 0) {
    return {
      seeded: false,
      shops: 0,
      products: 0,
      orders: 0,
      compliance: 0,
      adCampaigns: 0,
      adSuggestions: 0,
      adPlatformConnections: 0,
    };
  }

  const catalog = await seedOrdersAndCatalog(db, users, shopRepo, productRepo, orderRepo);
  await seedOrderDetails(db);
  const content = await seedComplianceAndAds(db, users);

  const seeded =
    catalog.shops + catalog.products + catalog.orders + content.compliance + content.adCampaigns + content.adSuggestions + content.adPlatformConnections > 0;

  return {
    seeded,
    ...catalog,
    ...content,
  };
}
