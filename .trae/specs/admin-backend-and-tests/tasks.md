# Tasks

- [x] Task 1: 密码安全加固 — 将明文密码改为 SHA-256 hash
  - [x] SubTask 1.1: 在 `lib/auth/` 新建 `password-hash.ts`，封装 `hashPassword()` 和 `verifyPasswordHash()` 函数
  - [x] SubTask 1.2: 修改 `lib/db/user-repository.ts`，`create()` 存储 hash，`verifyPassword()` 使用 hash 比对
  - [x] SubTask 1.3: 修改 `app/api/auth/route.ts`，注册和登录调用 hash 函数
  - [x] SubTask 1.4: 为 `password-hash.ts` 编写单元测试 `tests/auth/password-hash.test.ts`

- [x] Task 2: 管理员后台 API 路由
  - [x] SubTask 2.1: 创建 `app/api/admin/users/route.ts` — GET 返回用户列表（含分页、角色筛选），POST 更新用户角色
  - [x] SubTask 2.2: 创建 `app/api/admin/shops/route.ts` — GET 返回全平台店铺列表（含用户信息关联）
  - [x] SubTask 2.3: 创建 `app/api/admin/stats/route.ts` — GET 返回聚合统计数据（用户数、店铺数、GMV、AI调用次数）
  - [x] SubTask 2.4: 为 3 个 admin API 编写单元测试 `tests/api/admin-api.test.ts`

- [x] Task 3: 管理员后台路由守卫扩展
  - [x] SubTask 3.1: 修改 `lib/auth/route-guard.ts`，在 `PAGE_PERMISSIONS` 中新增 `/admin` 和 `/admin/*` 仅 admin 角色可访问
  - [x] SubTask 3.2: 更新 `tests/auth/route-guard.test.ts`，增加 admin 路由权限测试用例

- [x] Task 4: 管理员后台页面
  - [x] SubTask 4.1: 创建 `app/admin/layout.tsx` — 管理员后台独立布局（顶部导航 + 左侧菜单 + 主体区）
  - [x] SubTask 4.2: 创建 `app/admin/page.tsx` — 运营数据总览仪表盘（用户数/店铺数/GMV/AI调用统计卡片 + 趋势图占位）
  - [x] SubTask 4.3: 创建 `app/admin/users/page.tsx` — 用户管理页面（用户列表表格 + 角色修改 + 启用/禁用）
  - [x] SubTask 4.4: 创建 `app/admin/shops/page.tsx` — 店铺管理页面（店铺列表 + 授权状态 + 所属用户）

- [x] Task 5: 补全缺失模块的单元测试
  - [x] SubTask 5.1: 创建 `tests/ai/openai-client.test.ts` — 测试 `isOpenAIAvailable()`、`callOpenAIJSON()` 降级逻辑
  - [x] SubTask 5.2: 创建 `tests/api/dashboard-stats.test.ts` — 测试 `/api/dashboard/stats` 聚合逻辑
  - [x] SubTask 5.3: 创建 `tests/api/password-api.test.ts` — 测试 `/api/auth/password` 修改密码流程
  - [x] SubTask 5.4: 创建 `tests/admin/admin-dashboard.test.tsx` — 测试管理员后台页面渲染

- [x] Task 6: 全量验证
  - [x] SubTask 6.1: 运行 `npx tsc --noEmit` 确认 0 编译错误
  - [x] SubTask 6.2: 运行 `npx jest --passWithNoTests` 确认全量测试通过
  - [x] SubTask 6.3: 更新 `checklist.md` 打勾所有验证项

# Task Dependencies
- [Task 2] depends on [Task 1] (admin API 需要 hash 支持)
- [Task 3] depends on [Task 1] (路由守卫与认证配合)
- [Task 4] depends on [Task 2, Task 3] (页面需要 API 和权限)
- [Task 5] depends on [Task 1, Task 2] (测试需要被测模块就位)
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
