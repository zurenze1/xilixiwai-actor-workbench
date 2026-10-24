import test from 'node:test';
import assert from 'node:assert/strict';
import '../practical/web/workspace-ui.js';
import {rowToBody} from '../practical/web/social/importer.js';
const UI=globalThis.ActorWorkspace;
test('practical list has meaningful kind-specific summaries and escaped filter text',()=>{
 assert.match(UI.summary('knowledge',{question:'如何处理剧透',answer:'送审后回复'}),/如何处理剧透.*送审后回复/);
 assert.match(UI.summary('dance',{theme:'寻找与告别',segments:'四段'}),/寻找与告别/);
 const html=UI.list({kind:'knowledge',name:'FAQ',items:[{id:'r1',title:'<script>',visibility:'private',body:{question:'x" onclick="alert(1)',answer:'a'}}],controls:''});
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('data-record-filter'));assert.ok(html.includes('仅本人'));assert.ok(html.includes('&quot; onclick=&quot;'));
});
test('upcoming only includes future/ongoing open records, not historical completed or archived events',()=>{
 const event=(id,status,start,end,archived=false)=>({id,kind:'event',body:{status,start,end,archived}});
 const list=UI.activeEvents([event('old','完成','2000-01-01','2000-01-01'),event('past','已确认','2026-10-20','2026-10-21'),event('ongoing','已确认','2026-10-23','2026-10-25'),event('future','待确认','2026-10-26','2026-10-27'),event('cancel','取消','2026-10-25','2026-10-26'),event('archive','已确认','2026-10-25','2026-10-26',true)],'2026-10-24');
 assert.deepEqual(list.map(r=>r.id),['ongoing','future']);
});
test('calendar respects multi-day records and never creates activities for blank dates',()=>{
 const html=UI.calendar([{id:'event1',kind:'event',title:'有据排练',body:{start:'2026-10-24T23:00',end:'2026-10-25T01:00',status:'已确认'}}],{month:'2026-10',selected:'2026-10-25'});
 assert.equal((html.match(/data-action="calendar-day"/g)||[]).length,31);assert.ok(html.includes('有据排练'));assert.ok(html.includes('data-action="new-event-date" data-date="2026-10-25"'));
 assert.ok(!UI.calendar([],{month:'2026-02',selected:'2026-02-15'}).includes('有据排练'));
 assert.equal((UI.calendar([],{month:'2028-02',selected:'2028-02-15'}).match(/data-action="calendar-day"/g)||[]).length,29);
});
test('CSV source defaults do not crash when importing account/content records without metric source',()=>{
 const account=rowToBody('social-account',{p:'douyin',n:'虚构账号',k:'fixture-account'},{platform:'p',name:'n',accountKey:'k'},{sourceName:'平台原表.csv',sourceNotes:'保留来源'});
 assert.equal(account.name,'虚构账号');assert.equal(account.source,undefined);
 const content=rowToBody('social-content',{t:'虚构选题',c:'剧宣'},{title:'t',category:'c'},{sourceName:'选题.csv'});
 assert.equal(content.title,'虚构选题');
});
