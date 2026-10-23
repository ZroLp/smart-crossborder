# Tasks

- [x] Task 1: Agent共享数据池实现
  - [x] SubTask 1.1: 实现SharedContext类（lib/framework/shared-context.ts），提供setData/getData/getHistory/clear方法，支持按agentType命名空间读写，数据持久化到SQLite
  - [x] SubTask 1.2: 在SQLite中新增shared_context表（id, agent_type, key, value, created_at）
  - [x] SubTask 1.3: 在BaseAgent中注入SharedContext，Agent执行完成后自动将结果写入共享数据池
  - [x] SubTask 1.4: 编写SharedContext单元测试

- [x] Task 2: AI白盒五步可视化实现
  - [x] SubTask 2.1: 定义AgentStep类型（lib/framework/agent-progress.ts）：五步枚举（data-collection/model-reasoning/strategy-generation/execution/result-callback），每步包含status/timestamp/input/output/duration
  - [x] SubTask 2.2: 实现AgentProgressTracker类，提供startStep/completeStep/failStep/getProgress方法，支持暂停/终止/重试
  - [x] SubTask 2.3: 在SQLite中新增agent_progress表存储进度记录
  - [x] SubTask 2.4: 在BaseAgent中集成进度追踪，execute方法自动记录五步进度
  - [x] SubTask 2.5: 编写AgentProgressTracker单元测试

- [x] Task 3: 自然语言指令解析器实现
  - [x] SubTask 3.1: 实现NLCommandParser类（lib/framework/nl-parser.ts），基于关键词匹配解析自然语言为Agent调用指令
  - [x] SubTask 3.2: 定义中英文指令模板映射（如"推荐爆款"→selection, "建站"→store-builder, "生成文案"→content, "优化投放"→ad-optimizer, "客服"→customer-service, "发货"→fulfillment）
  - [x] SubTask 3.3: 实现参数提取逻辑（从自然语言中提取类目、市场、语种等参数）
  - [x] SubTask 3.4: 新增API接口 app/api/command/route.ts，接收自然语言指令并路由到对应Agent
  - [x] SubTask 3.5: 编写NLCommandParser单元测试

- [x] Task 4: Agent链路闭环调整
  - [x] SubTask 4.1: 修改投流Agent nextAgent从'customer-service'为'fulfillment'
  - [x] SubTask 4.2: 修改履约Agent增加nextAgent为'customer-service'，nextAgentInput传递订单和履约数据
  - [x] SubTask 4.3: 修改客服Agent执行完成后将数据写入SharedContext（反哺数据池）
  - [x] SubTask 4.4: 修改选品Agent从SharedContext读取历史运营数据用于策略迭代
  - [x] SubTask 4.5: 更新相关单元测试

- [x] Task 5: 网页端缺失页面补全
  - [x] SubTask 5.1: 实现合规风险中心页面（app/dashboard/compliance/page.tsx）：政策更新列表、税务提醒、合规检测、风险清单、整改建议
  - [x] SubTask 5.2: 实现AI任务日志中心页面（app/dashboard/task-logs/page.tsx）：Agent执行记录、任务进度、成功/失败统计、筛选、重跑
  - [x] SubTask 5.3: 实现个人与权限设置页面（app/dashboard/settings/page.tsx）：账号管理、套餐信息、通知配置、接口配置
  - [x] SubTask 5.4: 更新Sidebar导航，新增3个页面入口

- [x] Task 6: 移动端完整页面实现（10页）
  - [x] SubTask 6.1: 实现移动端登录/授权页（app/mobile/login/page.tsx）：快捷登录、店铺授权同步、设备权限申请
  - [x] SubTask 6.2: 实现移动端首页（app/mobile/page.tsx）：响应式布局，实时营收、待办提醒、快捷入口
  - [x] SubTask 6.3: 实现移动端数据看板（app/mobile/dashboard/page.tsx）：轻量化指标图表
  - [x] SubTask 6.4: 实现移动端AI指令页（app/mobile/command/page.tsx）：自然语言输入、指令模板、执行进度
  - [x] SubTask 6.5: 实现移动端选品快报页（app/mobile/selection/page.tsx）：每日爆款推荐、风险商品提醒、竞品动态简报
  - [x] SubTask 6.6: 实现移动端素材创作页（app/mobile/content/page.tsx）：快速文案生成、简易主图制作、素材预览与保存
  - [x] SubTask 6.7: 实现移动端投流监控页（app/mobile/ad-optimizer/page.tsx）：广告实时数据、异常投放提醒、一键启停优化
  - [x] SubTask 6.8: 实现移动端订单履约页（app/mobile/orders/page.tsx）：订单列表、物流进度
  - [x] SubTask 6.9: 实现移动端消息中心（app/mobile/messages/page.tsx）：分类消息、已读未读
  - [x] SubTask 6.10: 实现移动端个人中心（app/mobile/profile/page.tsx）：套餐、设置、帮助

