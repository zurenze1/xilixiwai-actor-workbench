# 每个板块就地操作资料

入口 `/demo/demo-workspace/?embedded=1&scope=studio&theme=tide`。不再展示实验室总目录或愿景卡。复用 `demo-lab/forms.js` 的实战18类完整定义与校验，记录共享原有 `xilixiwai-demo-lab-v1` IndexedDB；无网络、账号或模型连接。

`await frame.contentWindow.DemoWorkspace.whenIdle()`：等待初始化、草稿、文件及所有写入完成，失败抛错。旧 `DemoLab.whenIdle()` 不变。`getSummary()` 返回摘要，`getRecords()`/`getHistory(id)` 只读克隆当前scope资料。

`await DemoWorkspace.importActions([{task,owner,due}],{batchId,sourceTitle})`：将材料分析页已经人工确认的行动写入共享task记录；只在studio/today使用，负责人及真实截止日期必须手填。每批1至100项，先完整校验，再单事务写入；返回`{ids,count,created,skipped}`。固定批次+行号产生固定ID，重复导入保留既有人工修改，不覆盖重建；新任务含来源说明和V1历史。写入失败回滚候选状态；原先未提交的手写任务草稿继续保留。

同源父级在正式保存、归档、CSV导入、备份恢复、历史恢复及初始化后，收到 `{type:'actor:workspace-updated',reason,scope,kind,total,active,archived,byKind,latest,actualRevision}`。`byKind` 为 `{kind:{total,active,archived}}`；`latest` 为 `{id,title,kind,status,updatedAt,revision}`。`actualRevision` 是本机库已完成事务的版本号。父级可更新摘要显示，避免因此重建正在编辑的iframe。

仅接受同源parent主题消息 `workbench:theme` / `actor:theme` / `theme`。主题 tide/butter/moss。

| 实战普通路由 scope | 显示的完整记录类型 |
| --- | --- |
| today | task、event |
| project | project（新增项目资料）、evaluation、contract |
| script | scene、knowledge；原文上传/解析由主工作台入口提供 |
| performance | scene |
| studio | task、meeting、knowledge |
| fans | message |
| rights | right、contract |
| review | review、work |
| dance | dance |
| brief | brief |
| plan | goal |
| travel | travel、health |
| crisis | crisis |
| charity | charity |

实战20路由中其余6个：business/social 已有完整经营/运营演示模块；previs由分镜模块负责；pet保留肉肉原页；guide与settings不是这18类通用业务表单。此处不冒称接通AI、自动采集、发布或账号隔离。

项目资料新增第26类：标题、演员/虚名、8阶段、导演、制作团队、备注。其余18实战字段未简化，原25类旧备份继续接受，文件格式仍version1。仅当前scope缺失的虚构示例会自动补充，既有修改不会覆盖。

操作实际支持新增、编辑、归档/恢复、搜索、状态筛选、CSV预览导入/导出及空白模板、原件上传下载、独立完整备份。正式修改同步反映数量、列表、最新修改及状态。跨板块相同kind共享记录。

每条正式记录保留版本历史，修改/归档/CSV更新都会追加版本。点击“版本历史→恢复为新版本”可恢复当时标题、完整字段、归档状态及原件引用；旧版本与旧原件保留。每卡最多100版，达到时提示先备份并新建卡继续。JSON备份包含历史；旧版没有历史时按V1接续。

重复提交同步锁住原表单，失败解除锁定并保留输入。`whenIdle`先等待正在保存的正式记录完成，再读取当前DOM草稿，避免父壳立即切页造成新记录ID丢失；未确认的CSV/JSON导入预览会提示先确认或返回。

完整备份是整个共享业务库，包含所有类别、草稿、历史及原件。与主线、经营和账号运营备份各自独立；恢复会替换所有scope共享业务记录，预览明确提示。文件每件8MB、合计32MB、最多100件；JSON导入64MB。解除引用不删除原件。跨窗口修订冲突阻止覆盖。
