(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PrevisSchema = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const ASPECTS = ['16:9', '9:16', '1:1'];
  const MOVEMENTS = ['static', 'push', 'pull', 'left', 'right'];
  const FRAMINGS = ['全景', '中景', '近景', '特写', '自定'];
  const fail = text => { throw new Error('分镜资料：' + text); };
  const object = (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail(p + '应为对象');
    if (Object.keys(v).some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) fail(p + '包含无效字段');
    return v;
  };
  const text = (v, p, max = 10000) => { if (typeof v !== 'string' || v.length > max) fail(p + '应为不超过' + max + '字的文字'); return v; };
  const id = (v, p) => { text(v, p, 100); if (!/^[A-Za-z0-9_-]+$/.test(v)) fail(p + '编号无效'); return v; };
  const optionalId = (v, p) => v === '' || v == null ? '' : id(v, p);
  const list = (v, p, map, max = 300) => { if (!Array.isArray(v) || v.length > max) fail(p + '应为最多' + max + '项的列表'); return v.map((x, i) => map(x, p + (i + 1))); };
  const unique = (xs, p) => { if (new Set(xs.map(x => x.id)).size !== xs.length) fail(p + '编号重复'); };
  function file(v, p = '图片') {
    object(v, p);
    if (!/^file-[A-Za-z0-9-]+$/.test(text(v.id, p + '编号', 100))) fail(p + '不是项目附件编号');
    if (!/^image\/(png|jpeg|webp|gif)$/i.test(text(v.type, p + '类型', 100))) fail(p + '只支持PNG、JPEG、WebP或GIF图片');
    if (!Number.isSafeInteger(v.size) || v.size < 1 || v.size > 32 * 1024 * 1024) fail(p + '文件大小应在32MB以内');
    if (!/^[a-f0-9]{64}$/i.test(text(v.sha256, p + '哈希', 64))) fail(p + '缺少有效原件哈希');
    return { id: v.id, name: text(v.name, p + '名称', 1000), type: v.type.toLowerCase(), size: v.size, sha256: v.sha256.toLowerCase() };
  }
  function fresh() { return { schemaVersion: 1, title: '', aspect: '16:9', files: [], looks: [], shots: [] }; }
  function uid(prefix) { return prefix + '-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)); }
  function newShot() { return { id: uid('shot'), title: '', description: '', dialogue: '', lookNotes: '', duration: 3, imageId: '', lookId: '', framing: '中景', movement: 'static' }; }
  function newLook() { return { id: uid('look'), name: '', description: '', imageId: '' }; }
  function validate(raw) {
    object(raw, '方案');
    if (raw.schemaVersion !== 1) fail('方案版本不受支持');
    const out = { schemaVersion: 1, title: text(raw.title, '方案名', 300), aspect: raw.aspect,
      files: list(raw.files, '图片', file, 1000),
      looks: list(raw.looks, '造型', (v, p) => { object(v, p); return { id: id(v.id, p), name: text(v.name, p + '名称', 300), description: text(v.description, p + '说明'), imageId: optionalId(v.imageId, p + '图片') }; }),
      shots: list(raw.shots, '镜头', (v, p) => {
        object(v, p);
        if (typeof v.duration !== 'number' || !Number.isFinite(v.duration) || v.duration < .1 || v.duration > 600) fail(p + '时长须为0.1至600秒');
        if (!MOVEMENTS.includes(v.movement)) fail(p + '运动无效');
        return { id: id(v.id, p), title: text(v.title, p + '标题', 500), description: text(v.description, p + '画面', 20000), dialogue: text(v.dialogue, p + '台词'), lookNotes: text(v.lookNotes ?? '', p + '机位造型说明'), duration: Math.round(v.duration * 1000) / 1000,
          imageId: optionalId(v.imageId, p + '图片'), lookId: optionalId(v.lookId, p + '造型'), framing: text(v.framing, p + '景别', 100), movement: v.movement };
      }) };
    if (!ASPECTS.includes(out.aspect)) fail('画幅无效');
    unique(out.files, '图片'); unique(out.looks, '造型'); unique(out.shots, '镜头');
    const fileIds = new Set(out.files.map(x => x.id)), lookIds = new Set(out.looks.map(x => x.id));
    for (const v of [...out.looks, ...out.shots]) if (v.imageId && !fileIds.has(v.imageId)) fail('图片引用不在方案附件中');
    for (const v of out.shots) if (v.lookId && !lookIds.has(v.lookId)) fail('镜头引用的造型不存在');
    if (timeline(out).total > 36000) fail('总时长超过10小时，请拆成多个方案');
    if (JSON.stringify({key:'previs-v1',state:out}).length > 1900000) fail('方案文字合计过长，请拆成多个方案后保存');
    return out;
  }
  function timeline(state) {
    let start = 0;
    const shots = state.shots.map((shot, index) => { const row = { ...shot, index, start, end: Math.round((start + shot.duration) * 1000) / 1000 }; start = row.end; return row; });
    return { shots, total: start };
  }
  function frameAt(state, seconds) {
    const line = timeline(state); const t = Math.max(0, Math.min(Number(seconds) || 0, line.total));
    const shot = line.shots.find(s => t >= s.start && t < s.end) || (t === line.total ? line.shots.at(-1) : null);
    return { time: t, total: line.total, shot, progress: shot ? Math.max(0, Math.min(1, (t - shot.start) / shot.duration)) : 0 };
  }
  function importPlan(doc, knownFiles = []) {
    const raw = Array.isArray(doc) ? { shots: doc } : object(doc, '导入内容');
    if (!Array.isArray(raw.shots) || raw.shots.length === 0) fail('导入内容须含非空shots数组');
    if (raw.shots.length > 300) fail('最多导入300个镜头');
    if (raw.looks !== undefined && (!Array.isArray(raw.looks) || raw.looks.length > 300)) fail('造型应为最多300项的列表');
    const out = fresh(); out.title = text(raw.title ?? '', '方案名', 300); out.aspect = raw.aspect ?? '16:9';
    out.looks = (raw.looks || []).map(v => ({ ...newLook(), ...v }));
    out.shots = raw.shots.map(v => { object(v, '镜头'); return { ...newShot(), id: v.id || uid('shot'), title: v.title ?? v.name ?? '', description: v.description ?? v.visual ?? v.action ?? '', dialogue: v.dialogue ?? v.lines ?? v.sound ?? '', lookNotes: v.lookNotes ?? v.look ?? '',
      duration: v.duration ?? v.seconds ?? 3, imageId: v.imageId ?? '', lookId: v.lookId ?? '', framing: v.framing ?? v.shotSize ?? '中景', movement: v.movement ?? 'static' }; });
    const refs = new Set([...out.shots, ...out.looks].map(x => x.imageId).filter(Boolean));
    out.files = knownFiles.filter(x => refs.has(x.id)).map(x => file(x));
    for (const ref of refs) if (!out.files.some(x => x.id === ref)) fail('图片' + ref + '不在当前项目，请先上传或导入含原图的备份');
    return validate(out);
  }
  function csv(state) {
    const cell = value => { let s = String(value ?? ''); if (/^[\s]*[=+@-]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = [['镜号', '标题', '开始秒', '时长秒', '景别', '运动', '画面描述', '台词与声音说明', '机位造型说明', '造型名称', '造型说明', '原图文件名', '原图SHA256', '附件编号']];
    for (const shot of timeline(state).shots) {
      const look = state.looks.find(x => x.id === shot.lookId), ref = state.files.find(x => x.id === (shot.imageId || look?.imageId));
      rows.push([shot.index + 1, shot.title, shot.start, shot.duration, shot.framing, shot.movement, shot.description, shot.dialogue, shot.lookNotes || '', look?.name || '', look?.description || '', ref?.name || '', ref?.sha256 || '', ref?.id || '']);
    }
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  }
  return Object.freeze({ ASPECTS, MOVEMENTS, FRAMINGS, fresh, validate, file, newShot, newLook, timeline, frameAt, importPlan, csv });
});
