# 用户中心-多主题-国际化 Spec

## Why

经过全面审计，发现当前项目存在3个关键缺失：
1. **用户中心不完整**：登录页没有注册入口，Settings页面没有语言/时区/币种等国际化配置选项，缺少用户权限管理
2. **国际化无法切换**：虽然实现了5种语言的翻译文件和useTranslation hook，但所有页面都未使用，Settings页面也没有语言切换控件，用户无法切换语言
3. **多主题未规划**：虽然有theme token（colors/shadows/border-radius/animation），但没有主题切换机制，PC端和移动端共用一套样式，没有暗黑模式

## What Changes

- 登录页添加注册功能（前端表单 + API register支持已存在）
- Settings页面新增「国际化与区域设置」卡片（语言/时区/币种切换）
- Settings页面新增「外观主题」卡片（明亮/暗黑模式切换）
- 创建 ThemeContext 全局主题管理（明亮/暗黑模式，CSS变量切换）
- 移动端个人中心「语言设置」点击进入语言选择页
- 将现有页面接入 useTranslation hook（至少Dashboard首页、Sidebar、Settings）
- 用户权限管理（基础角色：admin/operator/viewer，路由守卫）

## Impact

- Affected specs: 用户中心、国际化配置、主题切换、权限控制
- Affected code: app/login/page.tsx, app/dashboard/settings/page.tsx, app/mobile/profile/page.tsx, app/layout.tsx, components/Sidebar.tsx, lib/i18n/use-translation.ts

## ADDED Requirements

### Requirement: 用户注册
The system SHALL allow new users to register with username, password, and optional email.

#### Scenario: 用户注册成功
- **WHEN** 用户在登录页点击「注册」并填写用户名和密码
- **THEN** 创建账号并自动登录，跳转到店铺授权页

#### Scenario: 用户名已存在
- **WHEN** 用户注册已存在的用户名
- **THEN** 提示「用户名已存在，请更换」

### Requirement: 国际化设置
The system SHALL provide a settings panel where users can change display language (zh/en/es/fr/de), timezone, and display currency.

#### Scenario: 切换语言
- **WHEN** 用户在设置页选择「English」
- **THEN** 全站界面文字切换为英文，设置持久化到用户偏好

#### Scenario: 切换时区
- **WHEN** 用户在设置页选择「America/New_York」
- **THEN** 所有日期时间展示转换为对应时区

#### Scenario: 切换币种
- **WHEN** 用户在设置页选择「EUR」
- **THEN** 所有金额以€符号展示，数值按汇率转换

### Requirement: 外观主题
The system SHALL support light and dark theme modes with system-wide CSS variable switching.

#### Scenario: 切换暗黑模式
- **WHEN** 用户在设置页选择「暗黑模式」
- **THEN** 全站背景变为深色，文字颜色反转，保持品牌色

#### Scenario: 跟随系统
- **WHEN** 用户选择「跟随系统」
- **THEN** 根据 prefers-color-scheme 自动切换

### Requirement: 用户权限
The system SHALL enforce role-based access control for dashboard routes.

#### Scenario: 不同角色访问权限
- **WHEN** viewer角色用户访问投流优化页面
- **THEN** 展示「无权访问」提示

## MODIFIED Requirements

### Requirement: Settings页面
The settings page SHALL be extended with internationalization settings (language/timezone/currency) and theme settings (light/dark/system).

### Requirement: 登录页
The login page SHALL include a registration form toggle and registration API call.

### Requirement: Root Layout
The root layout SHALL wrap the app with ThemeProvider and LocaleProvider contexts.
