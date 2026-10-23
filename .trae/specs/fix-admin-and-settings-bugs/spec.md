# 修复管理员后台崩溃 + 设置页国际化/主题不生效

## Why
管理员后台用户管理页面因 API 响应字段映射错误导致页面崩溃；设置页的国际化（语言/时区/币种）和主题（浅色/深色）切换不生效，因为 `useTranslation` hook 没有读取全局语言状态，且组件使用硬编码颜色而非 CSS 变量。

## What Changes
- 修复 `admin/users/page.tsx` 中 `data.data` → `data.users` 的字段映射错误
- 修复 `useTranslation` hook，使其从 `LocaleContext` 读取当前语言而非维护独立状态
- 配置 Tailwind v4 支持 `data-theme` 属性的 `dark:` 变体
- 为关键页面组件添加 `dark:` 暗色模式样式

## Impact
- Affected specs: admin-backend-and-tests, user-center-i18n-theme
- Affected code:
  - `app/admin/users/page.tsx` — 字段映射修复
  - `lib/i18n/use-translation.ts` — 接入 LocaleContext
  - `app/globals.css` — 添加 Tailwind dark 变体配置
  - `components/Sidebar.tsx` — 添加 dark 模式样式
  - `app/dashboard/settings/page.tsx` — 添加 dark 模式样式
  - `app/dashboard/layout.tsx` — 添加 dark 模式样式
  - `app/admin/layout.tsx` — 添加 dark 模式样式

## ADDED Requirements

### Requirement: Tailwind 暗色模式变体
系统 SHALL 在 `globals.css` 中配置 Tailwind v4 的 `@variant dark` 规则，使其基于 `[data-theme="dark"]` 属性选择器激活暗色模式。

#### Scenario: 深色主题激活
- **WHEN** `document.documentElement` 的 `data-theme` 属性为 `"dark"`
- **THEN** 所有 `dark:` Tailwind 工具类生效

### Requirement: 关键页面暗色模式适配
系统 SHALL 为 Sidebar、Settings 页、Admin 布局等关键组件添加 `dark:` 变体样式，确保深色主题下文字、背景、边框颜色正确切换。

#### Scenario: 深色主题下页面可读
- **WHEN** 用户选择深色主题
- **THEN** Sidebar 背景变为深色，文字变为浅色；Settings 页面卡片背景变为深色

## MODIFIED Requirements

### Requirement: useTranslation 语言同步
`useTranslation` hook SHALL 从 `LocaleContext` 读取当前语言状态，而非维护独立的 locale state。当用户在设置页切换语言时，所有使用 `useTranslation` 的组件 SHALL 自动重新渲染为新语言。

#### Scenario: 语言切换即时生效
- **WHEN** 用户在设置页将语言从中文切换为英文
- **THEN** Sidebar 导航文字、设置页标题等立即切换为英文

## Removed Requirements
无

## Bug 根因分析

### Bug 1: admin/users 页面崩溃
- `app/admin/users/page.tsx` 第 41 行：`setUsers(data.data)` 
- API `/api/admin/users` 返回 `{ success, users, pagination }`，字段名为 `users` 而非 `data`
- `data.data` 为 `undefined`，导致 `users` 状态变为 `undefined`
- 第 106 行 `filteredUsers.length` 访问 `undefined.length` 触发 TypeError

### Bug 2: 国际化不生效
- `lib/i18n/use-translation.ts` 的 `useTranslation()` 维护独立的 `useState<Locale>('zh')` 
- 设置页的 `setLocale()` 更新的是 `LocaleContext` 的状态
- `useTranslation` 不读取 `LocaleContext`，因此语言切换后翻译内容不变

### Bug 3: 主题不生效
- `ThemeContext` 正确设置了 `data-theme` 属性
- CSS 变量在 `[data-theme="dark"]` 下正确定义
- 但组件全部使用硬编码 Tailwind 颜色（如 `bg-white`、`text-[#1D2129]`），不响应 CSS 变量变化
- Tailwind v4 默认不支持 `data-theme` 属性选择器的 dark 变体
