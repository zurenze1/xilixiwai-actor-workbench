# 戏里戏外 · 演员与工作室工作台

同一套代码包含可实际保存资料、连接使用者自己模型的**实战版**，以及保留原样的**演示版/发布会**。验收材料均为虚构，不代表真实演员、团队、品牌的经历或背书。

## 先用本机版

需要 **Node.js 24 或更新版本**。在源码目录运行：

```sh
npm ci --ignore-scripts
npm run start:practical
```

打开 <http://127.0.0.1:4930/practical/>，自行注册账号。初始资料为空；可以明确导入虚构《逆光来信》原文验收，不预置分析结果。Mac也可双击`practical/启动实战工作台.command`。

本机版可以在演员自己的电脑直接使用。**跨设备、团队在线访问才需要云服务器或支持后台与持久存储的全栈托管账号，以及HTTPS域名。** [GitHub Pages](https://zurenze1.github.io/xilixiwai-actor-workbench/) 继续作为静态演示，不能运行实战账号、私密资料库与模型后台。设置页、登录页均有提示。

## 实战操作

| 业务 | 实际操作 |
| --- | --- |
| 从接戏到复盘 | 多项目、八阶段、导演/制作团队、评估、合同、日历、任务、作品与复盘 |
| 剧本和表演 | TXT/MD/DOCX/文字PDF提取、原件保存、规则拆场/对白；九类模型任务、长资料分段、逐字引用校验、报告编辑、采纳决定、行动项转任务 |
| 宣传与工作室 | 留言CSV/人工录入、分类和回复草稿、人工审核与发布记录；会议、FAQ、网页/RSS资料、目标、公益与公共沟通 |
| 造型与镜头 | 上传实际图片、编辑造型/镜头/台词/声音/时长、排序、暂停/拖动；JSON、CSV和内嵌原图的可播放HTML |
| 公司与品牌 | 多经营主体/合作关系、分期应收应付、部分实收实付、票据、资产领还盘点、会计确认与税务凭证、品牌/SKU库存/渠道 |
| 私人生活 | 出行、私人健康记录；肉肉实际日常/体重/行为/托管、原照片、同图加字720PNG、含原件备份 |
| 保存与权限 | Better Auth账号、SQLite持久保存、管理员/编辑/只读、私人空间、经营隔离、旧版本写入409、历史版本、SHA-256原件与备份恢复 |

AI结果来自使用者明确选中的原文/业务记录与自己配置的模型。事实引文逐字检查，匹配不上的事实降为待核实。规则拆场不冒充人物动机分析；分段分析保留各段结论，不能把拼接当成全局成长线判断。

## 自己连接模型

设置支持DeepSeek、OpenAI、Anthropic及公开HTTPS的OpenAI兼容文本API。填写使用者账号实际可用的模型ID和密钥；服务端加密保存，浏览器不回传密钥，项目/模块导出不含密钥。共享连接仅共享调用能力。分析前显示所选文字量及调用次数，由使用者确认，服务商可能收费。

使用者在自己的电脑安装并登录Codex / Claude Code后，可显式启动：

```sh
npm run start:practical -- --local-tools
```

仅本机部署的首位注册主人可用，不共享给团队，在线模式禁止；输入走stdin，不经shell执行，禁用工具执行/MCP。实际CLI版本与账号权限需本人点击测试确认。本轮未使用开发者个人账号或真实付费调用。ChatGPT网页登录不等于API密钥。

## 部署、备份与边界

- [部署与演员交接](practical/docs/部署与演员交接.md)：本机入口、数据目录、HTTPS Docker Compose、备份与验收。
- [验收记录](practical/docs/验收记录.md)、[独立代码复核](practical/docs/REVIEW-actor4.md)。
- [原演示说明](docs/演示版使用说明.md)；`npm start`仍启动原演示服务4890。
- [发布会](https://zurenze1.github.io/xilixiwai-actor-workbench/launch.html)与视频预览保留。

单原件32MiB；项目备份含清单后解压总量160MiB、清单20MiB、最多999附件。模块备份仅带所引用原件。项目恢复新建项目并重映射引用，原项目保留；肉肉、经营在各自模块完整备份恢复。

扫描PDF需先OCR；视频/音频保留原件和人工观察/转写，不自动理解未读取内容。没有自动发帖、平台私信抓取、自动报税或后台推送。税额由会计确认，动作安全由专业老师判断。云部署由演员决定，本轮只做本机验收与部署包。

## 开发验证

```sh
npm test
npm run test:practical
npm run test:browser
```

浏览器检查需Chrome或Playwright Chromium，macOS默认已安装Chrome，其他平台可设`CHROME_BIN`。模块浏览器命令见README/复核报告。测试用户、照片和模型runner均为合成夹具；接口契约通过不等于真实模型质量通过。

复用Better Auth、PDF.js、Mammoth、Papa Parse、fflate、Readability、linkedom、Zod、idb-keyval，许可在`docs/licenses/`。经营流程参考[ERPNext](https://github.com/frappe/erpnext)，未引入其服务或复制GPL实现。分镜保留GSAP许可头；演示媒体署名在`web/assets/PHOTO-CREDITS.txt`及音乐目录，不代表全部素材可任意商用。
