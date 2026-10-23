# Tasks

- [x] Task 1: 用户注册功能
  - [x] Subtask 1.1: 修改 app/login/page.tsx，添加「注册/登录」切换Tab，注册表单（用户名、密码、确认密码、邮箱）
  - [x] Subtask 1.2: 验证注册逻辑（API已支持action:register，前端已对接）
  - [x] Subtask 1.3: 注册成功后自动登录并跳转到店铺授权页
  - [x] Subtask 1.4: 编写注册功能单元测试（tests/components/login-registration.test.tsx）

- [x] Task 2: 用户权限管理
  - [x] Subtask 2.1: 在 SQLite users 表新增 role 字段（admin/operator/viewer），默认 viewer
  - [x] Subtask 2.2: 修改 lib/db/user-repository.ts，添加角色查询/更新方法
  - [x] Subtask 2.3: 创建 lib/auth/route-guard.ts，路由守卫中间件（检查用户角色与页面权限匹配）
  - [x] Subtask 2.4: 在 app/dashboard/layout.tsx 集成路由守卫，无权限展示403页面
  - [x] Subtask 2.5: Settings页面展示当前用户角色，admin可修改其他用户角色
  - [x] Subtask 2.6: 编写权限守卫单元测试

- [x] Task 3: 国际化设置面板
  - [x] Subtask 3.1: 创建 lib/i18n/locale-context.tsx，全局LocaleProvider（读取/设置语言、时区、币种偏好，持久化到user_preferences表）
  - [x] Subtask 3.2: 修改 app/layout.tsx，包裹LocaleProvider和ThemeProvider
  - [x] Subtask 3.3: 修改 app/dashboard/settings/page.tsx，新增「国际化与区域设置」卡片（语言下拉、时区下拉、币种下拉）
  - [x] Subtask 3.4: 修改 app/mobile/profile/page.tsx，「语言设置」点击跳转到语言选择页
  - [x] Subtask 3.5: 创建 app/mobile/settings-locale/page.tsx，移动端语言/时区/币种设置页

- [x] Task 4: 页面国际化接入
  - [x] Subtask 4.1: 修改 components/Sidebar.tsx，使用useTranslation替换硬编码中文
  - [x] Subtask 4.2: 修改 app/dashboard/page.tsx，使用useTranslation
  - [x] Subtask 4.3: 修改 app/dashboard/settings/page.tsx，使用useTranslation
  - [x] Subtask 4.4: 修改 app/mobile/layout.tsx，底部Tab使用useTranslation
  - [x] Subtask 4.5: 补充翻译文件中缺失的key（权限相关、设置相关、主题相关）

- [x] Task 5: 多主题切换
  - [x] Subtask 5.1: 创建 lib/theme/theme-context.tsx，ThemeProvider（light/dark/system），CSS变量注入
  - [x] Subtask 5.2: 修改 app/globals.css，定义 :root 和 [data-theme="dark"] 的CSS变量（背景色、文字色、卡片色、边框色、阴影色）
  - [x] Subtask 5.3: 修改 app/dashboard/settings/page.tsx，新增「外观主题」卡片（明亮/暗黑/跟随系统三选一）
  - [x] Subtask 5.4: 修改移动端个人中心，添加主题切换入口
  - [x] Subtask 5.5: 确保现有页面使用CSS变量而非硬编码颜色值（逐步迁移关键页面）

- [x] Task 6: 全量测试与验证
  - [x] Subtask 6.1: 执行全部新增测试
  - [x] Subtask 6.2: 确保原有555个测试无回归
  - [x] Subtask 6.3: 手动验证：语言切换、主题切换、注册登录、权限控制

# Task Dependencies
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 3]
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
