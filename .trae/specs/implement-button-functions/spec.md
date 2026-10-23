# 实现按钮功能 Spec

## Why
系统中约 20 个按钮只有 alert() 占位实现，包括移动端页面、Dashboard 子页面和 Admin 后台页面，需要提供真实功能或合理的交互反馈。

## What Changes
- 为所有 alert() 占位按钮实现真实功能或合理的 UI 反馈
- 创建缺失的 `/api/admin/shops` 路由
- 为 task-logs 详情页创建页面和路由
- 修复 admin/shops 页面的 data 字段引用错误

## Impact
- Affected specs: 无
- Affected code: app/mobile/*, app/dashboard/*, app/admin/*, app/api/*

## ADDED Requirements
### Requirement: 移动端按钮功能
移动端按钮 SHALL 提供真实的交互功能：
- 刷新按钮 SHALL 调用实际数据接口刷新列表
- 获取验证码按钮 SHALL 发送真实短信验证码
- 登录按钮 SHALL 调用认证接口
- 生成文案按钮 SHALL 调用 AI 接口生成文案
- 发送指令按钮 SHALL 调用 AI 指令处理接口

### Requirement: Dashboard 按钮功能
Dashboard 按钮 SHALL 提供真实功能：
- 导出日志 SHALL 导出 CSV 文件
- 任务详情 SHALL 跳转到详情页面
- 广告优化 SHALL 调用 AI 优化接口
- 合规检测 SHALL 调用真实扫描接口
- 使用模板 SHALL 应用模板创建店铺
- 计划升级 SHALL 处理升级逻辑

### Requirement: Admin 后台 API
Admin 后台 SHALL 提供完整的 CRUD API：
- GET /api/admin/shops SHALL 返回店铺列表
- GET /api/admin/shops/[id] SHALL 返回店铺详情
- PUT /api/admin/shops/[id]/status SHALL 更新店铺状态

### Requirement: 任务详情页面
系统 SHALL 提供任务详情页面：
- 页面 SHALL 显示任务的完整信息
- 页面 SHALL 显示任务的执行步骤和进度
- 页面 SHALL 支持重试操作

## REMOVED Requirements
### Requirement: Alert 占位实现
所有使用 alert() 的占位实现 SHALL 被移除并替换为真实功能。
**Reason**: Alert 不是生产级 UI 反馈
**Migration**: 替换为 Modal、Toast 或实际路由跳转
