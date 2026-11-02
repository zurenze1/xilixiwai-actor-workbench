import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.mjs';
import {Store,hash} from '../modules/creator-workbench/server/store.mjs';
import {config} from '../modules/creator-workbench/server/config.mjs';
import {createBackup,inspectBackup,restoreInspected} from '../modules/creator-workbench/server/backup.mjs';
import {ingestDaily} from '../modules/creator-workbench/server/discovery.mjs';
import {collectNewsImage} from '../modules/creator-workbench/server/discovery-media.mjs';
import {copyCreatorContent} from '../../scripts/copy-creator-content.mjs';
test('IP模块：保存、跨IP隔离、图片上传、版本导出、来源校验和重启',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ip-creator-'));let app,origin,csrf,pid,tid;
 const start=async()=>{app=await createApp({dataDir:dir,baseURL:origin||'http://127.0.0.1:4949',profile:'ip'});const addr=await app.listen(origin?Number(new URL(origin).port):4949);origin='http://127.0.0.1:'+addr.port;};
 const outer=async(path,body)=>{const r=await fetch(origin+'/api/p/'+path,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,await r.clone().text());return r.json();};
 const call=async(path,body,method=body?'POST':'GET',project=pid)=>{const r=await fetch(origin+'/api/p/projects/'+project+'/creator/app/api'+path,{method,headers:{origin,'content-type':'application/json','x-workbench-csrf':csrf||''},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(r.status+':'+await r.text());return r.json();};
 try{
  await start();pid=(await outer('projects'))[0].id;const other=await outer('projects',{title:'第二隔离IP'});let boot=await call('/bootstrap');csrf=boot.csrf;assert.equal(boot.executionDesk,true);
  const page=await fetch(origin+'/api/p/projects/'+pid+'/creator/app/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'self'/);assert.match(await page.text(),/app.js/);
  const foreign=await fetch(origin+'/api/p/projects/'+pid+'/creator/app/api/topics',{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:'{}'});assert.equal(foreign.status,403);
  const t=await call('/topics',{title:'隔离分镜，不是真实作品'});tid=t.id;await assert.rejects(call('/topics/'+tid,undefined,'GET',other.id),/404/);
  const capture=await call('/capture',{mode:'text',title:'隔离原文',text:'这句是测试原文。',url:'https://example.org/original',topicId:tid});const v=capture.items[0].versionId,s=capture.items[0].sourceId;
  const e=await call('/sources/'+s+'/evidence',{versionId:v,text:'这句是测试原文。',nature:'逐字原话'});
  await call('/topics/'+tid+'/script',{draft:{title:'隔离执行表',openQuestions:'',segments:[{id:'one',narration:'这句是测试原文。',heading:'第一镜',shot:'合成画面要求',subtitle:'合成字幕',startSec:0,endSec:5,evidenceIds:[e.id],executionState:'待素材'}]}},'PUT');
  const snap=await call('/topics/'+tid+'/versions',{label:'固定验收版'});const csv=await fetch(origin+'/api/p/projects/'+pid+'/creator/app/api/versions/'+snap.id+'/export?format=csv');assert.equal(csv.status,200);assert.match(await csv.text(),/这句是测试原文/);
  const bytes=await readFile(new URL('./fixtures/synthetic-photo.png',import.meta.url)),fd=new FormData();fd.append('file',new Blob([bytes],{type:'image/png'}),'synthetic.png');const upload=await fetch(origin+'/api/p/projects/'+pid+'/creator/app/api/upload?topicId='+tid,{method:'POST',headers:{origin,'x-workbench-csrf':csrf},body:fd});assert.equal(upload.status,200);const blob=await upload.json();assert.equal(blob.hash,hash(bytes));assert.deepEqual(Buffer.from(await(await fetch(origin+'/api/p/projects/'+pid+'/creator/app/api/blobs/'+blob.hash)).arrayBuffer()),bytes);
  const ranged=await fetch(origin+'/api/p/projects/'+pid+'/creator/app/api/blobs/'+blob.hash,{headers:{range:'bytes=0-3'}});assert.equal(ranged.status,206);assert.deepEqual(Buffer.from(await ranged.arrayBuffer()),bytes.subarray(0,4));
  await app.close();await start();boot=await call('/bootstrap');csrf=boot.csrf;const saved=await call('/topics/'+tid);assert.equal(saved.script.draft.segments[0].endSec,5);assert.equal(saved.script.versions[0].id,snap.id);assert.equal(boot.services.model.enabled,false);
 }finally{await app?.close();await rm(dir,{recursive:true,force:true});}
},{timeout:30000});
test('历史副本：原图/原文/原件及日报备份恢复到实际字节，不覆盖源与已有目标',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ip-copy-')),source=join(dir,'original'),target=join(dir,'copy');const cfg=config(['--data',source]),s=new Store(cfg.db);let copy,restored;
 try{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),article='https://example.org/story',png=await readFile(new URL('./fixtures/synthetic-photo.png',import.meta.url));
  await ingestDaily(s,source,{day:today,generatedAt:new Date().toISOString(),model:'隔离夹具',news:[{channel:'people',person:'合成验收人物',title:'非真实新闻',facts:'仅作测试',readScope:'合成',sources:[{name:'测试源',url:article}]}]});
  const media=await collectNewsImage(s,source,{url:article},{fetcher:async url=>({url,buffer:url===article?Buffer.from('<article>合成原文<img src="/picture.png"></article>'):png,mime:url===article?'text/html':'image/png'})});
  const result=await copyCreatorContent({source,target});assert.equal(result.tables.daily_digests,1);copy=new Store(join(target,'workbench.sqlite'));assert.equal(copy.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(await readFile(join(target,'blobs',media.hash)),png);assert.equal(s.db.prepare('SELECT count(*) n FROM daily_digests').get().n,1);
  await assert.rejects(copyCreatorContent({source,target}),/未覆盖/);
  const b=await createBackup(copy,target),preview=await inspectBackup(join(target,'backups',b.filename),join(dir,'inspect')),r=await restoreInspected(preview,join(dir,'restored'),{confirm:true});restored=new Store(join(r.dataDirectory,'workbench.sqlite'));assert.equal(restored.db.prepare('SELECT count(*) n FROM daily_digests').get().n,1);assert.deepEqual(await readFile(join(r.dataDirectory,'blobs',media.hash)),png);assert.equal(restored.get('discovery.media')[hash(article)].pageHash,media.pageHash);
 }finally{restored?.close();copy?.close();s.close();await rm(dir,{recursive:true,force:true});}
});
