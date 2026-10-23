# 演员三修复交接

2026-10-23。仅修复副本，最终仓库与Pages由演员一统一上传。没有修改主工作台app.js/style.css/index.html，也未创建仓库或部署。

## 已完成

- `launch.html`：主题只读写独立键 `xilixiwai.theme.v2`，完全移除业务整状态键；支持允许列表中的theme查询参数。工作台链接携带当前主题，路径均相对当前目录，可用于GitHub Pages子路径。动态片段从已有主题目录加载。
- `film.html`、`outro.html`：与style.css末尾新版三主题的配色和字体族对齐；保留原内容、原音频文件、原旁白顺序。结尾三主题统一0/3.4/7.3秒三个场景，总时间线14.5秒。
- 主视频进度支持pointer拖动与键盘前后/Home/End，拖动保留播放/暂停状态；暂停取消旧RAF，避免拖动重复启动循环。控制有可访问标签，同源消息才接受播放/暂停指令。
- `assets/shots/{tide,butter,moss}/*.png`：从新版工作台真实重新采集A/B状态截图；旧截图保留在同目录树的`originals_20261023/`，Git忽略。
- `assets/loops/{tide,butter,moss}/*.mp4`：51/51实际重生成的循环片段，768×432/24fps/3.625秒，沿用原叙事对应段落。旧51份保留`assets/loops/originals_20261023/`，Git忽略。没有用改标签代替重渲染。
- `assets/loops/outro-{tide,butter,moss}-repaired.mp4`：三份实际HyperFrames新渲染结尾预览，1920×1080/30fps/H.264/AAC，视频时间线14.5秒，容器约14.506秒。与网页同一剪辑。
- `assets/music/CREDITS.txt`：保留原配乐署名与许可来源说明，追加修复、依赖和音轨SHA记录。`film-audio.m4a`、`outro-audio.m4a`文件SHA均与修复前一致。未新增配音或使用任何凭据。
- `assets/loops/REPAIR-MANIFEST.json`：公开相对路径的原/新循环SHA、结尾SHA和未变音频SHA。没有绝对本机路径。

## 实际验证

- 3主题×film/outro共6次隔离Chrome实际点击播放：音轨时间推进、暂停、拖到75%、End到片尾、重新播放通过；未发现图片失败或页面脚本错误。证据`qa/playback-checks.json`与`playback-*.png`。
- 3个launch初始主题实际切换：业务键保持原值（隔离浏览器初始为空，切换后仍为空），仅独立主题键变化；媒体未报错，产品链接带theme。暖场设计会隐藏导航，主题操作在滚到宣发片后验证。
- 三份结尾已FFprobe核对，并完整解码退出0。`qa/rendered-media-contact.png`来自实际MP4抽帧：三主题2秒、10.5秒以及重建循环，共9帧。已目视文字完整和主题差异。
- 三份HTML内联脚本语法通过；这三份入口没有file://、/Users/、localhost或127.0.0.1路径，也没有业务整状态键。
- HyperFrames新渲染副本静态lint为0错误0警告，运行时检查通过。整体`check`仍将扫光遮罩的scroll范围识别为文字裁切，并报告装饰越界；未把整体check称为通过。实际抽帧中“戏里/戏外/戏里戏外”文字完整，见上述联系图。保留完整检查结果供复核，不通过隐藏结果冒充无问题。

## 保留与排除

`qa/`、`original-html/`、`film-*/`、`outro-*/`为本地核验、旧源和渲染临时工程，已在此目录.gitignore排除。长片渲染只作为生成循环的内部中间源，保留`qa/intermediate-film-*.mp4`，不在此次公开成品范围，也不在公开assets中。旧正式长片与原桌面项目未修改。

不要把含QA日志和原件备份的整个本地目录另打ZIP公开；按Git跟踪的源文件与资产上传即可。公开素材来源沿用`assets/PHOTO-CREDITS.txt`，本轮未把来源清单当作重新完成许可核验。

## 入口与范围

- 本地修复预览：`http://127.0.0.1:4906/launch.html?theme=butter`、`?theme=moss`、`?theme=tide`。
- GitHub Pages应发布web目录，保留同一相对结构；无需本站后端来播放发布会媒体。
- 人工听感/审美、真实模型能力、手机硬件及最终GitHub Pages线上访问仍由实际验收确认，本轮没有扩大这些能力。

核心变更路径：上述3份HTML、assets/shots主题PNG、assets/loops、assets/music/CREDITS.txt，以及本目录的渲染/验证脚本和本地记录。
