export const CURRENCIES = Object.freeze(['CNY', 'USD', 'EUR', 'HKD', 'GBP']);
export const COLLECTIONS = Object.freeze(['entities', 'relations', 'entries', 'payments', 'vouchers', 'assets', 'assetEvents', 'taxes', 'brands', 'skus', 'moves', 'channels']);
const MAX = Number.MAX_SAFE_INTEGER;
const error = message => { throw new Error(message); };
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : error('记录必须是对象');
const text = (value, label = '文本', max = 10_000) => typeof value === 'string' && value.length <= max ? value : error(label + '无效或过长');
const required = (value, label) => text(value, label, 500).trim() || error('请填写' + label);
const id = value => required(value, '记录编号');
const enumValue = (value, values, label) => values.includes(value) ? value : error(label + '选项无效');
const integer = (value, label, min = 0) => Number.isSafeInteger(value) && value >= min ? value : error(label + '必须是安全范围内的整数');
const money = value => integer(value, '金额（分）');
const currency = value => enumValue(value, CURRENCIES, '币种');
export function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function date(value, optional = false) {
  if (optional && !value) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) error('日期请使用 YYYY-MM-DD');
  const d = new Date(value + 'T00:00:00Z'); if (!Number.isFinite(d.valueOf()) || d.toISOString().slice(0, 10) !== value) error('日期不存在');
  return value;
}
export function parseMoney(value) {
  const valueText = String(value).trim(); if (!/^\d+(?:\.\d{1,2})?$/.test(valueText)) error('金额请填写非负数，最多两位小数，不支持科学计数法');
  const [whole, decimals = ''] = valueText.split('.'); const minor = BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'));
  if (minor > BigInt(MAX)) error('金额超出安全范围'); return Number(minor);
}
export function moneyText(value) { integer(Math.abs(value), '金额'); const n = Math.abs(value); return (value < 0 ? '-' : '') + Math.floor(n / 100) + '.' + String(n % 100).padStart(2, '0'); }
function sum(values) { return values.reduce((total, value) => { const next = total + value; if (!Number.isSafeInteger(next)) error('合计金额或库存超出安全范围'); return next; }, 0); }
function file(value) { object(value); return { id: id(value.id), name: required(value.name, '原件名称'), type: text(value.type || '', '文件类型', 200), size: integer(value.size, '原件大小'), sha256: /^[a-f\d]{64}$/i.test(value.sha256) ? value.sha256.toLowerCase() : error('原件 SHA256 无效') }; }
function files(value = []) { if (!Array.isArray(value) || value.length > 100) error('附件列表无效'); return value.map(file); }
const base = record => { object(record); return { id: id(record.id), note: text(record.note || '') }; };
export function fresh() { return { version: 1, ...Object.fromEntries(COLLECTIONS.map(key => [key, []])), drafts: {}, tab: 'overview' }; }