- [x] Task 7: 国际化设计体系实现
  - [x] SubTask 7.1: 实现i18n多语种框架（lib/i18n/index.ts），支持中/英/西/法/德5种语言，定义翻译字典结构
  - [x] SubTask 7.2: 创建5种语言翻译文件（lib/i18n/locales/zh.ts, en.ts, es.ts, fr.ts, de.ts），覆盖界面核心文案
  - [x] SubTask 7.3: 实现useTranslation Hook（lib/i18n/use-translation.ts），提供t()翻译函数和语种切换
  - [x] SubTask 7.4: 实现时区适配工具（lib/i18n/timezone.ts），支持自定义运营时区，时间数据自动转换
  - [x] SubTask 7.5: 实现币种转换工具（lib/i18n/currency.ts），支持USD/EUR/GBP/CNY切换和格式化展示
  - [x] SubTask 7.6: 在SQLite中新增user_preferences表存储用户语种、时区、币种偏好
  - [x] SubTask 7.7: 编写i18n相关单元测试

- [x] Task 8: 异常场景兜底机制实现
  - [x] SubTask 8.1: 实现API异常处理器（lib/framework/error-handler.ts），支持备用接口切换、重试队列、自动续跑
  - [x] SubTask 8.2: 实现AI生成失败分类器，区分网络失败/合规拦截/参数错误三类原因，给出修复建议
  - [x] SubTask 8.3: 实现Agent任务锁机制（lib/framework/task-lock.ts），防止多Agent同时操作同一资源
  - [x] SubTask 8.4: 实现数据缓存兜底策略（lib/framework/cache-fallback.ts），数据抓取受限时展示缓存数据并标注更新时间
  - [x] SubTask 8.5: 编写异常兜底机制单元测试

- [x] Task 9: 双端数据同步机制实现
  - [x] SubTask 9.1: 实现SyncService类（lib/framework/sync-service.ts），基于SharedContext实现双端数据同步
  - [x] SubTask 9.2: 实现操作互斥机制，同一资源同时操作时提示冲突
  - [x] SubTask 9.3: 编写SyncService单元测试

- [x] Task 10: 视觉主题设计规范实现
  - [x] SubTask 10.1: 创建品牌色系Token文件（lib/theme/colors.ts），定义主色#1677FF、辅助色、功能状态色、中性底色
  - [x] SubTask 10.2: 创建字体规范Token文件（lib/theme/typography.ts），定义字体层级（18px/16px/14px/12px）
  - [x] SubTask 10.3: 更新Tailwind配置应用品牌色系和字体规范
  - [x] SubTask 10.4: 实现AI功能视觉差异化组件（components/AIBadge.tsx），主题色角标+微光动效
  - [x] SubTask 10.5: 实现骨架屏加载组件（components/SkeletonLoader.tsx），渐变加载动效
  - [x] SubTask 10.6: 实现AI任务进度条组件（components/AIProgress.tsx），品牌渐变流动动效
  - [x] SubTask 10.7: 更新现有页面应用视觉主题规范

- [x] Task 11: 执行单元测试并验证
  - [x] SubTask 11.1: 执行全部单元测试（npm test）
  - [x] SubTask 11.2: 修复测试中发现的问题
  - [x] SubTask 11.3: 确保所有测试通过

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1, Task 2]
- [Task 5] depends on [Task 2, Task 3]
- [Task 6] depends on [Task 3, Task 7, Task 10]
- [Task 7] depends on [Task 1]
- [Task 8] depends on [Task 1, Task 2]
- [Task 9] depends on [Task 1]
- [Task 10] depends on [Task 2]
- [Task 11] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10]
