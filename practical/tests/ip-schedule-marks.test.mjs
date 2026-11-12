import test from 'node:test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createApp} from '../server/index.mjs';
import '../web/ip/schema.js';
import {scheduleColor,markStyle,emphasis} from '../web/ip/schedule-marks.mjs';
test('calendar colours use explicit marking first and never mutate dates or status',()=>{
 const row={kind:'ip-event',title:'拍摄｜隔离验收',body:{start:'2026-11-12T10:00',end:'2026-11-12T11:00',status:'待确认'}};
 const original=structuredClone(row);assert.equal(scheduleColor(row),'#67ac98');assert.deepEqual(row,original);
 row.body.color='#D083A4';row.body.highlight='1';assert.equal(scheduleColor(row),'#d083a4');assert.equal(emphasis(row),true);
 assert.equal(markStyle({...row,body:{color:'red; background:url(https://example.test)'}}),'--schedule-color:#67ac98');
});
test('invalid colour and priority values are rejected while legacy records remain valid',()=>{
 const b={start:'2026-11-12T10:00',end:'2026-11-12T11:00',status:'待确认'};
 assert.doesNotThrow(()=>globalThis.IPSchema.validate('ip-event',b));
 assert.doesNotThrow(()=>globalThis.IPSchema.validate('ip-event',{...b,color:'',highlight:'0'}));
 for(const color of ['red','#12345','url(example.test)','#ffffff;'])assert.throws(()=>globalThis.IPSchema.validate('ip-event',{...b,color}),/颜色/);
 assert.throws(()=>globalThis.IPSchema.validate('ip-event',{...b,highlight:'yes'}),/状态无效/);
});
test('colour and priority survive actual API edits and a server restart without rewriting work data',async()=>{
 const parent=process.env.IP_CALENDAR_TEST_ROOT||join(tmpdir(),'ip-calendar-colors');await mkdir(parent,{recursive:true});const dataDir=await mkdtemp(parent+'/marks-');
 const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const baseURL='http://127.0.0.1:'+port;
 let app=await createApp({dataDir,baseURL,profile:'ip',enableLocalTools:false});await app.listen(port);
 const call=async(path,method='GET',body)=>{const r=await fetch(baseURL+path,{method,headers:{Origin:baseURL,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();assert.ok(r.ok,JSON.stringify(value));return value;};
 try{
  await call('/api/p/context');const project=(await call('/api/p/projects'))[0],url='/api/p/projects/'+project.id+'/records';
  const original={start:'2026-11-12T10:00',end:'2026-11-12T11:00',status:'待确认',owner:'隔离验收',notes:'原正文保留'};
  const item=await call(url,'POST',{kind:'ip-event',title:'隔离标记验收',body:original});
  const changed=await call(url+'/'+item.id,'PATCH',{kind:item.kind,title:item.title,revision:item.revision,body:{...item.body,color:'#74b8ce',highlight:'1'}});
  for(const [k,v]of Object.entries(original))assert.equal(changed.body[k],v);
  await app.close();app=await createApp({dataDir,baseURL,profile:'ip',enableLocalTools:false});await app.listen(port);
  const saved=(await call(url)).find(r=>r.id===item.id);assert.equal(saved.body.color,'#74b8ce');assert.equal(saved.body.highlight,'1');assert.equal(saved.title,item.title);
  for(const [k,v]of Object.entries(original))assert.equal(saved.body[k],v);
 }finally{await app.close();}
});
