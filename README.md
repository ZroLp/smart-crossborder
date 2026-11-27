# 跨境智卖 · Smart Cross-border

面向中小跨境卖家的全链路 AI 运营平台（Web + Mobile + 管理后台），围绕 Shopify 生态，用六个 Agent 覆盖选品、建站、内容、投流、客服与履约。

> 当前定位：**可上线的生产化版本**。P0–P10 全部完成：Postgres 全量迁移、DB 任务队列、账号/短信/支付真实链路、GDPR + CCPA/CPRA + PIPL 合规工程、运营后台、容器化与灰度回滚。

## 本分支更新

分支 `feat/p4-p5-readiness` 相对 `main` 完成了生产化改造，完整台账见 [执行清单](docs/EXECUTION.md)。

| 阶段 | 内容 |
| --- | --- |
| P0 止血 | 身份仅来自服务端会话、登录限流、Origin/Referer CSRF、会话治理（logout-all / 惰性清理）、LLM 请求 AbortSignal、发布脚本 |
| P1 数据层 | SQLite → **PostgreSQL 16** 全量迁移（连接池、异步仓储、单连接事务）；Redis 可选（限流共享 / 任务取消广播，缺失自动降级内存态）；备份与恢复演练 |
| P2 任务运行时 | DB 队列 `FOR UPDATE SKIP LOCKED`、心跳与僵尸回收、幂等键、每用户并发上限、配额闸门、超时/熔断/规则版降级 |
| P3 数据模型 | 订单明细 `order_items`、物流轨迹 `tracking_events`；聚合查询避免看板拉全量 |
| P4 前端全量 | `useApi` 五态数据层；移动端 10 页接真实 API；仪表盘真实告警；**i18n 五语种全量**（CJK 硬编码归零）；**WCAG 2.1 AA**（axe 0 critical） |
| P5 产品闭环 | ROAS 加权口径修正；4 事件埋点与渠道归因；数据中心真实值；广告全闭环；Shopify 增量同步与 webhook；合规数据可溯源；履约数据链 |
| P6 账号·短信·支付 | 邮箱验证 + 设备/IP 审计；腾讯云/阿里云短信双供应商（防轰炸 + 图形验证）；套餐/订阅/3DS；**Webhook HMAC 签名 + 幂等入账**；VAT/OSS/US Sales Tax；退款/催缴/发票；权益变更收敛为支付与 webhook 两条路径 |
| P7 合规工程 | 阻断式同意管理；DSAR 自助（30 天 SLA）；数据保留期自动清理；跨境 SCC/DPF + 区域化；政策页可下载；泄露 72h 响应模板；Do Not Sell/Share；PIPL 单独同意与评估归档 |
| P8 运营后台 | 独立 admin 登录；写操作审计（before/after）；监控运营一屏 |
| P9 质量与 CI | tsc/jest/build/lint 门禁（`npm run ci`）；E2E 主链路与五语种 smoke；安全回归 6 条；并发压测 |
| P10 上线 | 多阶段 Dockerfile + Nginx 反代（HSTS/CSP/X-Frame）；健康检查与 Prometheus 指标 + 1min 告警；密钥 fail fast；灰度 canary 与 5 分钟回滚；灾备演练；合规上线检查 |

## 项目状态

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 六大 Agent 任务闭环 | ✅ | taskId/displayId、五步进度、暂停/终止/重试、任务日志 |
| 任务运行时 | ✅ | DB 队列认领、心跳、僵尸重投、并发上限与幂等键 |
| 账号安全 | ✅ | scrypt 密码哈希、登录限流、HttpOnly 会话、改密吊销其他会话、logout-all |
| 权限控制 | ✅ | 三种角色；管理接口仅 admin；业务数据按用户隔离 |
| 数据落库 | ✅ | PostgreSQL：任务、商品、订单与明细、物流轨迹、合规、广告、会话、埋点 |
| 合规 / 投流 / 订单 / 个人中心 | ✅ | 已接真实接口；数据来自演示种子或用户数据 |
| 账号 · 短信 · 支付 | ✅ | 邮箱/短信验证、套餐订阅、3DS、Webhook 幂等入账、退款与发票（网关为 mock） |
| 合规工程 | ✅ | GDPR + CCPA/CPRA + PIPL 并集：同意、DSAR、保留期、跨境机制、72h 泄露响应 |
| 运营后台 | ✅ | 总览、用户、店铺、审计日志、监控一屏（admin） |
| Shopify 同步 | ⚠️ | 授权后增量同步店铺/商品/订单，需对应 scope；token 过期标记为 expired |
| 移动端 | ✅ | 10 个页面接真实 API（`/mobile` 暂无登录守卫） |
| 国际化 | ✅ | 5 语种（zh/en/fr/de/es）全量接入，页面 CJK 硬编码归零 |
| 可访问性 | ✅ | WCAG 2.1 AA，axe-core 0 critical/serious |

