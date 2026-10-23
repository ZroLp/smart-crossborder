# Audit Fake Implementations & Shopify Binding Spec

## Why
用户询问项目中存在哪些假实现/占位实现，以及 Shopify 店铺绑定功能是否可用。需要全面审计代码库，列出所有未接入真实外部服务的功能模块。

## What Changes
- 创建完整的假实现/占位实现清单文档
- 明确 Shopify OAuth 流程的实际可用性
- 标记各功能模块的成熟度状态

## Impact
- Affected specs: build-full-implementation, gap-closure（后续可按此清单逐步替换假实现）
- Affected code: 6 个 Agent 模块、Dashboard 首页、Shopify OAuth、多个业务页面

## 假实现/占位实现清单

### 1. Agent 模块 — 全部为假实现（无外部 AI 调用）
所有 6 个 Agent 均未调用任何 AI API（如 OpenAI、Claude 等），完全使用**硬编码规则 + 模板**进行模拟：

| Agent | 文件 | 实现方式 |
|-------|------|----------|
| 选品 Agent | `lib/agents/product-selection.ts` | 硬编码评分公式（marketHeat/competitionLevel/profitMargin），无真实市场数据抓取 |
| 建站 Agent | `lib/agents/store-builder.ts` | 6 个硬编码模板 + hashName 生成假 productId |
| 内容 Agent | `lib/agents/content-creator.ts` | 语言模板拼接，非 AI 生成文案 |
| 投流 Agent | `lib/agents/ad-optimizer.ts` | 纯数学计算（ROAS/CPC/CTR），无真实广告平台对接 |
| 客服 Agent | `lib/agents/customer-service.ts` | 关键词匹配意图识别 + 固定回复模板 |
| 履约 Agent | `lib/agents/fulfillment.ts` | 5 个硬编码物流渠道 + `Math.random()` 模拟库存 |

### 2. NLP 指令解析 — 假实现
- `lib/framework/nl-parser.ts`：使用关键词匹配（非 NLP/LLM），根据预设关键词匹配 Agent 类型
- `/api/command`：仅做关键词解析，无语义理解

### 3. Dashboard 首页 — 全部硬编码
- `app/dashboard/page.tsx`：所有数据（营收 ¥128,560、订单 86、ROAS 3.2 等）均为硬编码
- 刷新按钮仅模拟加载动画，无真实数据请求
- Agent 状态（online/busy）为写死值

### 4. 业务页面 — 硬编码数据
| 页面 | 文件 | 问题 |
|------|------|------|
| 选品页 | `app/dashboard/selection/page.tsx` | 商品数据硬编码，无真实选品 API |
| 建站页 | `app/dashboard/store-builder/page.tsx` | 模板列表硬编码 |
| 内容页 | `app/dashboard/content/page.tsx` | 文案生成实际调用的是模板 Agent |
| 投流页 | `app/dashboard/ad-optimizer.tsx` | 广告数据硬编码 |
| 客服页 | `app/dashboard/customer-service/page.tsx` | FAQ 数据硬编码 |
| 履约页 | `app/dashboard/fulfillment/page.tsx` | 订单数据硬编码 |
| 数据中心 | `app/dashboard/data-center/page.tsx` | 图表占位符（chartPlaceholders） |
| 合规页 | `app/dashboard/compliance/page.tsx` | 政策更新、税务提醒全部硬编码 |
| 任务日志 | `app/dashboard/task-logs/page.tsx` | 初始日志硬编码 |

### 5. Settings 页面 — 部分假实现
- `app/dashboard/settings/page.tsx`：用户名（跨境卖家_Alex）、邮箱、API Endpoint、Webhook URL、API Keys、订阅计划均为硬编码展示
- 密码修改、通知设置无真实 API 提交逻辑
- 唯一真实的部分：角色查询/修改（调用 `/api/users/all` 和 `/api/users/role`）

### 6. Shopify OAuth — 框架完整但不可直接使用
- `app/api/auth/shopify/route.ts`：生成授权 URL，**需要 `SHOPIFY_API_KEY` 和 `SHOPIFY_REDIRECT_URI` 环境变量**
- `app/api/auth/shopify/callback/route.ts`：处理回调、交换 token、存储店铺，**需要 `SHOPIFY_API_SECRET` 环境变量**
- `lib/shopify/oauth-state.ts`：使用 Map 存储 OAuth state（**进程内存级，不支持多实例部署**）
- `.env` 文件中**不存在** `SHOPIFY_API_KEY`、`SHOPIFY_API_SECRET`、`SHOPIFY_REDIRECT_URI` 配置
- 登录页面**没有** Shopify 绑定入口

### 7. AI 能力 — 完全未接入
- 项目中没有任何 OpenAI / Claude / 任何 LLM API 的调用代码
- 无 `.env` 中的 `OPENAI_API_KEY` 或类似配置
- 所有 "AI 指令" 功能均靠关键词匹配 + 模板规则模拟

### 8. 真实实现（已接入数据库的 API）
| 功能 | 状态 |
|------|------|
| 用户注册/登录 | ✅ 真实（SQLite） |
| 权限控制/RBAC | ✅ 真实（SQLite） |
| 国际化/多主题 | ✅ 真实（Context + DB） |
| 用户偏好设置 | ✅ 真实（API + SQLite） |
| 商品/订单/任务日志 CRUD | ✅ 真实（Repository + SQLite） |
| 店铺管理（CRUD） | ✅ 真实（但无 Shopify 绑定入口） |
| Agent 进度追踪 | ✅ 真实（SQLite） |
| Agent 执行（orchestrator） | ✅ 框架真实，但 Agent 内部为假实现 |

## Shopify 绑定问题回答
**Shopify OAuth 框架已完整实现**（授权 URL 生成 → 回调处理 → Token 交换 → 店铺存储），但当前**无法直接使用**，原因：
1. 缺少环境变量配置（`SHOPIFY_API_KEY`、`SHOPIFY_API_SECRET`、`SHOPIFY_REDIRECT_URI`）
2. 需要在 Shopify Partners 后台创建 App 并配置授权域名
3. 登录页面/前端没有 Shopify 绑定入口 UI
4. OAuth state 存储在进程内存（Map），多实例部署会失效

## ADDED Requirements
### Requirement: 假实现审计文档
系统应有一份完整的假实现/占位实现清单，按模块分类标注实现状态。

### Requirement: Shopify 可用性说明
明确说明 Shopify 绑定的当前状态、所需配置、阻塞原因。
