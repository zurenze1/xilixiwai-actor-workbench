# 戏里戏外 · 演员与工作室工作台

面向演员与工作室的可操作演示：用虚构演员「把子肉」和虚构项目《逆光来信》，从接本、读本、入角、预演、开机、宣传、商务走到复盘。另有作品库、日程、粉丝沟通、出行和独立的肉肉生活页。三套主题同时用于工作台、发布会及网页视频预览。

**此项目包含预置示例。未代表任何真实演员、工作室、品牌或项目的经历、使用及背书。**

## 打开体验

- 工作台：本站首页 `index.html`
- 交互发布会：`launch.html`
- 宣发片网页预览：`film.html`
- 14.5秒结尾网页预览：`outro.html`
- 肉肉的小世界：`rourou/`

公开网页用于演示和本机浏览器记录，不包含服务器密钥，也不连接开发者账号。发布会的「打开工作台」链接可跳入实际操作页面。

## 本机运行

需要 Node.js 22 或更新版本。

```sh
npm ci
npm start
```

打开 `http://127.0.0.1:4890/`。端口被占用时，可使用 `PORT=4898 npm start`（macOS / Linux）。Windows PowerShell：先 `$env:PORT=4898`，再 `npm start`。

## 使用自己的模型

默认「演示模式」展示预置结果，不会假装读取新附件或检索外部平台。

在本人电脑运行后，打开「设置」，选择 DeepSeek、OpenAI、Claude 或其他 OpenAI 兼容服务，点击「配置 / 测试自己的连接」。填写本人账号可用的模型 ID 和 API Key；兼容服务另填公开 HTTPS API 地址。密钥仅在当前页面内存中使用，刷新后清除，不进入备份、GitHub 或浏览器持久存储。API 使用可能由模型服务商收费。

「发送资料并分析」只发送明确显示在输入框内的文本。可以编辑附件提取的文本、填写分析要求；结果能导出并保存为待人工复核记录。上传附件原件不会自动上传到模型。TXT / Markdown / CSV 可提取文字，DOCX 通过 Mammoth 提取文字；PDF等其他文件保留原件供下载，本版不做OCR或PDF文字解析。

Codex、Claude Code 由演员本人安装并登录后，以以下命令启动：

```sh
npm start -- --local-tools
```

本机工具默认关闭。开启后仅接受本机同源主动请求，使用禁止工具执行的参数运行；不同 CLI 版本可能需要调整参数。本次未调用开发者账号进行真实付费模型测试。API适配已通过模拟服务契约测试，实际账号权限、模型可用性与CLI兼容性需由使用者连接后测试。

GitHub Pages 只有静态网页，不能运行这些本机接口。ChatGPT网页订阅和API账号额度是不同连接方式，不能用网页登录状态代替API密钥。

## 保存、恢复和导出

- 记录与附件原件存入当前浏览器的 IndexedDB；旧版 localStorage 保留，首次打开通过校验后迁移。换域名、浏览器或设备不会自动同步，请先导出完整备份。
- 双窗口写入遇到旧版本会明确阻止覆盖；先导出当前草稿，再刷新读取最新保存内容。
- 工作台「设置 → 导出完整备份」包含项目记录、已有肉肉资料、附件原件和SHA-256。恢复前校验所有内容，并下载当前备份以便撤回。
- 肉肉页有独立的完整备份入口；独立恢复不改主工作台。
- 单个原件最多32 MB，单份备份原件合计最多160 MB。浏览器空间不足时明确报错，不能把成功提示视为备份。
- 项目归档可查看、导出和恢复；Markdown资料包用于文字交付，完整JSON备份用于恢复原件与记录。
- 主创资料、人物小传、回复草稿、人工决定、作品CSV导入和团队清单可实际填写或导出。外发仍由人决定。
- 本版没有登录隔离、云同步、团队权限、自动发帖、平台留言抓取和实时舆情监测。身体与宠物资料也属于当前浏览器记录；完整备份可能包含这些内容，分享前请自行检查。
- 作品CSV只更新片单；示例能力雷达、行业报告、评分和发展建议不会冒充根据导入内容生成。可通过自己的模型另行分析。

## 验证与开发

```sh
npm test
npm run build:store
```

浏览器回归脚本在 `tests/browser-regression.cjs`、`tests/browser-extended.cjs`。先运行本机服务，再安装 Playwright Chromium；可用 `BASE_URL` 指定服务地址，`CHROME_BIN` 指定已有Chrome，`QA_DIR`指定结果目录。默认结果保存到忽略的 `.runtime/qa/`。

本次修复范围和已验证结果见 [修复记录](docs/修复记录.md)。原版独立保留，源码历史可用Git提交追溯。

## 素材与第三方组件

应用代码、演示数据、图片、音乐和生成视觉的权利状态分别处理，不代表所有素材均可任意商用。图片及音乐的原始署名在 `web/assets/PHOTO-CREDITS.txt`、`web/assets/music/CREDITS.txt`；请在再发布时保留。

复用 [idb-keyval](https://github.com/jakearchibald/idb-keyval)、[Zod](https://github.com/colinhacks/zod)、[Mammoth](https://github.com/mwilliamson/mammoth.js)、[Papa Parse](https://github.com/mholt/PapaParse)。第三方许可副本在 `docs/licenses/`。模型适配沿用本项目早期实现，官方接口资料见 [DeepSeek](https://api-docs.deepseek.com/)、[OpenAI](https://platform.openai.com/docs/api-reference/responses)、[Claude](https://platform.claude.com/docs/en/api/messages/create)。
