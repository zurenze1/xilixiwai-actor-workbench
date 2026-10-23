import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisError, LIMITS, TASKS, normalizeDocuments, parseScript, splitDocuments, buildPrompt, parseAnalysis } from '../server/analysis.mjs';

const text = '《逆光来信》虚构验收剧本\r\n第1场 外景 老车站 夜\r\n人物：许知夏、陈默、站务员\r\n许知夏（压低声音）：信是你寄的吗？\r\n陈默：我只负责把它送到。\r\n\r\n第2场 内景 值班室 日\r\n许知夏：那你为什么还在等？\r\n';
const documents = [{ id: 'nglx-1', name: '逆光来信.txt', text }];
const response = overrides => JSON.stringify({ title: '角色目标分析', summary: '基于本次虚构材料。', sections: [], revisions: [], shots: [], actions: [], questions: [], ...overrides });
const item = overrides => ({ label: '送信行为', body: '陈默说自己负责送信。', kind: 'fact', sourceId: 'nglx-1', quote: '我只负责把它送到。', lineStart: 5, lineEnd: 5, ...overrides });
function code(expected) { return error => error instanceof AnalysisError && error.code === expected; }

test('Chinese script extraction retains original CRLF and verifiable source line citations', () => {
  const before = structuredClone(documents), result = parseScript(documents);
  assert.deepEqual(documents, before); assert.equal(result.documents[0].text, text);
  assert.equal(result.kind, 'deterministic'); assert.equal(result.stats.explicitScenes, 2); assert.equal(result.stats.dialogueLines, 3);
  assert.equal(result.stats.roles, 3); assert.equal(result.characters.find(x => x.name === '站务员').dialogueLines, 0);
  assert.equal(result.dialogues[0].role, '许知夏'); assert.equal(result.dialogues[0].delivery, '（压低声音）'); assert.equal(result.dialogues[0].text, '信是你寄的吗？');
  assert.equal(result.dialogues[0].lineStart, 4); assert.equal(result.dialogues[0].quote, text.split('\r\n')[3]);
  assert.equal(result.scenes[0].timeOfDay, '夜'); assert.equal(result.scenes[1].setting, '内景');
  assert.equal(result.relationships.length, 3); assert.equal(result.relationships[0].kind, 'scene_cooccurrence');
  assert.ok(result.relationships.every(x => x.evidence.every(ref => text.includes(ref.quote))));
  assert.match(result.timeline[0].note, /不代表故事内/);
});

test('unmarked prose does not fabricate scenes, characters, chronology or relationship nature', () => {
  const result = parseScript('她把信收进抽屉。\n两年之后，故乡下起雨。');
  assert.equal(result.stats.explicitScenes, 0); assert.equal(result.scenes[0].explicit, false);
  assert.deepEqual(result.characters, []); assert.deepEqual(result.relationships, []);
  assert.ok(result.warnings.some(x => x.includes('未识别')));
  const separate = parseScript('甲：你好。\n\n乙：再见。'); assert.deepEqual(separate.relationships, []);
});

test('Fountain and Chinese numbered scene markers support dialogue cues', () => {
  const result = parseScript('INT. STATION - NIGHT\nALICE\nHello.\nWait!\n\n@陈默\n（停顿）\n我知道。\n\n1-2 夜 外 老车站\n陈默：走吧。');
  assert.equal(result.stats.explicitScenes, 2); assert.equal(result.dialogues.filter(x => x.role === 'ALICE').length, 2);
  assert.ok(result.characters.some(x => x.name === '陈默'));
  assert.equal(result.dialogues.find(x => x.text === '我知道。').delivery, '（停顿）');
  assert.ok(result.blocks.some(x => x.type === 'parenthetical'));
  assert.equal(result.scenes[0].timeOfDay, 'NIGHT');
  assert.equal(parseScript('时间：2027年\n地点：车站\n备注：暂定').stats.dialogueLines, 0);
});

