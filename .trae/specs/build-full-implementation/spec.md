# 跨境智卖——全链路AI操作系统 完整实现 Spec

## Why
项目目录当前仅有业务调研与产品原型综合方案MD文档，无任何代码实现。需要基于该MD文档中定义的技术栈（Next.js + LangGraph + Ollama Qwen2.5 + SQLite）和六大Agent架构，构建完整可运行的项目实现，并编写单元测试验证核心逻辑正确性。

## What Changes
- 初始化 Next.js 全栈项目，配置 TypeScript、Tailwind CSS、SQLite（better-sqlite3）
- 实现核心 Multi-Agent 协作框架（基于 LangGraph 状态图）
- 实现六大 Agent 模块核心逻辑：选品Agent、建站Agent、内容Agent、投流Agent、客服Agent、履约Agent
- 实现 Agent 间消息总线与任务联动机制
- 实现 SQLite 数据访问层（用户、店铺、商品、订单、任务日志等表）
- 实现 Next.js API Routes 对外接口层
- 实现网页端核心页面（仪表盘、六大Agent模块页、数据中心）
- 编写全模块单元测试（Agent逻辑、数据层、API层）
- 执行单元测试并确保通过

## Impact
- Affected specs: 全新项目，无已有spec
- Affected code: 项目从零构建，涉及前后端全栈代码

## ADDED Requirements

### Requirement: 项目脚手架与基础架构
系统 SHALL 基于 Next.js 14+ App Router 创建全栈项目，使用 TypeScript 作为开发语言，Tailwind CSS 作为样式方案，better-sqlite3 作为数据库驱动。

#### Scenario: 项目初始化成功
- **WHEN** 执行项目初始化命令
- **THEN** 生成完整的 Next.js 项目结构，包含 app/、lib/、components/、tests/ 等目录，package.json 包含所有必要依赖

### Requirement: Multi-Agent 协作框架
系统 SHALL 实现基于 LangGraph 的 Multi-Agent 协作框架，支持六大Agent独立运行、消息总线通信、任务状态机管理。

#### Scenario: Agent任务调度
- **WHEN** 用户通过API下发运营指令
- **THEN** 系统解析意图，路由到对应Agent，创建任务记录，执行Agent逻辑，更新任务状态，返回执行结果

#### Scenario: Agent间联动
- **WHEN** 选品Agent完成爆款推荐
- **THEN** 系统自动触发建站Agent接收选品结果，建站完成后触发内容Agent生成素材，形成链式联动

### Requirement: 选品Agent
系统 SHALL 实现选品Agent，提供爆款四维评分算法（市场热度、竞争烈度、利润空间、合规安全）、风险筛查、区域适配功能。

#### Scenario: 爆款评分
- **WHEN** 输入商品数据（名称、类目、价格、销量等）
- **THEN** 输出0-100分四维加权评分，包含各维度分数和风险标签

### Requirement: 建站Agent
系统 SHALL 实现建站Agent，提供Shopify店铺授权管理、模板匹配、产品页生成、参数自动配置功能。

#### Scenario: 模板匹配
- **WHEN** 输入店铺类目和目标市场
- **THEN** 返回匹配度最高的行业模板列表，包含模板ID、名称、匹配度评分

### Requirement: 内容Agent
系统 SHALL 实现内容Agent，提供多语种文案生成、素材合规检测、批量素材管理功能。

#### Scenario: 多语种文案生成
- **WHEN** 输入商品信息和目标语种
- **THEN** 生成对应语种的标题、五点描述、详情文案，通过合规检测

### Requirement: 投流Agent
系统 SHALL 实现投流Agent，提供广告数据同步、智能调价建议、ROAS计算、低效广告识别功能。

#### Scenario: ROAS计算
- **WHEN** 输入广告消耗数据和店铺成交数据
- **THEN** 计算真实ROAS值，识别低效广告，给出调价建议

### Requirement: 客服Agent
系统 SHALL 实现客服Agent，提供意图识别、多语种应答模板、知识库管理、人工转接判断功能。

#### Scenario: 意图识别
- **WHEN** 输入客户咨询文本
- **THEN** 识别意图类别（物流查询/售后退换/支付咨询/产品参数/关税问题/其他），返回对应应答模板

### Requirement: 履约Agent
系统 SHALL 实现履约Agent，提供订单同步、物流渠道匹配、报关制单、库存管理、异常订单识别功能。

#### Scenario: 物流渠道匹配
- **WHEN** 输入订单收货地区、商品重量、时效需求
- **THEN** 返回性价比最高的物流渠道推荐，包含渠道名称、预估时效、预估费用

### Requirement: 数据访问层
系统 SHALL 基于 better-sqlite3 实现数据访问层，包含用户表、店铺表、商品表、订单表、任务日志表、知识库表等核心数据表，提供CRUD操作接口。

#### Scenario: 数据持久化
- **WHEN** Agent执行任务产生数据
- **THEN** 数据通过数据访问层持久化到SQLite，支持查询和导出

### Requirement: API接口层
系统 SHALL 通过 Next.js API Routes 暴露RESTful接口，覆盖六大Agent功能调用、用户管理、店铺管理、数据查询等场景。

#### Scenario: API调用
- **WHEN** 前端发起API请求
- **THEN** 后端路由到对应Agent逻辑，返回标准化JSON响应

### Requirement: 网页端核心页面
系统 SHALL 实现网页端核心页面，包含登录页、首页仪表盘、六大Agent模块页、数据中心页，采用品牌色系（主色#1677FF）和模块化卡片布局。

#### Scenario: 仪表盘展示
- **WHEN** 用户登录进入首页
- **THEN** 展示店铺核心数据指标、六大Agent运行状态、待办任务、快捷功能入口

### Requirement: 单元测试
系统 SHALL 为所有核心模块编写单元测试，覆盖Agent逻辑、数据访问层、API接口层，使用 Jest + Testing Library 作为测试框架。

#### Scenario: 测试执行通过
- **WHEN** 执行 npm test
- **THEN** 所有单元测试通过，测试覆盖核心业务逻辑路径