export function validate(raw) {
  object(raw); if (raw.version !== 1) error('经营资料版本不受支持'); const state = fresh();
  for (const key of COLLECTIONS) if (!Array.isArray(raw[key]) || raw[key].length > 20_000) error(key + '记录列表无效');
  state.entities = raw.entities.map(r => ({ ...base(r), name: required(r.name, '主体名称'), kind: enumValue(r.kind, ['company', 'studio', 'person', 'other'], '主体类型'), registrationNo: text(r.registrationNo || '', '登记编号', 300), jurisdiction: text(r.jurisdiction || '', '登记地区', 300), contact: text(r.contact || '', '联系人', 500) }));
  state.relations = raw.relations.map(r => ({ ...base(r), fromId: id(r.fromId), toId: id(r.toId), type: enumValue(r.type, ['contract', 'investment', 'management', 'license', 'other'], '合作关系'), start: date(r.start, true), end: date(r.end, true), files: files(r.files) }));
  state.entries = raw.entries.map(r => ({ ...base(r), entityId: id(r.entityId), title: required(r.title, '收支事项'), counterparty: required(r.counterparty, '往来方'), direction: enumValue(r.direction, ['income', 'expense'], '收支方向'), currency: currency(r.currency), amountMinor: money(r.amountMinor), category: text(r.category || '', '类别', 300), installments: (Array.isArray(r.installments) && r.installments.length > 0 && r.installments.length <= 100 ? r.installments : error('请至少填写一期回款或付款安排')).map(s => ({ id: id(s.id), label: required(s.label, '分期名称'), amountMinor: money(s.amountMinor), due: date(s.due) })), files: files(r.files) }));
  state.payments = raw.payments.map(r => ({ ...base(r), entryId: id(r.entryId), installmentId: id(r.installmentId), amountMinor: integer(r.amountMinor, '实收/实付金额', 1), date: date(r.date), reference: text(r.reference || '', '凭据编号', 300), files: files(r.files) }));
  state.vouchers = raw.vouchers.map(r => ({ ...base(r), entityId: id(r.entityId), entryId: r.entryId ? id(r.entryId) : '', title: required(r.title, '票据名称'), kind: enumValue(r.kind, ['invoice', 'receipt', 'contract', 'other'], '票据类型'), number: text(r.number || '', '票据编号', 300), date: date(r.date), currency: currency(r.currency), amountMinor: money(r.amountMinor), files: files(r.files) }));
  state.assets = raw.assets.map(r => ({ ...base(r), entityId: id(r.entityId), name: required(r.name, '资产名称'), serial: text(r.serial || '', '资产编号', 300), category: text(r.category || '', '资产分类', 300), purchased: date(r.purchased, true), currency: currency(r.currency), costMinor: money(r.costMinor), location: text(r.location || '', '存放位置', 500), files: files(r.files) }));
  state.assetEvents = raw.assetEvents.map(r => ({ ...base(r), assetId: id(r.assetId), type: enumValue(r.type, ['checkout', 'return', 'inventory', 'maintenance', 'dispose'], '资产动作'), date: date(r.date), person: required(r.person, '经手人'), location: text(r.location || '', '位置', 500), condition: text(r.condition || '', '状态描述', 500), files: files(r.files) }));
  state.taxes = raw.taxes.map(r => ({ ...base(r), entityId: id(r.entityId), title: required(r.title, '税务事项'), period: /^(?:\d{4}|\d{4}-(?:0[1-9]|1[0-2])|\d{4}-Q[1-4])$/.test(r.period) ? r.period : error('税务期间请填写 YYYY、YYYY-MM 或 YYYY-Q1 至 Q4'), deadline: date(r.deadline), jurisdiction: text(r.jurisdiction || '', '申报地区', 500), accountant: text(r.accountant || '', '确认会计', 500), confirmedAt: date(r.confirmedAt, true), status: enumValue(r.status, ['todo', 'confirmed', 'filed', 'paid'], '税务进度'), filedAt: date(r.filedAt, true), paidAt: date(r.paidAt, true), currency: currency(r.currency), amountMinor: r.amountMinor === null ? null : money(r.amountMinor), reference: text(r.reference || '', '申报/缴纳凭据编号', 500), files: files(r.files) }));
  state.brands = raw.brands.map(r => ({ ...base(r), entityId: id(r.entityId), name: required(r.name, '品牌名称'), rightsType: enumValue(r.rightsType, ['trademark', 'copyright', 'license', 'other'], '权利类型'), registrationNo: text(r.registrationNo || '', '权利编号', 500), territory: text(r.territory || '', '适用地域', 500), start: date(r.start, true), end: date(r.end, true), files: files(r.files) }));
  state.skus = raw.skus.map(r => ({ ...base(r), brandId: id(r.brandId), code: required(r.code, 'SKU 编码'), name: required(r.name, '商品名称'), unit: required(r.unit, '库存单位'), currency: currency(r.currency), priceMinor: money(r.priceMinor) }));
  state.moves = raw.moves.map(r => ({ ...base(r), skuId: id(r.skuId), type: enumValue(r.type, ['in', 'out', 'count'], '库存动作'), quantity: integer(r.quantity, '数量', r.type === 'count' ? 0 : 1), date: date(r.date), reference: text(r.reference || '', '单据编号', 500), person: required(r.person, '经手人') }));
  state.channels = raw.channels.map(r => ({ ...base(r), brandId: id(r.brandId), name: required(r.name, '渠道名称'), kind: text(r.kind || '', '渠道类型', 300), contact: text(r.contact || '', '联系人', 500), start: date(r.start, true), end: date(r.end, true), status: enumValue(r.status, ['planned', 'active', 'ended'], '渠道进度'), files: files(r.files) }));
  const indexes = Object.fromEntries(COLLECTIONS.map(key => [key, new Map(state[key].map(record => [record.id, record]))]));
  for (const key of COLLECTIONS) if (indexes[key].size !== state[key].length) error(key + '存在重复记录编号');
  const ref = (key, value, label) => indexes[key].has(value) || error(label + '引用的记录不存在，请先创建关联资料');
  for (const r of state.relations) { ref('entities', r.fromId, '合作主体'); ref('entities', r.toId, '合作主体'); if (r.fromId === r.toId) error('合作关系的两个主体不能相同'); }
  for (const key of ['entries', 'vouchers', 'assets', 'taxes', 'brands']) for (const r of state[key]) ref('entities', r.entityId, '经营主体');
  for (const r of state.entries) {
    if (r.amountMinor <= 0 || r.installments.some(s => s.amountMinor <= 0)) error('应收/应付与每期金额必须大于零');
    if (new Set(r.installments.map(s => s.id)).size !== r.installments.length) error('分期编号不能重复');
    if (sum(r.installments.map(s => s.amountMinor)) !== r.amountMinor) error('分期金额合计必须等于该事项总金额');
  }
  for (const p of state.payments) { ref('entries', p.entryId, '收付款'); const entry = indexes.entries.get(p.entryId), part = entry.installments.find(s => s.id === p.installmentId); if (!part) error('实收/实付对应的分期不存在'); }
  for (const e of state.entries) for (const s of e.installments) if (sum(state.payments.filter(p => p.entryId === e.id && p.installmentId === s.id).map(p => p.amountMinor)) > s.amountMinor) error('实收/实付不能超过对应分期金额；多余款项请另建事项');
  for (const v of state.vouchers) if (v.entryId) { ref('entries', v.entryId, '票据关联事项'); if (indexes.entries.get(v.entryId).entityId !== v.entityId) error('票据与收支事项的主体必须一致'); }
  for (const e of state.assetEvents) ref('assets', e.assetId, '资产动作');
  for (const asset of state.assets) assetStatus(state, asset.id);
  for (const tax of state.taxes) {
    if (tax.status !== 'todo' && (!tax.accountant.trim() || !tax.confirmedAt)) error('推进税务进度前，请记录会计姓名与确认日期');
    if (['filed', 'paid'].includes(tax.status) && !tax.filedAt) error('请记录实际申报日期');
    if (tax.status === 'paid' && (!tax.paidAt || !tax.files.length || tax.amountMinor === null)) error('记录已缴纳需要日期、金额与缴纳凭证原件');
  }
  for (const r of state.skus) ref('brands', r.brandId, '商品品牌');
  const skuKeys = state.skus.map(r => r.brandId + ':' + r.code); if (new Set(skuKeys).size !== skuKeys.length) error('同一品牌 SKU 编码不能重复');
  for (const r of state.moves) ref('skus', r.skuId, '库存商品');
  for (const sku of state.skus) stock(state, sku.id);
  for (const r of state.channels) ref('brands', r.brandId, '渠道品牌');
  for (const key of ['relations', 'brands', 'channels']) for (const r of state[key]) if (r.start && r.end && r.end < r.start) error('结束日期不能早于开始日期');
  for (const c of CURRENCIES) for (const direction of ['income', 'expense']) sum(state.entries.filter(e => e.currency === c && e.direction === direction).map(e => e.amountMinor));
  const originalFiles = new Map();
  for (const key of COLLECTIONS) for (const record of state[key]) for (const f of record.files || []) { const other = originalFiles.get(f.id); if (other && ['name', 'type', 'size', 'sha256'].some(k => other[k] !== f[k])) error('同一原件编号的元数据不能冲突'); originalFiles.set(f.id, f); }
  const rawDrafts = raw.drafts ?? {}; object(rawDrafts); if (JSON.stringify(rawDrafts).length > 100_000) error('未提交草稿过长，请分开保存');
  const draftKeys = [...COLLECTIONS, 'payment'];
  for (const [key, values] of Object.entries(rawDrafts)) { if (!draftKeys.includes(key)) continue; object(values); state.drafts[key] = {}; for (const [name, value] of Object.entries(values)) if (/^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !['constructor', 'prototype', '__proto__'].includes(name)) state.drafts[key][name] = text(value, '草稿', 30_000); }
  state.tab = ['overview', 'entities', 'entries', 'vouchers', 'assets', 'taxes', 'brands'].includes(raw.tab) ? raw.tab : 'overview';
  return state;
}

