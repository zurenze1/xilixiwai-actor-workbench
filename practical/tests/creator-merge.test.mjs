import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store,hash} from '../modules/creator-workbench/server/store.mjs';
import {mergeCreatorContent} from '../../scripts/merge-creator-content.mjs';
import {creatorRoute} from '../web/ip/creator-navigation.mjs';
test('整合页签只接受所在板块的工具，旧入口和未知片段有稳定回退',()=>{
 const routes=['today','library','topics','replies','content','execution','radar','operations'];
 assert.deepEqual(creatorRoute('#operations~review',routes),{route:'operations',page:'review'});
 assert.deepEqual(creatorRoute('#library~transcripts',routes),{route:'library',page:'transcripts'});
 assert.deepEqual(creatorRoute('#topics~comments',routes),{route:'radar',page:'comments'});
 assert.deepEqual(creatorRoute('#replies',routes),{route:'replies',page:'comment-inbox'});
 assert.deepEqual(creatorRoute('#radar~comments',routes),{route:'radar',page:'comments'});
 assert.deepEqual(creatorRoute('#execution',routes),{route:'execution',page:'edit-plan'});
 assert.deepEqual(creatorRoute('#content~javascript:alert(1)',routes),{route:'content',page:''});
 assert.deepEqual(creatorRoute('#unknown~assets',routes),{route:'today',page:''});
});
test('合并保留历史与目标行、拒绝内容冲突、重复执行不重复、损坏原件不入库',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creator-merge-')),source=join(root,'source'),target=join(root,'target');let s,d;
 try{
  await mkdir(source);await mkdir(target);s=new Store(join(source,'workbench.sqlite'));d=new Store(join(target,'workbench.sqlite'));
  const a=s.account({name:'虚构账号',role:'自有'}),t=s.topic({title:'虚构合并项目',account_id:a.id});d.topic({title:'保留目标项目'});
  s.set('model',{enabled:true});s.set('studio.conversations',[{text:'虚构历史创作记录'}]);d.set('model',{enabled:false});
  const bytes=Buffer.from('合并夹具原件'),h=hash(bytes);await mkdir(join(source,'blobs'));await writeFile(join(source,'blobs',h),bytes);s.db.prepare('INSERT INTO blobs VALUES(?,?,?,?)').run(h,bytes.length,'text/plain',new Date().toISOString());s.close();d.close();s=d=null;
  const first=await mergeCreatorContent({source,target});assert.equal(first.added.topics,1);assert.equal(first.verifiedFiles,1);assert.equal(first.credentialsCopied,false);
  d=new Store(join(target,'workbench.sqlite'));assert.equal(d.get('model').enabled,false);assert.equal(d.get('studio.conversations')[0].text,'虚构历史创作记录');assert.equal(d.db.prepare('SELECT count(*) n FROM topics').get().n,2);d.close();d=null;
  const repeat=await mergeCreatorContent({source,target});assert.equal(repeat.added.topics,0);assert.equal(repeat.copiedFiles,0);
  s=new Store(join(source,'workbench.sqlite'));s.db.prepare('UPDATE topics SET title=? WHERE id=?').run('冲突稿件',t.id);s.close();s=null;await assert.rejects(mergeCreatorContent({source,target}),/内容冲突/);
  s=new Store(join(source,'workbench.sqlite'));s.db.prepare('UPDATE topics SET title=? WHERE id=?').run('虚构合并项目',t.id);const h2=hash('未完整写入');s.db.prepare('INSERT INTO blobs VALUES(?,?,?,?)').run(h2,100,'text/plain',new Date().toISOString());s.close();s=null;await writeFile(join(source,'blobs',h2),'损坏');await assert.rejects(mergeCreatorContent({source,target}),/字节校验失败/);
  d=new Store(join(target,'workbench.sqlite'));assert.equal(d.db.prepare('SELECT count(*) n FROM blobs').get().n,1);
 }finally{s?.close();d?.close();await rm(root,{recursive:true,force:true});}
});
