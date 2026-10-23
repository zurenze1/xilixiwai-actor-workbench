(function (root) {
  'use strict';
  const TABS = ['today', 'health', 'breed', 'beh', 'care', 'album'];
  const CONTACTS = ['ownerName', 'ownerPhone', 'assistantName', 'assistantPhone', 'hospitalName', 'hospitalPhone', 'hospitalAddress', 'emergencyName', 'emergencyPhone', 'emergencyAddress', 'careNote'];
  const fail = (path, message) => { throw new Error('肉肉资料校验失败：' + path + message); };
  const obj = (x, p) => {
    if (!x || typeof x !== 'object' || Array.isArray(x) || ![Object.prototype, null].includes(Object.getPrototypeOf(x))) fail(p, '应为对象');
    if (Object.keys(x).some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) fail(p, '含有不允许的字段');
    return x;
  };
  const str = (x, p, max = 20000) => { if (typeof x !== 'string' || x.length > max) fail(p, '应为不超过 ' + max + ' 字的文字'); return x; };
  const num = (x, p, max = 1000000) => { if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > max) fail(p, '不是有效的非负数值'); return x; };
  const list = (x, p, map, max = 10000) => { if (!Array.isArray(x) || x.length > max) fail(p, '应为不超过 ' + max + ' 项的列表'); return x.map((v, i) => map(v, p + '[' + i + ']')); };
  const date = (x, p) => { str(x, p, 10); const d = new Date(x + 'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(x) || !Number.isFinite(+d) || d.toISOString().slice(0, 10) !== x) fail(p, '不是有效日期'); return x; };
  const time = (x, p) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(str(x, p, 5))) fail(p, '不是有效时间'); return x; };
  const image = (x, p) => { if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(str(x, p, 50000000))) fail(p, '不是可保留的旧版图片'); return x; };
  function fileRef(x, p) {
    obj(x, p);
    const id = str(x.id, p + '.id', 200);
    if (!/^file-[A-Za-z0-9-]+$/.test(id)) fail(p, '文件编号无效');
    const sha256 = str(x.sha256, p + '.sha256', 64);
    if (!/^[a-f0-9]{64}$/i.test(sha256)) fail(p, '缺少原件校验值');
    const size = num(x.size, p + '.size', Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(size)) fail(p, '文件字节数无效');
    return { id, name: str(x.name, p + '.name', 1000), type: str(x.type || '', p + '.type', 200), size, sha256: sha256.toLowerCase() };
  }
  function fresh() {
    const d = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const health = [
      ['core','💉','犬核心疫苗（八联 / 六联）',-340,365,'示例周期，请按医生建议修改'],
      ['rabies','🩺','狂犬疫苗',-358,365,'示例周期，请按医生建议修改'],
      ['in','💊','体内驱虫',-80,90,'示例周期'],
      ['out','🧴','体外驱虫（跳蚤 / 蜱虫）',-33,30,'示例周期'],
      ['check','🏥','年度体检',-200,365,'示例记录'],
      ['teeth','🦷','牙齿检查 / 洗牙评估',-150,180,'示例记录'],
      ['groom','✂️','美容修剪',-26,30,'示例记录']
    ].map(([id,ic,n,days,every,note]) => ({id,ic,n,last:d(days),every,note}));
    const behLog = [[-6,'主人出门就叫'],[-5,'主人出门就叫'],[-5,'像猪一样哼哼（反向喷嚏）'],[-3,'一直舔爪子'],[-2,'主人出门就叫'],[-1,'摇尾巴翻肚皮']].map(([days,b]) => ({d:d(days),b}));
    return { schemaVersion: 2, tab: 'today', logs: {}, health, behLog, photos: [], notes: {}, contacts: Object.fromEntries(CONTACTS.map(k => [k, ''])), drafts: {} };
  }
  function validate(raw) {
    obj(raw, '资料');
    if (raw.schemaVersion !== undefined && ![1, 2].includes(raw.schemaVersion)) fail('版本', '不受当前页面支持');
    const out = fresh();
    if (raw.tab !== undefined) { if (!TABS.includes(raw.tab)) fail('当前页面', '无效'); out.tab = raw.tab; }
    if (raw.logs !== undefined) {
      obj(raw.logs, '每日记录');
      if (Object.keys(raw.logs).length > 10000) fail('每日记录', '数量过多');
      for (const [d, v] of Object.entries(raw.logs)) {
        date(d, '每日记录日期'); obj(v, d);
        const care = {}; obj(v.care || {}, d + '.care');
        for (const key of ['brush', 'tear', 'teeth']) if (v.care?.[key] != null) care[key] = time(v.care[key], d + '.' + key);
        const timed = (a, p, field) => list(a || [], p, (x, q) => { obj(x, q); return { t: time(x.t, q + '.t'), [field]: num(x[field], q + '.' + field) }; });
        out.logs[d] = {
          food: timed(v.food, d + '.food', 'g'), water: num(v.water ?? 0, d + '.water'),
          walk: timed(v.walk, d + '.walk', 'm'), care,
          poop: list(v.poop || [], d + '.poop', (x, q) => { obj(x, q); return { t: time(x.t, q + '.t'), s: str(x.s, q + '.s', 100) }; }),
          waterLog: timed(v.waterLog, d + '.waterLog', 'ml')
        };
      }
    }
    if (raw.health != null) out.health = list(raw.health, '健康记录', (x, p) => {
      obj(x, p); const every = num(x.every, p + '.every', 36500); if (every < 1 || !Number.isInteger(every)) fail(p, '周期至少为1天');
      return { id: str(x.id, p + '.id', 100), ic: str(x.ic || '', p + '.ic', 20), n: str(x.n, p + '.n', 1000), last: date(x.last, p + '.last'), every, note: str(x.note || '', p + '.note', 10000) };
    }, 1000);
    if (!out.health.length || new Set(out.health.map(h => h.id)).size !== out.health.length) fail('健康记录', '至少保留一项，且项目编号不能重复');
    if (raw.behLog != null) out.behLog = list(raw.behLog, '行为记录', (x, p) => { obj(x, p); return { d: date(x.d, p + '.d'), b: str(x.b, p + '.b', 5000) }; });
    if (raw.photos !== undefined) out.photos = list(raw.photos, '照片', (x, p) => {
      obj(x, p); const value = { id: str(x.id || 'legacy-photo-' + p.replace(/\D/g, ''), p + '.id', 200), c: str(x.c || '', p + '.c', 10000), d: str(x.d || '', p + '.d', 100) };
      if (x.file != null) value.file = fileRef(x.file, p + '.file');
      if (x.src) value.src = image(x.src, p + '.src');
      if (!value.file && !value.src) fail(p, '缺少照片内容');
      return value;
    });
    if (raw.notes !== undefined) {
      obj(raw.notes, '记录');
      for (const [tab, entries] of Object.entries(raw.notes)) {
        if (!TABS.includes(tab)) fail('记录分类', '无效');
        out.notes[tab] = list(entries, '记录.' + tab, (x, p) => {
          obj(x, p); const value = { at: str(x.at || '', p + '.at', 100), text: str(x.text || '', p + '.text', 100000) };
          if (x.attachment != null) value.attachment = fileRef(x.attachment, p + '.attachment');
          if (x.file === true) value.file = true;
          if (x.img) value.img = image(x.img, p + '.img');
          return value;
        });
      }
    }
    if (raw.contacts !== undefined) { obj(raw.contacts, '托管联系'); for (const k of CONTACTS) if (raw.contacts[k] !== undefined) out.contacts[k] = str(raw.contacts[k], '托管联系.' + k, k === 'careNote' ? 10000 : 1000); }
    if (raw.drafts !== undefined) {
      obj(raw.drafts, '草稿');
      for (const [tab, value] of Object.entries(raw.drafts)) {
        if (!TABS.includes(tab)) fail('草稿分类', '无效'); obj(value, '草稿.' + tab);
        const d = {};
        for (const k of ['note', 'behavior', 'healthId', 'healthDate', 'photoCaption', 'photoDate']) if (value[k] !== undefined) d[k] = str(value[k], '草稿.' + tab + '.' + k, k === 'note' ? 100000 : 5000);
        if (value.contacts !== undefined) { obj(value.contacts, '托管草稿'); d.contacts = {}; for (const k of CONTACTS) if (value.contacts[k] !== undefined) d.contacts[k] = str(value.contacts[k], '托管草稿.' + k, k === 'careNote' ? 10000 : 1000); }
        out.drafts[tab] = d;
      }
    }
    references(out);
    return out;
  }
  function references(state) {
    const result = new Map();
    const add = ref => {
      const previous = result.get(ref.id);
      if (previous && ['name','type','size','sha256'].some(k => previous[k] !== ref[k])) fail('原件引用', '同一编号的文件说明不一致');
      result.set(ref.id, ref);
    };
    for (const p of state.photos || []) if (p.file) add(p.file);
    for (const entries of Object.values(state.notes || {})) for (const n of entries) if (n.attachment) add(n.attachment);
    return [...result.values()];
  }
  root.PetSchema = Object.freeze({ validate, fresh, references, contactKeys: Object.freeze(CONTACTS) });
})(typeof window !== 'undefined' ? window : globalThis);
