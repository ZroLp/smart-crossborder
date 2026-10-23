# Tasks

- [x] Task 1: 重定义暗色 CSS 变量配色方案
  - [x] SubTask 1.1: 修改 `app/globals.css`，替换 `[data-theme="dark"]` 下所有 CSS 变量为新的三层配色（base / surface / elevated）
  - [x] SubTask 1.2: 更新 globals.css 中现有的 CSS 工具类（`.sidebar`、`.topbar`、`.card` 等）使用新变量
  - [x] SubTask 1.3: 更新 `app/globals.css` 中已有的 `dark:` Tailwind 类引用的旧色值为新色值（搜索 `dark:bg-[#1D1D1D]` 等替换为新值）

- [x] Task 2: SkeletonLoader 暗色适配
  - [x] SubTask 2.1: 修改 `components/SkeletonLoader.tsx`，将内联 CSS 渐变色改为 CSS 变量驱动（`var(--bg-primary)` / `var(--border-color)`），使其在暗色模式下自动适配

- [x] Task 3: 共享组件暗色适配
  - [x] SubTask 3.1: 修改 `components/AIStepProgress.tsx`，添加 dark: 变体
  - [x] SubTask 3.2: 修改 `components/AgentStatusCard.tsx`，添加 dark: 变体
  - [x] SubTask 3.3: 修改 `components/AIProgress.tsx`，添加 dark: 变体
  - [x] SubTask 3.4: 修改 `components/AIBadge.tsx`，subtle 变体添加 dark: 适配
  - [x] SubTask 3.5: 修改 `components/VoiceInputButton.tsx`，添加 dark: 变体
  - [x] SubTask 3.6: 修改 `components/TopBar.tsx`，通知铃铛图标添加 dark: 变体

- [x] Task 4: Dashboard 主页 + 登录页暗色适配
  - [x] SubTask 4.1: 修改 `app/dashboard/page.tsx`，添加 dark: 变体
  - [x] SubTask 4.2: 修改 `app/login/page.tsx`，添加 dark: 变体

- [x] Task 5: Dashboard 子页面暗色适配
  - [x] SubTask 5.1: 修改 `app/dashboard/selection/page.tsx`
  - [x] SubTask 5.2: 修改 `app/dashboard/store-builder/page.tsx`
  - [x] SubTask 5.3: 修改 `app/dashboard/content/page.tsx`
  - [x] SubTask 5.4: 修改 `app/dashboard/ad-optimizer/page.tsx`
  - [x] SubTask 5.5: 修改 `app/dashboard/customer-service/page.tsx`
  - [x] SubTask 5.6: 修改 `app/dashboard/fulfillment/page.tsx`
  - [x] SubTask 5.7: 修改 `app/dashboard/data-center/page.tsx`
  - [x] SubTask 5.8: 修改 `app/dashboard/compliance/page.tsx`
  - [x] SubTask 5.9: 修改 `app/dashboard/task-logs/page.tsx`
  - [x] SubTask 5.10: 修改 `app/dashboard/403/page.tsx`

- [x] Task 6: Admin 页面暗色适配
  - [x] SubTask 6.1: 修改 `app/admin/page.tsx`
  - [x] SubTask 6.2: 修改 `app/admin/users/page.tsx`
  - [x] SubTask 6.3: 修改 `app/admin/shops/page.tsx`

- [x] Task 7: 移动端页面暗色适配
  - [x] SubTask 7.1: 修改 `app/mobile/layout.tsx`
  - [x] SubTask 7.2: 修改 `app/mobile/page.tsx`
  - [x] SubTask 7.3: 修改 `app/mobile/login/page.tsx`
  - [x] SubTask 7.4: 修改 `app/mobile/dashboard/page.tsx`
  - [x] SubTask 7.5: 修改 `app/mobile/selection/page.tsx`
  - [x] SubTask 7.6: 修改 `app/mobile/content/page.tsx`
  - [x] SubTask 7.7: 修改 `app/mobile/command/page.tsx`
  - [x] SubTask 7.8: 修改 `app/mobile/orders/page.tsx`
  - [x] SubTask 7.9: 修改 `app/mobile/messages/page.tsx`
  - [x] SubTask 7.10: 修改 `app/mobile/profile/page.tsx`
  - [x] SubTask 7.11: 修改 `app/mobile/settings-theme/page.tsx`
  - [x] SubTask 7.12: 修改 `app/mobile/settings-locale/page.tsx`
  - [x] SubTask 7.13: 修改 `app/mobile/ad-optimizer/page.tsx`

- [x] Task 8: 全量验证
  - [x] SubTask 8.1: 运行 `npx tsc --noEmit` 确认 0 编译错误
  - [x] SubTask 8.2: 运行 `npx jest --passWithNoTests` 确认全量测试通过
  - [x] SubTask 8.3: 更新 `checklist.md` 打勾所有验证项

# Task Dependencies
- [Task 2] depends on [Task 1] (SkeletonLoader 需要新的 CSS 变量)
- [Task 3] depends on [Task 1] (组件需要新色值)
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 1]
- [Task 7] depends on [Task 1]
- [Task 8] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7]
