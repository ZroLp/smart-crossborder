# Replace Fake Implementations Spec

## Why
经过 `audit-fake-implementations` 审计发现，项目中 6 个 Agent 模块、Dashboard 首页、业务页面全部使用硬编码数据模拟，Shopify OAuth 缺少前端入口和环境变量配置，NLP 指令解析仅为关键词匹配。需要将假实现替换为真实的外部 API 调用和数据查询。

## What Changes
- 接入 OpenAI API（GPT-4o-mini），替换 6 个 Agent 的硬编码规则
- NLP 指令解析升级为 LLM 语义理解
- Dashboard 首页改为从 SQLite 聚合真实数据
- 补全 Shopify OAuth 环境变量模板 + 前端绑定入口
- Settings 页面新增 API 配置区
- 业务页面从硬编码改为调用后端 API
- **BREAKING**: Agent 执行结果数据结构变更（从硬编码格式变为 AI 返回的 JSON 格式）
- **BREAKING**: `.env` 需要新增 `OPENAI_API_KEY` 等必需配置

## Impact
- Affected specs: audit-fake-implementations（基于审计结果）、build-full-implementation、gap-closure
- Affected code: 
  - `lib/agents/product-selection.ts`, `store-builder.ts`, `content-creator.ts`, `ad-optimizer.ts`, `customer-service.ts`, `fulfillment.ts`
  - `lib/framework/nl-parser.ts`
  - `app/dashboard/page.tsx`
  - `app/dashboard/selection/page.tsx`, `store-builder/page.tsx`, `content/page.tsx`, `ad-optimizer/page.tsx`, `customer-service/page.tsx`, `fulfillment/page.tsx`
  - `app/dashboard/settings/page.tsx`
  - `app/login/page.tsx`
  - `app/api/command/route.ts`
  - `.env.example`

## ADDED Requirements

### Requirement: OpenAI API 统一接入
系统 SHALL 通过统一的 `lib/ai/openai-client.ts` 模块接入 OpenAI API，所有 Agent 复用该客户端。

#### Scenario: API 调用成功
- **WHEN** Agent 调用 `callOpenAI(prompt)` 发送请求
- **THEN** 返回 AI 生成的结构化 JSON 结果

#### Scenario: API Key 未配置
- **WHEN** `OPENAI_API_KEY` 环境变量不存在
- **THEN** 降级使用当前的硬编码规则（兼容降级），并输出警告日志

#### Scenario: API 调用失败（网络/超时）
- **WHEN** OpenAI API 返回错误或超时
- **THEN** Agent 记录错误日志，返回降级结果（当前硬编码规则），不阻断用户流程

### Requirement: 选品 Agent — AI 真实选品
选品 Agent SHALL 使用 AI 分析市场趋势、竞争度、利润率，输出选品评分和推荐列表。

#### Scenario: AI 选品成功
- **WHEN** 用户输入选品指令（如"帮我选夏季热销产品"）
- **THEN** AI 基于 prompt 分析市场数据（模拟 API 可替换为真实数据源），输出结构化 JSON（产品名称、市场热度、竞争度、利润率、推荐理由）

#### Scenario: 降级模式
- **WHEN** OpenAI API 不可用
- **THEN** 使用当前硬编码评分公式返回结果，前端标注"AI 服务降级"

### Requirement: 建站 Agent — AI 生成店铺模板
建站 Agent SHALL 使用 AI 根据选品结果和店铺风格生成定制化的 Shopify 店铺结构和页面内容。

#### Scenario: AI 建站成功
- **WHEN** 用户输入建站指令（如"帮我建一个宠物用品店"）
- **THEN** AI 生成店铺结构 JSON（主题风格、页面布局、导航菜单、配色方案）

#### Scenario: 降级模式
- **WHEN** OpenAI API 不可用
- **THEN** 使用当前 6 个硬编码模板返回

### Requirement: 内容 Agent — AI 生成营销文案
内容 Agent SHALL 使用 AI 根据产品信息生成多语言营销文案（标题、描述、标签）。

#### Scenario: AI 内容生成成功
- **WHEN** 用户输入内容生成指令（如"为这款蓝牙耳机写英文描述"）
- **THEN** AI 生成多语言文案（标题 + 描述 + SEO 标签），输出结构化 JSON

#### Scenario: 降级模式
- **WHEN** OpenAI API 不可用
- **THEN** 使用当前语言模板拼接返回

