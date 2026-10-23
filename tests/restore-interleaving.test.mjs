import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('a different tab saving between restore commit and return cannot donate its revision to an old snapshot',async()=>{
 const source=(await readFile(new URL('../src/reliable-store.js',import.meta.url),'utf8')).replace(/^import .*idb-keyval.*$/m,'').replace(/^export \{.*\} from .*;$/mg,'').replace(/\bexport /g,'');
 const memory=new Map(),key='xilixiwai-demo-v1';let insertOtherWrite=false;
 const createStore=(db,store)=>db+'/'+store,compound=(key,store)=>store+'/'+key;
 const get=async(key,store)=>structuredClone(memory.get(compound(key,store)));
 const set=async(key,value,store)=>memory.set(compound(key,store),structuredClone(value));
 const update=async(k,fn,store)=>{const name=compound(k,store),next=fn(structuredClone(memory.get(name)));memory.set(name,structuredClone(next));
  // A second tab commits after the restore transaction, before its caller resumes.
  if(insertOtherWrite&&k==='workspaces'&&next[key]?.state.label==='A-restored'){insertOtherWrite=false;memory.set(name,{...next,[key]:{revision:next[key].revision+1,state:{label:'B-newer',folder:[],files:{}}}});}
 };
 const create=new Function('createStore','get','set','update','entries','BroadcastChannel','localStorage',source+'\nreturn {open,restoreBundle,exportBundle};');
 const store=create(createStore,get,set,update,async()=>[],undefined,{getItem:()=>null});const validate=x=>structuredClone(x);
 const client=await store.open(key,()=>({folder:[],files:{},label:'original'}),validate);insertOtherWrite=true;
 await store.restoreBundle({app:'xilixiwai',version:1,state:{folder:[],files:{},label:'A-restored'}},{mainClient:client,validateMain:validate});
 assert.equal(client.revision,2);assert.equal((await store.exportBundle()).state.label,'B-newer');await assert.rejects(client.save(client.state),/另一窗口/);
 assert.equal((await store.exportBundle()).state.label,'B-newer');
});
