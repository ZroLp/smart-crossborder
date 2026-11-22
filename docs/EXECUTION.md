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
| P2 AI 运行时 | ✅ 核心落地（多实例自动 worker 留待 P10） |
| P3 数据模型 | ✅ 全部完成（P3-01~02） |
| P4 前端全量 | 🔨 P4-01/02/03/04/05 ✅，P4-06 进行中 |
| P5 产品闭环 | ⬜ |
| P6 账号·短信·支付 | ⬜ |
| P7 合规工程 | ⬜ |
| P8 后台 | ⬜ |
| P9 质量与 CI | ⬜ |
| P10 上线 | ⬜ |

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

## Phase 4｜前端全量（🔨 P4-01~05 完成，P4-06 进行中）

- P4-01 `useApi` 五态统一数据层（loading/error/empty/success/timeout） ✅ `lib/hooks/use-api.ts`（cdef3a9）
- P4-02/03 移动端 10 页（主链路 5 页 + 其余 5 页，无假数据） ✅ login/home/dashboard/selection/content/orders/ad-optimizer/command/messages/profile 全部接真实 API：`getJson/getJsonData`（lib/api/get-json.ts）+ `useApi` 五态 + `MobileApiState`（默认导出，五态视图）+ `MobileCard`（Card/Empty/StatusBadge/RiskBadge）；agent 任务 POST /api/agent + 轮询 /api/agent/progress；假数据（趋势图/配额/设备权限/SMS 倒计时）全部移除；i18n fr/de 补齐三组词条 + `common.rateLimited` 五语种对齐
- P4-04 仪表盘真实告警空态 ✅ riskAlerts 改为 /api/compliance high 级 open/pending 风险 + ROAS<4.0 告警（hasData 门控），全空显示 t('dashboard.noAlerts')
- P4-05 i18n 五语种全量（CJK 扫描基线归零） ✅ cfb4a5b：app/admin、app/dashboard、app/login、app/mobile、components 全量 CJK 硬编码归零（页面/组件 CJK 扫描 0 行）；新增 48 键（dataCenter 新段 25、taskLogs 15、profile 4、dashboard 2、fulfillment/storeBuilder/customerService 各 1），五语种键集完全对齐（各 699 键）；中文注释改英文；tsc 0 错 + i18n-compliance 14/14
- P4-06 WCAG 2.1 AA（axe 0 critical，键盘可达） 🔨

## Phase 5｜产品闭环（⬜）

- P5-01 ROAS 口径修正（不再恒等 3.3）
- P5-02 埋点 4 事件 + 归因
- P5-03 数据中心真实值/数据不足态
- P5-04 广告全闭环（CRUD→启停→平台 API，未接通置灰）
- P5-05 Shopify 深度同步（webhook + 增量 + 补拉 + 重授权）
- P5-06 合规数据可溯源
- P5-07 履约数据链（≥1 家物流轨迹）

## Phase 6｜账号·短信·支付（⬜）

- P6-01 注册补全（邮箱验证 + 设备/IP 落库）
- P6-02 短信双供应商 + 防轰炸 + 图形验证
- P6-03 支付核心（Checkout/订阅生命周期/3DS）
- P6-04 Webhook 可靠入账（签名 + 幂等 + 防重放）
- P6-05 税务（VAT/OSS/US Sales Tax）
- P6-06 退款/催缴/发票
- P6-07 Entitlement 收敛（收回页面直改套餐）

## Phase 7｜合规工程（⬜）

- P7-01 阻断式同意管理（未同意零非必要脚本，可网络断言）
- P7-02 DSAR 自助（30 天 SLA 可测）
- P7-03 数据保留期配置 + 自动清理
- P7-04 跨境（SCC/DPF + 区域化选项）
- P7-05 政策/协议页可下载
- P7-06 泄露 72h 响应模板
- P7-07 US 州法 Do Not Sell/Share
- P7-08 PIPL 单独同意 + 跨境评估归档

## Phase 8｜后台（⬜）

- P8-01 独立登录 + 5 页（仅 admin）
- P8-02 写操作审计（before/after）
- P8-03 监控运营一屏

## Phase 9｜质量与 CI（⬜）

- P9-01 tsc/test/build/lint 红灯门禁
- P9-02 E2E 主链路 + 多语种 smoke（`data-testid`）
- P9-03 安全回归 6 条（越权/伪造/CSRF/爆破/改密踢人）
- P9-04 压测（Agent 并发 50，看板 100 QPS）
- P9-05 发布物（hash + 变更说明 + 回滚步骤）

## Phase 10｜上线（⬜）

- P10-01 容器化 + 反代（HSTS/CSP/X-Frame）
- P10-02 可观测（1min 告警）
- P10-03 密钥 fail fast
- P10-04 灰度与 5 分钟回滚
- P10-05 灾备演练
- P10-06 合规上线检查（RoPA/DPIA 归档）

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