### Requirement: 投流 Agent — AI 优化投放策略
投流 Agent SHALL 使用 AI 分析投放数据，优化 CPC、预算分配、受众定向。

#### Scenario: AI 投放优化成功
- **WHEN** 用户输入投放指令（如"优化我的广告 ROAS"）
- **THEN** AI 输出优化建议 JSON（CPC 调整、预算重分配、受众推荐、预期 ROAS）

#### Scenario: 降级模式
- **WHEN** OpenAI API 不可用
- **THEN** 使用当前数学计算规则返回

### Requirement: 客服 Agent — AI 智能回复
客服 Agent SHALL 使用 AI 分析客户消息意图，生成个性化回复。

#### Scenario: AI 客服回复成功
- **WHEN** 收到客户消息
- **THEN** AI 分析意图并生成回复（支持 5 种语言），输出 JSON（意图分类、回复内容、情绪标签）

#### Scenario: 降级模式
- **WHEN** OpenAI API 不可用
- **THEN** 使用当前关键词匹配 + 固定模板返回

### Requirement: 履约 Agent — AI 物流调度
履约 Agent SHALL 使用 AI 根据订单信息选择最优物流渠道和发货策略。

#### Scenario: AI 履约调度成功
- **WHEN** 用户输入履约指令（如"处理 10 个美国订单"）
- **THEN** AI 输出调度方案 JSON（物流渠道选择、预计时效、成本估算、库存状态）

#### Scenario: 降级模式
- **WHEN** OpenAI API 不可用
- **THEN** 使用当前硬编码物流渠道 + Math.random() 模拟库存返回

### Requirement: NLP 指令解析 — LLM 语义理解
NLP 解析器 SHALL 使用 AI 进行自然语言意图识别，而非关键词匹配。

#### Scenario: AI 意图识别成功
- **WHEN** 用户输入自然语言指令（如"帮我找一些夏季热卖的产品，然后建个店卖"）
- **THEN** AI 识别意图并输出结构化解析结果（Agent 类型、参数、关联动作）

#### Scenario: 降级模式
- **WHEN** OpenAI API 不可用
- **THEN** 使用当前关键词匹配逻辑降级

### Requirement: Dashboard 首页 — 真实数据聚合
Dashboard 首页 SHALL 从 SQLite 数据库聚合真实的经营数据，而非硬编码。

#### Scenario: 数据聚合展示
- **WHEN** 用户访问 Dashboard
- **THEN** 从 orders 表聚合营收/订单数，从 agent_runs 表计算 ROAS，从 tasks 表计算客服响应率

#### Scenario: 无数据兜底
- **WHEN** 数据库无订单数据（新用户）
- **THEN** 展示引导提示"你还没有订单数据，试试下发 AI 指令"，显示 0 值

### Requirement: Shopify OAuth — 前端入口 + 环境变量
系统 SHALL 补全 Shopify OAuth 的前端绑定入口和环境变量模板。

#### Scenario: 登录页 Shopify 绑定入口
- **WHEN** 用户登录成功后
- **THEN** 首次进入展示 Shopify 授权引导卡片，点击按钮跳转 Shopify OAuth

#### Scenario: .env.example 配置模板
- **WHEN** 用户查看 .env.example
- **THEN** 包含 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_MAX_TOKENS`、`OPENAI_TIMEOUT_MS` 及 `SHOPIFY_API_KEY`、`SHOPIFY_API_SECRET`、`SHOPIFY_REDIRECT_URI`

### Requirement: Settings — API 配置区
Settings 页面 SHALL 新增 API 配置区，展示和编辑 AI 和 Shopify 相关配置。

#### Scenario: API 配置展示
- **WHEN** 用户打开 Settings 页面
- **THEN** 展示 OpenAI 配置（API Key 状态、模型选择）和 Shopify 配置（已绑定店铺列表、API 状态）

## MODIFIED Requirements

### Requirement: Agent 执行结果数据结构
所有 Agent 的 `execute()` 方法返回结果 SHALL 统一为标准化 JSON 格式：
```json
{
  "status": "success" | "partial" | "failed",
  "data": { ...agent-specific-data... },
  "ai_provider": "openai" | "fallback",
  "response_time_ms": 1234,
  "error": null | "error message"
}
```

### Requirement: 业务页面数据来源
所有业务页面 SHALL 通过 `/api/` 端点获取数据，不再使用组件内硬编码数组。

## REMOVED Requirements
无。降级机制保留所有现有硬编码逻辑作为 fallback，不删除。
