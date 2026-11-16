# 内容与账号运营：演员三交接

2026-10-24。真源为 `practical-workspace` 分支，本模块只写 `practical/web/social/` 与独立 `practical/tests/social*`；主壳、服务端、部署由演员一负责。原演示版保留。

## 交付行为

- 戏外·事业 → 内容与账号运营，同一个工作台的 iframe。初始没有作品、账号或模拟数据。资料属于 studio 的长期 socialProjectId，换影视项目仍可读写。
- 五页：内容作品库、制作与分发、作品表现、账号与粉丝、复盘计划。六类正式记录都有新增、编辑、刷新持久化、可恢复的逻辑归档。作品保留脚本/负责人/审核人/分类，以及母片、剪辑、封面、文案等版本。
- 分发记录关联真实作品版本和账号；填写各平台文案、排期、审核/发布状态、真实时间与链接/原生作品ID。此版本人工完成平台发布，不自动登录/代发。
- 快照有来源、截止时间、累计/区间口径、精确/近似标记。没有数据保持 null；真实0单独保存。累计总览只取每条发布的最新快照，按平台分组并显示覆盖条数。播放、曝光分别统计，不合并成去重人数。缺失图表点断线，横轴按真实时间；累计值下降保留并提示核对。
- 粉丝总量、新增、取关、平台报告净增分别记录。净增优先同区间平台报告/新增减取关，其次两次总量差，显示实际跨日区间和近似性；不把账号总增粉硬归因到视频。单视频涨粉必须填平台归因依据并确认。
- CSV复用仓库既有 PapaParse 5.5.3（MIT）。列映射→全表验证→预览→确认→后端原子提交；重复跳过、冲突默认保留已有数据，可明确选择更新并保留版本历史。映射变化会使预览失效。更新未映射列保留已有值，作品版本原件恒保留；空列明确映射时会清空非必填值。
- CSV原表是可下载的引用原件；快照存 source.file，其他三类导入资料存可选 importSource.file。CSV输出转义公式，负数数值仍保留为数值。
- 正式数据备份含已引用原件及SHA；全校验再恢复，业务/版本/附件ID重映射，作为独立资料导入，原记录不覆盖。重复恢复会另加一组资料，确认框明确说明。外部大母片位置只备份位置文字。
- 私人表单草稿和筛选保存在当前用户的 private social-v1；正式记录 team 共享。viewer不创建草稿、无写操作。CAS冲突保留本地表单，用户可明确选择“读取最新资料”丢弃本地表单并重读最新正式版本。
- `window.SocialApp.whenIdle()` / `flush()` 均为函数：主壳销毁 iframe 前等待在途上传/写入并保存草稿。待选文件/待确认CSV会抛出说明，阻止静默丢失。

## 存储契约

`model.js` 为浏览器与服务端共用原生ESM：

- `validateRecord(kind,body)` 返回完整校验后的 body；`validateRelations(records)` 验证混合记录中的六个 social kind；`references(body)` 返回引用附件完整meta数组。
- `body.id` 是稳定业务键；`accountId/contentId/releaseId` 引用业务键。服务端 `record.id` 用于PATCH，revision作CAS。
- `social-account/social-content/social-release/social-metric/social-followers/social-plan` 各自独立记录，历史不塞进单个 module。
- GET/POST `projects/:socialPid/records`，PATCH `projects/:socialPid/records/:id`；原子 POST `projects/:socialPid/social-import`，`{mode:'upsert',records:[...]}`，返回 `{records:[...]}`。
- 作品快照自然键是发布ID+UTC标准化截止时间+口径+区间起点；粉丝快照为账号ID+UTC标准化截止时间。CSV账号匹配平台+账号标识；实际发布匹配账号+平台作品ID/链接，其他记录凭业务ID。

## 已完成验证

均使用隔离数据库、虚构身份/文字/原件，不访问用户账号库、实际演员平台账号或付费模型。

- `social-model.test.mjs`：41项通过，含日期/24时边界、数值/缺失/0/溢出、归因、关系、历史时序、CSV幂等/冲突/未映射列保留/原件引用。
- `social-backup.test.mjs`：8项通过，含600条单事务恢复、取消零写入、10000上限、缺少/多余原件、1000份原件边界、外部位置边界。
- `social-browser.test.mjs`：实际Chrome+真实bridge+SQLite，21项业务检查通过。六类新增与编辑后整页刷新、原件SHA、来源原表、CSV校验/幂等/预览失效、真实下载、恢复与坏备份零记录写入、归档/搜索、三主题及390px布局、脚本异常0。
- `social-coordination.test.mjs`：10项实际Chrome检查通过。不同成员CAS与显式重读、viewer、同页导航、最后输入保存、待选文件/待确认CSV保护、在途上传等待、换影视项目仍保留历史、异常0。
- 演员一独占的 `social-server.test.mjs` 本轮回跑通过；根负责其HTTP权限/批量事务/SQL触发器回滚/历史恢复测试的维护。
- 已查看实际桌面与390px截图；这些为CSS视口，不是硬件手机验收。

运行（在仓库根，用项目Node）：

```sh
node --test practical/tests/social-model.test.mjs practical/tests/social-backup.test.mjs practical/tests/social-server.test.mjs
ACTOR_QA_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node --test practical/tests/social-browser.test.mjs practical/tests/social-coordination.test.mjs
```

浏览器证据/测试运行库在 Git 忽略的 `practical/tests/social-qa/`，不发布其中身份库、截图中的虚构资料或完整备份。

## 容量及未验证边界

单份原件/CSV最多32 MiB；人工CSV每次1–500行。原子备份恢复最多10000条记录、20 MiB记录清单、1000份原件、原件合计160 MiB。超过时显式拒绝，不分批伪装原子提交。未做这些最大值的真实浏览器压力测试。备份校验后上传原件若因网络或后续提交失败，正式记录不半写入，但已上传的未引用原件可能保留在工作室空间。

全平台接口均显示“未连接”，没有后台定时抓取/通知，也没有自动发布。数据真实性依赖团队录入或实际平台报表。平台全量历史接口、演员自己的授权/账号与真实业务、云端域名/权限部署、硬件手机、本人审美认可均未在此模块任务验证。完整云端发布由演员一统一处理，本交接不代表整站已经发布。

已核对GitHub：Postiz及social-auto-upload仅作为排期/分发工作流参考，没有复制AGPL应用或复用登录态；真正复用项目现有MIT CSV解析器，未另装整套第三方平台。
