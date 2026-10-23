# Tasks

- [x] Task 1: 审计假实现和占位实现
  - [x] Subtask 1.1: 审计 6 个 Agent 模块（选品/建站/内容/投流/客服/履约）— 全部为假实现
  - [x] Subtask 1.2: 审计 NLP 指令解析 — 关键词匹配假实现
  - [x] Subtask 1.3: 审计 Dashboard 首页 — 全部硬编码
  - [x] Subtask 1.4: 审计各业务页面（选品/建站/内容/投流/客服/履约/数据中心/合规/任务日志）— 硬编码数据
  - [x] Subtask 1.5: 审计 Settings 页面 — 部分假实现
  - [x] Subtask 1.6: 审计 AI 能力接入 — 完全未接入

- [x] Task 2: 审计 Shopify 绑定功能
  - [x] Subtask 2.1: 审计 Shopify OAuth 路由（授权 URL + 回调 + Token 交换）
  - [x] Subtask 2.2: 审计环境变量配置（缺少 SHOPIFY_API_KEY/SECRET/REDIRECT_URI）
  - [x] Subtask 2.3: 审计前端 Shopify 绑定入口（无入口 UI）
  - [x] Subtask 2.4: 审计 OAuth state 存储（进程内存级，不支持多实例）

- [x] Task 3: 生成审计文档
  - [x] Subtask 3.1: 编写 spec.md 包含完整假实现清单和 Shopify 可用性说明

# Task Dependencies
无依赖，按顺序执行
