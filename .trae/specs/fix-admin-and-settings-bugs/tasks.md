# Tasks

- [x] Task 1: 修复 admin/users 页面字段映射错误
  - [x] SubTask 1.1: 修改 `app/admin/users/page.tsx` 第 41 行，将 `setUsers(data.data)` 改为 `setUsers(data.users)`

- [x] Task 2: 修复 useTranslation 语言状态不同步
  - [x] SubTask 2.1: 修改 `lib/i18n/use-translation.ts`，移除内部 `useState<Locale>`，改为从 `LocaleContext` 读取 `locale`
  - [x] SubTask 2.2: 验证 `useTranslation` 返回的 `t()` 函数在语言切换后立即生效

- [x] Task 3: 配置 Tailwind v4 暗色模式变体
  - [x] SubTask 3.1: 在 `app/globals.css` 中添加 `@variant dark` 配置，绑定 `[data-theme="dark"]` 选择器

- [x] Task 4: 关键组件暗色模式适配
  - [x] SubTask 4.1: 修改 `components/Sidebar.tsx`，为背景、文字、边框添加 `dark:` 变体
  - [x] SubTask 4.2: 修改 `app/dashboard/settings/page.tsx`，为卡片、文字、输入框添加 `dark:` 变体
  - [x] SubTask 4.3: 修改 `app/dashboard/layout.tsx`，为背景添加 `dark:` 变体
  - [x] SubTask 4.4: 修改 `app/admin/layout.tsx`，为背景、文字、边框添加 `dark:` 变体
  - [x] SubTask 4.5: 修改 `app/admin/users/page.tsx`，为表格和文字添加 `dark:` 变体

- [x] Task 5: 全量验证
  - [x] SubTask 5.1: 运行 `npx tsc --noEmit` 确认 0 编译错误
  - [x] SubTask 5.2: 运行 `npx jest --passWithNoTests` 确认全量测试通过
  - [x] SubTask 5.3: 更新 `checklist.md` 打勾所有验证项

# Task Dependencies
- [Task 2] depends on [Task 1] (无直接依赖，但顺序执行)
- [Task 3] depends on [Task 4] (无直接依赖，但 Tailwind 配置需先完成)
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
