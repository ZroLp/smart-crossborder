# 生产上线执行清单（全量方案 · EXECUTION）

> 依据用户确认的三项"最全功能"决策生成：
> ① 数据层 = Postgres 全量迁移；② 短信 + 支付真实集成；③ 合规 = GDPR + CCPA/CPRA + PIPL 三法并集。
> 本文档同时是**执行台账**：每个任务标注状态（✅ 完成 / 🔨 进行中 / ⬜ 未开始），
> 执行过程自动更新，无需人工介入。

## 决策记录（已确认）

| 决策 | 选择 | 后果 |
|---|---|---|
| 数据层 | Postgres 16 + 连接池 | 全链路 async；`timestamptz`；`FOR UPDATE` 事务 |
| 协调层 | Redis（限流/取消广播/锁/缓存） | 新增 infra 依赖；未配置时自动降级为单实例内存态 |
| 任务模型 | DB 队列 `FOR UPDATE SKIP LOCKED` + 心跳 | 多实例可重投，不再依赖进程内 Map |
| 计费事实源 | 支付平台 Webhook 幂等入账 | 本地仅 entitlement 投影，禁止页面直改套餐 |
| 合规基线 | GDPR+CCPA+PIPL 并集 | 阻断式同意、DSAR 自助、跨境可举证 |

## 状态总览

| Phase | 状态 |
|---|---|
| P0 止血 | ✅ 全部完成（P0-01~06） |
| P1 Postgres 迁移 | ✅ 全部完成（P1-01~08），全量回归 76/76 绿 |
| P2 AI 运行时 | ✅ 全部完成（多实例自动 worker 已于 P10 落地） |
| P3 数据模型 | ✅ 全部完成（P3-01~02） |
| P4 前端全量 | ✅ 全部完成（P4-01~06） |
| P5 产品闭环 | ✅ 全部完成（P5-01~07） |
| P6 账号·短信·支付 | ✅ 全部完成（P6-01~07） |
| P7 合规工程 | ✅ 全部完成（P7-01~08） |
| P8 后台 | ✅ 全部完成（P8-01~03） |
| P9 质量与 CI | ✅ 全部完成（P9-01~05） |
| P10 上线 | ✅ 全部完成（P10-01~06） |

## Phase 0｜止血（✅ 已完成）

| ID | 任务 | DoD | 状态 | 实现位置 |
|---|---|---|---|---|
| P0-01 | 删除 `AUTH_LEGACY_COMPAT` | 身份仅来自 session；伪造 userId 被忽略 | ✅ | `lib/auth/guards.ts`、各 route、guards.test |
| P0-02 | 登录限流 | 5 次/60s 滑动窗口，429+Retry-After；Redis 版见 P1-06 | ✅(内存版) | `lib/auth/login-rate-limit.ts` |
| P0-03 | CSRF | 跨站写 403（Origin/Referer/sec-fetch-site） | ✅ | `middleware.ts`（项目根） |
| P0-04 | 会话治理 | logout-all / 维护清理 / 改密轮换 | ✅ | `lib/auth/session.ts`、`app/api/auth/logout-all`、`app/api/maintenance/session-cleanup` |
| P0-05 | 外部 AbortSignal | 任务终止即断开 LLM 请求 | ✅ | `lib/ai/openai-client.ts` |
| P0-06 | 发布脚本 | tsc→jest→build→stage→hash 命名 zip | ✅ | `scripts/release.ps1` |

## Phase 1｜Postgres 全量迁移（✅）

| ID | 任务 | 状态 | 实现位置 |
|---|---|---|---|
| P1-01 | 选型与本地环境 | ✅ 客户端 + ✅ docker compose | `lib/db/client.ts`（pg 池 + `?`→`$n` + RETURNING lastInsertRowid + 类型归一化）；`docker-compose.yml`（见 P1-07） |
| P1-02 | 迁移工具化 | ✅ | `lib/db/schema.ts`（幂等 DDL + 触发器 + LIFECYCLE_MIGRATION）；`init.ts` 启动自动迁移 |
| P1-03 | 仓库层异步化 | ✅ | `lib/db/*` 全部仓储 + `task-state-transaction.ts`（单连接事务 + ALS） |
| P1-04 | 路由层 await 化 | ✅ | 27 个 `app/api/**/route.ts`，tsc 0 错 |
| P1-05 | 测试迁移 | ✅ | 内嵌 PGlite（`pglite/node-postgres` 走 pg 协议，与生产同构）；全量回归 76/76 套件、943 通过 + 1 跳过；运行需 `$env:NODE_OPTIONS='--experimental-vm-modules'; npx jest --forceExit`；`tests/helpers/db-compat.ts` 提供嵌套事务/主键 RETURNING/桥失步兼容 |
| P1-06 | 多实例协调 | ✅ | `lib/infra/redis.ts`（可选 ioredis）+ `lib/infra/task-cancellation.ts`（取消广播）；登录限流 Redis 化：`login-rate-limit.ts` 新增 `checkLoginRateLimitAsync/recordLoginFailureAsync/clearLoginFailuresAsync`（键 `sumaitong:login-limit:<key>`，TTL 2×窗口，无 REDIS_URL 或故障自动降级内存版），auth route 已切换 |
| P1-07 | 连接与基础设施 | ✅ | `docker-compose.yml`（postgres:16 + redis:7，健康检查 + pgdata 卷）；`.env.example` 增 DATABASE_URL/PG_POOL_SIZE/REDIS_URL；索引随 `schema.ts` 幂等 DDL |
| P1-08 | 备份与演练 | ✅ | `scripts/backup.sh`（pg_dump -Fc 全量 + `--restore` 独立演练库抽查 + 元数据校验）；PITR 基线 = 每日全量 + 托管侧 WAL 保留 7 天 |

