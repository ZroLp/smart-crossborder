# Tasks

- [x] Task 1: Shopify OAuth 授权完整流程
  - [x] SubTask 1.1: 创建 app/api/auth/shopify/route.ts OAuth授权端点，生成Shopify OAuth URL（含client_id、scope、redirect_uri）
  - [x] SubTask 1.2: 创建 app/api/auth/shopify/callback/route.ts OAuth回调端点，用授权码换取access_token，存储店铺信息到数据库
  - [x] SubTask 1.3: 在 SQLite 中新增 shops 表（id, user_id, shop_name, domain, access_token, scope, status, created_at, updated_at）
  - [x] SubTask 1.4: 重写 app/login/page.tsx，实现完整的账号密码登录→Shopify授权引导→跳转→回调→数据拉取→Agent初始化→跳转仪表盘流程
  - [x] SubTask 1.5: 实现授权失败错误处理，展示具体原因（权限不足/域名不匹配/网络异常）和修复方案，支持重试
  - [x] SubTask 1.6: 实现多店铺绑定逻辑，店铺列表展示已授权店铺状态，支持解绑和切换
  - [x] SubTask 1.7: 编写Shopify OAuth流程单元测试

- [x] Task 2: 仪表盘风险预警弹窗与自动刷新
  - [x] SubTask 2.1: 创建 components/RiskAlertPopup.tsx 风险预警弹窗组件，橙红渐变高亮卡片，支持关闭和一键跳转
  - [x] SubTask 2.2: 修改 app/dashboard/page.tsx，集成风险预警弹窗，从SharedContext读取风险数据触发展示
  - [x] SubTask 2.3: 在仪表盘实现定时自动刷新逻辑（setInterval 5分钟/次），刷新时使用SkeletonLoader过渡
  - [x] SubTask 2.4: 实现异常数据标红闪烁效果（CSS动画）
  - [x] SubTask 2.5: 编写仪表盘风险预警与自动刷新单元测试

- [x] Task 3: AI五步进度可视化前端对接
  - [x] SubTask 3.1: 创建 components/AIStepProgress.tsx 组件，从AgentProgressTracker获取五步进度数据，实时展示每步状态/耗时/输入输出
  - [x] SubTask 3.2: 修改 app/dashboard/selection/page.tsx，集成AIStepProgress组件，在AI选品指令执行时展示五步推理过程
  - [x] SubTask 3.3: 实现进度交互控制按钮（暂停/终止/重新生成），调用AgentProgressTracker对应方法
  - [x] SubTask 3.4: 在其他Agent页面（建站/内容/投流/客服/履约）统一集成AIStepProgress组件
  - [x] SubTask 3.5: 创建 app/api/agent/progress/route.ts 端点，返回指定taskId的五步进度数据
  - [x] SubTask 3.6: 编写AIStepProgress组件单元测试

- [x] Task 4: 移动端离线模式
  - [x] SubTask 4.1: 创建 lib/offline/cache-manager.ts，实现IndexedDB缓存管理（存取经营数据、任务状态、消息列表）
  - [x] SubTask 4.2: 创建 components/OfflineIndicator.tsx 离线状态指示组件，展示「离线模式」提示与最后更新时间
  - [x] SubTask 4.3: 修改 app/mobile/layout.tsx，集成网络状态监听（navigator.onLine + online/offline事件），展示OfflineIndicator
  - [x] SubTask 4.4: 修改移动端首页（app/mobile/page.tsx），离线时展示缓存数据并禁用网络操作按钮
  - [x] SubTask 4.5: 实现网络恢复自动同步逻辑，清除离线提示并刷新最新数据
  - [x] SubTask 4.6: 编写离线缓存管理器单元测试

- [x] Task 5: 移动端语音输入
  - [x] SubTask 5.1: 创建 lib/speech/web-speech.ts，封装Web Speech API（SpeechRecognition），提供startRecognition/stopRecognition方法
  - [x] SubTask 5.2: 创建 components/VoiceInputButton.tsx 语音输入按钮组件，支持录音状态切换、语音转文字展示
  - [x] SubTask 5.3: 修改 app/mobile/command/page.tsx，集成VoiceInputButton，支持文字/语音双输入
  - [x] SubTask 5.4: 实现设备兼容性检测，不支持时隐藏麦克风按钮
  - [x] SubTask 5.5: 编写语音输入组件单元测试

