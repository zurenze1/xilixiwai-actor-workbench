# 实战分析接口与验收

本模块是纯函数层，不访问网络、磁盘、模型账号或密钥。输入仅包含调用者本次传入的纯文本资料与参数。文件提取、连接模型、权限控制、持久化与界面呈现由主工程负责。

## 接口

```js
import {
  TASKS, LIMITS, AnalysisError,
  normalizeDocuments, parseScript, splitDocuments,
  buildPrompt, parseAnalysis,
} from '../server/analysis.mjs';

const documents = [{ id: 'source-1', name: '剧本.txt', text: '第一场 外景 车站 夜\n许知夏：你来了。' }];
const structure = parseScript(documents);
const request = buildPrompt('script', { documents, fields: { actor: '把子肉', role: '许知夏' } });
// 将 request.system / request.user 交给用户自行配置的模型，拿到实际返回的字符串：
const checked = parseAnalysis(actualModelText, documents);
```

- `TASKS`: 九项任务 `script/performance/fans/previs/rights/dance/brief/plan/studio`，每项有 `id/label/sections/instruction/schema`，章节及约束与任务相对应。
- `normalizeDocuments(input)`: 接受资料数组、单份资料对象或纯文本字符串；返回通过 Zod 校验的资料副本。标准资料是 `{id,name,text}`，`id` 必须唯一。纯文本字符串使用 `source-1`。不会改写原文。
- `parseScript(documents)`: 返回 `kind:'deterministic'`，及 `documents/stats/scenes/dialogues/characters/relationships/timeline/blocks/warnings`。统计中的 `characters` 是 UTF-16 字符数；`nonWhitespaceCharacters` 排除空白；`dialogueLines` 是识别到的对白物理行数。标注角色中的括号提示会单独提取。原文页首说明不会伪装为额外场次。无场次的散文会作为未标注文本保留，不推断人物同场关系。
- `splitDocuments(documents,{maxChars:12000,overlapLines:1})`: 返回原文分段数组，每段有 `id/sourceId/name/lineStart/lineEnd/charStart/charEnd/partialLine/text`。字符偏移为 JS UTF-16 的 `[start,end)`；行号从 1 开始且针对原资料。长行也会实际分段，避免 UTF-16 代理对和 CRLF 从中间断裂。`overlapLines:0` 时拼接各段可逐字还原整份原文。
- `buildPrompt(taskId,{documents,fields})`: 返回 `{system,user,taskId,stats,chunks}`。`system/user` 是字符串，可直接传给模型；`user` 为带行号资料的 JSON 字符串，原始 `documents` 仍供后续校验。`chunks` 是分段元信息，不是被偷偷省略后的原文。单次提示超长明确抛 `PROMPT_TOO_LARGE`，`details.chunks` 可供界面做分段选择；主工程需要让每段分析继续携带原资料引用，不能把每段行号重新当原文行号。
- `parseAnalysis(modelText,documents)`: 接受完整 JSON 或唯一 JSON Markdown 代码块，按 Zod 校验形状、长度、类型及分镜编号。返回 `title/summary/sections/revisions/shots/actions/questions`。不提供预置示例兜底。

## 引用含义

每条结果的 `sourceId/lineStart/lineEnd/quote` 可以打开原资料。`citationVerified:true` **仅表示引文逐字存在于这次上传的指定资料与行号中**，不代表模型的解释一定成立，也不代表资料本身真实、法律有效或获得了授权。人物同场图只表示在明确同一场次的列表或对白中出现，不表示情感、亲属或合作关系。

调用者不能相信模型自填的 `citationVerified`；解析器会忽略模型值并重新核对。没有行号时按本份原文定位；行号成对提供时必须在范围内命中。空引文、未知资料 id、越界行号、模糊改写均为 `false` 并给出 `citationIssue`。未验证的 `fact` 会转成 `unknown` 并记录 `originalKind:'fact'`；建议仍为 `suggestion`，不伪装成事实。

`revisions[].original` 才是改写校验依据，`proposal` 从不作为原文依据。引用不通过的改写不能静默覆盖原文。即使通过，仍应先让用户审阅和选择再应用，原始资料始终保留。

## 长度与错误

每次最多 64 份资料，每份 200 万 UTF-16 字符、合计 400 万；单次完整提示不超过 16 万字符，参数不超过 2.4 万字符，响应不超过 100 万字符。极端人物同场组合超过 20000 条会限制关系图规模并显式返回 `relationshipsLimited/warnings`，不会删除原角色、对白或文档。

`AnalysisError` 有 `code/message/details`，界面应展示中文 `message`，必要时展示字段路径。输入为空、超限、无效 JSON、结构错误与模型空返回均应明确失败，不能记成成功，也不能回落到虚构分析。无模型时仍可使用规则拆解、编辑与导出原文；不能将它标注为模型完成的动机/情绪分析。

## 已运行验收

```sh
node --check practical/server/analysis.mjs
node --test practical/tests/analysis.test.mjs
```

当前 19 项 Node 测试通过：中文/英文场次、原文 CRLF、中文角色独立行及括号提示、散文不推断同场、长行/重叠分段无损、九类提示、超限与非法参数、代码块 JSON、跨资料引用隔离、假引文降级、原句改写校验、分镜时长与重复编号，以及 1000 场/2000 行对白拆解。未调用真实模型；模型连通与实际任务质量由主工程接入后验收。

## 开源核查

已查阅 [Fountain.js](https://github.com/mattdaly/Fountain.js) 的场次/角色标记方案；它面向 Fountain 格式，当前中文常见的“人物冒号”和中文场次需要额外规则。因此没有引入整包或拷贝代码，用小型原文保留规则兼容这些标记。输入及输出校验直接复用主工程已安装的 [Zod](https://github.com/colinhacks/zod)，没有新增依赖。
