import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.mjs';

test('form CSV validates the entire batch, rolls back failed writes and restores historical titles',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'actor-form-')),origin='http://127.0.0.1:4953',app=await createApp({dataDir:dir,baseURL:origin});await app.listen(4953);let cookie='',studio='';
 async function request(path,method='GET',body){const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',cookie,'x-studio-id':studio},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};}
 const ok=async(...args)=>{const r=await request(...args);assert.ok(r.status<300,JSON.stringify(r));return r.data;};
 try{
  await ok('/api/auth/sign-up/email','POST',{name:'虚构表单验收',email:'forms@example.test',password:'Fixture-password-2026!'});studio=(await ok('/api/p/context')).studioId;
  const p=await ok('/api/p/projects','POST',{title:'虚构CSV验收'}),root='/api/p/projects/'+p.id;
  const task=title=>({kind:'task',title,body:{owner:'虚构助理',due:'2026-10-24',status:'待办',notes:'可验收任务'}});
  for(const due of ['2026-02-30','2026-13-01','0000-01-01','2026-10-24T00:00:00Z']){const item=task('bad-date');item.body.due=due;assert.equal((await request(root+'/records','POST',item)).status,400);}
  const bad=task('second');bad.body.status='不在选项';assert.equal((await request(root+'/records-batch','POST',{records:[task('first'),bad],validateOnly:true})).status,400);assert.equal((await request(root+'/records-batch','POST',{records:[task('first'),bad]})).status,400);assert.equal((await ok(root+'/records')).length,0);
  assert.equal((await ok(root+'/records-batch','POST',{records:[task('one'),task('two')],validateOnly:true})).count,2);assert.equal((await ok(root+'/records')).length,0);
  const saved=await ok(root+'/records-batch','POST',{records:[task('one'),task('two')]});assert.equal(saved.records.length,2);
  app.store.db.exec("CREATE TRIGGER fail_form_batch BEFORE INSERT ON records WHEN NEW.title='force-error' BEGIN SELECT RAISE(ABORT,'fixture'); END;");assert.equal((await request(root+'/records-batch','POST',{records:[task('rollback-one'),task('force-error')]})).status,500);assert.equal((await ok(root+'/records')).length,2);app.store.db.exec('DROP TRIGGER fail_form_batch;');
  const r=saved.records[0];await ok(root+'/records/'+r.id,'PATCH',{title:'renamed',body:{...r.body,owner:'第二版负责人'},revision:1});const history=await ok(root+'/records/'+r.id+'/versions');assert.equal(history[0].title,'one');const restored=await ok(root+'/records/'+r.id+'/restore','POST',{version:1,revision:2});assert.equal(restored.title,'one');assert.equal(restored.body.owner,'虚构助理');assert.equal(restored.revision,3);
  const file=await ok(root+'/files','POST',{name:'bad.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',data:Buffer.from('not a zip').toString('base64')});const extracted=await request(root+'/documents','POST',{fileId:file.id});assert.equal(extracted.status,400);assert.match(extracted.data.error,/原件已保留/);assert.equal((await ok(root+'/documents')).length,0);assert.equal((await ok(root+'/files')).length,1);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
