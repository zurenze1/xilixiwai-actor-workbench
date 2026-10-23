import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../web/pet/',import.meta.url).pathname;
globalThis.window=globalThis;
await import(root+'schema.js');
await import(root+'backup.js');
const clone=x=>JSON.parse(JSON.stringify(x));
test('实战首次打开无假历史，结构可回读',()=>{
 const s=PetSchema.validate(PetSchema.fresh());
 for(const k of ['weights','health','behLog','photos'])assert.deepEqual(s[k],[]);
 assert.deepEqual(s.logs,{});assert.equal(s.profile.birth,'');assert.equal(s.profile.meals,null);
 assert.deepEqual(PetSchema.validate(s),s);
});
test('旧版数据完整保留并隔离未核实提醒',()=>{
 const s=PetSchema.validate({schemaVersion:2,tab:'breed',health:[{id:'h',n:'旧示例',last:'2026-01-01',every:30}],behLog:[{d:'2026-01-02',b:'出门叫'}],notes:{breed:[{at:'旧',text:'原话'}]},drafts:{beh:{behavior:'原草稿'}}});
 assert.equal(s.tab,'profile');assert.equal(s.health.length,1);assert.equal(s.health[0].source,'legacy-unverified');assert.equal(PetSchema.nextDue(s.health[0]),'');assert.equal(s.behLog[0].source,'legacy-unverified');assert.equal(s.notes.profile[0].text,'原话');assert.equal(s.drafts.beh.behavior,'原草稿');
});
test('到期日期按日历计算，跨月闰日和明确日期正确',()=>{
 assert.equal(PetSchema.nextDue({source:'user',last:'2024-02-28',every:2}),'2024-03-01');
 assert.equal(PetSchema.nextDue({source:'user',last:'2026-10-01',every:30,due:'2026-11-09'}),'2026-11-09');
 assert.equal(PetSchema.remaining('2026-10-23','2026-10-24'),-1);
 const d=new Date(2026,9,23,0,1);assert.equal(PetSchema.localDate(d),'2026-10-23');
});
test('不接受非法日期、负数、无效记录、原件冲突及原型污染',()=>{
 const good=PetSchema.fresh();good.weights=[{id:'w',d:'2026-02-30',kg:3}];assert.throws(()=>PetSchema.validate(good),/日期/);
 good.weights=[{id:'w',d:'2026-02-01',kg:-2}];assert.throws(()=>PetSchema.validate(good),/数值/);
 assert.throws(()=>PetSchema.validate({...PetSchema.fresh(),notes:null}),/应为对象/);
 assert.throws(()=>PetSchema.validate(JSON.parse('{"__proto__":{"admin":true}}')),/字段/);
 const ref={id:'file-abcd',name:'a.png',type:'image/png',size:1,sha256:'a'.repeat(64)};
 assert.throws(()=>PetSchema.references({photos:[{file:ref},{file:{...ref,sha256:'b'.repeat(64)}}]}),/冲突/);
});
test('备份保留档案、照片、草稿、行为和完成历史，拒绝缺失或错配原件',async()=>{
 const ref={id:'file-abcd',name:'a.png',type:'image/png',size:1,sha256:'a'.repeat(64)};
 const s=PetSchema.fresh();s.profile.birth='2022-01-02';s.photos=[{id:'p',d:'2026-10-23',c:'文字',file:ref}];s.drafts.studio={note:'尚未提交'};
 const doc={app:'rourou-world',version:1,state:s,files:[ref]};
 globalThis.ActorStore={exportBundle:async()=>doc,restoreBundle:async()=>{},validateBundle:async d=>({pet:PetSchema.validate(d.state),files:d.files})};
 assert.equal((await PetBackup.export(s)).state.profile.birth,'2022-01-02');
 await assert.rejects(PetBackup.validate({...doc,files:[]}),/缺少附件原件/);
 await assert.rejects(PetBackup.validate({...doc,files:[{...ref,size:2}]}),/不一致/);
 await assert.rejects(PetBackup.validate({...doc,app:'xilixiwai'}),/只接受/);
});
async function harness(initial=PetSchema.fresh()){
 const listeners={},elements=new Map(),files=new Map();let saved=clone(initial),failSave=false,downloads=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:'',classList:{toggle(){},add(){},remove(){}},isConnected:true,focus(){},getContext(){return{drawImage(){}}}});return elements.get(id);};
 globalThis.document={body:{classList:{toggle(){}}},documentElement:{dataset:{}},querySelector:s=>element(s),querySelectorAll:()=>[],addEventListener:(k,f)=>{listeners[k]=f},createElement:tag=>tag==='canvas'?{getContext(){return{}},toBlob(cb){cb(new Blob(['png'],{type:'image/png'}));}}:{click(){downloads.push(this.download)}}};
 globalThis.location={search:'?embedded=1',origin:'http://fixture.invalid'};
 globalThis.parent={postMessage(){}};
 globalThis.addEventListener=()=>{};
 globalThis.confirm=()=>true;globalThis.prompt=()=>PetSchema.localDate();
 globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
 globalThis.Image=class{constructor(){this.naturalWidth=1200;this.naturalHeight=800;this.complete=true;}decode(){return Promise.resolve();}set src(v){this._src=v;queueMicrotask(()=>this.onload?.());}get src(){return this._src;}};
 const client={state:saved,async save(s){if(failSave)throw new Error('fixture conflict');saved=clone(PetSchema.validate(s));this.state=clone(saved);return this.state;},async reload(){this.state=clone(saved)}};
 globalThis.ActorStore={async open(){return client},context(){return{theme:'tide'}},async putFile(f){const bytes=Buffer.from(await f.arrayBuffer()),ref={id:'file-'+crypto.randomUUID(),name:f.name,type:f.type,size:f.size,sha256:createHash('sha256').update(bytes).digest('hex')};files.set(ref.id,f);return ref;},async getFile(id){if(!files.has(id))throw new Error('missing');return files.get(id)},async downloadFile(id){downloads.push(id)}};
 globalThis.PetSticker={async draw(canvas){return canvas},async png(){return new Blob(['fixture-png'],{type:'image/png'})}};
 await new Function('return '+await fs.readFile(root+'app.js','utf8'))();
 return{state:()=>clone(saved),html:()=>element('#main').innerHTML,status:()=>element('#storageStatus').textContent,fail(v){failSave=v},
 input(form,key,value){listeners.input({target:{dataset:{form,key},value}})},
 special(id,value){listeners.input({target:{dataset:{},id,value}})},
 async click(a,v=''){const el={dataset:{a,v},disabled:false,isConnected:true};await listeners.click({target:{closest:()=>el}});},
 async change(target){await listeners.change({target})},files,downloads};
}
test('七个页面空状态可渲染，档案与草稿跨页回读',async()=>{
 const h=await harness();
 for(const tab of PetSchema.tabs){await h.click('tab',tab);assert.equal(h.state().tab,tab);assert.ok(h.html().includes('本页补充记录'));assert.ok(!h.html().includes('NaN'));}
 await h.click('tab','profile');h.input('profile','birth','2022-05-20');h.input('profile','gram','35');h.input('profile','meals','2');await h.click('profile-save');
 assert.equal(h.state().profile.gram,35);assert.equal(h.state().profile.meals,2);
 await h.click('tab','care');h.input('plan','instructions','真实交接草稿');await h.click('tab','album');await h.click('tab','care');
 assert.ok(h.html().includes('真实交接草稿'));const reloaded=await harness(h.state());assert.ok(reloaded.html().includes('真实交接草稿'));
});
test('日常数量与日期是真实输入，删除加水不改其他记录',async()=>{
 const h=await harness();await h.change({id:'logDate',value:'2026-01-02'});
 h.input('entry','kind','waterLog');h.input('entry','amount','123');h.input('entry','t','09:41');await h.click('daily-add');
 h.input('entry','kind','food');h.input('entry','amount','37');await h.click('daily-add');
 assert.equal(h.state().logs['2026-01-02'].water,123);assert.equal(h.state().logs['2026-01-02'].food[0].g,37);
 await h.click('daily-remove','waterLog:0');assert.equal(h.state().logs['2026-01-02'].water,0);assert.equal(h.state().logs['2026-01-02'].food.length,1);
});
test('健康可增改完成，完成历史保留，称重可编辑删除',async()=>{
 const h=await harness();await h.click('tab','health');h.input('health','n','医生确认项目');h.input('health','last','2026-01-02');h.input('health','every','30');await h.click('health-save');
 let H=h.state().health[0];assert.equal(PetSchema.nextDue(H),'2026-02-01');await h.click('health-complete',H.id);H=h.state().health[0];assert.ok(H.history.some(x=>x.d==='2026-01-02'));assert.ok(H.history.some(x=>x.d===PetSchema.localDate()));
 h.input('weight','kg','2.8');h.input('weight','d','2026-01-02');await h.click('weight-save');const id=h.state().weights[0].id;await h.click('weight-edit',id);h.input('weight','kg','2.9');await h.click('weight-save');assert.equal(h.state().weights[0].kg,2.9);await h.click('weight-remove',id);assert.equal(h.state().weights.length,0);
});
test('行为原话、实际托管日期和联系人保存，不产出假分析',async()=>{
 const h=await harness();await h.click('tab','beh');h.input('behaviorForm','b','<script>原话</script>');h.input('behaviorForm','context','回家之后');await h.click('behavior-save');assert.equal(h.state().behLog[0].b,'<script>原话</script>');assert.ok(h.html().includes('&lt;script&gt;'));assert.ok(!h.html().includes('AI 发现'));
 await h.click('tab','care');h.input('plan','from','2026-10-25');h.input('plan','to','2026-10-30');h.input('plan','carer','合成照顾者');await h.change({id:'not-used'});
 await h.click('care-save');assert.equal(h.state().carePlan.carer,'合成照顾者');assert.ok(h.html().includes('2026-10-25'));assert.ok(!h.html().includes('成都 → 重庆'));
});
test('保存失败后不报成功，草稿仍可重试，切换前flush可拒绝丢失',async()=>{
 const h=await harness();await h.click('tab','profile');h.input('profile','food','尚未保存主粮');h.fail(true);await h.click('profile-save');assert.match(h.status(),/fixture conflict/);await assert.rejects(PetModule.whenIdle(),/fixture conflict/);h.fail(false);await h.click('retry');assert.equal(h.state().profile.food,'尚未保存主粮');await PetModule.whenIdle();
});
test('照片原件→工坊沿用同一照片，不复制或压缩原件',async()=>{
 const h=await harness();await h.click('tab','album');h.special('photoCaption','合成照片说明');h.special('photoDate','2026-01-02');
 const file=new File([new Uint8Array([137,80,78,71])],'合成.png',{type:'image/png'});
 await h.change({id:'ph',files:[file],isConnected:true,value:''});const p=h.state().photos[0];assert.equal(p.file.size,4);assert.equal(h.files.size,1);await h.click('photo-sticker',p.id);assert.equal(h.state().tab,'studio');assert.equal(h.state().studio.photoId,p.id);assert.equal(h.files.size,1);await h.click('photo-download',p.id);assert.equal(h.downloads[0],p.file.id);
});

test('导入草稿不能向日期控件注入HTML或原型键',()=>{
 for(const drafts of [{today:{date:'"><img src=x onerror=alert(1)>'}},{today:{date:'__proto__'}},{album:{photoDate:'"><svg onload=alert(1)>'}}])assert.throws(()=>PetSchema.validate({...PetSchema.fresh(),drafts}),/日期/);
});

test('旧版未提交行为原话可直接保存，旧加水汇总可辨认并单独校正',async()=>{
 const s=PetSchema.fresh();s.drafts.beh={behavior:'旧草稿原话'};
 s.logs['2026-01-02']={food:[],water:100,waterLog:[{t:'09:00',ml:30}],walk:[],poop:[],care:{}};
 const h=await harness(s);await h.click('tab','beh');assert.ok(h.html().includes('旧草稿原话'));await h.click('behavior-save');assert.equal(h.state().behLog[0].b,'旧草稿原话');
 await h.click('tab','today');await h.change({id:'logDate',value:'2026-01-02'});assert.ok(h.html().includes('旧版汇总加水 70'));await h.click('daily-remove','legacyWater:0');assert.equal(h.state().logs['2026-01-02'].water,30);assert.equal(h.state().logs['2026-01-02'].waterLog.length,1);
});
