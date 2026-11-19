# 跨境智卖 · Smart Cross-border

面向中小跨境卖家的全链路 AI 运营平台（Web + Mobile + 管理后台），围绕 Shopify 生态，用六个 Agent 覆盖选品、建站、内容、投流、客服与履约。

> 当前定位：**可演示的 MVP**。P0 级的任务闭环、数据落库、账号安全与服务端会话已完成；真实平台对接、移动端和国际化仍在推进。

## 项目状态

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 六大 Agent 任务闭环 | ✅ | taskId/displayId、五步进度、暂停/终止/重试、任务日志 |
| 账号安全 | ✅ | scrypt 密码哈希、登录限流、HttpOnly 会话、改密吊销其他会话 |
| 权限控制 | ✅ | 三种角色；管理接口仅 admin；业务数据按用户隔离 |
| 数据落库 | ✅ | 任务日志、商品、订单、合规、广告、会话均落 SQLite |
| 合规 / 投流 / 订单 / 个人中心 | ✅ | 已接真实接口；数据来自演示种子或用户数据 |
| Shopify 同步 | ⚠️ | 授权后 best-effort 同步店铺/商品/订单，需要对应 scope |
| 移动端 | ⚠️ | 10 个页面为静态原型，暂无登录守卫 |
| 国际化 | ⚠️ | 5 语种词条齐全，但仅部分页面接入 `useTranslation` |

## 功能概览

- **六大 Agent**：选品、建站、内容、投流、客服、履约；支持 OpenAI，失败自动回退本地规则
- **任务运行时**：任务持久化、五步进度、暂停/终止/重试、任务日志列表与详情
- **卖家工作台**：仪表盘、选品、建站、内容、投流、客服、履约订单、数据中心、合规中心、任务日志、设置、个人中心
- **管理后台**：运营总览、用户管理、店铺管理（admin）
- **账号体系**：注册/登录、角色权限、会话 Cookie、改密、退出登录
- **数据层**：SQLite + Repository、幂等演示种子、按用户隔离
- **体验能力**：明暗主题、5 语种词条、离线缓存、语音输入、骨架屏

## 技术栈

- Next.js 14（App Router）+ React 18 + TypeScript
- Tailwind CSS 4
- better-sqlite3（本地 SQLite）
- Jest + Testing Library
- OpenAI Chat Completions API

## 快速开始

环境要求：Node.js 18+（推荐 20/24）、npm。

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env        # Windows 可用 copy .env.example .env

# 3. 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

首次启动会自动创建 `data/sumaitong.db` 和数据表。

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
- 退出登录调用 `POST /api/auth/logout`，会销毁当前会话

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI Key；不配置时六个 Agent 使用本地规则回退 |
| `OPENAI_MODEL` | 模型名，默认 `gpt-4o-mini` |
| `OPENAI_MAX_TOKENS` / `OPENAI_TIMEOUT_MS` | 调用参数 |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_REDIRECT_URI` | Shopify OAuth 配置 |
| `SEED_DEMO_DATA` | `true/false`；开发环境默认开启示例数据 |

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
  api/               # 后端 API（会话鉴权、任务、数据、合规、广告）
components/          # 通用组件
lib/
  agents/            # 六大 Agent、任务编排、输入适配
  framework/         # Orchestrator / 任务运行时 / 进度 / 状态机
  auth/              # 会话、守卫、密码哈希、登录限流
  db/                # SQLite 初始化、迁移、Repository、seed
  ai/                # OpenAI 客户端与 Prompt
  i18n/              # 5 语种文案
  theme/             # 设计 Token
hooks/               # 在线状态、useAgentTask
tests/               # 76 个测试套件 / 943 个用例
data/                # 本地数据库（不纳入版本管理）
```

## 测试

```bash
npm run test
npx tsc --noEmit
```

当前基线：**76 个测试套件 / 943 个用例全部通过**，覆盖 Agent 算法、任务运行时、鉴权与权限、API 路由、数据隔离、i18n、主题和页面组件。

## 已知限制

- **合规/投流数据**来自演示种子，不是真实政策库或广告平台同步；关闭 seed 时为空态
- **订单明细/物流轨迹**暂无对应表，接口返回空数组，页面显示“暂无”
- **暂停/终止**为协作式：终止会让任务提前返回，但底层 LLM HTTP 请求尚未接入 `AbortSignal`
- **移动端**为静态原型，`/mobile` 暂无登录守卫
- **国际化**词条齐全，但仅 6/38 个页面/布局接入翻译
- **CSRF** 目前仅依赖 SameSite=Lax，生产建议增加 Origin 校验或双提交 Token
- **会话清理**为惰性删除，固定 7 天，无 logout-all / 滑动续期
- 缺少浏览器端 E2E，当前以 Jest 组件/接口测试为主

## 文档

- 产品调研、原型与交互方案：[业务调研与产品原型综合方案](跨境智卖——中小跨境卖家全链路AI操作系统%20业务调研与产品原型综合方案.md)
- 安全与任务闭环验收记录：`docs/verification/`
