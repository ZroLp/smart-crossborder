# Tasks
- [ ] Task 1: 创建 /api/admin/shops 路由，实现店铺列表和详情查询
  - [ ] SubTask 1.1: 创建 GET /api/admin/shops 路由
  - [ ] SubTask 1.2: 创建 GET /api/admin/shops/[id] 路由
- [ ] Task 2: 修复 admin/shops 页面数据加载 bug
  - [ ] SubTask 2.1: 修复 data.data 改为 data.shops
- [ ] Task 3: 创建任务详情页面 /dashboard/task-logs/[id]
  - [ ] SubTask 3.1: 创建详情页面组件
  - [ ] SubTask 3.2: 创建对应的 API 路由
- [ ] Task 4: 替换所有 alert() 占位为真实功能
  - [ ] SubTask 4.1: 移动端刷新按钮对接实际数据接口
  - [ ] SubTask 4.2: 移动端验证码按钮对接短信发送接口
  - [ ] SubTask 4.3: Dashboard 广告优化按钮对接 AI 优化接口
  - [ ] SubTask 4.4: Dashboard 合规检测对接真实扫描接口
  - [ ] SubTask 4.5: Dashboard 使用模板对接模板应用接口
- [ ] Task 5: 全量验证
  - [ ] SubTask 5.1: TypeScript 编译通过
  - [ ] SubTask 5.2: 单元测试通过

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
