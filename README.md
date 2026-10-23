# 跨境智卖 · Smart Cross-border

面向中小跨境卖家的全链路 AI 运营平台原型（Web + Mobile + 管理后台），围绕 Shopify 生态，用六个 Agent 覆盖选品、建站、内容、投流、客服与履约。

> 当前定位：**高保真产品原型 / MVP**，可用于演示与答辩；部分业务页仍使用演示数据，生产化能力（鉴权、平台对接、数据同步）尚未完成。

## 功能概览

- **六大 Agent**：选品、建站、内容、投流、客服、履约，支持 OpenAI 调用，失败时自动回退到规则算法
- **卖家工作台**：仪表盘、AI 选品、智能建站、内容创作、广告优化、客服工作台、履约订单、数据中心、合规中心、任务日志、账号设置
- **移动端**：登录、首页、AI 指令、选品、内容、投流、订单、消息、个人中心等 10 个页面
- **管理后台**：运营总览、用户管理、店铺管理
- **基础能力**：SQLite 持久化、RBAC 三角色、5 语种国际化、明暗主题、离线缓存、语音输入、Agent 进度追踪框架

## 技术栈

- Next.js 14（App Router）+ React 18 + TypeScript
- Tailwind CSS 4
- better-sqlite3（本地 SQLite）
- Jest + Testing Library
- OpenAI Chat Completions API

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 填入 OPENAI_API_KEY；如需 Shopify 授权，再填 SHOPIFY_* 三项

# 3. 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

首次启动会自动创建 `data/sumaitong.db` 及数据表。默认没有业务数据，仪表盘会展示空状态。

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI Key；不配置时六个 Agent 使用本地规则回退 |
| `OPENAI_MODEL` | 模型名，默认 `gpt-4o-mini` |
| `OPENAI_MAX_TOKENS` / `OPENAI_TIMEOUT_MS` | 调用参数 |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_REDIRECT_URI` | Shopify OAuth 配置 |

## 常用命令

```bash
npm run dev     # 开发模式
npm run build   # 生产构建
npm run start   # 启动生产服务
npm run test    # 运行 Jest 测试
```

## 目录结构

```
app/                 # 页面与 API 路由（App Router）
  dashboard/         # 网页端卖家工作台
  mobile/            # 移动端页面
  admin/             # 管理后台
  api/               # 21 个后端接口
components/          # 通用组件
lib/
  agents/            # 六大 Agent 实现
  framework/         # Orchestrator / 消息总线 / 任务锁 / 进度追踪
  db/                # SQLite 初始化与 Repository
  ai/                # OpenAI 客户端与 Prompt
  i18n/              # 5 语种文案
  theme/             # 设计 Token
hooks/               # 在线状态等 Hooks
tests/               # 49 个测试文件 / 698 个用例
data/                # 本地数据库（不纳入版本管理）
```

## 测试

```bash
npm run test
```

测试覆盖 Agent 算法、框架组件、API 路由、国际化、主题与部分页面组件。

## 已知限制

- 选品、投流、合规、任务日志等页面仍以演示数据为主，尚未全部接入数据库
- `/api/agent/pause|terminate|retry` 等控制接口尚未实现，Agent 进度仅有框架层
- 登录态基于 `sessionStorage`，管理后台接口尚未接入服务端鉴权，**不可直接用于生产**
- Shopify OAuth 仅完成 token 交换，未同步商品/订单
- 移动端页面目前为静态原型

## 文档

产品调研、原型与交互方案见仓库根目录：
`跨境智卖——中小跨境卖家全链路AI操作系统 业务调研与产品原型综合方案.md`
