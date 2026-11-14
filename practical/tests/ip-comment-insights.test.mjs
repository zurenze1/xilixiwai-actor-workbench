import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDatabase} from '../server/database.mjs';
import {publishInsights,prepareInsights} from '../../scripts/workbench-comment-insights.mjs';
import {commentInsightPanel,commentInsightsPage,commentReports} from '../web/ip/comment-insights.mjs';
const sample={date:'2026-11-14',summary:'观众问题',content:'原话与待核事项',candidates:[{title:'测试选题',audience:'观众',question:'为什么？',angle:'核对资料',evidence:'原话 / 点赞 / 作品',needsVerification:'尚需核对原始材料'}]};
test('imports stay within one project; retries retain edits and archives',()=>{
 const dir=mkdtempSync(join(tmpdir(),'comment-insights-')),store=createDatabase(dir,'test-only-secret');
 try{const studio=store.ensureStudio({id:'u',name:'测试',email:'test@example.invalid'})[0].id;
 for(const pid of ['a','b'])store.run('INSERT INTO projects VALUES(?,?,?,?,?,?,?,?,?,?,?)',pid,studio,pid,'',0,1,'{}',0,'u',new Date().toISOString(),new Date().toISOString());
 const c={pid:'a',studio,user:'u',input:sample},first=publishInsights(store,c);assert.equal(first.filter(r=>r.created).length,2);assert.equal(store.listRecords('b',studio,'u').length,0);
 const old=store.record(first[0].id,'a',studio,'u');store.saveRecord({rid:old.id,pid:'a',studio,user:'u',kind:old.kind,title:'本人改过的标题',body:{...old.body,summary:'本人改过的正文',archived:true},visibility:old.visibility,revision:old.revision});
 assert.equal(publishInsights(store,c).filter(r=>r.created).length,0);const retained=store.record(old.id,'a',studio,'u');assert.equal(retained.title,'本人改过的标题');assert.equal(retained.body.summary,'本人改过的正文');assert.equal(retained.body.archived,true);
 const topic=store.listRecords('a',studio,'u','ip-topic')[0];assert.equal(topic.body.status,'待讨论');assert.equal(topic.visibility,'private');
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('home and topic page use current project records, escape text, and exclude archives',()=>{
 const records=prepareInsights({...sample,summary:'<script>bad</script>'}).map((r,i)=>({...r,id:String(i),created_at:'2026-11-14'}));
 assert.equal(commentReports(records).length,1);const html=commentInsightPanel(records);assert.ok(html.includes('href="#radar~comments"'));assert.ok(html.includes('href="#topics~insights"'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(commentInsightsPage(records).includes('待讨论'));assert.ok(!commentInsightsPage(records).includes('data-action="edit"'));assert.ok(commentInsightsPage(records,{writable:true}).includes('data-action="edit"'));
 records[0].body.archived=true;assert.equal(commentReports(records).length,0);assert.ok(!commentInsightPanel(records).includes('阅读最新解读'));
 assert.throws(()=>prepareInsights({...sample,date:'2026-02-30'}));assert.throws(()=>prepareInsights({...sample,sourceUrl:'javascript:alert(1)'}));
});