test('declared Chinese character cues and stage directions are separated from dialogue', () => {
  const result = parseScript('人物：许知夏、陈默\n第一场 车站 外 夜\n许知夏\n（轻声）\n你还在等？\n\n陈默（低头）\n是。');
  assert.equal(result.stats.dialogueLines, 2); assert.equal(result.dialogues[0].role, '许知夏');
  assert.equal(result.dialogues[0].delivery, '（轻声）'); assert.equal(result.dialogues[1].role, '陈默');
  assert.equal(result.dialogues[1].delivery, '（低头）'); assert.equal(result.relationships.length, 1);
});

test('empty input stays empty and duplicate source ids are rejected', () => {
  assert.equal(parseScript([]).stats.documentCount, 0); assert.deepEqual(parseScript('   ').scenes, []);
  assert.throws(() => normalizeDocuments([...documents, ...documents]), code('DUPLICATE_SOURCE'));
  assert.throws(() => normalizeDocuments([{ id: 'a', text: null }]), code('INVALID_DOCUMENTS'));
  assert.throws(() => normalizeDocuments([{ id: 'a', text: 'a'.repeat(LIMITS.documentChars + 1) }]), code('INVALID_DOCUMENTS'));
});

test('line-based chunking preserves every original character and offsets without overlap', () => {
  const original = ('第1场 外景 车站 夜\r\n许知夏：谢谢你的来信。\r\n').repeat(80);
  const chunks = splitDocuments([{ id: 'a', name: '长剧本', text: original }], { maxChars: 512, overlapLines: 0 });
  assert.equal(chunks.map(x => x.text).join(''), original); assert.ok(chunks.length > 1);
  for (const chunk of chunks) { assert.equal(chunk.text, original.slice(chunk.charStart, chunk.charEnd)); assert.ok(chunk.text.length <= 512); assert.ok(chunk.lineEnd >= chunk.lineStart); }
  assert.equal(chunks[1].charStart, chunks[0].charEnd);
});

test('very long lines and surrogate pairs are losslessly split, never loop forever', () => {
  const original = '甲'.repeat(255) + '😀'.repeat(800) + '\r\n终点';
  const chunks = splitDocuments([{ id: 'a', text: original }], { maxChars: 256, overlapLines: 2 });
  const coverage = new Set(); for (const chunk of chunks) { assert.equal(chunk.text, original.slice(chunk.charStart, chunk.charEnd)); for (let i = chunk.charStart; i < chunk.charEnd; i++) coverage.add(i); assert.ok(!/[\uD800-\uDBFF]$/.test(chunk.text)); }
  assert.equal(coverage.size, original.length); assert.ok(chunks.some(x => x.partialLine)); assert.ok(chunks.length < 30);
});

test('overlap chunks cover source, retain original line numbers and validate bounds', () => {
  const original = Array.from({ length: 100 }, (_, i) => `${i + 1} ${'中'.repeat(30)}`).join('\n');
  const chunks = splitDocuments([{ id: 'a', text: original }], { maxChars: 300, overlapLines: 2 });
  assert.ok(chunks[1].charStart < chunks[0].charEnd);
  assert.equal(chunks.at(-1).charEnd, original.length);
  for (const chunk of chunks) assert.equal(chunk.lineStart, original.slice(0, chunk.charStart).split('\n').length);
  assert.throws(() => splitDocuments(documents, { maxChars: 0 }), code('INVALID_CHUNK_OPTIONS'));
});

