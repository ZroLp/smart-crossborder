# Admin Backend & Test Coverage Spec

## Why

产品文档（跨境智卖方案）已新增完整的管理员后台章节，但代码中 `/app/admin/` 路径完全不存在。同时，多个已实现模块缺少单元测试（11个 API 路由、OpenAI 客户端、密码管理等）。需要补全管理员后台核心页面和关键模块的测试覆盖。

## What Changes

- 新增管理员后台页面（运营数据总览、用户管理、店铺管理）
- 新增管理员后台 API 路由（统计数据聚合、用户CRUD、店铺查询）
- 新增管理员后台路由守卫
- 补全关键模块单元测试（openai-client、API 路由、admin 页面）
- 修复密码明文存储问题（改用 hash）

## Impact

- Affected specs: 管理员后台、用户认证安全、API 测试覆盖
- Affected code:
  - 新增: `app/admin/` (页面), `app/api/admin/` (API路由)
  - 修改: `lib/auth/route-guard.ts` (新增 admin 路由权限)
  - 修改: `lib/db/user-repository.ts` (密码 hash)
  - 修改: `app/api/auth/route.ts` (注册/登录改用 hash)
  - 新增: `tests/api/` (API 测试), `tests/admin/` (admin 测试)

## ADDED Requirements

### Requirement: Admin Dashboard Overview

系统 SHALL 为 admin 角色提供运营数据总览仪表盘。

#### Scenario: Admin views dashboard
- **WHEN** admin 访问 `/admin`
- **THEN** 展示全平台用户总数、店铺总数、AI调用总量、GMV 聚合数据

#### Scenario: Non-admin access denied
- **WHEN** 非 admin 角色访问 `/admin`
- **THEN** 重定向到 `/dashboard/403`

### Requirement: Admin User Management

系统 SHALL 为 admin 提供用户列表查询和角色管理能力。

#### Scenario: List users
- **WHEN** admin 调用 `GET /api/admin/users`
- **THEN** 返回所有用户列表（id/username/role/created_at），支持分页

#### Scenario: Update user role
- **WHEN** admin 调用 `POST /api/admin/users/role` 携带 `{userId, role}`
- **THEN** 更新目标用户角色，记录审计日志

### Requirement: Admin Shop Management

系统 SHALL 为 admin 提供全平台店铺查询能力。

#### Scenario: List all shops
- **WHEN** admin 调用 `GET /api/admin/shops`
- **THEN** 返回所有店铺列表（shop_name/domain/user_id/status/created_at）

### Requirement: Admin Route Guard

系统 SHALL 在路由守卫中为 `/admin/*` 路径配置仅 admin 角色可访问。

#### Scenario: Admin route protection
- **WHEN** 用户角色不是 admin 访问 `/admin` 或 `/admin/*`
- **THEN** `checkPermission()` 返回 false

### Requirement: Password Hash

系统 SHALL 使用 SHA-256 hash 存储用户密码，不再明文存储。

#### Scenario: Registration with hashed password
- **WHEN** 用户注册
- **THEN** 密码经 SHA-256 hash 后存入数据库

#### Scenario: Login verification
- **WHEN** 用户登录
- **THEN** 输入密码经 SHA-256 hash 后与数据库中的 hash 值比对

## MODIFIED Requirements

### Requirement: Route Guard

现有 `lib/auth/route-guard.ts` 中的 `PAGE_PERMISSIONS` SHALL 新增以下规则：
- `/admin`: `['admin']`
- `/admin/*`: `['admin']`

### Requirement: User Repository

现有 `lib/db/user-repository.ts` 的 `verifyPassword()` 和 `create()` SHALL 改用 hash 比对/存储。

## REMOVED Requirements

### Requirement: Plaintext Password Storage

**Reason**: 安全风险，密码以明文存储和比对
**Migration**: 现有用户首次登录时自动 hash 迁移（或直接重新注册）

## Test Requirements

以下模块 SHALL 有专用单元测试：

1. `lib/ai/openai-client.ts` → `tests/ai/openai-client.test.ts`
2. `app/api/admin/users/route.ts` → `tests/api/admin-users.test.ts`
3. `app/api/admin/shops/route.ts` → `tests/api/admin-shops.test.ts`
4. `app/api/dashboard/stats/route.ts` → `tests/api/dashboard-stats.test.ts`
5. `app/api/auth/password/route.ts` → `tests/api/password.test.ts`
6. `app/admin/page.tsx` → `tests/admin/admin-dashboard.test.tsx`
