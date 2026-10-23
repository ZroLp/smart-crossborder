# Tasks

- [x] Task 1: 移动端简单按钮实现 (toast/alert)
  - [x] SubTask 1.1: `mobile/selection/page.tsx` L58 — 🔄 刷新：toast 提示"数据已刷新"
  - [x] SubTask 1.2: `mobile/ad-optimizer/page.tsx` L71 — 🔄 刷新：toast 提示"数据已刷新"

- [x] Task 2: 移动端退出登录功能
  - [x] SubTask 2.1: `mobile/profile/page.tsx` L127 — 退出登录：清除 auth token + 跳转 /mobile/login

- [x] Task 3: 移动端登录页按钮功能
  - [x] SubTask 3.1: `mobile/login/page.tsx` L46 — 获取验证码：倒计时 60s + toast
  - [x] SubTask 3.2: `mobile/login/page.tsx` L81 — 绑定店铺：toast 提示 + 跳转授权页

- [x] Task 4: 移动端内容页按钮功能
  - [x] SubTask 4.1: `mobile/content/page.tsx` L49 — 生成文案：模拟 AI 生成 + toast
  - [x] SubTask 4.2: `mobile/content/page.tsx` L84 — 保存草稿：toast 提示
  - [x] SubTask 4.3: `mobile/content/page.tsx` L87 — 下载素材：toast 提示

- [x] Task 5: 移动端指令页按钮功能
  - [x] SubTask 5.1: `mobile/command/page.tsx` L44 — 发送：发送输入内容到 AI + 模拟回复
  - [x] SubTask 5.2: `mobile/command/page.tsx` L54 — 快捷指令按钮 (×6)：点击后自动填充输入框

- [x] Task 6: 移动端设置页按钮
  - [x] SubTask 6.1: `mobile/settings-theme/page.tsx` L74 — 预览按钮：toast 提示

- [x] Task 7: Dashboard 导出类按钮
  - [x] SubTask 7.1: `dashboard/task-logs/page.tsx` L59 — 导出日志：生成 CSV 文件下载
  - [x] SubTask 7.2: `dashboard/data-center/page.tsx` L30 — 导出报表：toast 提示功能开发中

- [x] Task 8: Dashboard 详情/优化按钮
  - [x] SubTask 8.1: `dashboard/task-logs/page.tsx` L166 — 详情：toast 提示
  - [x] SubTask 8.2: `dashboard/fulfillment/page.tsx` L206 — 详情：toast 提示
  - [x] SubTask 8.3: `dashboard/ad-optimizer/page.tsx` L205 — 优化：toast 提示

- [x] Task 9: Dashboard 合规检测按钮
  - [x] SubTask 9.1: `dashboard/compliance/page.tsx` L89 — 一键合规检测：toast 提示 + 模拟扫描
  - [x] SubTask 9.2: `dashboard/compliance/page.tsx` L173 — 查看详情：toast 提示
  - [x] SubTask 9.3: `dashboard/compliance/page.tsx` L242 — 标记已处理：更新状态为已处理

- [x] Task 10: Dashboard 其他按钮
  - [x] SubTask 10.1: `dashboard/content/page.tsx` L183 — 生成素材：toast 提示
  - [x] SubTask 10.2: `dashboard/content/page.tsx` L186 — 批量更新：toast 提示
  - [x] SubTask 10.3: `dashboard/store-builder/page.tsx` L144 — 使用模板：toast 提示
  - [x] SubTask 10.4: `dashboard/page.tsx` L234 — 快捷操作按钮 (×4)：toast 提示 + 路由跳转
  - [x] SubTask 10.5: `dashboard/settings/page.tsx` L406 — 计划升级按钮：toast 提示

- [x] Task 11: 共享组件通知铃铛
  - [x] SubTask 11.1: `components/TopBar.tsx` L24 — 通知铃铛：添加点击态 + toast

- [x] Task 12: 全量验证
  - [x] SubTask 12.1: 运行 `npx tsc --noEmit` 确认 0 编译错误
  - [x] SubTask 12.2: 运行 `npx jest` 确认全量测试通过

# Task Dependencies
- [Task 7] depends on [Task 12] (验证)
- [Task 8] depends on [Task 12] (验证)
- [Task 9] depends on [Task 12] (验证)
- [Task 10] depends on [Task 12] (验证)
- [Task 11] depends on [Task 12] (验证)
- [Task 1] through [Task 6] can run in parallel (no inter-dependencies)
- [Task 7] through [Task 11] can run in parallel (no inter-dependencies)