test('nine task-specific prompts are grounded only in supplied sources and parameters', () => {
  assert.deepEqual(TASKS.map(x => x.id), ['script', 'performance', 'fans', 'previs', 'rights', 'dance', 'brief', 'plan', 'studio']);
  for (const task of TASKS) {
    const prompt = buildPrompt(task.id, { documents, fields: { actor: '把子肉', target: '核对当前资料' } });
    const payload = JSON.parse(prompt.user); assert.equal(payload.sources.length, 1); assert.equal(payload.sources[0].id, 'nglx-1');
    assert.match(payload.sources[0].numberedText, /\[5\] 陈默：我只负责把它送到。/);
    assert.match(prompt.system, /citationVerified/); assert.match(prompt.system, /不使用示例项目/);
    assert.ok(task.sections.every(heading => prompt.system.includes(heading)));
    assert.deepEqual(task.schema.sections.map(x => x.heading), task.sections);
    assert.equal(prompt.stats.sourceChars, text.length);
  }
  assert.match(buildPrompt('rights', { documents }).system, /不能声称已获得授权/);
  assert.match(buildPrompt('dance', { documents }).system, /不提供身体安全结论/);
  assert.match(buildPrompt('brief', { documents }).system, /不得声称刚刚查证/);
});

test('prompt inputs fail explicitly instead of substituting demo or silently truncating', () => {
  assert.throws(() => buildPrompt('other', { documents }), code('UNKNOWN_TASK'));
  assert.throws(() => buildPrompt('script'), code('EMPTY_INPUT'));
  assert.throws(() => buildPrompt('script', { fields: { x: Infinity } }), code('INVALID_FIELDS'));
  const cycle = {}; cycle.self = cycle; assert.throws(() => buildPrompt('script', { fields: cycle }), code('INVALID_FIELDS'));
  assert.throws(() => buildPrompt('script', { fields: JSON.parse('{"__proto__":{"polluted":true}}') }), code('INVALID_FIELDS'));
  assert.throws(() => buildPrompt('script', { documents: [{ id: 'a', text: '甲'.repeat(180_000) }] }), error => error.code === 'PROMPT_TOO_LARGE' && error.details.chunks.length > 1);
  assert.ok(buildPrompt('plan', { fields: { target: '准备年度计划' } }).user.includes('准备年度计划'));
});

test('valid JSON and JSON fence are parsed; model-provided verification flags are ignored', () => {
  const raw = response({ sections: [{ heading: '事实', items: [item({ citationVerified: false })] }] });
  const result = parseAnalysis('```json\n' + raw + '\n```', documents);
  assert.equal(result.sections[0].items[0].citationVerified, true); assert.equal(result.sections[0].items[0].kind, 'fact');
  assert.deepEqual(result.revisions, []);
  assert.equal(parseAnalysis(response({ sections: [{ heading: '事实', items: [item({ kind: '事实', lineStart: undefined, lineEnd: undefined })] }] }), documents).sections[0].items[0].lineStart, 5);
});

test('nonexistent quotation, incorrect source and incorrect line range cannot become facts', () => {
  const cases = [item({ quote: '陈默深爱她。', citationVerified: true }), item({ sourceId: 'missing' }), item({ lineStart: 4, lineEnd: 4 }), item({ lineStart: 5, lineEnd: 100 }), item({ lineStart: 5, lineEnd: undefined }), item({ lineStart: 6, lineEnd: 3 }), item({ quote: '' })];
  for (const value of cases) {
    const result = parseAnalysis(response({ sections: [{ heading: '待核验', items: [value] }] }), documents).sections[0].items[0];
    assert.equal(result.citationVerified, false); assert.equal(result.kind, 'unknown'); assert.equal(result.originalKind, 'fact'); assert.ok(result.citationIssue);
  }
});

test('creative suggestions keep suggestion kind without falsely claiming source support', () => {
  const suggestion = item({ kind: 'suggestion', quote: '', sourceId: '', lineStart: undefined, lineEnd: undefined });
  const result = parseAnalysis(response({ sections: [{ heading: '试演建议', items: [suggestion] }] }), documents).sections[0].items[0];
  assert.equal(result.kind, 'suggestion'); assert.equal(result.citationVerified, false);
});

