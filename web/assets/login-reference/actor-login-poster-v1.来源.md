# 登录专用横版背景 v1

生成日期：2026-10-24。

## 来源与文件

祖老大要求按公开 Pinterest 参考适配登录界面，允许不与原图一模一样。已实际查看参考图，再使用 Codex 内置 `image_gen` 生成新的横版背景。原图仅作为颗粒、拼贴与蓝黄对比的风格参考，不作为人物身份参考，也没有将原海报简单重排。

- 参考页面：<https://www.pinterest.com/pin/750834569172953609/>；公开参考的实际读取与 canonical 差异见本目录《来源说明.md》。匿名访问记录 `public-source.json` 与参考 JPG 已移至仓库外的本地验证目录保留。
- 生成内容：虚构的成年女性演员形象、深棕卷发，左侧眼部／唇部矩形拼贴、钴蓝颗粒、柠檬黄细框及少量星芒；右侧保留深棕灰色安静区域。
- `actor-login-poster-v1.png` 为最终生成原图的逐字节副本，已移至仓库外的本地验证目录，不随网页发布；默认生成目录的原文件也保留，没有覆盖原参考。
- `actor-login-poster-v1.webp` 仅做 WebP 质量 88 转码，尺寸不变，未裁切、重画或叠字。
- 图片尺寸：1586 × 992 像素，约 16:10；RGB、不透明。
- PNG：2,989,419 字节；SHA-256 `439806ed5bcf6731a378516f68ec2a2d1b14fda83cd6267e413c164a64be5940`。
- WebP：306,344 字节；SHA-256 `4ce601c072a9726ffcf1cc3fb653c2987bb00f00a1a77e532e7e50a3c3522bca`。
- 参考原件保留在本地验证目录，发布仅含新生成图。未删除任何原始素材。

## 实际查看与适配范围

已完整解码并通过 `view_image` 查看 WebP：视觉主要集中在左侧约六成，右侧约三分之一留有深色区域，可供真实 HTML 登录表单叠加；右侧区域中位色约 `#322826`。未发现可读文字、品牌名、原专辑名或歌词，未画登录按钮、表单或网站截图。人物的发型、脸部构图和妆容与参考不同，没有把输出称为任何真实演员的肖像。

本文件仅为背景素材，不代表登录界面已经接入或通过功能验收。表单在宽屏／窄屏的可读性与裁切，需在真实页面集成后另行验证，审美由祖老大最终确认。

## 最终生成提示词

> Use case: stylized-concept. Asset type: completely new full-bleed landscape 16:10 background artwork for an actor studio login screen, approximately 1600 by 1000. The attached image is ONLY a STYLE REFERENCE for fine film grain, cobalt blue and lemon yellow contrast, editorial facial collage, rectangular thin-line accents and a few tiny stars/circles. It is NOT an identity reference and NOT an edit target. Create an original fictional adult female actor about 28 years old with a distinctly different face and hairstyle from the reference, softly waved dark chestnut shoulder-length hair, natural tasteful makeup, a calm thoughtful confident expression. Do not copy or preserve the reference person's identity, eyes, mouth, haircut, pose or photographic pixels. Entirely NEW composition and NEW person. LEFT 60% of the landscape: an elegant cinematic softly blurred partial portrait of this fictional woman, looking gently toward the viewer, warm gray-brown monochrome with gentle daylight on skin. Layer two separate clean rectangular photographic detail crops of THIS NEW fictional woman over her soft portrait: one horizontal crop of her eye and eyebrow around left-center at y=40%, one smaller horizontal crop of a relaxed closed mouth around y=68%. Crops are stylish conceptual editorial montage, not dismemberment and not a body image theme. Restrained lemon-yellow hairline partial rectangular frames around these crops and just three tiny original abstract star or circular accents. Cobalt blue and slightly periwinkle blue softly occupy the upper left corner and lower far left, blending into dark brown charcoal film tones. Color inspiration: cobalt #5357BE, lemon #FFE567, deep warm brown gray #332D2C, softly hazed warm gray rose. Strong but refined analog film grain texture throughout the visual area, matte cinematic editorial feeling. RIGHT 35% MUST BE EMPTY, dark warm charcoal-brown, quiet, mostly uniform with only extremely subtle fine grain. All portrait fragments, facial features, blue areas, yellow frames, stars and circle accents stay strictly in the LEFT 60%, fading fully to dark by x=64%. The right area will be covered by an actual HTML login form later, so it must have clean negative space across x=67%-98% and y=12%-91%. Keep top and bottom safe areas free of important cropped features. Make the portrait composition and grain feel glamorous, artistic, mature and human. No dark purple or magenta dominant areas. ABSOLUTELY NO TEXT, NO letters, NO digits, NO logo, NO AESPA, NO album title, NO English lyrics, NO brand, NO watermark, NO pseudo-writing, NO UI, NO form, NO buttons, NO software screen screenshot. Do not rearrange or reproduce the source poster. One original standalone 16:10 landscape background artwork with only a fictional person and abstract visual accents.
