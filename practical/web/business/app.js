import * as M from './model.js';

const KEY = 'business-v1', $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => crypto.randomUUID(), clone = value => structuredClone(value);
const TABS = { overview: '经营总览', entities: '主体与合作', entries: '收支与回款', vouchers: '票据原件', assets: '资产管理', taxes: '税务待办', brands: '品牌与商品' };
const labels = { company: '公司', studio: '工作室', person: '个人', other: '其他', contract: '合同合作', investment: '出资关系（手动记录）', management: '经纪管理', license: '授权合作', income: '收入', expense: '支出', invoice: '发票', receipt: '收付款凭据', checkout: '领用', return: '归还 / 维护完成', inventory: '盘点', maintenance: '维护', dispose: '处置', available: '在库', loaned: '领用中', disposed: '已处置', todo: '待会计确认', confirmed: '会计已确认', filed: '已申报（用户记录）', paid: '已缴纳（用户记录）', trademark: '商标', copyright: '作品著作权', in: '入库', out: '出库', count: '实物盘点数', planned: '洽谈中', active: '合作中', ended: '已结束', settled: '已结清', overdue: '已逾期', pending: '待回款 / 付款' };
const opt = values => values.map(value => [value, labels[value] || value]);
const field = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const currencies = field('currency', '币种', 'select', { options: M.CURRENCIES.map(c => [c, c]), default: 'CNY' });
const entity = field('entityId', '所属经营主体', 'entities', { required: true });
const note = field('note', '补充说明', 'textarea');
const attached = field('attachments', '添加原件（每份最多 32 MB）', 'files');
const schemas = {
  entities: { title: '经营主体', fields: [field('name', '主体名称', 'text', { required: true }), field('kind', '主体类型', 'select', { options: opt(['company', 'studio', 'person', 'other']), default: 'studio' }), field('registrationNo', '登记编号（可留空）'), field('jurisdiction', '登记地区（可留空）'), field('contact', '业务联系人（可留空）'), note] },
  relations: { title: '合作关系', fields: [field('fromId', '主体甲', 'entities', { required: true }), field('toId', '主体乙', 'entities', { required: true }), field('type', '关系类型', 'select', { options: opt(['contract', 'investment', 'management', 'license', 'other']), default: 'contract' }), field('start', '开始日', 'date'), field('end', '结束日', 'date'), note, attached] },
  entries: { title: '应收 / 应付事项', fields: [entity, field('title', '合作 / 收支事项', 'text', { required: true }), field('counterparty', '往来方', 'text', { required: true }), field('direction', '收支方向', 'select', { options: opt(['income', 'expense']), default: 'income' }), currencies, field('amount', '总金额（元）', 'money', { required: true }), field('category', '业务类别'), field('due', '单期到期日', 'date'), field('schedule', '分期安排（不分期可留空）', 'textarea', { hint: '每行：阶段名称 | 金额（元） | YYYY-MM-DD。分期合计须等于总金额。' }), note, attached] },
  payments: { title: '实际回款 / 付款', fields: [field('entryId', '关联事项', 'entries', { required: true }), field('installmentId', '对应分期', 'installments', { required: true }), field('amount', '实际金额（元）', 'money', { required: true }), field('date', '到账 / 付款日', 'date', { required: true, today: true }), field('reference', '凭据编号（非银行密码）'), note, attached] },
  vouchers: { title: '票据登记', fields: [entity, field('entryId', '关联收支事项（可留空）', 'entries'), field('title', '票据名称', 'text', { required: true }), field('kind', '票据类型', 'select', { options: opt(['invoice', 'receipt', 'contract', 'other']), default: 'invoice' }), field('number', '票据编号'), field('date', '票据日期', 'date', { required: true, today: true }), currencies, field('amount', '票面金额（元）', 'money', { required: true }), note, attached] },
  assets: { title: '资产台账', fields: [entity, field('name', '资产名称', 'text', { required: true }), field('serial', '内部资产编号 / 序列号'), field('category', '分类'), field('purchased', '购置日', 'date'), currencies, field('cost', '购置金额（元）', 'money', { required: true }), field('location', '初始存放位置'), note, attached] },
  assetEvents: { title: '领用 / 归还 / 盘点', fields: [field('assetId', '资产', 'assets', { required: true }), field('type', '动作', 'select', { options: opt(['checkout', 'return', 'inventory', 'maintenance', 'dispose']), default: 'inventory' }), field('date', '登记日期', 'date', { required: true, today: true }), field('person', '经手人', 'text', { required: true }), field('location', '当前存放位置'), field('condition', '实物状况'), note, attached] },
  taxes: { title: '税务期间与进度', fields: [entity, field('title', '税务事项', 'text', { required: true }), field('period', '所属期间', 'text', { required: true, placeholder: 'YYYY-MM / YYYY-Q1 / YYYY' }), field('deadline', '会计确认的办理期限', 'date', { required: true }), field('jurisdiction', '申报地区 / 办理机构'), field('status', '办理进度（人工记录）', 'select', { options: opt(['todo', 'confirmed', 'filed', 'paid']), default: 'todo' }), field('accountant', '确认会计'), field('confirmedAt', '会计确认日', 'date'), field('filedAt', '实际申报日', 'date'), field('paidAt', '实际缴纳日', 'date'), currencies, field('amount', '会计确认的金额（元，可留空）', 'money'), field('reference', '申报 / 缴纳凭据编号'), note, attached] },
  brands: { title: '自有品牌 / 权利', fields: [entity, field('name', '品牌 / 权利名称', 'text', { required: true }), field('rightsType', '权利类型', 'select', { options: opt(['trademark', 'copyright', 'license', 'other']), default: 'trademark' }), field('registrationNo', '注册 / 授权编号'), field('territory', '授权地域与用途'), field('start', '权利开始日', 'date'), field('end', '期限截止日', 'date'), note, attached] },
  skus: { title: '商品 SKU', fields: [field('brandId', '所属品牌', 'brands', { required: true }), field('code', 'SKU 编码', 'text', { required: true }), field('name', '商品名称', 'text', { required: true }), field('unit', '库存单位', 'text', { required: true, placeholder: '件 / 本 / 套' }), currencies, field('price', '标价（元）', 'money', { required: true }), note] },
  moves: { title: '库存流水', fields: [field('skuId', '商品 SKU', 'skus', { required: true }), field('type', '库存动作', 'select', { options: opt(['in', 'out', 'count']), default: 'in' }), field('quantity', '数量（盘点填写实物总数）', 'integer', { required: true }), field('date', '登记日期', 'date', { required: true, today: true }), field('person', '经手人', 'text', { required: true }), field('reference', '订单 / 单据编号'), note] },
  channels: { title: '渠道合作', fields: [field('brandId', '所属品牌', 'brands', { required: true }), field('name', '渠道名称', 'text', { required: true }), field('kind', '渠道类型'), field('contact', '业务联系人'), field('status', '合作进度', 'select', { options: opt(['planned', 'active', 'ended']), default: 'planned' }), field('start', '合作开始日', 'date'), field('end', '合作截止日', 'date'), note, attached] },
};
let state, client, timer, writes = Promise.resolve(), dirty = false, version = 0, busy = false;
const status = text => { $('#status').textContent = text; };
const fail = error => { $('#error').textContent = error?.message || String(error); $('#error').hidden = false; status('操作未完成 · 请检查后重试'); };
const clearError = () => { $('#error').hidden = true; $('#error').textContent = ''; };
function mark() { dirty = true; version++; status('草稿待保存…'); clearTimeout(timer); timer = setTimeout(() => flush().catch(fail), 500); }
async function flush() {
  clearTimeout(timer); timer = 0; if (!dirty) { await writes; return; }
  const snapshot = M.validate(state), at = version; status('保存中…');
  const work = writes.catch(() => {}).then(() => client.save(snapshot)); writes = work;
  await work; if (at === version) { dirty = false; status('已保存 · 经营私有资料'); }
}
async function commit(next) { await flush(); await writes; const saved = await client.save(M.validate(next)); state = M.validate(saved); dirty = false; status('已保存 · 经营私有资料'); }
function selectedFiles() { return [...document.querySelectorAll('input[type=file]')].some(input => input.id !== 'restore' && input.files?.length); }
async function whenIdle() { if (busy) throw Error('经营资料正在处理，请稍候'); if (selectedFiles()) throw Error('有待提交原件，请先保存该表单或清空文件选择后再切换'); await flush(); await writes; if (dirty) throw Error('经营草稿尚未保存，请重试'); }
window.BusinessApp = Object.freeze({ whenIdle });
async function run(fn) { if (busy) return; busy = true; $('#app').inert = true; clearError(); try { await fn(); } catch (e) { fail(e); } finally { busy = false; $('#app').inert = false; } }
function optionsFor(type, draft = {}) {
  if (type === 'installments') return (state.entries.find(e => e.id === draft.entryId)?.installments || []).map(p => [p.id, p.label + ' · ' + M.moneyText(p.amountMinor)]);
  return (state[type] || []).map(r => [r.id, r.name || r.title || r.code]);
}
function draftFor(type) { return state.drafts[type] || {}; }
function form(type) {
  const spec = schemas[type], draft = draftFor(type), existing = state[type].find(r => r.id === draft.id);
  return `<details ${type === (state.tab === 'brands' ? 'brands' : state.tab) ? 'open' : ''} id="form-${type}"><summary>${draft.id ? '编辑' : '添加'}${esc(spec.title)}</summary><form data-form="${type}"><input type="hidden" name="id" value="${esc(draft.id || '')}"><div class="fields">${spec.fields.map(f => {
    const value = draft[f.key] ?? f.default ?? (f.today ? M.localDate() : ''), attrs = `name="${f.key}" ${f.required ? 'required' : ''}`;
    let control;
    if (f.type === 'files') control = `<input ${attrs} type="file" multiple>`;
    else if (f.type === 'textarea') control = `<textarea ${attrs} rows="3" maxlength="10000">${esc(value)}</textarea>`;
    else if (f.type === 'select' || ['entities', 'entries', 'installments', 'assets', 'brands', 'skus'].includes(f.type)) { const options = f.options || optionsFor(f.type, draft); control = `<select ${attrs}>${f.options ? '' : '<option value="">请选择</option>'}${options.map(([key, title]) => `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select>`; }
    else control = `<input ${attrs} type="${f.type === 'date' ? 'date' : f.type === 'integer' ? 'number' : 'text'}" ${f.type === 'integer' ? 'min="0" step="1"' : ''} ${f.type === 'money' ? 'inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?"' : ''} value="${esc(value)}" maxlength="500" placeholder="${esc(f.placeholder || '')}">`;
    return `<label class="field ${['textarea', 'files'].includes(f.type) ? 'wide' : ''}"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${control}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
  }).join('')}</div>${existing ? attachments(existing, type) : ''}<div class="row"><button class="primary" type="submit">${draft.id ? '保存修改' : '登记'}</button><button type="button" data-cancel="${type}">清空表单</button><span class="hint">表单草稿会保存；点击登记后才计入台账。</span></div></form></details>`;
}
function attachments(record, type) { return record.files?.length ? `<div class="file-list">${record.files.map(f => `<span><button type="button" data-download="${esc(f.id)}">下载 ${esc(f.name)}</button><button type="button" data-remove-file="${esc(f.id)}" data-type="${type}" data-id="${esc(record.id)}" aria-label="移除${esc(f.name)}引用">×</button></span>`).join('')}</div>` : ''; }
const entityName = id => state.entities.find(e => e.id === id)?.name || '未关联';
function recordTitle(type, r) { return r.name || r.title || (type === 'relations' ? entityName(r.fromId) + ' → ' + entityName(r.toId) : type === 'payments' ? state.entries.find(e => e.id === r.entryId)?.title : type === 'assetEvents' ? state.assets.find(a => a.id === r.assetId)?.name : type === 'moves' ? state.skus.find(s => s.id === r.skuId)?.name : '') || schemas[type].title; }
function details(type, r) {
  if (type === 'entities') return `${labels[r.kind]} · ${r.jurisdiction || '登记地区待填'}\n登记编号：${r.registrationNo || '未填'}\n业务联系人：${r.contact || '未填'}`;
  if (type === 'relations') return `${labels[r.type]}\n${r.start || '起日未填'} → ${r.end || '期限未填'}\n关系仅依据手动填写，未自动核验现实股权。`;
  if (type === 'entries') return `${entityName(r.entityId)} · ${r.counterparty}\n${labels[r.direction]} ${r.currency} ${M.moneyText(r.amountMinor)} · ${r.installments.length} 期`;
  if (type === 'payments') return `${r.date} · ${M.moneyText(r.amountMinor)} ${state.entries.find(e => e.id === r.entryId)?.currency}\n${state.entries.find(e => e.id === r.entryId)?.installments.find(s => s.id === r.installmentId)?.label || ''} · 凭据：${r.reference || '未填'}`;
  if (type === 'vouchers') return `${entityName(r.entityId)} · ${labels[r.kind]}\n${r.currency} ${M.moneyText(r.amountMinor)} · ${r.date}\n编号：${r.number || '未填'}`;
  if (type === 'assets') { const s = M.assetStatus(state, r.id); return `${entityName(r.entityId)} · ${r.serial || '编号未填'}\n${labels[s.status]}${s.holder ? ' · ' + s.holder : ''} · ${s.location || '位置未填'}\n${r.currency} ${M.moneyText(r.costMinor)} · 最后盘点：${s.lastInventory || '未登记'}`; }
  if (type === 'assetEvents') return `${labels[r.type]} · ${r.date} · ${r.person}\n${r.location} ${r.condition}`;
  if (type === 'taxes') return `${entityName(r.entityId)} · ${r.period} · ${labels[r.status]}\n期限：${r.deadline} · 会计：${r.accountant || '待分配'}\n金额：${r.amountMinor === null ? '待会计确认' : r.currency + ' ' + M.moneyText(r.amountMinor)}\n${r.paidAt ? '缴纳日期：' + r.paidAt : ''}`;
  if (type === 'brands') return `${entityName(r.entityId)} · ${labels[r.rightsType]}\n${r.registrationNo || '权利编号待填'} · ${r.territory || '地域用途待填'}\n期限：${r.end || '待确认'}（登记不代表自动取得权利）`;
  if (type === 'skus') return `${state.brands.find(b => b.id === r.brandId)?.name} · ${r.code}\n库存 ${M.stock(state, r.id)} ${r.unit}\n标价：${r.currency} ${M.moneyText(r.priceMinor)}`;
  if (type === 'moves') return `${labels[r.type]} ${r.quantity} · ${r.date} · ${r.person}\n单据：${r.reference || '未填'}`;
  return `${state.brands.find(b => b.id === r.brandId)?.name} · ${labels[r.status]}\n${r.kind} · ${r.contact}\n${r.start || '起日未填'} → ${r.end || '期限未填'}`;
}
function list(type) { return state[type].length ? `<div class="cards">${state[type].map(r => `<article class="card"><h3>${esc(recordTitle(type, r))}</h3><p class="record-details">${esc(details(type, r))}</p>${r.note ? `<p class="hint">${esc(r.note)}</p>` : ''}${attachments(r, type)}<div class="record-actions"><button data-edit="${type}" data-id="${esc(r.id)}">编辑</button><button class="danger" data-delete="${type}" data-id="${esc(r.id)}">删除记录</button></div></article>`).join('')}</div>` : `<p class="empty">暂无${esc(schemas[type].title)}。请填写真实资料，系统不会预填经营关系。</p>`; }
function section(type) { return `<div class="section-head"><h2>${esc(schemas[type].title)}</h2><button data-export="${type}">导出 CSV</button></div>${form(type)}${list(type)}`; }
function scheduleTable(parts) { return parts.length ? `<div class="table-wrap"><table><thead><tr>${['事项 / 往来方', '方向', '币种', '分期', '应收 / 应付', '实收 / 实付', '剩余', '到期', '进度'].map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${parts.map(p => `<tr><td class="wrap">${esc(p.title)}<br><small>${esc(p.counterparty)}</small></td><td>${labels[p.direction]}</td><td>${p.currency}</td><td>${esc(p.label)}</td><td>${M.moneyText(p.amountMinor)}</td><td>${M.moneyText(p.paidMinor)}</td><td>${M.moneyText(p.remainingMinor)}</td><td>${p.due}</td><td class="${p.status === 'overdue' ? 'overdue' : ''}">${labels[p.status]}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">尚未登记分期收支。</p>'; }
function overview() { const data = M.summary(state); return `<h2>经营总览</h2><p class="hint">金额来自已登记事项及到账流水，未包含未登记业务；各币种独立显示，不换汇、不自动算税。</p><div class="metrics">${Object.entries(data.byCurrency).map(([currency, x]) => `<article class="metric"><small>${currency} · 实收减实付</small><strong>${M.moneyText(x.receivedMinor - x.paidMinor)}</strong><p>待收 ${M.moneyText(x.receivableMinor)} · 待付 ${M.moneyText(x.payableMinor)}</p><small>实收 ${M.moneyText(x.receivedMinor)} / 实付 ${M.moneyText(x.paidMinor)}</small></article>`).join('') || '<p class="empty">从创建经营主体、登记一笔应收 / 应付开始。</p>'}</div><div class="section-head"><h2>逾期款项 · ${data.overdue.length}</h2><button data-export="entries">导出回款表 CSV</button></div>${scheduleTable(data.overdue)}<div class="panel"><h2>税务待办 · ${data.taxDue.length}</h2>${data.taxDue.map(t => `<p class="${t.overdue ? 'overdue' : ''}">${esc(entityName(t.entityId))} · ${esc(t.title)} · ${t.deadline} · ${labels[t.status]}${t.overdue ? ' · 已过登记期限' : ''}</p>`).join('') || '<p class="muted">暂无待办。系统没有联网查询税务状态。</p>'}<h3>30 天内权利到期 · ${data.brandsExpiring.length}</h3>${data.brandsExpiring.map(b => `<p>${esc(b.name)} · ${b.end}</p>`).join('') || '<p class="muted">暂无已登记的临近到期权利。</p>'}</div>`; }
function render() {
  $('#tabs').innerHTML = Object.entries(TABS).map(([key, value]) => `<button data-tab="${key}" class="${state.tab === key ? 'active' : ''}" aria-current="${state.tab === key ? 'page' : 'false'}">${value}</button>`).join('');
  const tab = state.tab;
  $('#content').innerHTML = tab === 'overview' ? overview() : tab === 'entities' ? section('entities') + section('relations') : tab === 'entries' ? scheduleTable(M.installments(state)) + section('entries') + section('payments') : tab === 'assets' ? section('assets') + section('assetEvents') : tab === 'brands' ? section('brands') + section('skus') + '<div class="row"><button data-export="stock">导出库存表 CSV</button></div>' + section('moves') + section('channels') : section(tab);
  if (tab === 'overview') { const expired = M.summary(state).brandsExpired; if (expired.length) $('#content').insertAdjacentHTML('beforeend', `<div class="panel overdue"><h2>已过登记权利期限 · ${expired.length}</h2>${expired.map(b => `<p>${esc(b.name)} · ${b.end} · 请核对续期或停止使用安排</p>`).join('')}</div>`); }
}
function capture(form) { const type = form.dataset.form, values = {}; for (const input of form.querySelectorAll('input,select,textarea')) if (input.name && input.type !== 'file') values[input.name] = input.value; state.drafts[type] = values; }
function editDraft(type, record) { const result = Object.fromEntries(Object.entries(record).filter(([, v]) => ['string', 'number'].includes(typeof v)).map(([k, v]) => [k, String(v)])); if ('amountMinor' in record) result.amount = record.amountMinor === null ? '' : M.moneyText(record.amountMinor); if ('costMinor' in record) result.cost = M.moneyText(record.costMinor); if ('priceMinor' in record) result.price = M.moneyText(record.priceMinor); if (record.installments) result.schedule = record.installments.map(p => `${p.label} | ${M.moneyText(p.amountMinor)} | ${p.due}`).join('\n'); return result; }
function fromForm(type, values, original, addedFiles) {
  const r = { ...values, id: values.id || uid(), note: values.note || '', files: [...(original?.files || []), ...addedFiles] };
  delete r.attachments;
  if (['entries', 'payments', 'vouchers'].includes(type)) r.amountMinor = M.parseMoney(values.amount);
  if (type === 'entries') {
    const lines = (values.schedule || '').split(/\r?\n/).filter(x => x.trim());
    r.installments = lines.length ? lines.map((line, index) => { const parts = line.split('|').map(s => s.trim()); if (parts.length !== 3) throw Error('每期请按“名称 | 金额 | YYYY-MM-DD”填写'); return { id: original?.installments[index]?.id || uid(), label: parts[0], amountMinor: M.parseMoney(parts[1]), due: M.date(parts[2]) }; }) : [{ id: original?.installments[0]?.id || uid(), label: '单期', amountMinor: r.amountMinor, due: M.date(values.due) }];
  }
  if (type === 'assets') r.costMinor = M.parseMoney(values.cost);
  if (type === 'taxes') r.amountMinor = values.amount ? M.parseMoney(values.amount) : null;
  if (type === 'skus') r.priceMinor = M.parseMoney(values.price);
  if (type === 'moves') { if (!/^\d+$/.test(values.quantity)) throw Error('库存数量请填写非负整数'); r.quantity = Number(values.quantity); }
  return r;
}
async function checkBundle(bundle) {
  if (bundle.key !== KEY) throw Error('请选择工作室经营模块的备份');
  const checked = await ActorStore.validateBundle(bundle, { validate: M.validate });
  const files = new Map(checked.files.map(file => [file.id, file]));
  for (const ref of M.references(checked.state)) { const file = files.get(ref.id); if (!file || ['name', 'type', 'size', 'sha256'].some(key => file[key] !== ref[key])) throw Error('备份缺少匹配原件：' + ref.name); }
  return checked;
}
document.addEventListener('input', event => { const form = event.target.closest('form[data-form]'); if (!form || event.target.type === 'file') return; capture(form); mark(); });
document.addEventListener('change', event => { const form = event.target.closest('form[data-form]'); if (!form) return; if (event.target.name === 'entryId' && form.dataset.form === 'payments') { const select = form.elements.installmentId; select.innerHTML = '<option value="">请选择分期</option>' + optionsFor('installments', { entryId: event.target.value }).map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join(''); capture(form); mark(); } });
document.addEventListener('submit', event => { const form = event.target.closest('form[data-form]'); if (!form) return; event.preventDefault(); run(async () => { capture(form); mark(); const type = form.dataset.form, values = clone(state.drafts[type]), original = state[type].find(r => r.id === values.id), files = [];
  // Validate scalar fields before storing potentially large originals.
  const proposed = fromForm(type, values, original, []); if (!(type === 'taxes' && proposed.status === 'paid' && !original?.files?.length)) M.replaceRecord(state, type, proposed);
  for (const file of form.querySelector('[type=file]')?.files || []) { status('正在保存原件：' + file.name); files.push(await ActorStore.putFile(file, KEY)); }
  const next = M.replaceRecord(state, type, fromForm(type, values, original, files)); delete next.drafts[type]; await commit(next); render();
}); });
document.addEventListener('click', event => { const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.tab) return run(async () => { if (selectedFiles()) throw Error('请先登记或清空待上传原件'); await flush(); const next = clone(state); next.tab = button.dataset.tab; await commit(next); render(); });
  if (button.dataset.edit) return run(async () => { if (selectedFiles()) throw Error('请先登记或清空待上传原件'); const type = button.dataset.edit, record = state[type].find(r => r.id === button.dataset.id); const next = clone(state); next.drafts[type] = editDraft(type, record); await commit(next); render(); const details = $('#form-' + type); details.open = true; details.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  if (button.dataset.cancel) return run(async () => { const next = clone(state); delete next.drafts[button.dataset.cancel]; await commit(next); render(); });
  if (button.dataset.delete) return run(async () => { if (!confirm('删除这条记录？有关联记录时会阻止删除；附件原件不会物理删除。')) return; const next = M.deleteRecord(state, button.dataset.delete, button.dataset.id); if (next.drafts[button.dataset.delete]?.id === button.dataset.id) delete next.drafts[button.dataset.delete]; await commit(next); render(); });
  if (button.dataset.removeFile) return run(async () => { const r = clone(state[button.dataset.type].find(r => r.id === button.dataset.id)); r.files = r.files.filter(f => f.id !== button.dataset.removeFile); await commit(M.replaceRecord(state, button.dataset.type, r)); render(); });
  if (button.dataset.download) return run(async () => { const ref = M.references(state).find(f => f.id === button.dataset.download); const blob = await ActorStore.getFile(ref.id); ActorStore.download(ref.name, blob, ref.type); });
  if (button.dataset.export) return run(async () => { await flush(); ActorStore.download('工作室经营-' + button.dataset.export + '-' + M.localDate() + '.csv', M.exportRows(state, button.dataset.export), 'text/csv;charset=utf-8'); status('CSV 已生成 · 请保管经营资料'); });
});
$('#save').addEventListener('click', () => run(flush));
$('#reload').addEventListener('click', () => run(async () => { if (selectedFiles() || dirty) { if (!confirm('重新读取会放弃本页未保存的修改，继续吗？')) return; } clearTimeout(timer); state = M.validate(await client.reload()); dirty = false; render(); status('已重新读取'); }));
$('#backup').addEventListener('click', () => run(async () => { await flush(); const bundle = await checkBundle(await ActorStore.exportBundle({ scope: KEY, state })); ActorStore.download('工作室经营-完整备份-' + M.localDate() + '.json', JSON.stringify(bundle), 'application/json'); status('完整备份已生成 · 含原件'); }));
$('#restore').addEventListener('change', event => { const file = event.target.files[0]; if (!file) return; run(async () => { if (file.size > 230 * 1024 * 1024) throw Error('备份文件过大'); let bundle; try { bundle = JSON.parse(await file.text()); } catch { throw Error('备份不是有效 JSON'); } const checked = await checkBundle(bundle); if (!confirm('原件校验通过。恢复会替换当前经营台账；建议先下载当前完整备份。继续？')) return; await flush(); state = M.validate(await ActorStore.restoreBundle(checked, { client, validate: M.validate })); dirty = false; render(); status('经营资料与原件已恢复'); }).finally(() => { event.target.value = ''; }); });
window.addEventListener('beforeunload', event => { if (dirty || busy || selectedFiles()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('message', event => { if (event.origin !== location.origin || event.source !== parent) return; if (event.data?.type === 'actor:theme' && ['tide', 'butter', 'moss'].includes(event.data.theme)) document.documentElement.dataset.theme = event.data.theme; });
try {
  if (!window.ActorStore) throw Error('工作台连接未就绪，请从主工作台打开经营模块');
  const context = await ActorStore.context(); if (!context.businessProjectId) throw Error('当前账号不能访问经营资料；请由工作室管理员打开');
  document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') || context.theme || 'tide'; document.body.classList.toggle('embedded', new URLSearchParams(location.search).get('embedded') === '1');
  client = await ActorStore.open(KEY, M.fresh, M.validate); state = M.validate(client.state); render(); status('已连接 · 经营私有资料');
} catch (error) { fail(error); $('#content').innerHTML = '<p class="empty">经营资料尚未打开。请确认主工作台已登录，并由工作室管理员进入；本页没有使用空白状态覆盖原数据。</p>'; document.querySelectorAll('button,input').forEach(e => e.disabled = true); }