test('revision originals are verified and proposed language is never used as evidence', () => {
  const result = parseAnalysis(response({ revisions: [
    { original: '我只负责把它送到。', proposal: '信送到，我就走。', reason: '试演更坚决的处理。', sourceId: 'nglx-1' },
    { original: '原文中根本不存在的台词', proposal: '我只负责把它送到。', reason: '不应通过。', sourceId: 'nglx-1', citationVerified: true },
  ] }), documents);
  assert.equal(result.revisions[0].citationVerified, true); assert.equal(result.revisions[0].lineStart, 5); assert.equal(result.revisions[1].citationVerified, false);
});

test('cross-document evidence cannot leak into a different source id', () => {
  const sources = [...documents, { id: 'meeting', text: '导演：请慢半拍。' }];
  const result = parseAnalysis(response({ sections: [{ heading: '引用', items: [item({ sourceId: 'meeting' })] }] }), sources);
  assert.equal(result.sections[0].items[0].citationVerified, false);
});

test('multiline exact quotes support CRLF while normalized or fuzzy quotations remain unverified', () => {
  const exact = '许知夏（压低声音）：信是你寄的吗？\r\n陈默：我只负责把它送到。';
  const result = parseAnalysis(response({ sections: [{ heading: '原文', items: [item({ quote: exact, lineStart: 4, lineEnd: 5 }), item({ quote: exact.replace('\r\n', '\n'), lineStart: 4, lineEnd: 5 })] }] }), documents);
  assert.equal(result.sections[0].items[0].citationVerified, true); assert.equal(result.sections[0].items[1].citationVerified, false);
});

test('empty, malformed, giant or invalid-schema outputs give actionable errors', () => {
  assert.throws(() => parseAnalysis(''), code('EMPTY_ANALYSIS')); assert.throws(() => parseAnalysis('我认为主角很勇敢。'), code('INVALID_JSON'));
  assert.throws(() => parseAnalysis('{"title":"x"}'), code('INVALID_ANALYSIS'));
  assert.throws(() => parseAnalysis('a'.repeat(LIMITS.responseChars + 1)), code('RESPONSE_TOO_LARGE'));
  assert.throws(() => parseAnalysis('['.repeat(25) + ']'.repeat(25)), code('INVALID_ANALYSIS'));
  assert.throws(() => parseAnalysis(response({ sections: [{ heading: 'x', items: [item({ body: 42 })] }] }), documents), code('INVALID_ANALYSIS'));
  assert.throws(() => parseAnalysis(response({ shots: [{ number: 1, title: 'x', description: 'y', duration: -1 }] }), documents), code('INVALID_ANALYSIS'));
});

test('shots and next actions remain usable, duplicate shot numbers are rejected', () => {
  const shot = { number: 1, title: '来信', description: '手指停在信封上。', duration: 3.5, look: '近景', sound: '纸声' };
  const result = parseAnalysis(response({ shots: [shot], actions: [{ task: '试演两种处理' }], questions: ['导演偏向哪一种？'] }), documents);
  assert.deepEqual(result.shots[0], shot); assert.equal(result.actions[0].owner, '待分配'); assert.equal(result.actions[0].due, '');
  assert.throws(() => parseAnalysis(response({ shots: [shot, shot] }), documents), code('INVALID_ANALYSIS'));
});

test('many-line script extraction stays bounded and all citations still match source', () => {
  const long = Array.from({ length: 1000 }, (_, i) => `第${i + 1}场 外景 车站 夜\n许知夏：这是第${i + 1}封信。\n陈默：收到。\n`).join('');
  const start = performance.now(), result = parseScript([{ id: 'long', text: long }]);
  assert.equal(result.stats.explicitScenes, 1000); assert.equal(result.stats.dialogueLines, 2000);
  assert.equal(result.relationships[0].sceneIds.length, 1000); assert.ok(performance.now() - start < 10_000);
  assert.ok(result.dialogues.every(line => long.includes(line.quote)));
});
