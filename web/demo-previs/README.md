# 完整造型与分镜演示

入口：`/demo/demo-previs/?embedded=1&theme=tide`；主题支持 tide / butter / moss。

运行 `node scripts/build-demo-previs.mjs` 镜像实战的界面、校验器、播放器、导出器和 GSAP。`sources.json` 记录每份来源与输出的 SHA-256；实战源码不改。初始化采用《逆光来信》虚构的 4 镜头、2 造型与 2 份既有项目氛围图。原图沿用 `../assets/PHOTO-CREDITS.txt` 中来源，不新增图或假称演员定妆。

唯一差异是 `bridge.js` 的独立 IndexedDB 本机适配、首次样例、明确的演示提示，以及 `PrevisApp.whenIdle()`。没有账号、密钥、外部平台或 `/api` 调用。初次建立后不重复种入，不覆盖后续编辑；浏览器清除资料会丢失内容，需下载 JSON 备份。

可操作：镜头增删编辑／排序／时长与景别运动；造型与原图关联；原图上传下载；播放暂停、拖动与续播；通用 shots JSON 的校验追加／替换；JSON 含原件备份恢复、CSV、可离线播放的独立 HTML。HTML 不等于 MP4，声音说明保留文字，不合成音频。

父页面在移除 iframe 前需等待 `PrevisApp.flush()` 或 `whenIdle()` 成功。两者等待当前上传、导入、导出及保存；失败时保留当前页。支持原生同源 `previs:flush`／`previs:flushed` 消息及 `theme` 消息。状态与原件存于同一数据库；保存使用修订号保护，恢复在同一事务中写入原件与方案并重新映射全部图片编号。

本轮实际浏览器验收 42 项通过：保存刷新、镜头与造型增删排序、原件 SHA-256／字节一致、播放暂停拖动续播、无效时长、三种导出、损坏备份拒绝、跨浏览器资料库恢复重映射、双窗口冲突、父页面切页保存、三主题在 1440／390／320 无溢出，以及断网打开导出 HTML 播放与拖动。未测试实体手机或真实模型连接。

已核查开源参考：[Storyboarder](https://github.com/wonderunit/storyboarder)、[idb-keyval](https://github.com/jakearchibald/idb-keyval)。本轮优先复用已有实战模块，没有加入新的第三方框架。GSAP 上游许可头完整保留在 `vendor/gsap.min.js`，按其中链接的上游条款使用。
