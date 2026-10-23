# MD需求深度对齐补齐 Spec

## Why

经过对《跨境智卖——中小跨境卖家全链路AI操作系统 业务调研与产品原型综合方案.md》的逐行审计，发现上一轮 `align-md-requirements` spec 虽然完成了框架层功能补全（SharedContext、AgentProgressTracker、NLParser等），但在**前端交互体验层**和**测试验证层**仍存在显著缺口。具体包括：Shopify OAuth授权流程仅有UI空壳、仪表盘缺少风险预警弹窗与自动刷新、AI五步进度可视化前端未对接后端框架、移动端缺少离线模式与语音输入、主题Token缺少阴影/动效/间距规范、第六部分测试与性能方案完全未覆盖。需深度补齐以完整对齐MD文档全部需求。

## What Changes

### 前端交互体验补齐
- 实现Shopify OAuth授权完整流程（OAuth跳转→回调→数据拉取→Agent初始化）
- 实现仪表盘风险预警弹窗与定时自动刷新（5分钟/次）
- 前端页面对接AgentProgressTracker实现AI五步进度可视化
- 实现移动端离线模式（IndexedDB缓存 + 离线状态标识）
- 实现移动端语音输入（Web Speech API集成）

### 视觉主题Token补全
- 新增阴影Token（shadows.ts）：卡片阴影、悬浮加深
- 新增圆角Token（border-radius.ts）：网页端12px、移动端16px
- 新新增动效Token（animation.ts）：骨架屏渐变、AI流动、悬浮上浮、弹跳、抖动
- 补充Tailwind配置中的teal独立颜色变量

### 测试与性能验证体系
- 实现六大Agent独立功能测试（每个Agent核心功能的验证）
- 实现全链路协同集成测试（选品→建站→内容→上新→投流→履约→客服闭环）
- 实现性能基准测试（页面响应≤1.2s、AI任务≤2s、接口≤300ms指标验证）
- 实现国际化适配测试（多语种切换、多时区转换、多币种精度）
- 实现异常容错测试（API异常、网络波动、任务冲突场景覆盖）

## Impact

