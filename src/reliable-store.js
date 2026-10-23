import {createStore, get, set, update, entries} from 'idb-keyval';

const records = createStore('xilixiwai-v2', 'records');
const files = createStore('xilixiwai-files-v2', 'files');
const MAIN = 'xilixiwai-demo-v1', PET = 'rourou-world-v1';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xilixiwai-v2') : null;
const clients = new Map();
const copy = x => structuredClone(x);
export const conflictMessage = '另一窗口已保存新记录。为避免覆盖，请先导出当前草稿，再刷新页面读取最新记录。';
function safe(value, depth = 0) {
  if (depth > 60) throw Error('备份层级过深');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { if(value.length > 100000) throw Error('备份记录过多'); value.forEach(v=>safe(v,depth+1)); return; }
  if (!value || typeof value !== 'object' || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error('备份包含无效数据');
  for(const [k,v] of Object.entries(value)) { if(['__proto__','constructor','prototype'].includes(k)) throw Error('备份含有不安全字段'); safe(v,depth+1); }
}
const announce = (key,revision) => channel?.postMessage({key,revision});
channel?.addEventListener('message', e => {
  const c=clients.get(e.data?.key);
  if(c && e.data.revision > c.revision) {
    c.stale=true;
    globalThis.dispatchEvent(new CustomEvent('actor-store-conflict',{detail:{key:e.data.key,message:conflictMessage}}));
  }
});
export async function open(key, fresh, validate) {
  let all = await get('workspaces', records) || {};
  if (!all[key]) {
    let state = fresh();
    const old=localStorage.getItem(key);
    if(old) {
      try { state=validate(JSON.parse(old)); }
      catch(e) { throw Error('旧记录校验失败，原记录仍保留。请先导出原始记录再恢复：'+e.message); }
    }
    await update('workspaces', current => {
      current=current||{};
      return current[key] ? current : {...current,[key]:{revision:1,state:validate(state)}};
    }, records);
    all=await get('workspaces',records);
  }
  let queue=Promise.resolve();
  const client={key,revision:all[key].revision,state:validate(copy(all[key].state)),stale:false,restoring:false,validate,
    whenIdle:()=>queue.catch(()=>{}),
    save(state) {
      if(client.restoring)return Promise.reject(Error('正在恢复资料，请稍候再保存'));
      const next=validate(copy(state)); safe(next);
      const work=queue.catch(()=>{}).then(async()=>{
        let rev;
        await update('workspaces', current=>{
          current=current||{};
          if(current[key]?.revision!==client.revision) throw Error(conflictMessage);
          rev=client.revision+1;
          return {...current,[key]:{revision:rev,state:next}};
        },records);
        client.revision=rev; client.state=copy(next); client.stale=false; announce(key,rev);
        return copy(next);
      });
      queue=work; return work;
    },
    async reload() { await queue.catch(()=>{}); const data=(await get('workspaces',records))?.[key]; if(!data) throw Error('找不到保存记录'); client.state=validate(copy(data.state));client.revision=data.revision;client.stale=false;return copy(client.state); }
  };
  clients.set(key,client);return client;
}
export async function exportRaw(key) { return JSON.stringify({key,stored:(await get('workspaces',records))?.[key]||null,legacy:localStorage.getItem(key)},null,2); }
export async function startFresh(key,state) {
  const current=await get('workspaces',records)||{};
  await set('recovery-'+key+'-'+Date.now(),{record:current[key]||null,legacy:localStorage.getItem(key)},records);
  await update('workspaces',all=>({...all,[key]:{revision:(all?.[key]?.revision||0)+1,state}}),records);
}
const hex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const hash = async b => hex(await crypto.subtle.digest('SHA-256',b));
export async function putFile(file) {
  if(!(file instanceof Blob) || file.size>32*1024*1024) throw Error('单个原件最多32 MB');
  const sha256=await hash(await file.arrayBuffer());
  const meta={id:'file-'+crypto.randomUUID(),name:file.name||'附件',type:file.type||'application/octet-stream',size:file.size,sha256};
  await set(meta.id,{...meta,blob:file},files);return meta;
}
export async function getFile(id) { const row=await get(id,files); if(!row?.blob) throw Error('原件不存在：旧版只登记过文件名，请重新上传原件');return row.blob; }
export function download(name,data,type='application/json') {
  const blob=data instanceof Blob?data:new Blob([data],{type});const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function downloadFile(id) { const row=await get(id,files);if(!row?.blob) throw Error('找不到附件原件');download(row.name,row.blob); }
const base64 = bytes => { let s=''; for(let i=0;i<bytes.length;i+=32768) s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s); };
function decode(s) { if(typeof s!=='string'||s.length>48*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw Error('附件编码无效');return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); }
function refs(value,out=new Set()) { if(value&&typeof value==='object') { if(typeof value.id==='string'&&value.id.startsWith('file-'))out.add(value.id);if(typeof value.snap==='string'){try{refs(JSON.parse(value.snap),out);}catch{}}for(const v of Object.values(value))refs(v,out); }return out; }
function fileReferences(value,out=[]) {if(value&&typeof value==='object'){if(typeof value.id==='string'&&value.id.startsWith('file-')&&value.sha256)out.push(value);if(typeof value.snap==='string'){try{fileReferences(JSON.parse(value.snap),out);}catch{}}for(const v of Object.values(value))fileReferences(v,out);}return out;}
export async function exportBundle({petOnly=false,state}={}) {
  const all=await get('workspaces',records)||{};
  const main=state||all[MAIN]?.state,pet=all[PET]?.state||null;
  const doc=petOnly?{app:'rourou-world',version:1,state:state||pet}:{app:'xilixiwai',version:2,state:main,pet};
  if(!doc.state) throw Error('没有可备份的记录');
  doc.savedAt=new Date().toISOString();doc.files=[];
  const needed=refs(petOnly?doc.state:{state:doc.state,pet});
  let total=0;
  for(const id of needed) { const row=await get(id,files);if(!row?.blob)throw Error('附件原件缺失，未生成不完整备份：'+id);total+=row.blob.size;if(total>160*1024*1024)throw Error('备份附件合计超过160 MB，请分项目备份');const {blob,...meta}=row;doc.files.push({...meta,data:base64(new Uint8Array(await blob.arrayBuffer()))}); }
  return doc;
}
export async function validateBundle(doc,{validateMain,validatePet,petOnly=false}={}) {
  safe(doc);
  if(!doc||!['xilixiwai','rourou-world'].includes(doc.app))throw Error('不是本应用的备份');
  if(petOnly&&doc.app!=='rourou-world')throw Error('此处只接受肉肉独立备份，主工作台备份请在工作台恢复');
  if(doc.app==='xilixiwai'&&![1,2].includes(doc.version))throw Error('不支持这个备份版本');
  if(doc.app==='rourou-world'&&doc.version!==1)throw Error('不支持这个肉肉备份版本');
  const validateM=validateMain||clients.get(MAIN)?.validate;
  const validateP=validatePet||globalThis.PetSchema?.validate||clients.get(PET)?.validate;
  const result={main:null,pet:null,files:[]};
  if(doc.app==='xilixiwai') { if(!validateM)throw Error('缺少主工作台校验器');result.main=validateM(doc.state);if(doc.pet!=null){if(!validateP)throw Error('缺少肉肉资料校验器');result.pet=validateP(doc.pet);} }
  else {if(!validateP)throw Error('缺少肉肉资料校验器');result.pet=validateP(doc.state);}
  if(doc.files!=null&&!Array.isArray(doc.files))throw Error('附件列表无效');
  const ids=new Set();let total=0;
  for(const f of doc.files||[]) {
    if(!f||!/^file-[A-Za-z0-9-]+$/.test(f.id)||ids.has(f.id)||typeof f.name!=='string'||typeof f.type!=='string'||!Number.isSafeInteger(f.size)||f.size<0||f.size>32*1024*1024||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('附件资料无效');
    const bytes=decode(f.data);total+=bytes.length;if(total>160*1024*1024)throw Error('备份附件合计超过160 MB');
    if(bytes.length!==f.size||await hash(bytes)!==f.sha256)throw Error('附件校验失败：'+f.name);
    ids.add(f.id);result.files.push({id:f.id,name:f.name,type:f.type,size:f.size,sha256:f.sha256,blob:new Blob([bytes],{type:f.type})});
  }
  for(const id of refs({main:result.main,pet:result.pet}))if(!ids.has(id))throw Error('备份缺少附件原件：'+id);
  const payloads=new Map(result.files.map(f=>[f.id,f]));
  for(const ref of fileReferences({main:result.main,pet:result.pet}))if(['name','type','size','sha256'].some(k=>ref[k]!==payloads.get(ref.id)?.[k]))throw Error('附件说明与原件不一致：'+ref.name);
  return result;
}
export async function restoreBundle(doc,options={}) {
  const data=await validateBundle(doc,options);
  const mainClient=options.mainClient||clients.get(MAIN),petClient=options.petClient||clients.get(PET);
  const affected=[...(data.main&&mainClient?[mainClient]:[]),...(data.pet&&petClient?[petClient]:[])];
  await Promise.all(affected.map(c=>c.whenIdle()));
  if(affected.some(c=>c.restoring))throw Error('另一项恢复仍在进行，请稍候');
  affected.forEach(c=>c.restoring=true);
  try {
  const before=await get('workspaces',records)||{};
  // File payloads are immutable, content-checked, and written before the single state transaction.
  // A failed transaction leaves only unreferenced files, never a partly restored workspace.
  for(const row of data.files)await update(row.id,existing=>{
    if(existing&&['sha256','name','type','size'].some(k=>existing[k]!==row[k]))throw Error('附件编号冲突，原件保持不变');
    return existing||row;
  },files);
  const changes={};if(data.main)changes[MAIN]=data.main;if(data.pet)changes[PET]=data.pet;
  const committed={};
  await update('workspaces',current=>{
    current=current||{};
    for(const key of Object.keys(changes)) {const c=key===MAIN?mainClient:petClient;const expected=c?.revision??before[key]?.revision;if(current[key]?.revision!==expected)throw Error(conflictMessage);}
    const next={...current};for(const [key,state]of Object.entries(changes)){committed[key]=(current[key]?.revision||0)+1;next[key]={state,revision:committed[key]};}return next;
  },records);
  for(const key of Object.keys(changes)){const c=key===MAIN?mainClient:petClient;if(c){c.state=copy(changes[key]);c.revision=committed[key];c.stale=false;}announce(key,committed[key]);}
  return {state:copy(data.main||data.pet),pet:copy(data.pet)};
  } finally {affected.forEach(c=>c.restoring=false);}
}

export {validateMain} from './main-schema.js';
export {scheduleDays,timeRange} from './schedule.js';
