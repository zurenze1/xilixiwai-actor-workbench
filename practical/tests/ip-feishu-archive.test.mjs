import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {feishuService} from '../server/feishu.mjs';
import {archiveName,archiveFilename} from '../web/ip/archive-model.mjs';
import {Store} from '../modules/creator-workbench/server/store.mjs';
test('Cloud bridge preserves last good snapshot, scopes IPs, and retries immutable versions without duplication',async()=>{
 const dir=await mkdtemp(resolve('qa-ip/feishu-')),remote=[],calls=[];let offline=false;
 await mkdir(join(dir,'feishu'));await writeFile(join(dir,'feishu/connection.json'),JSON.stringify({cli:'/test/lark-cli',profile:'fixture',baseToken:'base-fixture',projects:{a:{name:'甲'},b:{name:'乙'}},productionTable:'production',sources:[{name:'策划',tableId:'plans',type:'plans'}]}));
 const store={get:()=>({title:'甲'}),all:(sql)=>sql.includes('record_versions')?[]:[{id:'r1',kind:'ip-content',title:'稿件',body:JSON.stringify({script:'内容',status:'写作中'}),revision:1,created_at:'2026-11-03T00:30:00+08:00',updated_at:'2026-11-03T00:30:00+08:00'}]};
 const runner=async(exe,args,{cwd})=>{calls.push(args);if(offline)throw Error('offline');const action=args[1],table=args[args.indexOf('--table-id')+1];if(action==='+record-list'){
  const output=args[args.indexOf('--output')+1],rows=table==='production'?remote:[{record_id:'1',IP:'甲',名称:'甲策划'},{record_id:'2',IP:'乙',名称:'乙策划'}];
  await writeFile(join(cwd,output),rows.map(r=>JSON.stringify(r)).join('\n'));await writeFile(join(cwd,output.replace(/\.ndjson$/,'.manifest.json')),JSON.stringify({has_more:false}));return {stdout:JSON.stringify({manifest_version:'v1',format:'ndjson'})};
 }if(action==='+record-batch-create'){const rows=JSON.parse(args[args.indexOf('--json')+1]).create_records;remote.push(...rows);return {stdout:JSON.stringify({ok:true,data:{}})};}throw Error('unexpected command');};
 const f=feishuService({dataDir:dir,store,enabled:true,runner});try{
  await f.refresh();const first=await f.state('a');assert.equal(first.sources[0].records.length,1);assert.equal(first.sources[0].records[0].名称,'甲策划');assert.equal(remote.length,2);await f.refresh();assert.equal(remote.length,2);
  assert.equal((await f.state('unknown')).configured,false);assert.equal((await f.state('unknown')).sources[0].records.length,0);
  const second=await f.state('a');offline=true;await assert.rejects(f.refresh());const last=await f.state('a');assert.equal(last.lastSuccess,second.lastSuccess);assert.equal(last.sources[0].records.length,1);assert.ok(last.lastError);assert.ok(!last.lastError.includes('内容'));
 }finally{await f.close();await rm(dir,{recursive:true,force:true});}
});
test('Snapshot content remains fixed after a new draft and archived topic survives reopening',()=>{
 const s=new Store(':memory:');try{const t=s.topic({title:'测试作品'});let draft=s.saveDraft(t.id,{draft:{title:t.title,segments:[{narration:'第一版',shot:'近景'}]}});const v=s.snapshot(t.id,'完成归档');s.topic({...t,stage:'归档'},t.id);
  s.saveDraft(t.id,{revision:draft.revision,draft:{title:t.title,segments:[{narration:'第二版',shot:'远景'}]}});assert.equal(JSON.parse(s.row('script_versions',v.id).payload).draft.segments[0].narration,'第一版');assert.equal(s.row('topics',t.id).stage,'归档');assert.match(archiveName('测试作品',new Date(),v.number),/\d\d\.\d\d 测试作品 V1/);assert.ok(!archiveFilename('A/B',new Date(),2).includes('/'));
 }finally{s.close();}
});

test('HTTP archives a storyboard once, retains fixed content, and creates the next independent project',async()=>{
 const {createApp}=await import('../server/index.mjs'),{createServer}=await import('node:net');
 const dir=await mkdtemp(resolve('qa-ip/archive-http-')),reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const origin='http://127.0.0.1:'+port,app=await createApp({dataDir:dir,baseURL:origin,profile:'ip'});await app.listen(port);
 const request=async(path,body,method=body?'POST':'GET',csrf='')=>{const response=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json','x-workbench-csrf':csrf},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;};
 try{const p=(await request('/api/p/projects'))[0],base='/api/p/projects/'+p.id+'/creator/app/api';const boot=await request(base+'/bootstrap'),csrf=boot.csrf;
  const t=await request(base+'/topics',{title:'隔离测试第一篇',account_id:boot.accounts[0].id,stage:'素材'},'POST',csrf);await request(base+'/topics/'+t.id+'/script',{draft:{title:t.title,segments:[{narration:'原始稿件',shot:'口播中景'}]}},'PUT',csrf);
  const a=await request(base+'/topics/'+t.id+'/archive',{},'POST',csrf),again=await request(base+'/topics/'+t.id+'/archive',{},'POST',csrf);assert.equal(a.version.id,again.version.id);assert.equal(a.topic.stage,'归档');
  const next=await request(base+'/topics',{title:'隔离测试第二篇',account_id:boot.accounts[0].id,stage:'素材'},'POST',csrf);assert.notEqual(next.id,t.id);const fixed=await request(base+'/versions/'+a.version.id);assert.equal(fixed.payload.draft.segments[0].narration,'原始稿件');
  const fresh=await request(base+'/bootstrap');assert.equal(fresh.topics.find(x=>x.id===t.id).script_version,1);assert.equal(fresh.topics.find(x=>x.id===t.id).stage,'归档');
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
