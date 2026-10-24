import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {validateMain} from '../src/main-schema.js';
const fresh=()=>({operationModes:{},operationSummaries:{},pendingActions:null,settings:false,dance:false});
test('every practical navigation route has one unique reachable demo page',async()=>{
 const source=await readFile(new URL('../practical/web/app.js',import.meta.url),'utf8');
 const expression=/const NAV\s*=\s*(\[[\s\S]*?\]);/.exec(source)?.[1];assert.ok(expression);
 const nav=vm.runInNewContext(expression),context={};vm.runInNewContext(await readFile(new URL('../web/parity-map.js',import.meta.url),'utf8'),context);
 const rows=context.ActorParityMap.routes;assert.equal(rows.length,20);assert.equal(new Set(rows.map(x=>x.route)).size,20);assert.equal(new Set(rows.map(x=>x.page)).size,20);
 assert.deepEqual([...rows.map(x=>x.route)].sort(),[...nav.map(x=>x[0])].sort());
});
test('operation backup rejects impossible task dates and invalid counters before replacement',()=>{
 const valid={...fresh(),operationModes:{script:'materials'},operationSummaries:{script:{active:1,archived:0,actualRevision:3,latest:{title:'第12场',status:'已修改',revision:2}}},pendingActions:{batchId:'report-v2',sourceTitle:'人工核对',actions:[{task:'确认停顿',owner:'团队成员',due:'2026-10-25'}]}};
 assert.equal(validateMain(valid,fresh).pendingActions.actions[0].owner,'团队成员');
 for(const mutate of [s=>s.pendingActions.actions[0].due='2026-02-30',s=>s.pendingActions.actions[0].owner='',s=>s.operationSummaries.script.active=-1,s=>s.operationSummaries.script.actualRevision=1.5,s=>s.operationModes.script='pretend-ai']){const state=structuredClone(valid);mutate(state);assert.throws(()=>validateMain(state,fresh));}
 assert.equal(validateMain({},fresh).pendingActions,null);
});
