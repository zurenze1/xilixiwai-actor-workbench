import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../web/business/model.js';

const entity = { id: 'e1', name: '虚构工作室', kind: 'studio' };
const attachment = { id: 'f1', name: '虚构凭据.txt', type: 'text/plain', size: 12, sha256: 'a'.repeat(64) };
function setup() { return M.replaceRecord(M.fresh(), 'entities', entity); }
function entry(overrides = {}) { return { id: 'r1', entityId: 'e1', title: '虚构项目合作', counterparty: '虚构合作方', direction: 'income', currency: 'CNY', amountMinor: 10001, installments: [{ id: 'part1', label: '签约', amountMinor: 4000, due: '2026-10-20' }, { id: 'part2', label: '交付', amountMinor: 6001, due: '2026-11-20' }], ...overrides }; }
function tax(overrides = {}) { return { id: 't1', entityId: 'e1', title: '虚构待确认事项', period: '2026-10', deadline: '2026-11-15', status: 'todo', amountMinor: null, currency: 'CNY', ...overrides }; }

test('money conversion uses exact minor integers and rejects rounding, exponent and overflow', () => {
  assert.equal(M.parseMoney('0.01'), 1); assert.equal(M.parseMoney('100.10'), 10010); assert.equal(M.parseMoney('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  assert.equal(M.moneyText(101), '1.01'); assert.equal(M.moneyText(-101), '-1.01');
  for (const bad of ['0.001', '-1', '1e2', 'Infinity', '90071992547409.92', '1,000', 'abc']) assert.throws(() => M.parseMoney(bad));
});

test('fresh business has no invented entity, revenue, tax rate or private identity', () => {
  const state = M.validate(M.fresh()); for (const key of M.COLLECTIONS) assert.deepEqual(state[key], []);
  assert.deepEqual(M.summary(state, '2026-10-23').byCurrency, {}); assert.equal(Object.hasOwn(state, 'apiKey'), false);
});

test('partial installments update receivable, overdue and totals using only recorded payment', () => {
  let state = M.replaceRecord(setup(), 'entries', entry());
  state = M.replaceRecord(state, 'payments', { id: 'p1', entryId: 'r1', installmentId: 'part1', amountMinor: 1000, date: '2026-10-21' });
  const parts = M.installments(state, '2026-10-23'); assert.equal(parts[0].paidMinor, 1000); assert.equal(parts[0].remainingMinor, 3000); assert.equal(parts[0].status, 'overdue');
  assert.equal(parts[1].status, 'pending'); const summary = M.summary(state, '2026-10-23'); assert.equal(summary.byCurrency.CNY.receivableMinor, 9001); assert.equal(summary.overdue.length, 1);
  state = M.replaceRecord(state, 'payments', { id: 'p2', entryId: 'r1', installmentId: 'part1', amountMinor: 3000, date: '2026-10-22' });
  assert.equal(M.installments(state, '2026-10-23')[0].status, 'settled');
});

test('different currencies and income/expense never silently combine or convert', () => {
  let state = M.replaceRecord(setup(), 'entries', entry());
  state = M.replaceRecord(state, 'entries', entry({ id: 'usd', currency: 'USD', amountMinor: 2500, installments: [{ id: 'us1', label: '单期', amountMinor: 2500, due: '2026-10-25' }] }));
  state = M.replaceRecord(state, 'entries', entry({ id: 'expense', direction: 'expense', amountMinor: 1000, installments: [{ id: 'xp1', label: '单期', amountMinor: 1000, due: '2026-10-25' }] }));
  const sum = M.summary(state, '2026-10-23').byCurrency; assert.equal(sum.CNY.incomeMinor, 10001); assert.equal(sum.CNY.payableMinor, 1000); assert.equal(sum.USD.incomeMinor, 2500); assert.equal(Object.keys(sum).length, 2);
});

test('unbalanced installments, overpayments, missing parent and unsafe total are rejected', () => {
  const initial = setup(); assert.throws(() => M.replaceRecord(initial, 'entries', entry({ amountMinor: 10000 })), /合计/);
  const state = M.replaceRecord(initial, 'entries', entry());
  assert.throws(() => M.replaceRecord(state, 'payments', { id: 'p1', entryId: 'r1', installmentId: 'part1', amountMinor: 4001, date: '2026-10-21' }), /超过/);
  assert.throws(() => M.deleteRecord(state, 'entities', 'e1'), /引用/);
  assert.throws(() => M.replaceRecord(state, 'payments', { id: 'p1', entryId: 'r1', installmentId: 'absent', amountMinor: 1, date: '2026-10-21' }), /分期不存在/);
  const huge = entry({ id: 'huge', amountMinor: Number.MAX_SAFE_INTEGER, installments: [{ id: 'big', label: '大额', amountMinor: Number.MAX_SAFE_INTEGER, due: '2026-12-01' }] });
  assert.throws(() => M.replaceRecord(state, 'entries', huge), /安全范围/);
});

test('asset checkout, return, maintenance and inventory record actual custody', () => {
  let state = M.replaceRecord(setup(), 'assets', { id: 'a1', entityId: 'e1', name: '虚构摄影灯', currency: 'CNY', costMinor: 10000, location: '器材架' });
  const event = (id, type, date) => ({ id, assetId: 'a1', type, date, person: '虚构经手人' });
  state = M.replaceRecord(state, 'assetEvents', event('x1', 'checkout', '2026-10-21')); assert.equal(M.assetStatus(state, 'a1').status, 'loaned');
  assert.throws(() => M.replaceRecord(state, 'assetEvents', event('x2', 'checkout', '2026-10-22')), /归还/);
  assert.throws(() => M.replaceRecord(state, 'assetEvents', event('x2', 'dispose', '2026-10-22')), /归还/);
  state = M.replaceRecord(state, 'assetEvents', event('x2', 'return', '2026-10-22'));
  state = M.replaceRecord(state, 'assetEvents', { ...event('x3', 'inventory', '2026-10-23'), location: '器材柜' });
  const status = M.assetStatus(state, 'a1'); assert.equal(status.status, 'available'); assert.equal(status.location, '器材柜'); assert.equal(status.lastInventory, '2026-10-23');
  assert.throws(() => M.replaceRecord(state, 'assetEvents', event('x4', 'inventory', '2026-10-19')), /日期顺序/);
});

test('tax workflow cannot fabricate accountant confirmation or paid receipt', () => {
  let state = M.replaceRecord(setup(), 'taxes', tax()); assert.equal(state.taxes[0].amountMinor, null);
  assert.throws(() => M.replaceRecord(state, 'taxes', tax({ status: 'confirmed' })), /会计/);
  state = M.replaceRecord(state, 'taxes', tax({ status: 'confirmed', accountant: '虚构会计', confirmedAt: '2026-10-23' }));
  assert.throws(() => M.replaceRecord(state, 'taxes', { ...state.taxes[0], status: 'paid', filedAt: '2026-10-23', paidAt: '2026-10-23', amountMinor: 1000 }), /凭证/);
  state = M.replaceRecord(state, 'taxes', { ...state.taxes[0], status: 'paid', filedAt: '2026-10-23', paidAt: '2026-10-23', amountMinor: 1000, files: [attachment] });
  assert.equal(M.summary(state, '2026-10-23').taxDue.length, 0); assert.equal(M.references(state).length, 1);
});

test('SKU stock changes and physical counts are traceable and cannot go negative', () => {
  let state = M.replaceRecord(setup(), 'brands', { id: 'b1', entityId: 'e1', name: '虚构品牌', rightsType: 'trademark' });
  state = M.replaceRecord(state, 'skus', { id: 's1', brandId: 'b1', code: 'SKU-001', name: '虚构文具', unit: '件', currency: 'CNY', priceMinor: 1000 });
  const move = (id, type, quantity) => ({ id, skuId: 's1', type, quantity, date: '2026-10-23', person: '虚构经手人' });
  state = M.replaceRecord(state, 'moves', move('m1', 'in', 10)); state = M.replaceRecord(state, 'moves', move('m2', 'out', 3)); assert.equal(M.stock(state, 's1'), 7);
  assert.throws(() => M.replaceRecord(state, 'moves', move('m3', 'out', 8)), /超过现有库存/);
  state = M.replaceRecord(state, 'moves', move('m3', 'count', 6)); assert.equal(M.stock(state, 's1'), 6);
  assert.throws(() => M.replaceRecord(state, 'skus', { ...state.skus[0], id: 'duplicate' }), /SKU 编码/);
  assert.throws(() => M.deleteRecord(state, 'brands', 'b1'), /引用/);
});

test('dates and relations are factual input only, nonexistent dates and self-relations fail', () => {
  assert.throws(() => M.date('2026-02-30')); assert.equal(M.date('2028-02-29'), '2028-02-29');
  let state = M.replaceRecord(setup(), 'entities', { id: 'e2', name: '虚构合作主体', kind: 'company' });
  state = M.replaceRecord(state, 'relations', { id: 'rel1', fromId: 'e1', toId: 'e2', type: 'contract' }); assert.equal(state.relations.length, 1);
  assert.throws(() => M.replaceRecord(state, 'relations', { id: 'rel2', fromId: 'e1', toId: 'e1', type: 'contract' }), /不能相同/);
});

test('CSV quoting, UTF-8 BOM and formula defense preserve visible content without secrets', () => {
  const result = M.csv(['名称', '值'], [['=HYPERLINK("x")', 'a,b\n"c"'], ['  @cmd', 3]]);
  assert.ok(result.startsWith('\uFEFF')); assert.match(result, /'═?=HYPERLINK/); assert.match(result, /"a,b\n""c"""/); assert.match(result, /'  @cmd/);
  const state = M.replaceRecord(setup(), 'entries', entry()); const csv = M.exportRows(state, 'entries', '2026-10-23'); assert.ok(csv.includes('40.00')); assert.ok(csv.includes('60.01')); assert.ok(!csv.includes('apiKey'));
});

test('bad import and referenced deletes leave source state intact; drafts are retained', () => {
  const state = M.replaceRecord(setup(), 'entries', entry()), before = structuredClone(state);
  assert.throws(() => M.deleteRecord(state, 'entities', 'e1')); assert.deepEqual(state, before);
  assert.throws(() => M.validate({ ...state, assets: null })); assert.deepEqual(state, before);
  const next = M.validate({ ...state, drafts: { taxes: { title: '未提交的事项', amount: '12.01' } } }); assert.equal(next.drafts.taxes.amount, '12.01');
  assert.equal(next.taxes.length, 0);
});

test('expired rights are distinct from future expiry and extra credential fields are excluded', () => {
  let state = M.replaceRecord(setup(), 'brands', { id: 'expired', entityId: 'e1', name: '虚构旧授权', rightsType: 'license', end: '2026-10-01' });
  state = M.replaceRecord(state, 'brands', { id: 'next', entityId: 'e1', name: '虚构待续期授权', rightsType: 'license', end: '2026-11-01' });
  const data = M.summary(state, '2026-10-23'); assert.deepEqual(data.brandsExpired.map(x => x.id), ['expired']); assert.deepEqual(data.brandsExpiring.map(x => x.id), ['next']);
  const checked = M.validate({ ...state, apiKey: 'synthetic-not-a-key', bankPassword: 'synthetic-password' });
  assert.equal(Object.hasOwn(checked, 'apiKey'), false); assert.equal(Object.hasOwn(checked, 'bankPassword'), false);
});