## 功能概览

- **六大 Agent**：选品、建站、内容、投流、客服、履约；支持 OpenAI，失败自动回退本地规则
- **任务运行时**：任务持久化、五步进度、暂停/终止/重试、任务日志列表与详情
- **卖家工作台**：仪表盘、选品、建站、内容、投流、客服、履约订单、数据中心、合规中心、任务日志、设置、个人中心
- **管理后台**：运营总览、用户管理、店铺管理、审计日志、监控一屏（admin）
- **账号与计费**：注册/登录、邮箱与短信验证、角色权限、会话 Cookie、改密、套餐订阅、支付与退款
- **合规**：Cookie 同意横幅、DSAR 导出/删除、数据保留策略、跨境传输机制、Do Not Sell/Share
- **数据层**：PostgreSQL + Repository、幂等演示种子、按用户隔离
- **体验能力**：明暗主题、5 语种词条、离线缓存、语音输入、骨架屏、WCAG 2.1 AA

## 技术栈

- Next.js 14（App Router）+ React 18 + TypeScript
- Tailwind CSS 4
- PostgreSQL 16 + `pg` 连接池（测试用 PGlite 内嵌 Postgres，与生产同构）
- Redis 7（可选：限流共享状态、任务取消广播）
- Jest 30 + Testing Library + axe-core
- OpenAI Chat Completions API
- Docker 多阶段构建 + Nginx 反向代理

## 快速开始

环境要求：Node.js 20+（Docker 镜像基于 `node:20-alpine`）、npm、Docker（用于本地 Postgres/Redis）。

```bash
# 1. 安装依赖
npm install

# 2. 启动依赖服务（Postgres 16 + Redis 7）
docker compose up -d

# 3. 配置环境变量
cp .env.example .env        # Windows 可用 copy .env.example .env

# 4. 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

首次启动会自动执行幂等建表与迁移（`lib/db/init.ts`）。

演示数据说明：

- 开发环境默认开启示例数据（店铺、商品、订单、合规、广告）
- 如果首次启动时还没有用户，示例数据不会生成；**注册账号后重启一次 `npm run dev`**，示例数据会为该账号补齐
- 设置 `SEED_DEMO_DATA=false` 可关闭；生产环境不会自动写入

### 账号与权限

- 注册用户默认角色为 `viewer`
- 管理后台需要 `admin` 角色，可在数据库中修改：
  ```sql
  UPDATE users SET role = 'admin' WHERE username = '你的用户名';
  ```
- 登录成功后写入 `sumaitong_session`（HttpOnly + SameSite=Lax，7 天）
- 退出登录调用 `POST /api/auth/logout`；`POST /api/auth/logout-all` 退出全部设备

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串（必填） |
| `PG_POOL_SIZE` | 连接池上限，默认 10 |
| `REDIS_URL` | 可选；配置后限流状态共享、任务取消跨实例广播，缺失自动降级内存态 |
| `OPENAI_API_KEY` | OpenAI Key；不配置时六个 Agent 使用本地规则回退 |
| `OPENAI_MODEL` | 模型名，默认 `gpt-4o-mini` |
| `OPENAI_MAX_TOKENS` / `OPENAI_TIMEOUT_MS` | 调用参数 |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_REDIRECT_URI` | Shopify OAuth 配置 |
| `PAYMENT_WEBHOOK_SECRET` | 支付 Webhook HMAC 签名密钥；缺失时 `/api/webhooks/payment` 恒 503（fail-closed） |
| `SMS_PROVIDER` | `tencent`（默认）/ `aliyun`；凭据缺失自动降级 mock |
| `SMS_TENCENT_*` / `SMS_ALIYUN_*` | 对应供应商的密钥、签名与模板配置 |
| `EMAIL_PROVIDER` | 配置后走真实投递，否则非生产回显 devCode |
| `MAINTENANCE_SECRET` | 维护接口鉴权密钥；不配置则维护接口恒 403 |
| `SECRET_FAIL_FAST` | 生产默认开启，必填密钥缺失时阻断启动 |
| `WORKER_AUTO_START` | 每实例自动拉起任务 worker；只跑 API 时置 `false` |
| `ALERT_WEBHOOK_URL` / `QUEUE_ALERT_DEPTH` / `STALE_TASK_SECONDS` | 告警地址与阈值 |
| `SEED_DEMO_DATA` | `true/false`；开发环境默认开启示例数据 |