- [x] Task 6: 视觉主题Token补全
  - [x] SubTask 6.1: 创建 lib/theme/shadows.ts，定义卡片阴影（默认/悬浮/深层三级）、弹窗阴影、下拉阴影Token
  - [x] SubTask 6.2: 创建 lib/theme/border-radius.ts，定义圆角Token（卡片12px/移动端16px/按钮8px/标签4px/圆形50%）
  - [x] SubTask 6.3: 创建 lib/theme/animation.ts，定义动效Token（骨架屏渐变/AI流动/悬浮上浮/完成弹跳/失败抖动/消息闪烁的duration+easing）
  - [x] SubTask 6.4: 更新 tailwind.config.ts，新增 teal(#36CFC9) 独立颜色变量，引入shadows/border-radius/animation扩展
  - [x] SubTask 6.5: 在现有页面组件中应用新增的阴影、圆角、动效Token

- [x] Task 7: 全链路协同集成测试
  - [x] SubTask 7.1: 创建 tests/integration/agent-chain.test.ts，测试选品→建站→内容全链路联动（SharedContext数据传递验证）
  - [x] SubTask 7.2: 创建 tests/integration/agent-chain-closure.test.ts，测试投流→履约→客服→数据反哺闭环
  - [x] SubTask 7.3: 创建 tests/integration/agent-error-recovery.test.ts，测试全链路异常中断恢复（某Agent失败后的状态和重试）
  - [x] SubTask 7.4: 执行集成测试并修复发现的问题

- [x] Task 8: 性能基准测试
  - [x] SubTask 8.1: 创建 tests/performance/db-operations.test.ts，测试SharedContext/AgentProgress/TaskLock单次操作≤300ms、批量操作≤1.5s
  - [x] SubTask 8.2: 创建 tests/performance/concurrency.test.ts，测试100并发Agent任务请求无阻塞
  - [x] SubTask 8.3: 执行性能测试并记录基准数据

- [x] Task 9: 国际化适配测试
  - [x] SubTask 9.1: 创建 tests/integration/i18n-compliance.test.ts，测试5种语言切换所有翻译key完整性
  - [x] SubTask 9.2: 创建 tests/integration/timezone-accuracy.test.ts，测试多时区转换正确性（US/EU/CN/东南亚）
  - [x] SubTask 9.3: 创建 tests/integration/currency-precision.test.ts，测试多币种转换精度与格式化展示
  - [x] SubTask 9.4: 执行国际化测试并修复发现的问题

- [x] Task 10: 异常容错测试
  - [x] SubTask 10.1: 创建 tests/integration/error-classification.test.ts，测试ErrorHandler对5种错误类型的准确分类
  - [x] SubTask 10.2: 创建 tests/integration/task-lock-contention.test.ts，测试多Agent并发锁竞争的正确行为
  - [x] SubTask 10.3: 创建 tests/integration/cache-fallback-degradation.test.ts，测试数据源不可用时缓存降级返回
  - [x] SubTask 10.4: 执行异常容错测试并修复发现的问题

- [x] Task 11: 全量测试执行与验证
  - [x] SubTask 11.1: 执行全部新增测试（集成测试+性能测试+国际化测试+异常容错测试）
  - [x] SubTask 11.2: 修复测试中发现的所有问题
  - [x] SubTask 11.3: 确保所有测试（含原有单元测试）全部通过，无回归

# Task Dependencies
- [Task 2] depends on [Task 6]
- [Task 3] depends on [Task 6]
- [Task 7] depends on [Task 1]
- [Task 8] depends on [Task 1, Task 4]
- [Task 9] depends on [Task 6]
- [Task 10] depends on [Task 1, Task 4]
- [Task 11] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10]