- Affected specs: align-md-requirements
- Affected code: app/login/page.tsx, app/dashboard/page.tsx, app/mobile/*, components/*, lib/theme/*, tailwind.config.ts, tests/*, package.json(新增测试依赖)

## ADDED Requirements

### Requirement: Shopify OAuth 授权完整流程
系统 SHALL 实现Shopify店铺OAuth授权的完整交互流，覆盖从账号登录到店铺数据初始化的全流程，对齐MD文档第三部分第一节交互规范。

#### Scenario: 首次授权成功
- **WHEN** 用户输入账号密码登录成功后首次进入
- **THEN** 引导用户点击Shopify授权按钮，跳转Shopify官方OAuth授权页，用户确认授权后系统回调获取access_token，自动拉取店铺信息、商品数据、广告数据，初始化六大Agent并同步状态，最终跳转首页仪表盘

#### Scenario: 授权失败
- **WHEN** Shopify授权过程中出现权限不足、域名不匹配、网络异常
- **THEN** 系统展示具体失败原因并给出修复方案，支持重试授权或手动导入数据兜底

#### Scenario: 多店铺绑定
- **WHEN** 用户已有授权店铺后再次点击授权
- **THEN** 支持绑定多个Shopify店铺，店铺列表展示已授权店铺状态，支持解绑和切换

### Requirement: 仪表盘风险预警弹窗与自动刷新
系统 SHALL 在首页仪表盘实现风险预警弹窗与定时自动刷新机制，对齐MD文档第二部分第三章第一节交互规范。

#### Scenario: 风险预警弹窗
- **WHEN** 系统检测到运营风险数据（异常订单、低库存、投放异常、合规风险）
- **THEN** 页面以橙红渐变高亮弹窗展示风险预警，支持一键跳转对应处理页面，用户可手动关闭

#### Scenario: 定时自动刷新
- **WHEN** 用户停留在仪表盘页面
- **THEN** 系统每5分钟自动刷新经营数据与Agent状态，刷新过程使用骨架屏过渡，用户也可手动刷新

### Requirement: AI五步进度可视化前端对接
系统 SHALL 将后端AgentProgressTracker的五步进度数据在前端页面实时可视化展示，对齐MD文档第三部分全局AI交互规范。

#### Scenario: Agent执行进度展示
- **WHEN** 用户下发AI指令后Agent开始执行
- **THEN** 前端实时展示「数据采集→模型推理→策略生成→执行落地→结果回传」五步进度，每步显示状态（待执行/执行中/已完成/失败）、耗时、输入输出摘要，品牌渐变流动动效

#### Scenario: 进度交互控制
- **WHEN** 用户在AI任务执行过程中点击暂停/终止/重新生成按钮
- **THEN** 系统调用AgentProgressTracker的pauseTask/terminateTask/retryTask方法，前端同步更新进度状态

### Requirement: 移动端离线模式
系统 SHALL 在移动端实现离线缓存与离线模式，对齐MD文档第三部分移动端首页交互流中的离线规范。

#### Scenario: 离线数据展示
- **WHEN** 移动端检测到网络断开
- **THEN** 页面标注「离线模式」提示，展示IndexedDB中缓存的最近数据并标注数据更新时间，禁用需要网络的操作按钮

#### Scenario: 网络恢复自动同步
- **WHEN** 移动端网络恢复连接
- **THEN** 自动清除离线模式提示，同步离线期间的本地操作数据，刷新最新服务端数据

### Requirement: 移动端语音输入
系统 SHALL 在移动端AI指令页集成语音输入功能，对齐MD文档第三部分智能AI指令页交互规范。

#### Scenario: 语音输入指令
- **WHEN** 用户点击麦克风按钮并开始说话
- **THEN** 系统通过Web Speech API实时转写语音为文字，展示在输入框中，用户确认后发送指令

#### Scenario: 语音输入不可用
- **WHEN** 设备不支持语音识别或用户未授权麦克风权限
- **THEN** 隐藏麦克风按钮，仅保留文字输入方式，不报错

### Requirement: 视觉主题Token补全
系统 SHALL 完善主题Token体系，补齐阴影、圆角、动效等缺失的视觉规范定义，对齐MD文档第四部分前端页面版式与动效设计规范。

#### Scenario: 卡片阴影规范
- **WHEN** 渲染页面卡片组件
- **THEN** 默认使用轻微阴影(box-shadow)，鼠标悬浮时阴影加深，过渡动画300ms

#### Scenario: 圆角规范
- **WHEN** 渲染页面元素
- **THEN** 网页端卡片圆角12px，移动端卡片圆角16px，按钮圆角8px，统一应用

#### Scenario: 动效规范
- **WHEN** 触发页面加载、AI任务执行、卡片交互、消息推送
- **THEN** 应用定义的动效Token：骨架屏渐变加载、AI流动进度、卡片悬浮上浮+阴影过渡、完成弹跳、失败抖动、消息红点呼吸闪烁

### Requirement: 全链路协同集成测试
系统 SHALL 实现六大Agent全链路闭环的集成测试，验证模块间数据互通、任务触发、流程完整性，对齐MD文档第六部分第二节全链路协同测试要求。

#### Scenario: 选品→建站→内容→上新联动
- **WHEN** 执行选品→建站→内容全链路
- **THEN** 验证选品结果自动传递给建站Agent、建站完成触发内容Agent、全链路数据写入SharedContext且无数据丢失

#### Scenario: 投流→履约→客服→数据反哺闭环
- **WHEN** 执行投流→履约→客服全链路
- **THEN** 验证投流触发履约、履约完成触发客服、客服数据反哺写入SharedContext、选品Agent可读取反馈数据

#### Scenario: 异常中断恢复
- **WHEN** 全链路中某Agent执行失败
- **THEN** 验证失败Agent标记错误状态、后续Agent不执行、ErrorHandler记录重试任务、修复后可恢复执行

### Requirement: 性能基准测试
系统 SHALL 实现性能基准测试，验证系统满足MD文档第六部分第三节定义的核心性能指标。

#### Scenario: 数据库操作性能
- **WHEN** 执行SharedContext数据读写、AgentProgress记录、TaskLock加锁解锁操作
- **THEN** 单次操作响应时间≤300ms，批量操作（100条）≤1.5s

#### Scenario: 并发任务处理
- **WHEN** 模拟100个并发Agent任务请求
- **THEN** 系统无任务阻塞、无队列卡死，所有任务均在合理时间内完成

### Requirement: 国际化适配测试
系统 SHALL 实现国际化适配的专项测试，验证多语种、多时区、多币种功能的正确性，对齐MD文档第六部分第五节国际化适配测试要求。

#### Scenario: 多语种切换完整性
- **WHEN** 切换5种语言（中/英/西/法/德）
- **THEN** 所有翻译key均有对应翻译，无缺失、无fallback到key本身

#### Scenario: 多时区转换正确性
- **WHEN** 将UTC时间转换为不同时区（US/EU/CN/东南亚）
- **THEN** 转换结果准确，无时差偏移错误

#### Scenario: 多币种精度
- **WHEN** 在不同币种间转换金额
- **THEN** 转换精度无丢失，格式化展示符合各币种规范（USD $、EUR €、GBP £、CNY ¥）

### Requirement: 异常容错测试
系统 SHALL 实现异常容错的测试覆盖，验证各类异常场景的兜底机制有效性，对齐MD文档第六部分第六节异常容错测试要求。

#### Scenario: ErrorHandler分类准确性
- **WHEN** 注入不同类型的错误（网络错误、合规拦截、参数错误、API超时、数据源不可用）
- **THEN** ErrorHandler准确分类为对应错误类型，给出正确的修复建议

#### Scenario: TaskLock冲突处理
- **WHEN** 多个Agent同时请求同一资源锁
- **THEN** 仅一个Agent获取锁，其余等待或返回冲突提示，无重复操作

#### Scenario: CacheFallback降级
- **WHEN** 数据源不可用时
- **THEN** CacheFallback返回缓存数据并标注数据时间和「缓存」标识，页面保持可用

## MODIFIED Requirements

### Requirement: 选品页面交互增强
选品页面（app/dashboard/selection/page.tsx）从静态表单升级为完整交互页面，增加AI五步执行进度展示区域、爆款评分可视化、风险标签展示、一键加入建站清单操作。

### Requirement: 仪表盘页面交互增强
首页仪表盘（app/dashboard/page.tsx）增加风险预警弹窗组件、定时自动刷新逻辑（5分钟/次）、异常数据标红闪烁效果。

## REMOVED Requirements
None.
