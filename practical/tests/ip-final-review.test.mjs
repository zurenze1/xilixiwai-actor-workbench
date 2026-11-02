import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.mjs';
import {FINAL_GROUPS,FINAL_COUNT,emptyChecks,checkProgress} from '../web/ip/final-review.js';
import {parseRulebook,scanContent} from '../web/ip/content-risk.js';

const fixture=`# 高风险词与表达分类库
## 效果担保
| 检索词 / 表达线索 | 何时有风险 | 最小处理与例外 |
| --- | --- | --- |
| 百分百有效、100%成功 | 商业推广中保证效果 | 核证据和适用条件 |
依据与适用范围：[[S01] 抖音社区公约](https://example.test/douyin)；[[S04] 小红书审核规范](https://example.test/xhs)
# 抖音专项：商品
- 检查挂车商品与宣传一致。
# 小红书专项：合作
- 合作笔记与投流审核分开。
`;
test('Source conditions and separate platform guidance survive parsing without banning ordinary narration',()=>{
 const book=parseRulebook(fixture);assert.equal(book.rules.length,1);assert.equal(book.rules[0].sources.length,2);
 const bad=scanContent([{key:'script',label:'正文',text:'本课程百分百有效。'}],book,'小红书');
 assert.equal(bad.hits[0].index,3);assert.equal(bad.hits[0].condition,'商业推广中保证效果');
 assert.match(bad.guides[0],/合作笔记/);assert.match(scanContent([],book,'抖音').guides[0],/挂车/);
 assert.equal(scanContent([{key:'script',text:'第一次夺冠，100%棉，介绍ChatGPT。'}],book,'抖音').hits.length,0);
 assert.throws(()=>scanContent([],book,'其他'),/请选择/);
 assert.deepEqual(FINAL_GROUPS.map(g=>g.items.length),[4,5,5]);assert.equal(FINAL_COUNT,14);assert.equal(checkProgress(emptyChecks()).complete,false);
});
test('Each cut retains its own checks across restart and backup; replacing a cut cannot carry approvals',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ip-final-review-'));let app=await createApp({dataDir:dir,baseURL:'http://127.0.0.1:49396',profile:'ip'});
 await app.listen(49396);const origin='http://127.0.0.1:49396';let studio='';
 const request=async(path,method='GET',body)=>{const r=await fetch(origin+'/api/p/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json','x-studio-id':studio},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():new Uint8Array(await r.arrayBuffer())};};
 const ok=async(...args)=>{const r=await request(...args);assert.ok(r.status<300,JSON.stringify(r));return r.data;};
 try{
  const ctx=await ok('context');studio=ctx.studioId;const p=(await ok('projects'))[0],base='projects/'+p.id+'/records';
  const body={cutVersion:'隔离测试-v1.mp4',checks:emptyChecks(),notes:'虚构验收，不是用户真实作品'};
  let first=await ok(base,'POST',{kind:'ip-finalcheck',title:'隔离测试成片',body});
  const second=await ok(base,'POST',{kind:'ip-finalcheck',title:'另一条虚构作品',body:{...body,cutVersion:'另一条-v1.mp4'}});
  first=await ok(base+'/'+first.id,'PATCH',{revision:first.revision,body:{...first.body,checks:'1'.repeat(14)}});
  assert.equal((await request(base+'/'+first.id,'PATCH',{revision:first.revision,body:{...first.body,cutVersion:'v2.mp4'}})).status,400);
  assert.equal((await request(base,'POST',{kind:'ip-finalcheck',title:'残缺状态',body:{...body,checks:'1'}})).status,400);
  assert.equal((await ok(base)).find(r=>r.id===second.id).body.checks,emptyChecks());
  const zip=await ok('projects/'+p.id+'/export'),restored=await ok('ip-import','POST',{data:Buffer.from(zip).toString('base64')});
  const copied=await ok('projects/'+restored.id+'/records');assert.equal(copied.length,2);assert.equal(copied.find(r=>r.title===first.title).body.checks,'1'.repeat(14));
  await app.close();app=await createApp({dataDir:dir,baseURL:origin,profile:'ip'});await app.listen(49396);
  assert.equal((await ok(base)).find(r=>r.id===first.id).body.checks,'1'.repeat(14));
  first=await ok(base+'/'+first.id,'PATCH',{revision:first.revision,body:{...first.body,cutVersion:'v2.mp4',checks:emptyChecks()}});
  assert.equal(first.body.checks,emptyChecks());
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