## 常用命令

```bash
npm run dev     # 开发模式
npm run build   # 生产构建
npm run start   # 启动生产服务
npm run test    # 运行 Jest 测试
npm run ci      # 门禁：tsc → jest → next build → lint
```

## 目录结构

```
app/                 # 页面与 API 路由（App Router）
  dashboard/         # 网页端卖家工作台
  mobile/            # 移动端页面
  admin/             # 管理后台
  api/               # 后端 API（会话鉴权、任务、数据、支付、合规、运维）
components/          # 通用组件
lib/
  agents/            # 六大 Agent、任务编排、输入适配
  framework/         # Orchestrator / 任务运行时 / 进度 / 状态机
  auth/              # 会话、守卫、密码哈希、登录限流、邮箱/短信验证
  db/                # Postgres 初始化、迁移、Repository、seed
  infra/             # Redis 客户端、任务取消广播
  task-runtime/      # DB 队列 worker 与自动启动注册
  payment/           # Checkout / 订阅 / 3DS / Webhook / 退款开票
  tax/               # VAT / OSS / US Sales Tax 计算
  privacy/           # DSAR、数据保留、跨境机制
  compliance/        # 上线合规检查（RoPA/DPIA）
  admin/             # 后台审计
  sms/               # 腾讯云/阿里云短信双供应商
  ai/                # OpenAI 客户端、Prompt、熔断
  i18n/              # 5 语种文案
  theme/             # 设计 Token
hooks/               # 在线状态、useAgentTask、useApi
tests/               # 98 个测试套件（含 a11y / e2e / load）
deploy/              # Nginx 反向代理配置
scripts/             # ci / release / canary / rollback / backup / dr-drill / monitor-alerts
data/                # 本地数据（不纳入版本管理）
```

## 测试

```bash
npm run test
npx tsc --noEmit
npm run ci          # 完整门禁
```

当前基线：**98 个测试套件 / 1100+ 用例全部通过**，覆盖 Agent 算法、任务运行时、鉴权与权限、API 路由、支付与 webhook、合规、数据隔离、i18n、可访问性、压测与页面组件。

## 发布与运维

| 脚本 | 用途 |
| --- | --- |
| `scripts/release.ps1` | tsc → jest → build → 打包 → SHA256 → RELEASE_NOTES → ROLLBACK |
| `scripts/canary.ps1` | 灰度：解包、切换目录、重启、连续探活，失败自动回滚 |
| `scripts/rollback.ps1` | 回滚：优先切 `previous`，否则取上一版 zip 并校验 SHA256，计时目标 ≤5 分钟 |
| `scripts/backup.sh` | `pg_dump -Fc` 全量备份与 `--restore` 演练 |
| `scripts/dr-drill.sh` | 灾备演练：恢复库行数比对，输出 PASS/FAIL |
| `scripts/monitor-alerts.sh` | 60s 轮询健康与队列指标，状态翻转才推送告警 |

健康检查：`GET /api/health`（db/redis 逐项探针，503 = not ready）；Prometheus 指标：`GET /api/monitor/metrics`。

## 已知限制

- **支付网关为 mock**：3DS 为模拟校验（固定码 `123456`），尚未接入真实渠道；接入真实网关只需替换 `lib/payment/payment-service.ts` 的网关适配层
- **短信/邮箱**未配置凭据时降级 mock，非生产会回显 `devCode`
- **合规文本**（隐私/条款/DPA、泄露通知函）为中文模板，未经外部律所审定
- **Shopify 同步**依赖授权 scope，且为 best-effort；token 过期仅标记 `expired`，需用户重新授权
- **`/mobile` 暂无登录守卫**，页面数据仍按 API 会话说隔离
- **E2E** 为 jsdom 渲染级 smoke，尚未接入真实浏览器（Playwright/Cypress）
- **数据库迁移仅前向**：回滚应用不回落 schema，必要时用发布前快照恢复

## 文档

- 执行台账（P0–P10 状态、DoD、实现位置）：[docs/EXECUTION.md](docs/EXECUTION.md)
- 产品调研、原型与交互方案：[业务调研与产品原型综合方案](跨境智卖——中小跨境卖家全链路AI操作系统%20业务调研与产品原型综合方案.md)
- 安全与任务闭环验收记录：`docs/verification/`

## 贡献者

- **xiaohe**（[@CoderTheCat](https://github.com/CoderTheCat)）—— 分支 `feat/p4-p5-readiness` 的生产化改造（P0–P10）