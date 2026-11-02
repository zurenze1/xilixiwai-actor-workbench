# IP创作模块内核

来源：[zurenze1/content-workbench](https://github.com/zurenze1/content-workbench) v0.10.4。复用实际热点雷达、分镜执行台及其共用服务、存储和原件处理内核；IP工作台提供外层导航和按IP鉴权入口。

适配包含相对API地址、同源嵌入、外层导航、独立数据路径与未保存提醒。直接依赖undici修补至8.12.3，静态文件依赖glob覆盖至14.0.3；行为经过集成测试。`dist/`由仓库根的 `npm run build:creator-modules` 生成，纳入源码同步以支持现有桌面启动器。

本目录只包含代码和构建产物，不包含任何数据库、媒体、字体、用户图片、密钥、备份或定时任务。运行数据位于仓库忽略的 `runtime-ip/creator-modules/<IP-ID>/`。原项目代码权利与依赖各自许可证保持不变；React构建依赖许可见仓库根 `docs/licenses/creator-bundle-LICENSE.txt`。这不授予任何外部原图或作品使用权。
