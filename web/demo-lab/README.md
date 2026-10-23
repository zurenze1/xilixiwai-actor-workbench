# 演示资料实验室（现有工作台的内嵌模块）

## 集成

- iframe 地址：`/demo/demo-lab/?embedded=1&theme=tide&kind=evaluation`；公开静态站相对地址 `demo-lab/`。
- 切换前调用 `await iframe.contentWindow.DemoLab.whenIdle()`。保存失败会抛错，父级应保留当前页面及输入。
- 主题：父级同源发送 `{type:'workbench:theme', theme:'tide'|'butter'|'moss'}`。仅接受同源、`event.source===parent` 的消息。
- `kind`：实战 `ActorForms.MOD` 的全部 18 键，加 `company/finance/asset/brand/social-content/social-account/social-metric`。
- 独立数据库 `xilixiwai-demo-lab-v1`，不读写实战账号、项目资料、模型设置或肉肉数据库。

## 保持字段一致

运行 `node scripts/build-demo-lab.mjs`。脚本使用 Node 内置库将 `practical/web/forms.js` 原样镜像为本目录 `forms.js`，复制已安装 PapaParse 5.5.3（MIT）浏览器解析库及许可证，记录三份实战字段来源 SHA256。需先完成项目 `npm ci`；运行不依赖 CDN。

经营和运营是最小演示表单，参考 `practical/web/business/model.js` 和 `practical/web/social/model.js`，并非完整实战业务数据库模型，不向实战库直接导入。未知指标保持空白，不替换成零。

## 可用能力和边界

25 类字段可实际填写、保存、修改、搜索、归档、恢复。25 张虚构示例逐次只补缺失种子，不覆盖使用者修改。每个类别保留当前未提交草稿，跨类别切换及刷新保留；同类选择另一卡或点击新建时，如有未保存修改，会先提示确认；取消会保留原输入，确认放弃才打开另一张卡。跨类别切换继续保留各自草稿。

CSV 使用英文字段键或中文字段名，标题列为 `title` / `资料标题`。以导出文件为模板；一次最多 500 行 / 10 MB，所有行验证通过才能确认导入。带同 ID 行会更新已有同类记录，预览明确显示更新数量；不同类别同 ID 拒绝。导出将公式样式开头加单引号，防止电子表格执行公式。

文件字段实际保存原件及 SHA256：单件 8 MB，累计 32 MB，最多 100 件。解除引用保留原件以便恢复，不悄悄删除。完整 JSON 备份包含记录、草稿、原件；恢复校验原件长度与 SHA256，预览后明确替换本实验室资料（不是合并）。备份导入上限 64 MB。

**实验室资料必须用本模块的独立备份。主线工作台备份不包含实验室。** 本机存储可能被浏览器清理，也不会跨设备同步；实战私密资料应使用有权限隔离的部署版。

AI 图卡为明确标注的固定虚构案例；平台授权、自动采集、自动发布、纳税申报等只展示规划，不发请求假装执行。所有保存、导入和原件处理均在浏览器本地。IndexedDB 写入使用版本检查，另一标签已写入时拒绝覆盖；仍可独立导出当前页面的未同步输入备份，再刷新。

页头预留 `data-illustration="studio"`，供统一插画模块使用。本页自带纸张/资料盒轻量 SVG，三种主题和窄屏响应式。
