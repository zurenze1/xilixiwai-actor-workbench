import test from 'node:test';
import assert from 'node:assert/strict';
await import('../web/rourou/schema.js');
const {validate,fresh,references}=globalThis.PetSchema;
test('legacy records are merged without losing the available photo copy or attachment marker',()=>{
  const image='data:image/png;base64,aGVsbG8=';
  const state=validate({tab:'album',logs:{},health:null,behLog:null,photos:[{src:image,c:'旧照',d:'2026/10/23'}],notes:{album:[{at:'10/23',text:'legacy.docx',file:true}]}});
  assert.equal(state.photos[0].src,image);
  assert.equal(state.notes.album[0].file,true);
  assert.ok(state.health.length);
  assert.equal(state.contacts.ownerPhone,'');
});
test('malformed nested data is rejected rather than replaced by blank defaults',()=>{
  for(const bad of [null,[],{notes:null},{photos:{}},{health:[]},{logs:{'2026-02-30':{}}},{notes:{care:[{text:2}]}},{contacts:{ownerName:2}}]) assert.throws(()=>validate(bad),/肉肉资料校验失败/);
});
test('file references and drafts survive validation with exact byte metadata',()=>{
  const file={id:'file-test-1',name:'synthetic.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:123,sha256:'ab'.repeat(32)};
  const raw=fresh(); raw.photos=[{id:'p1',file,c:'照片',d:'2026-10-23'}]; raw.notes.care=[{at:'test',text:file.name,attachment:file}];
  raw.drafts.care={note:'未提交草稿',contacts:{ownerName:'虚构联系人'}};
  const out=validate(raw);
  assert.deepEqual(out.notes.care[0].attachment,file);
  assert.equal(out.drafts.care.note,'未提交草稿');
  assert.equal(out.drafts.care.contacts.ownerName,'虚构联系人');
  assert.equal(references(out).length,1);
  assert.notEqual(out,raw);
});
test('invalid original metadata and unsafe legacy image sources are rejected',()=>{
  const raw=fresh();
  raw.photos=[{file:{id:'file-x',name:'x',type:'image/png',size:1,sha256:'broken'}}];
  assert.throws(()=>validate(raw),/校验值/);
  assert.throws(()=>validate({...fresh(),photos:[{src:'javascript:alert(1)'}]}),/旧版图片/);
  assert.throws(()=>validate(JSON.parse('{"__proto__":{"polluted":true}}')),/不允许/);
  assert.equal({}.polluted,undefined);
});
test('impossible health dates and duplicate identifiers are rejected',()=>{
  const raw=fresh();raw.health[0].last='2026-02-30';
  assert.throws(()=>validate(raw),/日期/);
  const duplicate=fresh();duplicate.health[1].id=duplicate.health[0].id;
  assert.throws(()=>validate(duplicate),/编号不能重复/);
});
test('pet backup wrapper refuses a main-workbench backup before touching storage',async()=>{
  globalThis.ActorStore={exportBundle:async x=>x,restoreBundle:()=>{throw Error('must not write');}};
  await import('../web/rourou/backup.js');
  await assert.rejects(()=>globalThis.PetBackup.restore({app:'xilixiwai'},{}),/主工作台/);
});
test('conflicting metadata on a shared file id is rejected',()=>{
  const raw=fresh(), ref={id:'file-shared',name:'original.png',type:'image/png',size:9,sha256:'ab'.repeat(32)};
  raw.photos=[{file:ref,c:'one',d:''}]; raw.notes.care=[{text:'same id',attachment:{...ref,size:10}}];
  assert.throws(()=>validate(raw),/同一编号/);
});
test('independent backups require every referenced payload and matching original metadata',async()=>{
  const ref={id:'file-portable',name:'original.png',type:'image/png',size:9,sha256:'ab'.repeat(32)};
  const pet=validate({...fresh(),photos:[{file:ref,c:'one',d:''}]});
  globalThis.ActorStore.validateBundle=async()=>({pet,files:[]});
  await assert.rejects(()=>globalThis.PetBackup.validate({app:'rourou-world'}),/缺少附件原件/);
  globalThis.ActorStore.validateBundle=async()=>({pet,files:[{...ref,size:10}]});
  await assert.rejects(()=>globalThis.PetBackup.validate({app:'rourou-world'}),/说明与原件不一致/);
  globalThis.ActorStore.validateBundle=async()=>({pet,files:[ref]});
  assert.equal((await globalThis.PetBackup.validate({app:'rourou-world'})).pet.photos.length,1);
});
