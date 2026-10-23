import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.mjs';
import {emptyBody} from '../web/social/model.js';

test('social HTTP stores related records atomically, enforces shared ACL, revisions and original integrity',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'actor-social-')),origin='http://127.0.0.1:4952';
 const app=await createApp({dataDir:dir,baseURL:origin});await app.listen(4952);
 const client=()=>({cookie:'',studio:'',async request(path,method='GET',body){const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',cookie:this.cookie,'x-studio-id':this.studio},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};},async ok(path,method,body){const r=await this.request(path,method,body);assert.ok(r.status<300,JSON.stringify(r));return r.data;}});
 try{
  const owner=client(),editor=client(),viewer=client();
  for(const [i,c]of [owner,editor,viewer].entries()){await c.ok('/api/auth/sign-up/email','POST',{name:'虚构运营验收'+i,email:`social${i}@example.test`,password:'Fixture-password-2026!'});const ctx=await c.ok('/api/p/context');c.studio=ctx.studioId;}
  const ownerContext=await owner.ok('/api/p/context');editor.studio=owner.studio;assert.equal((await editor.request('/api/p/projects/'+ownerContext.socialProjectId+'/records')).status,403);editor.studio='';
  for(const [i,c,role]of [[1,editor,'editor'],[2,viewer,'viewer']]){const invite=await owner.ok('/api/p/invites','POST',{email:`social${i}@example.test`,role});await c.ok('/api/p/join','POST',{token:new URL(invite.url).searchParams.get('invite')});c.studio=owner.studio;}
  const ctx=await owner.ok('/api/p/context'),pid=ctx.socialProjectId,root='/api/p/projects/'+pid;
  assert.equal((await editor.ok('/api/p/context')).socialProjectId,pid);assert.equal((await viewer.ok('/api/p/context')).socialProjectId,pid);
  const account={...emptyBody('social-account'),id:'account1',name:'虚构验收号',accountKey:'fictional-only'};
  const content={...emptyBody('social-content'),id:'content1',title:'虚构验收短片'};
  const release={...emptyBody('social-release'),id:'release1',accountId:account.id,contentId:content.id,title:'虚构发布',status:'已发布',publishedAt:'2026-10-20T10:00:00+08:00',url:'https://example.com/fictional'};
  const metric={...emptyBody('social-metric'),id:'metric1',releaseId:release.id,asOf:'2026-10-21T10:00:00+08:00',source:{kind:'manual',name:'虚构手工验收',notes:''}};metric.metrics.views=100;
  const item=(kind,body)=>({kind,title:body.title||body.name||body.asOf,body,visibility:'team'});
  const batch=await owner.ok(root+'/social-import','POST',{mode:'upsert',records:[item('social-metric',metric),item('social-release',release),item('social-content',content),item('social-account',account)]});
  assert.equal(batch.records.length,4);assert.equal((await editor.ok(root+'/records')).length,4);assert.equal((await viewer.ok(root+'/records')).length,4);
  assert.equal((await viewer.request(root+'/social-import','POST',{records:[item('social-account',{...account,id:'viewer'})]})).status,403);
  const before=(await owner.ok(root+'/records')).length;
  const bad=await owner.request(root+'/social-import','POST',{records:[item('social-content',{...content,id:'c2'}),item('social-release',{...release,id:'bad',accountId:'missing'})]});assert.equal(bad.status,400);assert.equal((await owner.ok(root+'/records')).length,before);
  assert.equal((await owner.request(root+'/records','POST',item('social-metric',{...metric,id:'duplicate',asOf:'2026-10-21T02:00:00Z'}))).status,400);
  const film=await owner.ok('/api/p/projects','POST',{title:'另一虚构影视项目'});assert.equal((await owner.request('/api/p/projects/'+film.id+'/records','POST',item('social-account',{...account,id:'wrong-space'}))).status,400);
  assert.equal((await owner.ok('/api/p/context')).socialProjectId,pid);
  assert.equal((await owner.request(root+'/records','POST',{...item('social-account',{...account,id:'private'}),visibility:'private'})).status,400);
  const ar=batch.records.find(r=>r.kind==='social-account');const edit=await editor.ok(root+'/records/'+ar.id,'PATCH',{revision:ar.revision,title:ar.title,body:{...ar.body,manager:'虚构编辑'}});assert.equal(edit.revision,2);
  assert.equal((await owner.request(root+'/records/'+ar.id,'PATCH',{revision:1,title:ar.title,body:ar.body})).status,409);
  assert.equal((await owner.request(root+'/records/'+ar.id,'PATCH',{revision:2,title:ar.title,body:{...ar.body,id:'changed'}})).status,400);
  const restored=await owner.ok(root+'/records/'+ar.id+'/restore','POST',{version:1,revision:2});assert.equal(restored.body.manager,'');
  const file=await owner.ok(root+'/files','POST',{name:'虚构来源.csv',type:'text/csv',data:Buffer.from('views\n100').toString('base64')});
  const privateFile=await owner.ok(root+'/files','POST',{name:'私人来源.csv',type:'text/csv',visibility:'private',data:Buffer.from('private').toString('base64')});
  const mr=batch.records.find(r=>r.kind==='social-metric');
  for(const ref of [{...file,sha256:'a'.repeat(64)},privateFile])assert.equal((await owner.request(root+'/records/'+mr.id,'PATCH',{revision:1,title:mr.title,body:{...mr.body,source:{...mr.body.source,file:ref}}})).status,400);
  await owner.ok(root+'/records/'+mr.id,'PATCH',{revision:1,title:mr.title,body:{...mr.body,source:{...mr.body.source,file}}});
  const draft=await owner.ok(root+'/module','POST',{key:'social-v1',state:{filter:'mine'}});assert.equal(draft.visibility,'private');assert.equal((await editor.ok(root+'/records?kind=module')).length,0);
  assert.equal((await owner.request(root+'/records/'+draft.id,'PATCH',{revision:1,title:'social-v1',visibility:'team',body:draft.body})).status,403);
  app.store.db.exec("CREATE TRIGGER test_batch_abort BEFORE INSERT ON records WHEN NEW.title='force-error' BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  const count=(await owner.ok(root+'/records')).length;
  const abort=await owner.request(root+'/social-import','POST',{records:[item('social-content',{...content,id:'roll1'}),{...item('social-content',{...content,id:'roll2'}),title:'force-error'}]});assert.equal(abort.status,500);assert.equal((await owner.ok(root+'/records')).length,count);assert.equal(app.store.get("SELECT COUNT(*) n FROM records WHERE json_extract(body,'$.id')='roll1'").n,0);
  app.store.db.exec('DROP TRIGGER test_batch_abort;');
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
