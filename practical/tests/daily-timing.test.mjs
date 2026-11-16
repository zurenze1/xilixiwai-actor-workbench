import test from 'node:test';
import assert from 'node:assert/strict';
import {briefTiming} from '../modules/creator-workbench/src/daily-timing.mjs';
const item={day:'2026-11-16',generatedAt:'2026-11-16T00:32:45.545Z',scheduleTime:'09:00',uiTimezone:'Asia/Shanghai'};
test('计划09:00不被当成实际推送回执，下午分析明确为后续补充',()=>{const t=briefTiming({...item,editorial:{reviewedAt:'2026-11-16T09:22:00Z'}});assert.equal(t.scheduled,'09:00');assert.equal(t.delivered,null);assert.equal(t.prepared.time,'08:32');assert.equal(t.edited.time,'17:22');assert.equal(t.label,'后续补充分析');});
test('实际09:01交付和17:22补充分别显示，不倒改时间',()=>{const t=briefTiming({...item,delivery:{deliveredAt:'2026-11-16T01:01:41Z'},editorial:{reviewedAt:'2026-11-16T09:22:00Z'}});assert.equal(t.delivered.time,'09:01');assert.equal(t.edited.time,'17:22');assert.equal(t.label,'交付后分析更新');});
test('历史回看保留真实补充时间，不变成历史当日交付',()=>{const t=briefTiming({...item,day:'2026-11-14',editorial:{reviewedAt:'2026-11-16T09:22:00Z',retrospective:true}});assert.equal(t.label,'本次回看分析');assert.equal(t.edited.day,'2026-11-16');});
test('跨时区与无效时间按观测范围处理',()=>{const t=briefTiming({...item,uiTimezone:'America/New_York',editorial:{reviewedAt:'2026-11-16T09:22:00Z'},delivery:{deliveredAt:'bad'}});assert.equal(t.edited.time,'04:22');assert.equal(t.delivered,null);assert.equal(briefTiming(item).edited,null);});
test('没有凭据的日期保持未知，不从资料生成时间推断交付',()=>{const t=briefTiming({...item,generatedAt:'2026-11-16T01:00:00Z'});assert.equal(t.delivered,null);assert.equal(t.prepared.time,'09:00');});
