# 暗主题全面优化 Spec

## Why
当前暗主题仅在 Settings 页、Sidebar、TopBar 等少量组件上添加了 `dark:` 变体，其余 22 个页面/组件完全未适配（占全量 80%+）。此外现有暗色配色（#141414/#1D1D1D）过于生硬，缺乏层次感和视觉舒适度。

## What Changes
1. **优化暗色配色方案**：重新设计 CSS 变量，提供更有层次感的暗色梯度（surface elevation）
2. **全量暗色适配**：为所有 Dashboard 页面、Admin 页面、共享组件、登录页添加 `dark:` 变体
3. **SkeletonLoader 暗色支持**：将内联 CSS 渐变改为 CSS 变量驱动，支持暗色模式
4. **移动端暗色适配**：为所有 `app/mobile/*` 页面添加 `dark:` 变体

## Impact
- Affected specs: fix-admin-and-settings-bugs, user-center-i18n-theme
- Affected code:
  - `app/globals.css` — 重定义暗色 CSS 变量
  - `components/` — AIStepProgress, AgentStatusCard, SkeletonLoader, AIProgress, AIBadge, VoiceInputButton
  - `app/dashboard/` — 全部 11 个页面 + layout
  - `app/admin/` — 全部 3 个页面 + layout
  - `app/login/page.tsx`
  - `app/mobile/` — 全部 13 个页面

## ADDED Requirements

### Requirement: 暗色配色层次体系
系统 SHALL 提供三级 surface 层次（base / surface / elevated），确保卡片、弹窗、侧边栏在暗色模式下有清晰的视觉层次。

#### Scenario: 卡片在暗色背景下可区分
- **WHEN** 用户在暗色主题下查看仪表盘
- **THEN** 页面背景、卡片背景、悬浮元素之间有可感知的亮度差异

### Requirement: SkeletonLoader 暗色适配
SkeletonLoader 组件 SHALL 使用 CSS 变量驱动的渐变色，在暗色模式下自动切换为深色骨架屏。

#### Scenario: 暗色主题下加载占位符
- **WHEN** 页面在暗色主题下处于加载状态
- **THEN** 骨架屏渐变从深灰色过渡到略浅灰色（而非白色到灰色）

## MODIFIED Requirements

### Requirement: 全量页面暗色适配
所有 Dashboard 页面、Admin 页面、登录页、移动端页面 SHALL 使用 `dark:` Tailwind 变体或 CSS 变量，确保暗色主题下无刺眼的白色背景或不可读的黑色文字。

#### Scenario: 暗色主题下所有页面可读
- **WHEN** 用户切换到暗色主题并浏览任意页面
- **THEN** 所有文字在暗色背景下清晰可读，无白色色块闪烁

## Removed Requirements
无

## 暗色配色优化方案

### 当前配色（问题：过于生硬，缺乏层次）
```css
[data-theme="dark"] {
  --bg-primary: #141414;    /* 页面背景 - 太黑 */
  --bg-secondary: #1D1D1D;  /* 卡片背景 - 与背景差异太小 */
  --text-primary: #E5E6EB;
  --text-secondary: #C9CDD4;
  --border-color: #2E2E2E;
}
```

### 优化后配色（参考 Arc Browser / Linear / Vercel 设计语言）
```css
[data-theme="dark"] {
  --bg-primary: #0F1117;      /* 页面背景 - 微蓝深色，更舒适 */
  --bg-secondary: #181A20;    /* 卡片/侧边栏背景 - 中间层 */
  --bg-elevated: #1E2028;     /* 悬浮/弹窗/下拉 - 最高层 */
  --text-primary: #E8EAED;    /* 主文字 - 略暖白 */
  --text-secondary: #A0A4AC;  /* 次文字 */
  --text-tertiary: #6B7080;   /* 辅助文字 */
  --border-color: #2A2D35;    /* 边框 - 微蓝灰 */
  --hover-bg: #22252D;        /* 悬停态 */
  --sidebar-bg: #14161C;      /* 侧边栏 - 略深于卡片 */
  --card-bg: #181A20;         /* 卡片 = bg-secondary */
  --input-bg: #1E2028;        /* 输入框 = elevated */
}
```

### Tailwind 暗色工具类映射
| 语义 | CSS 变量 | Tailwind 暗色类 |
|---|---|---|
| 页面背景 | `--bg-primary` | `dark:bg-[#0F1117]` |
| 卡片背景 | `--bg-secondary` | `dark:bg-[#181A20]` |
| 悬浮/弹窗 | `--bg-elevated` | `dark:bg-[#1E2028]` |
| 主文字 | `--text-primary` | `dark:text-[#E8EAED]` |
| 次文字 | `--text-secondary` | `dark:text-[#A0A4AC]` |
| 辅助文字 | `--text-tertiary` | `dark:text-[#6B7080]` |
| 边框 | `--border-color` | `dark:border-[#2A2D35]` |
| 悬停 | `--hover-bg` | `dark:hover:bg-[#22252D]` |
| 侧边栏 | `--sidebar-bg` | `dark:bg-[#14161C]` |
| 输入框 | `--input-bg` | `dark:bg-[#1E2028]` |
