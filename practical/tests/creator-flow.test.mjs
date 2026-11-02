import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {Store,hash} from '../modules/creator-workbench/server/store.mjs';
import {Operations} from '../modules/creator-workbench/server/operations.mjs';
import {Hot} from '../modules/creator-workbench/server/hot.mjs';
import {Analytics} from '../modules/creator-workbench/server/analytics.mjs';
import {Variants} from '../modules/creator-workbench/server/variants.mjs';
import {Create} from '../modules/creator-workbench/server/create.mjs';
import {config} from '../modules/creator-workbench/server/config.mjs';
import {saveBuffer,blobPath} from '../modules/creator-workbench/server/files.mjs';
import {createBackup,inspectBackup,restoreInspected} from '../modules/creator-workbench/server/backup.mjs';

async function setup(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-operations-')),cfg=config(['--data',path.join(root,'data')]),s=new Store(cfg.db),o=new Operations(s,cfg.dir);try{await fn(s,o,cfg.dir,root);}finally{s.close();await fs.rm(root,{recursive:true,force:true});}}
async function content(s,dir,role='自有'){
  const account=s.account({name:role==='自有'?'隔离验收自有IP':'隔离验收授权IP',role}),topic=s.topic({title:'隔离验收内容',account_id:account.id}),raw=Buffer.from('隔离验收原文：保存出处与完整原件。'),blob=await saveBuffer(s,dir,raw,'原始文稿.txt'),source=s.createSource({title:'合成验收资料',url:'https://example.org/isolated-source',rights:'自有'}).source,v=s.addVersion(source.id,{body:raw.toString(),blobHash:blob.hash,filename:blob.name});s.link(topic.id,source.id);const e=s.addEvidence(source.id,{versionId:v.id,text:'保存出处与完整原件',nature:'逐字原话'}),draft={title:topic.title,openQuestions:'隔离验收，不代表真实发布或实际客户意见。',segments:[{id:'p1',heading:'主体',narration:'保存出处与完整原件。',shot:'',subtitle:'',evidenceIds:[e.id]}]};s.saveDraft(topic.id,{draft});const version=s.snapshot(topic.id,'第一版');return {account,topic,source,version,draft,raw,blob};
}
test('完整链：审稿→交付→发布登记→真实格式文件导入→复盘→下一实验，备份恢复保留关系及原件',()=>setup(async(s,o,dir,root)=>{const f=await content(s,dir);o.profile(f.account.id,{revision:0,positioning:'隔离验收定位'});const r=o.requestReview(f.topic.id,{versionId:f.version.id,reviewer:'合成审阅者'});o.decide(r.id,{status:'已确认',origin:'本人审阅',note:'隔离验收，非实际客户意见'});const h=await o.handoff(f.topic.id,{versionId:f.version.id}),p=s.publish(f.topic.id,{versionId:f.version.id,url:'https://example.org/isolated-test',publishedAt:'2026-10-18T09:00:00+08:00'}),a=new Analytics(s),csv='播放量,点赞数\n120,9',blob=await saveBuffer(s,dir,Buffer.from(csv),'合成验收数据.csv');const imported=a.commit({content:csv,format:'csv',filename:blob.name,mapping:{publicationId:p.id,windowHours:24,capturedAt:'2026-10-19T09:00:00+08:00',paid:'无投放',cumulative:true,durationSec:60,columns:{播放量:{metric:'views',scale:'数值'},点赞数:{metric:'likes',scale:'数值'}}}},blob);assert.equal(imported.ok,1);a.review(p.id,{text:'隔离验收复盘：样本不足，不能推断因果。'});const e=a.experiment({publication_id:p.id,variable:'开头信息顺序',change:'下一条先呈现人物选择',expected:'待观察',metric_key:'retention5s',review_window:'发布后24小时'}),next=a.experimentTopic(e.id,{});assert.equal(s.row('topics',next.topic.id).account_id,f.account.id);const b=await createBackup(s,dir),preview=await inspectBackup(path.join(dir,'backups',b.filename),root),restored=await restoreInspected(preview,path.join(root,'restored'),{confirm:true}),read=new Store(path.join(restored.dataDirectory,'workbench.sqlite'));try{const oo=new Operations(read,restored.dataDirectory),data=oo.topic(f.topic.id);assert.equal(data.approved.version_id,f.version.id);assert.equal(data.publications[0].snapshots,1);assert.equal(data.publications[0].reviews,1);assert.equal(data.publications[0].experiments,1);assert.equal(data.handoffs[0].id,h.id);assert.deepEqual(await fs.readFile(blobPath(restored.dataDirectory,f.blob.hash)),f.raw);assert.equal(hash(await fs.readFile(blobPath(restored.dataDirectory,h.blob_hash))),h.blob_hash);assert.equal(read.db.prepare('PRAGMA foreign_key_check').all().length,0);}finally{read.close();}}));
