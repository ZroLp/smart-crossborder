# Tasks

- [x] Task 1: 项目脚手架初始化
  - [x] SubTask 1.1: 使用 create-next-app 初始化 Next.js 14+ 项目（TypeScript + Tailwind CSS + App Router）
  - [x] SubTask 1.2: 安装核心依赖：langchain、@langchain/core、better-sqlite3、jest、@testing-library/react、@testing-library/jest-dom
  - [x] SubTask 1.3: 创建项目目录结构：app/（页面+API）、lib/agents/（六大Agent）、lib/db/（数据层）、lib/framework/（Agent框架）、components/（UI组件）、tests/（测试）、__mocks__/（Mock）
  - [x] SubTask 1.4: 配置 Jest（jest.config.js）和 TypeScript 路径别名

- [x] Task 2: SQLite 数据访问层实现
  - [x] SubTask 2.1: 实现数据库初始化模块（lib/db/init.ts），创建 users、shops、products、orders、task_logs、knowledge_base 六张核心表
  - [x] SubTask 2.2: 实现通用数据访问基类（lib/db/base-repository.ts），提供 CRUD 操作
  - [x] SubTask 2.3: 实现各表 Repository：UserRepo、ShopRepo、ProductRepo、OrderRepo、TaskLogRepo、KnowledgeBaseRepo
  - [x] SubTask 2.4: 编写数据访问层单元测试（tests/db/）

- [x] Task 3: Multi-Agent 协作框架实现
  - [x] SubTask 3.1: 实现 Agent 基类（lib/framework/base-agent.ts），定义统一接口：execute()、validate()、getStatus()
  - [x] SubTask 3.2: 实现消息总线（lib/framework/message-bus.ts），支持 Agent 间事件发布/订阅
  - [x] SubTask 3.3: 实现任务状态机（lib/framework/task-state-machine.ts），管理 待执行→执行中→已完成/执行失败 状态流转
  - [x] SubTask 3.4: 实现 Agent 编排器（lib/framework/orchestrator.ts），支持链式触发和并行执行
  - [x] SubTask 3.5: 编写框架层单元测试（tests/framework/）

- [x] Task 4: 六大 Agent 核心逻辑实现
  - [x] SubTask 4.1: 实现选品Agent（lib/agents/product-selection.ts）：四维评分算法、风险筛查、区域适配
  - [x] SubTask 4.2: 实现建站Agent（lib/agents/store-builder.ts）：模板匹配、产品页生成、参数配置
  - [x] SubTask 4.3: 实现内容Agent（lib/agents/content-creator.ts）：多语种文案生成、合规检测、批量管理
  - [x] SubTask 4.4: 实现投流Agent（lib/agents/ad-optimizer.ts）：ROAS计算、智能调价、低效广告识别
  - [x] SubTask 4.5: 实现客服Agent（lib/agents/customer-service.ts）：意图识别、应答模板、知识库查询、人工转接判断
  - [x] SubTask 4.6: 实现履约Agent（lib/agents/fulfillment.ts）：物流渠道匹配、报关制单、库存管理、异常识别
  - [x] SubTask 4.7: 编写六大Agent单元测试（tests/agents/）

- [x] Task 5: Next.js API Routes 实现
  - [x] SubTask 5.1: 实现 Agent 调用统一入口 API（app/api/agent/route.ts）
  - [x] SubTask 5.2: 实现用户认证 API（app/api/auth/route.ts）
  - [x] SubTask 5.3: 实现店铺管理 API（app/api/shop/route.ts）
  - [x] SubTask 5.4: 实现数据查询 API（app/api/data/route.ts）
  - [x] SubTask 5.5: 编写 API 层单元测试（tests/api/）

- [x] Task 6: 网页端核心页面实现
  - [x] SubTask 6.1: 实现全局布局组件（app/layout.tsx）：左侧导航栏 + 顶部状态栏 + 主体内容区
  - [x] SubTask 6.2: 实现登录页（app/login/page.tsx）
  - [x] SubTask 6.3: 实现首页仪表盘（app/dashboard/page.tsx）：核心数据指标、Agent状态、待办任务、快捷入口
  - [x] SubTask 6.4: 实现六大Agent模块页面（app/dashboard/selection/page.tsx 等）
  - [x] SubTask 6.5: 实现数据中心页面（app/dashboard/data-center/page.tsx）

- [x] Task 7: 执行单元测试并修复问题
  - [x] SubTask 7.1: 执行全部单元测试（npm test）
  - [x] SubTask 7.2: 修复测试中发现的问题
  - [x] SubTask 7.3: 确保所有测试通过

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 5]
- [Task 7] depends on [Task 4, Task 5]
