# 造型与分镜模块

在同一个工作台中嵌入 `/practical/previs/?embedded=1&theme=tide`，支持 tide、butter、moss。模块不创建账号、项目或另一份业务存储；新项目为空白方案。

## 接入

只依赖同源 `../bridge.js` 的 ActorStore。`open('previs-v1', fresh, validate)`；保存由服务端记录修订号保护，图片通过 `putFile/listFiles/getFile/downloadFile` 操作。状态只保存附件编号、名称、字节数、MIME、SHA256，不嵌入图片，也不写 localStorage。选图来自当前项目的附件列表；附件滚动可见时加载，所用图片优先加载。

**主工作台在切项目或移除 iframe 前，必须等待 `iframe.contentWindow.PrevisApp.flush()` 成功。** 失败时保留当前页草稿，提示保存重试或显式重新读取。也支持同源消息 `{type:'previs:flush',requestId}`，返回 `{type:'previs:flushed',requestId,ok,error?}`。事件 `previs:ready` 和 `previs:dirty` 可用于主界面状态提示。主题消息为 `{type:'theme',theme}`。不要用修改 sessionStorage 后直接保留旧 iframe 的方式切换项目。

## 能力与数据

- 手动增删、上下排序镜头；编辑画面、台词、景别、时长、静止/推近/拉远/左右平移；画幅16:9、9:16、1:1。
- 编辑造型名称、妆发/服装说明和原图，关联镜头；镜头未单独选图时使用造型图片。未选图明确提示。
- 预览暂停、原地拖动、续播、从头播放；时间线按当前镜头重算。变更编辑会暂停预览。
- 模型调用仍由主工作台通用任务负责，模块可校验导入其 shots JSON；支持顶层数组或 `{title,aspect,shots,looks?}`，追加/替换均先校验。通用任务实际输出的 `look` 导入为可编辑 `lookNotes`、`sound` 导入为台词/声音说明，不丢掉文字；声音说明不会合成音频。
- JSON 为 `practical-submodule` v1 包，含本方案使用的原件及SHA256，经 ActorStore.validateBundle 校验；恢复使用 ActorStore.restoreBundle，跨项目导入时由桥重新上传并重映射附件编号。不会顺便打包同项目的无关剧本附件。
- CSV 为带BOM的镜头表，完整保留描述、台词、造型和原图引用，并转义表格公式前缀。
- 独立HTML内嵌已用图片、完整方案、播放代码和GSAP，可断网播放、暂停和拖动。完整镜头文字在“镜头全文与原图引用”中，预览画布只展示适合画幅的行数。HTML不是MP4，也未宣称已通过HyperFrames视频渲染验收。

单张原图上限32MiB；原件备份/HTML合计上限160MiB；单方案最多300镜头/300造型，镜头0.1至600秒、总长最多10小时，文字量遵循服务端单记录限制。超大方案可先导出，再替换内容或分项目保存；不进行隐式压图或替换原件。多张上传中的失败会逐项显示，已上传的原件保留。`PrevisApp.flush()`同时等待正在执行的上传/导入/导出，避免主页面切换时中止该操作。

镜头JSON示意（字段是结构例子，不是产品预置结果）：

```json
{"title":"当前方案","shots":[{"title":"镜头标题","description":"当前画面","dialogue":"当前台词","duration":3,"framing":"中景","movement":"push","imageId":"","lookId":""}]}
```

## 独立验证

`node --test practical/tests/previs.schema.test.cjs`

`NODE_PATH=<含playwright的node_modules> ACTOR_QA_CHROME=<Chrome可执行路径> node practical/tests/previs.browser.cjs`

浏览器测试使用独立 ActorStore 契约适配器与虚构验收资料，实际上传测试PNG、下载并核对原件哈希，验证保存失败和异常导入、离线HTML播放。它不等于真实登录/工作室权限或模型调用验收；这些由主演员工作台整体验证。测试下载和截图保留在忽略的 `practical/tests/previs-artifacts/`。

真实桥联测：`NODE_PATH=<含playwright的node_modules> ACTOR_QA_CHROME=<Chrome可执行路径> node practical/tests/previs.integration.cjs`。脚本在4938起真实服务，使用该QA目录下的新数据库和虚构测试账号，实际通过主界面进入同页iframe，验证原件上传/恢复重映射、项目切换、立即导航保存、真实409版本冲突和预览拖动；结束关闭自己的服务。不要指向用户运行中的数据目录。本机集成结果不替代公网部署、其他工作室ACL、真实模型或手机硬件验收。

## 来源与许可

执行前核对 [Storyboarder](https://github.com/wonderunit/storyboarder) 与 [HyperFrames](https://github.com/heygen-com/hyperframes)。Storyboarder是完整桌面制作软件，不直接加入这个同页模块；沿用HyperFrames的有限时间线、可定位运动规则，最小实现项目数据编辑和HTML导出。播放器使用已在原工程中的GSAP 3.12.5，副本位于 `vendor/gsap.min.js`，上游署名与许可头完整保留，许可按该文件所链的GSAP条款。没有新增模型依赖或凭据。
