# 演员三 · 造型与分镜首轮交接

冻结：2026-10-23 23:56（北京时间）。真源分支 `practical-workspace`。

只修改 `practical/web/previs/` 与 `practical/tests/previs*`；旧 `web/` 演示版、主app/server/package未修改，未提交或部署。源码接入说明见同目录README。

## 交付

同页入口 `/practical/previs/?embedded=1&theme=tide`。初始方案和图片为空，编辑当前项目自己的镜头与造型，支持增删/排序、描述、台词/声音说明、机位造型说明、时长、图片关联、推拉/平移、暂停/拖动/续播、三种画幅和三套主题。

使用真实 `../bridge.js` 与 `previs-v1` 记录。原图存服务器，状态保留附件元数据、编号与SHA256；读取及导出会校验原图字节数和SHA。主界面移除iframe前调用 `PrevisApp.flush()`，同时等待正在执行的上传/导入/导出；保存冲突保留本页草稿，不自动覆盖新版本。

通用模型报告的 `shots[{number,title,description,duration,look,sound}]` 可直接粘贴/导入：look保留为lookNotes，sound保留为台词/声音说明，均可继续编辑。模型任务仍由主界面发起，本模块没有预置《逆光》或其他固定报告。

可实际下载：方案JSON（所用原图+哈希）、镜头CSV（含完整说明/台词/引用，防公式执行）、图片内嵌且自带运行库的独立HTML、原件图片。恢复调用真实桥重上传并重映射文件ID，保留原字节/hash。未选择图片时明确显示提示。声音字段是文字说明，不合成音频。

## 已验证

- `node --test practical/tests/previs.schema.test.cjs`：12/12通过。边界/非法数值、重复ID、错误引用、CSV转义、实际模型look/sound映射、HTML脚本注入与缺图中止。
- `practical/tests/previs.browser.cjs`：23/23通过。独立契约适配器；实际上传虚构验收PNG、保存/重读、改动与重排、造型图回退、静止/运动定位、暂停拖动续播、失败保存保留草稿后重试、异常/超量导入不改原方案、缺原件备份拦截、恢复与删除、JSON/CSV/HTML/原件真实下载，下载原件逐字节相同。
- 三主题×320/390/1280 CSS视口无整体水平溢出；独立HTML在关闭网络的浏览器中实际播放/暂停/拖动，图片可解码。完整文字在导出“镜头全文与原图引用”中。
- `practical/tests/previs.integration.cjs`：12/12通过。4938真实server+真实bridge+独立数据库+虚构账号，实际主UI注册/建项目/同页iframe；在上传中离页会等完成、立即导航保存、项目状态/图片隔离、恢复新附件ID且原字节/hash相同、主主题同步、双标签真实409拒旧写且旧草稿保留、实际暂停拖动，脚本错误0。测试服务已退出，没有触碰4930及用户入口。
- 补测先复现“拉远”首帧缩放1与拖回起点1.14不同；初始化镜头变换修正后，两次均为1.14，并回归通过。

结构化结果与截图均保留在Git忽略的 `practical/tests/previs-artifacts/`：`contract-results.json`（23项）、`real-integration-results.json`（12项）、`real-embedded-moss.png`、`real-embedded-paused-seek.png`、九张主题/视口截图、`offline-export.png`。源码SHA见该QA目录的 `source-manifest.json`。QA还含隔离测试运行数据，不能打包公开；该目录仅`.gitignore`可被Git追踪。

## 范围与限制

真实验证为本机、虚构账号/场景与实际上传测试图，不等于其他工作室ACL、公网部署、真实模型付费调用、手机硬件或本人审美验收；这些交演员一统一推进。单图32MiB、已用原图备份/HTML160MiB，限值有校验，尚未做极限容量压力测试。每项目保存一个当前方案，服务端记录修订历史；可导出后替换，不提供额外的多方案管理器。HTML是可独立播放的预演文件，未新做MP4或宣称HyperFrames渲染验收通过。

依赖只复用原工程GSAP 3.12.5，保留上游许可头；没有新增package依赖、密钥或模型账号。