### 测试基础设施说明（P1-05 关键设计）

- `initDatabase(':memory:')` 保持同步签名，返回惰性客户端；底层为 **PGlite 内嵌 Postgres**，
  每个测试文件独立引擎（`jest.pglite-setup.cjs` 预编译 WASM 并挂 `__SUMAITONG_PGLITE_CONFIG__`），
  每次 `initDatabase` 通过 `DROP/CREATE SCHEMA public` 得到干净逻辑库 → **天然无共享状态**，
  免事务回滚样板，语义等同原 SQLite `:memory:` 隔离。
- `?` 占位符由客户端自动改写 `$n`；`lastInsertRowid` 经自动 `RETURNING "id"` 保留
  （`RunResult { changes, lastInsertRowid }`）。
- SQL 方言对照（测试内手写 SQL 需转换）：
  - `datetime('now')` → `now()`；`datetime('now','-60 seconds')` → `now() - interval '60 seconds'`
  - `strftime('%Y-%m-%dT%H:%M:%fZ','now')` → `to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
  - `INSERT OR IGNORE` → `ON CONFLICT ... DO NOTHING`；`IFNULL` → `COALESCE`
  - `sqlite_master` → `information_schema.tables`；`PRAGMA table_info` → `information_schema.columns`
  - 时间列现为 ISO-8601 UTC 字符串（`timestamptz`）；`expires_at` 等为 BIGINT 毫秒（number）

## Phase 2｜AI 运行时（✅ P2 核心已落地，生产多实例接入待 P10）

> 已实现：DB 队列（`FOR UPDATE SKIP LOCKED` 认领）+ 内嵌 worker（`TaskQueueWorker`，`start/stop`，当前可手动启动，多实例自动启动留待 P10）；心跳/僵尸回收；幂等键 + 每用户并发上限(默认 3)；配额闸门 402 + 后台用量查询；熔断 + 规则版降级。提交默认走内联路径（`TASK_QUEUE_ENABLED=1` 时改走 202 入队）。测试：`tests/integration/task-queue.test.ts`、`tests/framework/circuit-breaker.test.ts`、`tests/api/agent-queue-gates.test.ts`、`tests/api/admin-quota.test.ts`。

| ID | 任务 | 状态 | 说明 |
|---|---|---|---|
| P2-01 | DB 队列消费（SKIP LOCKED） | ✅ | `TaskQueueRepository.claimNext` + `TaskQueueWorker`；路由入队返回 202 |
| P2-02 | 心跳与僵尸回收 | ✅ | `heartbeat` + `reapZombies`（lease 过期重投，requeue_count 计数） |
| P2-03 | 并发上限 + 幂等键 | ✅ | `assertConcurrencyCap`(429) + `createTaskIdempotent`(同 key 去重) |
| P2-04 | 配额执行点 | ✅ | `QuotaRepository.checkQuota`(402) + `app/api/admin/quota/usage` |
| P2-05 | 超时/熔断/降级 | ✅ | `lib/ai/circuit-breaker.ts` 接入 openai-client；规则版降级已就绪 |
| P2-06 | 分布式锁 | ✅ | SKIP LOCKED 认领 + 既有 `TaskLock`/`mutex_locks` 竞争测试通过 |

## Phase 3｜数据模型补齐（✅）

> 已实现：`order_items`/`tracking_events` 新表（幂等 DDL 同步进 `SCHEMA_SQL` 与 `LIFECYCLE_MIGRATION_SQL`）；
> `OrderItemRepository`/`TrackingEventRepository`（单订单 + `ANY(?)` 批量，避免 N+1）；
> 种子数据按订单总额 6/4 分摊补齐 2 条行项目与 1~3 条轨迹（幂等：跳过已有明细的订单）；
> `orders/[id]` 与 `/api/data?type=orders` 返回真实明细/轨迹；订单聚合走单条 GROUP BY
> （`summarizeForShops`，配 `idx_orders_shop_status`/`idx_orders_shop_created`），看板统计不再拉全量行。
> 测试：`tests/db/order-details.test.ts`（幂等/批量/1000 单聚合 <200ms），
> `tests/api/orders-api.test.ts`、`tests/integration/f04-data-isolation.test.ts` 断言更新为真实明细。

| ID | 任务 | DoD | 状态 | 实现位置 |
|---|---|---|---|---|
| P3-01 | `order_items` / `tracking_events` | `orders/[id]` 返回真实数据 | ✅ | `lib/db/schema.ts`、`lib/db/order-detail-repository.ts`、`lib/db/seed.ts`（`seedOrderDetails`）、`app/api/orders/[id]/route.ts`、`app/api/data/route.ts` |
| P3-02 | 聚合查询与索引 | 1000 单样本 <200ms | ✅ | `OrderRepository.summarizeForShops`（GROUP BY + 状态分布）；`app/api/dashboard/stats/route.ts` 改用聚合；1000 单性能测试通过 |

## Phase 4｜前端全量（✅ P4-01~06 全部完成）

- P4-01 `useApi` 五态统一数据层（loading/error/empty/success/timeout） ✅ `lib/hooks/use-api.ts`（cdef3a9）
- P4-02/03 移动端 10 页（主链路 5 页 + 其余 5 页，无假数据） ✅ login/home/dashboard/selection/content/orders/ad-optimizer/command/messages/profile 全部接真实 API：`getJson/getJsonData`（lib/api/get-json.ts）+ `useApi` 五态 + `MobileApiState`（默认导出，五态视图）+ `MobileCard`（Card/Empty/StatusBadge/RiskBadge）；agent 任务 POST /api/agent + 轮询 /api/agent/progress；假数据（趋势图/配额/设备权限/SMS 倒计时）全部移除；i18n fr/de 补齐三组词条 + `common.rateLimited` 五语种对齐
- P4-04 仪表盘真实告警空态 ✅ riskAlerts 改为 /api/compliance high 级 open/pending 风险 + ROAS<4.0 告警（hasData 门控），全空显示 t('dashboard.noAlerts')
- P4-05 i18n 五语种全量（CJK 扫描基线归零） ✅ cfb4a5b：app/admin、app/dashboard、app/login、app/mobile、components 全量 CJK 硬编码归零（页面/组件 CJK 扫描 0 行）；新增 48 键（dataCenter 新段 25、taskLogs 15、profile 4、dashboard 2、fulfillment/storeBuilder/customerService 各 1），五语种键集完全对齐（各 699 键）；中文注释改英文；tsc 0 错 + i18n-compliance 14/14
- P4-06 WCAG 2.1 AA（axe 0 critical，键盘可达） ✅ `tests/a11y/axe-a11y.test.tsx`（axe-core 4.14：wcag2a/2aa/21a/21aa 四 tag，critical+serious 归零；覆盖 TopBar/Sidebar/AgentStatusCard/AIStepProgress/DemoDataNotice/OfflineIndicator/RiskAlertPopup/SettingsDropdowns/VoiceInputButton 9 组件 + login/dashboard 2 页，另含键盘 focus 可达断言；region 规则豁免组件级容器，lang/title 按 layout 补齐）。修复：SettingsDropdowns 两个 select 加 aria-label（复用 settings.intlSettings/themeSettings 既有键，五语种零新增键）；dashboard/page.tsx fetchStats finally 补 setIsLoading(false)（原骨架屏常驻导致真实渲染分支不可达）；除该行为修复外不改变业务逻辑，仅加可访问性属性

## Phase 5｜产品闭环（🔨 进行中）

- P5-01 ROAS 口径修正（不再恒等 3.3） ✅ f111309：`/api/dashboard/stats` 改为广告加权口径 `SUM(spent*roas)/SUM(spent)`（按 campaign 还原收入，按用户隔离），无广告计划时返回 '0'；删除旧公式 `totalRevenue/(totalRevenue*0.3)`；测试 +2（加权 3.5 / 跨用户不影响）
- P5-02 埋点 4 事件 + 归因 ✅ `analytics_events` 表 + `AnalyticsRepository`（白名单 4 事件：signup/shop_connected/task_submitted/task_completed；source 归因，NULL 按 direct 归组；漏斗=事件计数）；`POST /api/analytics/track`（客户端 signup + 渠道归因）/`GET /api/analytics/summary`（计数/归因分布/漏斗，按用户隔离）；服务端接线：shop 路由 shop_connected、task-service task_submitted（createTask+内联路径）/task_completed（仅成功计入漏斗，trackSafe 失败不影响主流程）；客户端 helper `lib/analytics/track-event.ts`（UTM source 会话级持久 + 随机 sessionId，login 注册成功后上报）；tests/api/analytics.test.ts 11 用例全绿（mock 编排器，LLM 无关）
- P5-03 数据中心真实值/数据不足态 ✅ f111309：`/api/dashboard/stats` 改为广告加权口径（见 P5-01）；data-center 页面接入 `/api/analytics/summary`（P5-02）：转化率 = task_completed / task_submitted（无数据时显示 noTraffic 提示），流量来源 Donut 由 analytics.sources 填充（无数据时显示 noTrafficHint 提示）；CSV 导出 conversionRate 列改用实际值或空字符串；i18n noTrafficHint 五语种更新为「任务完成后自动采集」
- P5-04 广告全闭环 ✅ 广告 CRUD + 启停 + 建议采纳/拒绝 + 平台连接状态 + 未接通置灰：新增 `ad_platform_connections` 表；`AdCampaignRepository` 仓储；`POST /api/ad-campaigns`（创建）、`PATCH/DELETE /api/ad-campaigns/[id]`（编辑/启停/删除）、`POST .../sync`（同步，未连接时 409）、`POST /api/ad-suggestions/[id]`（采纳/拒绝）、`GET/POST /api/ad-platforms`（连接状态）；列表页新增「新建」表单、每行操作列（暂停/恢复/删除/同步，未接通时同步按钮置灰）、建议卡片改 API 调用；i18n 27 新键 ×5 语种；`npx tsc --noEmit` 全绿；`tests/api/ + tests/framework/i18n` 20/164 全绿
- P5-05 Shopify 深度同步 ✅ shops 表新增 `last_sync_at`；`sync.ts` 改进为增量同步（`updated_at_min` 参数）+ upsert 语义（已存在商品/订单更新而非跳过）+ 401 检测（`tokenExpired: true`）；OAuth callback 在同步成功后写入 `last_sync_at`，401 时标记 `status='expired'`；新增 `POST /api/shop/sync`（手动补拉，读 `last_sync_at` 作增量游标）；新增 `POST /api/webhooks/shopify`（MVP 基础 webhook，处理 orders/create、orders/updated、products/update，P7 补 HMAC）；settings 页新增三态徽章（active/expired/inactive）+「同步数据」按钮 +「重新授权」链接 + lastSync 时间；i18n 4 新键 ×5 语种；`npx tsc --noEmit` 全绿
- P5-06 合规数据可溯源 ✅ `compliance_items` 增加 `source`（默认 `'demo'`）+ `updated_at`；新增 `compliance_events` 审计表（`ON DELETE CASCADE`）；`GET /api/compliance/[id]` 返回详情 + 审计时间线；`POST /api/compliance/[id]` 写入审计事件并更新 `updated_at`；详情页从 stub 改为展示 source 徽章、payload、时间戳、审计时间线、标记已处理按钮；列表页「标记已处理」改为调 POST API；i18n 11 新键 ×5 语种；`npx tsc --noEmit` + compliance/i18n tests 33/33 全绿
- P5-07 履约数据链 ✅ `tracking_events` 增加 `carrier` + `tracking_number` 列；`TrackingEvent` 接口同步更新；`TrackingEventRepository.add` 支持写入新字段；种子数据 3 条订单各自带承运商（DHL Express / 中邮小包 / 拉美专线）+ 运单号；履约页改用真实 `tracking` 数组渲染物流动态（含承运商徽章 + 运单号）；新增 `POST /api/orders/[id]/tracking` 写入端点（越权 404）；`npx tsc --noEmit` + order-related tests 10/10 全绿

## Phase 6｜账号·短信·支付（✅ P6-01~07 全部完成）

- P6-01 注册补全（邮箱验证 + 设备/IP 落库） ✅ users 增加 `email_verified_at`；新增 `user_devices`（UNIQUE(user_id, user_agent)，登录/注册 upsert 落库 UA+IP）与 `email_verification_codes`（6 位码 SHA-256 哈希存储、15min TTL、60s 冷却）；`lib/auth/device.ts`（getClientIp/getUserAgent/recordUserDevice/listUserDevices）、`lib/auth/email-verification.ts`（request/confirm，无 provider 时非生产回显 devCode 供测试）；注册接受可选 email（规范化小写+格式校验）；新增 `GET/POST /api/auth/email`（request/confirm，EMAIL_NOT_SET/INVALID_CODE/CODE_EXPIRED）与 `GET /api/auth/devices`；tests/api/email-verification.test.ts 6 用例 + auth-route 回归，13/13 全绿，tsc 0 错
- P6-02 短信双供应商 + 防轰炸 + 图形验证 ✅ `lib/sms/providers.ts`：`SmsProvider` 接口 + Tencent（TC3-HMAC-SHA256 签名 `SmsSend`）/ Aliyun（RPC HMAC-SHA1 `SendSms`）双供应商，凭据缺失自动降级 mock（非生产回显 devCode）；`lib/sms/sms-service.ts`：算术图形验证（`captcha_challenges` 表，5min TTL、单次使用）+ 防轰炸（手机号 60s 冷却 / 24h≤10、IP 1h≤3，计数走 `sms_verification_codes` 跨实例可累加）+ 6 位码 SHA-256 哈希 10min TTL；`GET /api/auth/sms` 出题、`POST {action:'send'}`（400 CAPTCHA_INVALID/INVALID_INPUT、429 SMS_RATE_LIMITED）、`POST {action:'verify'}`（NO_CODE/INVALID_CODE/CODE_EXPIRED）；tests/api/sms-captcha.test.ts 10 用例全绿，tsc 0 错
- P6-03 支付核心（Checkout/订阅生命周期/3DS） ✅ schema 新增 `plans`（basic 9900/pro 29900/enterprise 89900 CNY，幂等 seed）、`subscriptions`（active 唯一部分索引 + `cancel_at_period_end` + 30 天周期）、`payments`（pending/requires_action/succeeded/failed/canceled + threeds_status）；`lib/payment/payment-service.ts`：mock 网关（金额 ≥¥500 或 `PAYMENT_MOCK_3DS=1` 触发 3DS，校验码 123456）、checkout 创建、confirm 幂等、成功即 `activatePlanForUser`（事务内更新 users 4 个订阅投影列 + subscription_logs + 订阅行滚动 30 天，配额闸门行为不变）；路由 `POST /api/checkout`、`GET /api/payments`、`GET /api/payments/[id]`（跨用户 404）、`POST /api/payments/[id]/confirm`（400 THREEDS_REQUIRED/402 PAYMENT_FAILED/409 INVALID_STATE）、`GET+POST /api/subscription`（plans 目录 + cancel/restore，404 NO_SUBSCRIPTION）；settings 页接真实套餐（API 拉取、真实价格、经 checkout 支付升级、3DS prompt、订阅状态区到期取消/恢复，删硬编码 plans 与假用量条）；i18n 6 新键 ×5 语种；tests/api/checkout.test.ts 9 用例全绿 + i18n 29/29 + tsc 0 错（注：tests/components 3 个既有 jsdom 用例失败与本次无关，归 P9 门禁）
- P6-04 Webhook 可靠入账（签名 + 幂等 + 防重放） ✅ 新增 `payment_webhook_events` 台账表（event_id UNIQUE + 自增 id 兼容 `RETURNING "id"` 客户端约定）；`lib/payment/payment-service.ts` 增 `signWebhook`/`verifyWebhookSignature`（HMAC-SHA256(`PAYMENT_WEBHOOK_SECRET`, `${ts}.${rawBody}`)，恒定时间比较，5min 重放窗口）+ `ingestPaymentWebhook`（`ON CONFLICT(event_id) DO NOTHING` 幂等去重 → 重复直接 ack；仅 `payment.succeeded`（置 succeeded + 激活订阅）/`payment.failed`（仅 pending/requires_action → failed）改状态，未知类型记台账不改状态）；`POST /api/webhooks/payment`：签名/重放 401、未知 payment 404、重复 200 duplicate、无 secret 503 fail-closed（CSRF middleware 对无 Origin/Referer 网关请求天然放行）；tests/api/webhook.test.ts 8 用例 + P6-01/03/04 回归 30/30 全绿，tsc 0 错
- P6-05 税务（VAT/OSS/US Sales Tax） ✅ 新增 `tax_rates` 目录表（JP JCT 10%、DE/FR/ES/IT/NL/PL VAT、GB 20%、US 5 州州税率，幂等 seed）；`lib/tax/tax-service.ts`：`quoteTax` 引擎（CN 免税、EU 按目的地 VAT + ≤€150 IOSS / >€150 OSS 提示、US 州税率 + 无州时 0% + 经济关联门槛提示、未知国家 0% + 免责提示，税额 = round(amount × rate/100)）；`GET /api/tax/quote?amount=&country=&state=`（参数校验 400）；tests/api/tax.test.ts 10 用例全绿，tsc 0 错
- P6-06 退款/催缴/发票 ✅ 新增 `refunds`/`invoices` 表；`payment-service.ts` 增 `issueInvoiceForPayment`（激活订阅时事务内按 payment 幂等开票，重复 confirm/webhook 不重发）、`refundPayment`（仅 succeeded 可退，409 否则 404 跨用户；退款事务：写 refund、payment → refunded、订阅取消、users 4 列归 NULL 回 free、记 log）、`findDunningTargets`（active 且周期已过期，含 days_overdue）；路由 `POST /api/payments/[id]/refund`（200/404/409）、`GET /api/invoices`（用户发票列表）、`GET /api/admin/dunning`（requireAdmin，403 非 admin）；tests/api/refunds-invoices.test.ts 7 用例 + checkout 回归 15/15 全绿，tsc 0 错
- P6-07 Entitlement 收敛（收回页面直改套餐） ✅ 删除 `app/api/subscription/upgrade` 直改路由（全库无残留引用、无测试依赖；PLAN_LIMITS 随文件移除）；套餐/权益变更收敛为唯一两条路径：支付确认（`confirmPayment` → `activatePlanForUser`）与网关 webhook（`ingestPaymentWebhook` → 同事务），退款走 `refundPayment` 归 free；settings 页升级按钮 P6-03 已改走 checkout 支付流，配额闸门（agent route 402）行为回归 33/33 绿，tsc 0 错

## Phase 7｜合规工程（✅ P7-01~08 全部完成）

- P7-01 阻断式同意管理（未同意零非必要脚本，可网络断言） ✅ `consent_records` 表（UNIQUE(user_id, purpose) 单行最新态，含 ip/consent_at/withdrawn_at）；`GET/POST /api/consent`（再同意刷新 consented_at 并清 withdrawn_at，撤回记 withdrawn_at，IP 走 `getClientIp`）；`POST /api/analytics/track` 对 task_submitted/task_completed/shop_connected 无 analytics 同意记录时 403 `CONSENT_REQUIRED`（signup 放行）；前端 `components/ConsentBanner.tsx` 挂入 dashboard layout（未同意才显示，同意/拒绝即隐藏），i18n 新增 consentBanner/consentAccept/consentDecline 3 键 ×5 语种；tests/api/privacy.test.ts 6 用例
- P7-02 DSAR 自助（30 天 SLA 可测） ✅ `dsar_requests` 表（sla_due_at=requested_at+30 天）；`POST /api/privacy/dsar`：export 立即生成 JSON 快照（users 本行/sessions/user_devices/analytics_events/task_logs/consent_records + 本人订单号/金额/状态摘要）存入 export_json 并置 fulfilled，delete 做 PII 清除（users.email=NULL、password=''、username=deleted-<id>，关联数据保留审计行）；`GET /api/privacy/dsar` 本人请求列表；tests/api/privacy.test.ts 4 用例
- P7-03 数据保留期配置 + 自动清理 ✅ `data_retention_policies` 表 seed 6 个 data_type（sessions 90/analytics_events 365/task_logs 365/email_verification_codes 30/sms_verification_codes 30/compliance_events 365，幂等 ON CONFLICT DO NOTHING）；`lib/privacy/retention.ts` `runRetentionCleanup`（data_type→物理表白名单映射防注入，`created_at < now() - interval '1 day' * max_age_days`）；`POST /api/maintenance/data-retention`（requireAdmin 非 admin 403，200 返回 cleaned 明细）；tests/api/privacy.test.ts 3 用例
- P7-04 跨境（SCC/DPF + 区域化选项） ✅ `users.data_residency`（DEFAULT 'CN'）；`POST /api/privacy/residency` 白名单 CN/EU/US 否则 400 INVALID_REGION；`GET /api/privacy/transfer-mechanisms` 目录：EU→SCC（EU 2021/914 第 9 条 4 款附录 1 模块 1）、US→DPF 认证（EU-US 数据隐私框架，SCC 备选）、CN→PIPL 38/39 条 + 标准合同（CAC 备案），并附该用户当前 data_residency；tests/api/privacy.test.ts 3 用例
- P7-05 政策/协议页可下载 ✅ `GET /api/legal/policy?type=privacy|terms|dpa`：`text/plain; charset=utf-8` + `Content-Disposition: attachment; filename="<type>_policy.txt"`，三份中文模板（含版本 + 生效日期），非法 type 400 INVALID_TYPE；tests/api/privacy.test.ts 2 用例
- P7-06 泄露 72h 响应模板 ✅ `breach_reports` 表（notification_deadline_at=detected_at+interval '72 hours'，GDPR Art.33）；`POST /api/admin/breach`（requireAdmin，201 返回含 deadline；非 admin 403）、`GET /api/admin/breach` 列表、`GET /api/legal/breach-templates` 返回 regulator（致监管机构通知函）/data_subject（致数据主体告知函）两份中文骨架（均含 72h 时限说明）；tests/api/privacy.test.ts 3 用例
- P7-07 US 州法 Do Not Sell/Share ✅ `users.do_not_sell`（NOT NULL DEFAULT false）；`GET /api/privacy/dnss` 返回 `{doNotSell, jurisdiction:'CA/US'}`、`POST /api/privacy/dnss` 写回该列（CCPA/CPRA + 加州隐私法）；tests/api/privacy.test.ts 2 用例
- P7-08 PIPL 单独同意 + 跨境评估归档 ✅ 单独同意复用 `consent_records` purpose='pipl_cross_border'（经 P7-01 `POST /api/consent` 写入）；`GET /api/privacy/pipl-assessment` 返回归档 JSON：`{basis:'PIPL 第 38/39/40 条', assessment:{机制:'标准合同 + 单独同意', 单独同意:<记录或 null>, 区域化:users.data_residency}, archived_at:<记录 created_at 或 null>}`；tests/api/privacy.test.ts 2 用例

## Phase 8｜后台（✅ P8-01~03 全部完成）

- P8-01 独立登录 + 5 页（仅 admin） ✅ `POST /api/admin/login`（仅 admin 可登录，失败统一 401 `INVALID_CREDENTIALS`，含登录限流，成功写 `admin.login` 审计）；`app/admin/login` 独立登录页；admin layout 未登录跳 `/admin/login`、非 admin 仍 `/dashboard/403`；导航扩 5 项（总览/用户/店铺/审计/监控）；修复 `POST /api/admin/users/role` 端点（新建 `app/api/admin/users/role/route.ts`，页面调用自然生效）；tests/api/admin-audit.test.ts 14 用例
- P8-02 写操作审计（before/after） ✅ `admin_audit_logs` 表（BIGINT IDENTITY + created_at DESC 索引）+ `lib/admin/audit.ts`（`recordAudit` 序列化 before/after JSON、`fetchUserSnapshot`/`fetchSubscriptionSnapshot`，审计旁路失败不阻塞业务）；接入 4 处写路由（`admin/users` 与 `users/role` 改角色取用户+订阅前后快照、`subscription` cancel/restore 取订阅行前后快照、`admin/breach` 建档 before=null）；`GET /api/admin/audit`（requireAdmin，`?limit=` 默认 50 上限 500，倒序）
- P8-03 监控运营一屏 ✅ `GET /api/admin/monitor` 单屏聚合（task_logs 状态分布 + 近 24h 计数、users/payments/subscriptions 计数、`findDunningTargets` 催缴条数、最近 10 条审计）；`app/admin/monitor` 页（指标卡 + 状态分布 + 最近审计）与 `app/admin/audit` 审计日志页（表格 + 空态）

## Phase 9｜质量与 CI（✅ P9-01~05 全部完成）

- P9-01 tsc/test/build/lint 红灯门禁 ✅ `scripts/ci.ps1` 顺序执行 tsc→jest→next build→lint（无 eslint 配置则 SKIP）+ `npm run ci`；并根治 pglite 首跑/并发线协议失步（每 pg Client 独立 PglitePgConnection + schema 初始化幂等重试 + 桥 error 加固）、修复 2 个真实缺陷（Shopify 同步计数应为"新建数"、设备审计失败 500 阻断登录），全量 jest 恢复全绿
- P9-02 E2E 主链路 + 多语种 smoke（`data-testid`）✅ login/dashboard/ConsentBanner 关键元素加 `data-testid`（dashboard 时间格式化改随语种，消除非 CJK 语种中文泄漏）；`tests/e2e/smoke.test.tsx`：主链路 填表→提交→fetch 注册成功(+set-cookie)→user-panel 成功态；zh/en/fr/de/es 五语种渲染断言 testid 存在且非 CJK 语种无中文字符泄漏
- P9-03 安全回归 6 条（越权/伪造/CSRF/爆破/改密踢人）✅ `tests/api/security-regression.test.ts`：跨用户 payment/subscription/orders 统一 404、`?userId`/body/`x-user-id` 注入全被忽略、middleware 导出纯函数 `isCrossSiteRequest` + 跨站写 403、6 次错误登录第 6 次 429+Retry-After、改密吊销其他会话（当前保留）、logout-all 全会话失效；实现已齐备（改密踢人/会话治理 P0-04 已落地），测试全部通过
- P9-04 压测（Agent 并发 50，看板 100 QPS）✅ `tests/load/throughput.test.ts`：50 任务并发入队（202/429 语义与 gates 一致）+ 每用户并发上限 ≤3 + 50 条全部可被 `claimNext` 认领；1000 单样本连续 100 次 `summarizeForShops` p95=1ms（<200ms 目标，CI 容差 <500ms）
- P9-05 发布物（hash + 变更说明 + 回滚步骤）✅ `scripts/release.ps1` 扩展：zip 的 SHA256 校验文件、`RELEASE_NOTES.txt`（git log + 变更类型统计）、`ROLLBACK.txt`（停服务→解包上一版 zip 覆盖→DB 迁移仅前向兼容说明→健康检查 /），原 5 步流程保留

## Phase 10｜上线（✅ P10-01~06 全部完成）

- P10-01 容器化 + 反代（HSTS/CSP/X-Frame） ✅ `Dockerfile`（多阶段：builder `npm ci`+`npm run build` → `node:20-alpine` runner，`USER node`，HEALTHCHECK 探 `/api/health`）+ `.dockerignore` + `deploy/nginx.conf`（80→443、TLS1.2/1.3、HSTS 1y includeSubDomains、CSP `default-src 'self'`、`X-Frame-Options DENY`、nosniff、Referrer-Policy、Permissions-Policy、upstream 双 app 负载）+ `docker-compose.prod.yml`（app×2 + postgres16 + redis7(requirepass) + nginx1.27，密钥 `${VAR:?required}` 强制）；P2 遗留「多实例自动 worker」同步落地：`instrumentation.ts`（register 钩子，JEST_WORKER_ID 跳过）+ `lib/task-runtime/worker-registry.ts`（模块级单例 start/stop/isRunning），`WORKER_AUTO_START=false` 可关
- P10-02 可观测（1min 告警） ✅ `app/api/health/route.ts`（db `SELECT 1` 失败 503；redis 未配置 disabled、ping 失败 degraded；返回 workerRunning/uptimeSec）+ `app/api/monitor/metrics/route.ts`（Prometheus 文本：uptime、`app_task_queue_depth{status}`、`app_tasks_zombie_candidates`、`app_last_task_completed_ago_seconds`，无记录为 +Inf，需内网/源 IP 白名单）+ `scripts/monitor-alerts.sh`（60s 轮询，APP_DOWN/QUEUE_BACKLOG/WORKER_STALE 三类告警，状态翻转才推送 `ALERT_WEBHOOK_URL`）；测试 `tests/api/health-metrics.test.ts`
- P10-03 密钥 fail fast ✅ `lib/config/secrets.ts`（必填 DATABASE_URL / PAYMENT_WEBHOOK_SECRET / OPENAI_API_KEY / MAINTENANCE_SECRET；占位值 `your-*-here|change-me|<your` 视同缺失；仅 `NODE_ENV=production` 且 `SECRET_FAIL_FAST!=='false'` 时抛错阻断启动）；生产启动由 `instrumentation.ts` 调用；`.env.example` 补齐 P6 短信/邮箱、P10 告警与开关说明；测试 `tests/framework/secrets-fail-fast.test.ts`（7 用例）
- P10-04 灰度与 5 分钟回滚 ✅ `scripts/canary.ps1`（解包→旧目录移 `previous`→重启→连探 `/api/health` N 次，全 200 输出 PROMOTE，失败自动调回滚）+ `scripts/rollback.ps1`（优先切 canary `previous`，否则取 dist 倒数第二个 zip 并校验 `.sha256`；重启后 `/api/health` 复验；`Stopwatch` 计时输出 `ROLLBACK OK ... (target <=300s)`；明确 schema 仅前向不回滚）；`scripts/release.ps1` 的 `ROLLBACK.txt` 第 8/9 步改为 `/api/health` 探针 + 指向 `rollback.ps1`
- P10-05 灾备演练 ✅ `scripts/dr-drill.sh`（`set -euo pipefail`；记录 users/task_logs/payments 基线行数 → `pg_dump -Fc` → `pg_restore --list` 校验 → 建 `dr_drill_<ts>` 库 → `pg_restore --no-owner --exit-on-error` → 恢复库行数比对 → DROP → PASS/exit 0 或 FAIL/exit 1）
- P10-06 合规上线检查（RoPA/DPIA 归档） ✅ `compliance_archives` 表（kind ∈ ropa/dpia，幂等 DDL 同时进 `SCHEMA_SQL` 与 `LIFECYCLE_MIGRATION_SQL`）+ `lib/compliance/launch-check.ts`（五项：ropa_archived / dpia_archived / dsar_sla / breach_72h 为阻断项，retention_configured 非阻断；pass = 阻断项全绿；`archiveComplianceDocument` 归档）+ `GET /api/admin/compliance-launch`（requireAdmin 聚合检查）+ `POST /api/admin/compliance-launch/archive`（INVALID_JSON/INVALID_KIND/MISSING_TITLE 校验，成功写 `compliance.archive.<kind>` 审计）；测试 `tests/api/compliance-launch.test.ts`（9 用例）

## 验收命令

```powershell
# 类型检查
npx tsc --noEmit
# 全量测试（PGlite 内存库，无外部依赖）
npx jest
# 生产构建
npx next build
```

## 待外部决策（不阻塞代码，仅影响范围）

1. 云与区域（单区 vs EU/US 双区）
2. 支付渠道组合（仅 Stripe vs +支付宝/微信）
3. PIPL 是否含中国大陆主体/数据本地化
4. 法务资源（内部 vs 外部律所）
5. FTE 上限（<3.5 人时 Phase 5/7 降级为最小可上线集）