export function assetStatus(state, assetId) {
  let status = 'available', holder = '', lastDate = '', location = state.assets.find(a => a.id === assetId)?.location || '', lastInventory = '';
  for (const event of state.assetEvents.filter(e => e.assetId === assetId)) {
    if (event.date < lastDate) error('资产流水请按日期顺序登记，不能插入早于已有流水的动作');
    lastDate = event.date;
    if (status === 'disposed') error('已处置资产不能继续登记动作');
    if (event.type === 'checkout') { if (status !== 'available') error('资产须先归还或完成维护后才能领用'); status = 'loaned'; holder = event.person; }
    if (event.type === 'return') { if (!['loaned', 'maintenance'].includes(status)) error('当前资产没有待归还或维护中的记录'); status = 'available'; holder = ''; }
    if (event.type === 'maintenance') { if (status === 'loaned') error('领用中的资产须先归还再登记维护'); status = 'maintenance'; holder = event.person; }
    if (event.type === 'dispose') { if (status === 'loaned') error('领用中的资产须先归还再处置'); status = 'disposed'; holder = ''; }
    if (event.type === 'inventory') lastInventory = event.date;
    if (event.location) location = event.location;
  }
  return { status, holder, location, lastDate, lastInventory };
}
export function stock(state, skuId) {
  let quantity = 0, lastDate = '';
  for (const m of state.moves.filter(move => move.skuId === skuId)) {
    if (m.date < lastDate) error('库存流水请按日期顺序登记，不能早于已有流水'); lastDate = m.date;
    quantity = m.type === 'count' ? m.quantity : sum([quantity, m.type === 'in' ? m.quantity : -m.quantity]);
    if (quantity < 0) error('出库数量超过现有库存');
  }
  return quantity;
}
export function installments(state, today = localDate()) {
  date(today); return state.entries.flatMap(entry => entry.installments.map(part => {
    const paidMinor = sum(state.payments.filter(p => p.entryId === entry.id && p.installmentId === part.id).map(p => p.amountMinor));
    const remainingMinor = part.amountMinor - paidMinor;
    return { ...part, entryId: entry.id, entityId: entry.entityId, title: entry.title, counterparty: entry.counterparty, direction: entry.direction, currency: entry.currency, paidMinor, remainingMinor, status: remainingMinor === 0 ? 'settled' : part.due < today ? 'overdue' : 'pending' };
  }));
}
export function summary(state, today = localDate()) {
  const byCurrency = {};
  for (const part of installments(state, today)) {
    const item = byCurrency[part.currency] ??= { incomeMinor: 0, expenseMinor: 0, receivedMinor: 0, paidMinor: 0, receivableMinor: 0, payableMinor: 0 };
    if (part.direction === 'income') { item.incomeMinor = sum([item.incomeMinor, part.amountMinor]); item.receivedMinor = sum([item.receivedMinor, part.paidMinor]); item.receivableMinor = sum([item.receivableMinor, part.remainingMinor]); }
    else { item.expenseMinor = sum([item.expenseMinor, part.amountMinor]); item.paidMinor = sum([item.paidMinor, part.paidMinor]); item.payableMinor = sum([item.payableMinor, part.remainingMinor]); }
  }
  return { byCurrency, overdue: installments(state, today).filter(p => p.status === 'overdue'), taxDue: state.taxes.filter(t => t.status !== 'paid').map(t => ({ ...t, overdue: t.deadline < today })), brandsExpiring: state.brands.filter(b => b.end && b.end >= today && b.end <= addDays(today, 30)), brandsExpired: state.brands.filter(b => b.end && b.end < today) };
}
function addDays(value, amount) { const d = new Date(value + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); }
export function references(state) { const map = new Map(); for (const key of COLLECTIONS) for (const record of state[key]) for (const ref of record.files || []) map.set(ref.id, ref); return [...map.values()]; }
export function replaceRecord(state, collection, record) { if (!COLLECTIONS.includes(collection)) error('未知记录类型'); const next = structuredClone(state), at = next[collection].findIndex(r => r.id === record.id); if (at < 0) next[collection].push(record); else next[collection][at] = record; return validate(next); }
export function deleteRecord(state, collection, recordId) { if (!COLLECTIONS.includes(collection)) error('未知记录类型'); const next = structuredClone(state); next[collection] = next[collection].filter(r => r.id !== recordId); return validate(next); }
export function csv(headers, rows) {
  const cell = value => { let s = String(value ?? ''); if (/^[\s\t\r\n]*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
export function exportRows(state, type, today = localDate()) {
  const entityName = eid => state.entities.find(e => e.id === eid)?.name || '';
  const entryName = eid => state.entries.find(e => e.id === eid)?.title || '';
  const brandName = bid => state.brands.find(b => b.id === bid)?.name || '';
  if (type === 'entities') return csv(['主体名称', '类型', '登记编号', '登记地区', '业务联系人', '说明'], state.entities.map(e => [e.name, e.kind, e.registrationNo, e.jurisdiction, e.contact, e.note]));
  if (type === 'relations') return csv(['主体甲', '主体乙', '关系（手动登记）', '开始日', '结束日', '附件数', '说明'], state.relations.map(r => [entityName(r.fromId), entityName(r.toId), r.type, r.start, r.end, r.files.length, r.note]));
  if (type === 'entries') return csv(['主体', '事项', '往来方', '方向', '币种', '分期', '应收应付（元）', '实收实付（元）', '剩余（元）', '到期日', '进度'], installments(state, today).map(p => [state.entities.find(e => e.id === p.entityId)?.name, p.title, p.counterparty, p.direction === 'income' ? '收入' : '支出', p.currency, p.label, moneyText(p.amountMinor), moneyText(p.paidMinor), moneyText(p.remainingMinor), p.due, p.status]));
  if (type === 'payments') return csv(['主体', '事项', '分期', '方向', '币种', '实收实付（元）', '日期', '凭据编号', '附件数', '说明'], state.payments.map(p => { const e = state.entries.find(e => e.id === p.entryId); return [entityName(e.entityId), e.title, e.installments.find(s => s.id === p.installmentId)?.label, e.direction, e.currency, moneyText(p.amountMinor), p.date, p.reference, p.files.length, p.note]; }));
  if (type === 'vouchers') return csv(['主体', '关联事项', '票据名称', '类型', '票据编号', '日期', '币种', '金额（元）', '附件数', '说明'], state.vouchers.map(v => [entityName(v.entityId), entryName(v.entryId), v.title, v.kind, v.number, v.date, v.currency, moneyText(v.amountMinor), v.files.length, v.note]));
  if (type === 'assets') return csv(['主体', '资产', '编号', '币种', '购置金额（元）', '状态', '领用人', '位置', '最后盘点'], state.assets.map(a => { const s = assetStatus(state, a.id); return [state.entities.find(e => e.id === a.entityId)?.name, a.name, a.serial, a.currency, moneyText(a.costMinor), s.status, s.holder, s.location, s.lastInventory]; }));
  if (type === 'assetEvents') return csv(['资产', '内部编号', '动作', '日期', '经手人', '位置', '实物状况', '附件数', '说明'], state.assetEvents.map(e => { const a = state.assets.find(a => a.id === e.assetId); return [a.name, a.serial, e.type, e.date, e.person, e.location, e.condition, e.files.length, e.note]; }));
  if (type === 'taxes') return csv(['主体', '事项', '期间', '期限', '进度（用户记录）', '确认会计', '确认日', '申报日', '缴纳日', '币种', '金额（元）', '凭据编号', '附件数'], state.taxes.map(t => [state.entities.find(e => e.id === t.entityId)?.name, t.title, t.period, t.deadline, t.status, t.accountant, t.confirmedAt, t.filedAt, t.paidAt, t.currency, t.amountMinor === null ? '未确认' : moneyText(t.amountMinor), t.reference, t.files.length]));
  if (type === 'stock' || type === 'skus') return csv(['品牌', 'SKU', '商品', '库存', '单位', '币种', '标价（元）'], state.skus.map(s => [state.brands.find(b => b.id === s.brandId)?.name, s.code, s.name, stock(state, s.id), s.unit, s.currency, moneyText(s.priceMinor)]));
  if (type === 'brands') return csv(['主体', '品牌权利名称', '类型', '注册授权编号', '地域与用途', '开始日', '截止日', '附件数', '说明'], state.brands.map(b => [entityName(b.entityId), b.name, b.rightsType, b.registrationNo, b.territory, b.start, b.end, b.files.length, b.note]));
  if (type === 'moves') return csv(['品牌', 'SKU', '商品', '动作', '数量', '单位', '日期', '经手人', '单据编号', '说明'], state.moves.map(m => { const s = state.skus.find(s => s.id === m.skuId); return [brandName(s.brandId), s.code, s.name, m.type, m.quantity, s.unit, m.date, m.person, m.reference, m.note]; }));
  if (type === 'channels') return csv(['品牌', '渠道名称', '类型', '业务联系人', '进度', '开始日', '截止日', '附件数', '说明'], state.channels.map(c => [brandName(c.brandId), c.name, c.kind, c.contact, c.status, c.start, c.end, c.files.length, c.note]));
  const rows = state[type]; if (!COLLECTIONS.includes(type) || !Array.isArray(rows)) error('未知导出类型');
  const headers = [...new Set(rows.flatMap(r => Object.keys(r).filter(key => !['files', 'installments'].includes(key))))];
  return csv(headers.length ? headers : ['暂无记录'], rows.map(record => headers.map(key => typeof record[key] === 'object' ? JSON.stringify(record[key]) : record[key])));
}
