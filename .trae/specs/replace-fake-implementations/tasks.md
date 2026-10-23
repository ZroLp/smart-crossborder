# Tasks

- [x] Task 1: 创建 OpenAI 统一客户端和 .env 模板
  - [x] Subtask 1.1: 创建 `lib/ai/openai-client.ts`，封装 OpenAI API 调用（chat completions），支持结构化 JSON 输出
  - [x] Subtask 1.2: 创建 `lib/ai/prompts.ts`，集中管理 6 个 Agent + NLP 的 system prompt 模板
  - [x] Subtask 1.3: 更新 `.env.example`，新增 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_MAX_TOKENS`、`OPENAI_TIMEOUT_MS` 环境变量
  - [x] Subtask 1.4: 实现降级机制：API Key 不存在或调用失败时自动降级到硬编码规则，输出警告日志

- [x] Task 2: 替换选品 Agent 假实现
  - [x] Subtask 2.1: 修改 `lib/agents/product-selection.ts`，使用 OpenAI API 替代硬编码评分公式
  - [x] Subtask 2.2: 在 `lib/ai/prompts.ts` 添加选品专用 prompt（市场分析、评分维度、JSON Schema）
  - [x] Subtask 2.3: 保持降级路径（API 不可用时使用原硬编码逻辑）
  - [x] Subtask 2.4: 更新返回数据结构为标准格式（status/data/ai_provider/response_time_ms/error）

- [x] Task 3: 替换建站 Agent 假实现
  - [x] Subtask 3.1: 修改 `lib/agents/store-builder.ts`，使用 AI 根据选品结果和店铺风格生成定制化模板
  - [x] Subtask 3.2: 在 `lib/ai/prompts.ts` 添加建站专用 prompt
  - [x] Subtask 3.3: 保持降级路径（API 不可用时使用原 6 个硬编码模板）
  - [x] Subtask 3.4: 更新返回数据结构为标准格式

- [x] Task 4: 替换内容 Agent 假实现
  - [x] Subtask 4.1: 修改 `lib/agents/content-creator.ts`，使用 AI 生成多语言营销文案
  - [x] Subtask 4.2: 在 `lib/ai/prompts.ts` 添加内容生成专用 prompt（标题/描述/SEO 标签）
  - [x] Subtask 4.3: 保持降级路径（API 不可用时使用原语言模板拼接）
  - [x] Subtask 4.4: 更新返回数据结构为标准格式

- [x] Task 5: 替换投流 Agent 假实现
  - [x] Subtask 5.1: 修改 `lib/agents/ad-optimizer.ts`，使用 AI 分析投放数据并生成优化建议
  - [x] Subtask 5.2: 在 `lib/ai/prompts.ts` 添加投流优化专用 prompt
  - [x] Subtask 5.3: 保持降级路径（API 不可用时使用原数学计算规则）
  - [x] Subtask 5.4: 更新返回数据结构为标准格式

- [x] Task 6: 替换客服 Agent 假实现
  - [x] Subtask 6.1: 修改 `lib/agents/customer-service.ts`，使用 AI 进行意图识别和回复生成
  - [x] Subtask 6.2: 在 `lib/ai/prompts.ts` 添加客服专用 prompt（意图分类、情绪分析、多语言回复）
  - [x] Subtask 6.3: 保持降级路径（API 不可用时使用原关键词匹配）
  - [x] Subtask 6.4: 更新返回数据结构为标准格式

- [x] Task 7: 替换履约 Agent 假实现
  - [x] Subtask 7.1: 修改 `lib/agents/fulfillment.ts`，使用 AI 选择最优物流渠道和发货策略
  - [x] Subtask 7.2: 在 `lib/ai/prompts.ts` 添加履约专用 prompt
  - [x] Subtask 7.3: 保持降级路径（API 不可用时使用原硬编码渠道 + Math.random()）
  - [x] Subtask 7.4: 更新返回数据结构为标准格式

- [x] Task 8: 替换 NLP 指令解析为 LLM 语义理解
  - [x] Subtask 8.1: 修改 `lib/framework/nl-parser.ts`，使用 AI 进行意图识别替代关键词匹配
  - [x] Subtask 8.2: 在 `lib/ai/prompts.ts` 添加 NLP 解析专用 prompt
  - [x] Subtask 8.3: 保持降级路径（API 不可用时使用原关键词匹配）
  - [x] Subtask 8.4: 修改 `app/api/command/route.ts`，适配新的解析结果格式（添加 await）

- [x] Task 9: Dashboard 首页接入真实数据
  - [x] Subtask 9.1: 创建 `app/api/dashboard/stats/route.ts`，从 SQLite 聚合营收/订单/ROAS/客服率数据
  - [x] Subtask 9.2: 修改 `app/dashboard/page.tsx`，从 `/api/dashboard/stats` 获取真实数据替代硬编码
  - [x] Subtask 9.3: 实现无数据兜底提示（新用户引导）
  - [x] Subtask 9.4: 保持骨架屏加载过渡效果

- [x] Task 10: Shopify OAuth 前端入口补全
  - [x] Subtask 10.1: 在 `app/login/page.tsx` 添加 Shopify 绑定入口 UI（登录成功后首次展示授权引导卡片）
  - [x] Subtask 10.2: 更新 `.env.example`，新增 `SHOPIFY_API_KEY`、`SHOPIFY_API_SECRET`、`SHOPIFY_REDIRECT_URI` 占位配置
  - [x] Subtask 10.3: OAuth state 从进程内存（Map）改为 SQLite 存储（支持多实例部署）

- [x] Task 11: Settings 页面新增 API 配置区
  - [x] Subtask 11.1: 在 `app/dashboard/settings/page.tsx` 新增"AI 服务配置"区块（API Key 状态、模型选择）
  - [x] Subtask 11.2: 在 Settings 页面新增"Shopify 店铺"区块（已绑定店铺列表、授权状态、解绑按钮）
  - [x] Subtask 11.3: 替换硬编码用户名/邮箱/API Keys 展示为真实用户数据

- [x] Task 12: 业务页面接入真实 API 数据源
  - [x] Subtask 12.1: 修改 `app/dashboard/selection/page.tsx`，从 Agent 执行结果获取真实选品数据
  - [x] Subtask 12.2: 修改 `app/dashboard/store-builder/page.tsx`，从 Agent 执行结果获取真实建站数据
  - [x] Subtask 12.3: 修改 `app/dashboard/content/page.tsx`，从 Agent 执行结果获取真实文案
  - [x] Subtask 12.4: 修改 `app/dashboard/ad-optimizer/page.tsx`，从 Agent 执行结果获取真实投放数据
  - [x] Subtask 12.5: 修改 `app/dashboard/customer-service/page.tsx`，从 Agent 执行结果获取真实回复
  - [x] Subtask 12.6: 修改 `app/dashboard/fulfillment/page.tsx`，从 Agent 执行结果获取真实物流数据

- [x] Task 13: 全量测试
  - [x] Subtask 13.1: 更新 `tests/api/agent-execution.test.ts` 适配新的标准返回数据格式
  - [x] Subtask 13.2: 更新 `tests/agents/*.test.ts` 验证降级机制（无 API Key 时正常降级）
  - [x] Subtask 13.3: 新增 `tests/ai/openai-client.test.ts` 测试 OpenAI 客户端调用和降级逻辑
  - [x] Subtask 13.4: 运行 `npx jest --passWithNoTests` 确保全量测试通过

- [x] Task 14: TypeScript 编译验证
  - [x] Subtask 14.1: 修复所有 Agent 返回值中 `ai_provider` 类型不兼容（添加 `as const`）
  - [x] Subtask 14.2: 修复 `nl-parser.test.ts` 中 `parse()` 异步调用
  - [x] Subtask 14.3: 修复 `locale-context.test.tsx` 中 `defaultValue` 访问方式
  - [x] Subtask 14.4: 修复 `agent-chain-closure.test.ts` / `agent-chain.test.ts` 中 `unknown` 类型断言
  - [x] Subtask 14.5: 运行 `npx tsc --noEmit` 确认 0 个编译错误

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 1]
- [Task 7] depends on [Task 1]
- [Task 8] depends on [Task 1]
- [Task 9] depends on [Task 2, Task 3, Task 4, Task 5, Task 6, Task 7]
- [Task 10] depends on [Task 1]
- [Task 11] depends on [Task 10]
- [Task 12] depends on [Task 2, Task 3, Task 4, Task 5, Task 6, Task 7]
- [Task 13] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10, Task 11, Task 12]
- [Task 14] depends on [Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8]
