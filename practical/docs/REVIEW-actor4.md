# 演员四独立复核

范围：`server/index.mjs`、`database.mjs`、`files.mjs`、`backup.mjs` 与 `web/bridge.js`。本轮没有修改这些生产文件；只有独立回归测试和本文。所有HTTP、身份、数据库、原件操作使用自动创建并清理的 `.runtime/actor4-*` 夹具，随机空闲端口，不访问真人资料，不调用真实模型或本机模型工具。

## 已复现并由主工程修复的缺陷

| 级别 | 原缺陷与实证 | 最小修复与回归 |
| --- | --- | --- |
| P1 | 普通项目中私有原件无法被viewer下载，但导出成documents后viewer读到了全文：documents没有owner/visibility隔离。 | 主工程已增加字段/迁移，文件转文档继承隐私；documents列表、分析资料与导出按调用者过滤。HTTP回归通过。 |
| P1 | 创建私有记录后，以干净正文改为团队共享，viewer通过versions读到旧私有正文。 | 版本表保存当时owner/visibility；旧版本保守设private，历史查询和恢复按版本权限过滤。HTTP回归通过。 |
| P1 | 合成模型runner抛出包含实际收到的合成连接key的错误，该key进入jobs.error并由API返回。 | 连接调用对本次真实key递归脱敏，异常转安全错误；日志不再打印原错误文本。HTTP回归通过，未使用真人密钥。 |
| P2 | ZIP导入后资料分配新ID，报告sourceId及sourceSnapshot仍指向旧资料，引用断链。 | 主工程预先映射项目/文件/文档/记录所有ID，递归映射业务引用后原子写入。HTTP回归通过。 |
| P2 | 含非法记录kind的包已先写项目和原件，拒绝后只归档新项目，留下幽灵项目/文件。 | 主工程全量预校验，文件暂存后统一SQLite事务，失败清理暂存原件。HTTP回归通过。 |

上述及经营/私人空间负向访问包含在 `tests/review-actor4.test.mjs`；连同原有 `tests/server.test.mjs` 的首次独立复跑为7/7通过。

## 随后发现的补充边界

1. **P1：ZIP文档隐私继承遗漏。** 合法结构包中，文件是private，其关联document写team；导入后viewer再次读到原件全文。不是重复前述文件导入路径，而是ZIP恢复路径遗漏继承。新增 `review-actor4.test.mjs` 最后一项实际HTTP复现，最初失败。修法：文档若关联private原件必须强制private；缺失旧字段需保守处理，不能默认公开给团队。已通知主工程。
2. **P2：原件落盘后的权限复核不在清理try内。** `fileService.put`写磁盘后再次调用project校验，若此时访问被撤回会直接抛出并留下无DB记录原件。`review-file-cleanup.test.mjs` 使用真实临时磁盘与合成权限撤回夹具复现，最初失败。修法：落盘及其后复核/入库/审计放入统一try，异常unlink，写权限在同步DB事务中再核对。
3. **P2：项目导出与导入容量规则需一致。** 静态核对发现导出原先只限制原件总160MiB，而导入限制解压后总160MiB、manifest至多20MiB、总路径至多1000个。合法的大文本、1000份小附件、或5份32MiB原件可能导出成功却不能恢复。建议导出前将manifest字节、路径数量和原件一并预检，使成功下载的包满足同一套prepareImport规则。本轮未制造百MB包，不把静态结论写成已完成大文件HTTP试验。

主工程随后已修复以上三处：恢复时关联private原件的文档强制private；原件写入及后续权限/元数据/审计统一进入try和SQLite事务，失败清理；导出同时限制manifest20MiB、全部解压内容160MiB及1000个路径。前两项最终独立回归通过，容量一致性通过修复后代码核对，仍不声称已做百MB压测。

## 真实服务经营浏览器验收

`tests/review-business.browser.test.mjs` 使用真实createApp、SQLite、BetterAuth、主页面导航、iframe和实际bridge，运行真实Chrome。通过的实际操作：

- 新注册虚构管理员，主导航`#business`打开空白经营空间，没有预置主体、金额或经营关系。
- 创建主体，登记两期100.01元应收，刷新后仍存在，金额在数据库中为整数10001分。
- 主主题切换至butter，iframe通过`actor:theme`实际更新。
- 文本草稿填写后立即离页，主工程等待BusinessApp.whenIdle，返回时草稿保留且没有误登记主体。
- 选择未提交原件后尝试离页，被明确阻止，iframe与文件选择保持；提交后原件进入经营私有项目。
- 实际下载原件，与上传缓冲区逐字节一致。
- 下载完整经营备份、删除登记、导入恢复；原件实际上传到新ID，状态引用正确映射。
- 注册虚构viewer加入同一工作室，访问经营项目403，下载经营私有原件404。
- 浏览器脚本错误0，没有模型调用。

这是实际服务技术验收；没有据此声称完成外部模型调用质量、税务申报、法务授权审核或本人审美验收。

## 复跑

```sh
node --test practical/tests/review-actor4.test.mjs practical/tests/review-file-cleanup.test.mjs practical/tests/server.test.mjs
node --test practical/tests/review-business.browser.test.mjs
```

SQLite记录写入在BEGIN IMMEDIATE事务中检查revision，旧版本写入、主体更新及审计同事务；实际HTTP重复revision返回409。跨工作室、他人私人空间及非管理员经营空间的拒绝路径已实测。仅采用主工程暴露的接口和依赖，没有为本次审计引入新框架。

## 最终冻结结果

独立执行 `node --test practical/tests/review*.mjs`：**9/9通过**，包括7项真实HTTP访问/恢复/历史/密钥隔离、1项真实原件异常清理，以及1项真实服务经营浏览器完整流程。模型部分只使用注入的合成runner验证异常处理，没有调用模型账号。本轮提出的缺陷均已由主工程修复；这不等同于整个产品不存在其他未知问题。

复核时文件SHA256（用于区分后续修改）：

| 文件 | SHA256 |
| --- | --- |
| server/index.mjs | `119f30e295963237f3c37873505cc20d33fac71fd6cf4886615d3e1956d15229` |
| server/database.mjs | `f042eddba59eafa8ba8472055046f32baf89efa9e79bff2c4a7abb48a97cff91` |
| server/files.mjs | `7524a167e20fbb20bf49e4df8de6a0922c1065528e2e05ac7c4a41cdb6b3618d` |
| server/backup.mjs | `f0383358ecb7e132e273362e3ab1cc4d5f4682a7872f5a33d9247407a9b82c37` |
| web/bridge.js | `0cd4fd9deb3f52695737d4ba3783aea3eddda30ca5b39530de237a0dbf63e6f6` |

生产源码未由演员四改写，后续整站回归与发布继续由演员一统一负责。
