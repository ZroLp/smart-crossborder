# Checklist

## Task 1: Shopify OAuth 授权完整流程
- [x] OAuth授权端点生成正确的Shopify授权URL（含client_id、scope、redirect_uri参数）
- [x] OAuth回调端点正确用授权码换取access_token并存储到shops表
- [x] SQLite shops表创建成功，包含所有必需字段
- [x] 登录页实现完整的登录→授权引导→跳转→回调→数据拉取→Agent初始化→跳转仪表盘流程
- [x] 授权失败展示具体原因（权限不足/域名不匹配/网络异常）和修复方案
- [x] 支持多店铺绑定，店铺列表展示已授权店铺状态，支持解绑和切换
- [x] Shopify OAuth流程单元测试通过

## Task 2: 仪表盘风险预警弹窗与自动刷新
- [x] RiskAlertPopup组件渲染橙红渐变高亮卡片，支持关闭和跳转
- [x] 仪表盘集成风险预警弹窗，从SharedContext读取风险数据触发
- [x] 定时自动刷新逻辑（5分钟/次）正常工作，刷新时骨架屏过渡
- [x] 异常数据标红闪烁CSS动画生效
- [x] 风险预警与自动刷新单元测试通过

## Task 3: AI五步进度可视化前端对接
- [x] AIStepProgress组件正确展示五步进度（每步状态/耗时/输入输出）
- [x] 选品页面集成AIStepProgress，AI选品指令执行时展示推理过程
- [x] 暂停/终止/重新生成按钮正确调用AgentProgressTracker方法
- [x] 其他Agent页面（建站/内容/投流/客服/履约）统一集成进度组件
- [x] /api/agent/progress端点返回正确的五步进度数据
- [x] AIStepProgress组件单元测试通过

## Task 4: 移动端离线模式
- [x] IndexedDB缓存管理器可存取经营数据、任务状态、消息列表
- [x] OfflineIndicator组件正确展示「离线模式」提示与最后更新时间
- [x] 移动端布局集成网络状态监听，网络断开时展示OfflineIndicator
- [x] 移动端首页离线时展示缓存数据并禁用网络操作按钮
- [x] 网络恢复后自动清除离线提示并刷新最新数据
- [x] 离线缓存管理器单元测试通过

## Task 5: 移动端语音输入
- [x] Web Speech API封装正确提供startRecognition/stopRecognition方法
- [x] VoiceInputButton组件支持录音状态切换和语音转文字展示
- [x] AI指令页集成VoiceInputButton，支持文字/语音双输入
- [x] 设备不支持时隐藏麦克风按钮，不报错
- [x] 语音输入组件单元测试通过

## Task 6: 视觉主题Token补全
- [x] shadows.ts定义三级卡片阴影（默认/悬浮/深层）、弹窗阴影、下拉阴影
- [x] border-radius.ts定义圆角Token（卡片/移动端/按钮/标签/圆形）
- [x] animation.ts定义动效Token（骨架屏/AI流动/悬浮/弹跳/抖动/闪烁的duration+easing）
- [x] tailwind.config.ts新增teal(#36CFC9)独立颜色变量
- [x] 现有页面组件已应用新增的阴影、圆角、动效Token

## Task 7: 全链路协同集成测试
- [x] 选品→建站→内容全链路联动测试通过（SharedContext数据传递正确）
- [x] 投流→履约→客服→数据反哺闭环测试通过
- [x] 全链路异常中断恢复测试通过（失败Agent正确标记，后续不执行，可恢复）
- [x] 集成测试全部执行通过

## Task 8: 性能基准测试
- [x] SharedContext/AgentProgress/TaskLock单次操作≤300ms
- [x] 批量操作（100条）≤1.5s
- [x] 100并发Agent任务请求无阻塞、无队列卡死
- [x] 性能测试全部执行通过

## Task 9: 国际化适配测试
- [x] 5种语言切换所有翻译key完整性验证通过（无缺失、无fallback到key本身）
- [x] 多时区转换正确性验证通过（US/EU/CN/东南亚无偏移错误）
- [x] 多币种转换精度验证通过（USD $/EUR €/GBP £/CNY ¥格式化正确）
- [x] 国际化测试全部执行通过

## Task 10: 异常容错测试
- [x] ErrorHandler对5种错误类型准确分类（网络/合规/参数/超时/数据源）
- [x] 多Agent并发锁竞争正确行为（仅一个获取锁，其余等待或冲突提示）
- [x] 数据源不可用时CacheFallback正确返回缓存数据并标注时间
- [x] 异常容错测试全部执行通过

## Task 11: 全量测试执行与验证
- [x] 全部新增测试（集成+性能+国际化+异常容错）执行通过
- [x] 所有测试发现的问题已修复（ShopRepository schema字段对齐：shopify_domain→domain+access_token）
- [x] 原有单元测试无回归，全部通过（555 tests passed）
