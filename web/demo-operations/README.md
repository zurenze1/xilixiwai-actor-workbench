# 完整经营与运营本机演示

运行 `node scripts/build-demo-operations.mjs` 镜像实战现有业务 UI/模型。维护原模块后重新构建，`sources.json` 记录来源与输出哈希；不手写第二套字段。

- 经营入口：`/demo/demo-operations/business/?embedded=1&theme=tide`
- 运营入口：`/demo/demo-operations/social/?embedded=1&theme=tide`
- 同页 iframe 切换前：`contentWindow.DemoOperations.whenIdle()`，也保留 BusinessApp/SocialApp 原接口。
- 主题消息：仅接受同源父窗口 `workbench:theme`、`actor:theme`、`theme`；颜色 tide/butter/moss。
- 独立 IndexedDB `actor-demo-operations-v1`，不读实战账号、sessionStorage 或主线存储，不调用真实 `/api`。
- 首次载入虚构工作室、独立签约经纪主体、片酬分期、回款、支出、票据、器材领用、人工税务待办、自有品牌/SKU/库存/渠道；自有品牌与外部代言独立登记。运营包含账号、选题、版本、人工发布审核、累计快照、粉丝快照、复盘行动。
- 经营完整备份包含经营台账和引用原件；运营备份包含运营正式记录和原件。需分别下载，不属于主工作台备份。运营表单草稿自动保存在本机，但正式运营备份不含个人草稿。
- 原件每份32 MiB；SHA-256 校验；完整备份引用原件合计160 MiB。业务写入/CSV批次在一个 IndexedDB 事务中校验，失败不留下部分记录。跨窗口 revision 冲突会阻止覆盖。
- 未连接平台同步、自动发布、税务申报、电商订单/支付或真实模型。此处人工登记与计算可以实际运行，初始资料并非真实经营结果。
