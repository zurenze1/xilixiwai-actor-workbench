import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import http from 'node:http';
import {mkdir,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../modules/creator-workbench/',import.meta.url));
import {Store} from '../modules/creator-workbench/server/store.mjs';
import {DatabaseSync} from 'node:sqlite';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function unusedPort(){const s=createServer();await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r);});const port=s.address().port;await new Promise(r=>s.close(r));return port;}
export function creatorModules(dataDir){
 const children=new Map();
 function summary(project){
  let db;try{db=new DatabaseSync(resolve(dataDir,'creator-modules',project.id,'workbench.sqlite'),{readOnly:true});return Object.fromEntries(['topics','sources','blobs','publications','script_versions','metric_snapshots','transcripts'].map(t=>[t,db.prepare('SELECT count(*) n FROM '+t).get().n]));}
  catch(e){if(e.code==='ERR_SQLITE_ERROR'&&e.message.includes('unable to open'))return null;throw e;}finally{db?.close();}
 }
 async function start(project){
  if(children.has(project.id))return children.get(project.id).ready;
  const state={proc:null,ready:null};children.set(project.id,state);
  state.ready=(async()=>{
   const dir=resolve(dataDir,'creator-modules',project.id);await mkdir(dir,{recursive:true,mode:0o700});
   const seed=new Store(resolve(dir,'workbench.sqlite'));try{if(!seed.db.prepare('SELECT id FROM accounts LIMIT 1').get())seed.account({name:project.title,role:'自有'});}finally{seed.close();}
   const port=await unusedPort(),log=await open(resolve(dir,'service.log'),'a',0o600);
   const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('WORKBENCH_')||k==='OPENAI_API_KEY'||k==='ANTHROPIC_API_KEY')delete env[k];
   // Trusted parent context; child modules can read only this project's shared records.
   env.WORKBENCH_IP_PARENT_DB=resolve(dataDir,'workbench.sqlite');
   env.WORKBENCH_IP_PROJECT_ID=project.id;
   state.proc=spawn(process.execPath,[root+'server/main.mjs','--data',dir,'--port',String(port)],{cwd:root,env,stdio:['ignore',log.fd,log.fd]});await log.close();
   state.proc.once('exit',()=>children.delete(project.id));
   for(let i=0;i<120;i++){
    if(state.proc.exitCode!=null||state.proc.signalCode)throw Error('创作模块启动未完成，请检查本机日志。');
    try{const r=await fetch('http://127.0.0.1:'+port+'/api/bootstrap');if(r.ok)return {port,dir};}catch{}
    await delay(100);
   }
   state.proc.kill('SIGTERM');throw Error('创作模块启动超时，可刷新重试。');
  })().catch(e=>{children.delete(project.id);throw e;});return state.ready;
 }
 async function proxy(req,res,{project,suffix,query='',baseURL}){
  if(req.headers['sec-fetch-site']==='cross-site')throw Object.assign(Error('拒绝跨站访问'),{status:403});
  const {port}=await start(project),headers={...req.headers,host:'127.0.0.1:'+port};
  if(headers.origin){if(headers.origin!==new URL(baseURL).origin)throw Object.assign(Error('拒绝跨站请求'),{status:403});headers.origin='http://127.0.0.1:'+port;}
  await new Promise((done,reject)=>{
   const out=http.request({host:'127.0.0.1',port,path:'/'+suffix+query,method:req.method,headers},up=>{res.writeHead(up.statusCode,up.headers);up.pipe(res);up.once('end',done);up.once('error',reject);});
   out.once('error',reject);req.once('aborted',()=>out.destroy());res.once('close',()=>{out.destroy();done();});req.pipe(out);
  });
 }
 async function close(){await Promise.allSettled([...children.values()].map(async s=>{try{await s.ready;}catch{}if(!s.proc||s.proc.exitCode!=null||s.proc.signalCode)return;s.proc.kill('SIGTERM');await Promise.race([new Promise(r=>s.proc.once('exit',r)),delay(6000).then(()=>{if(s.proc.exitCode==null&&!s.proc.signalCode)s.proc.kill('SIGKILL');})]);}));children.clear();}
 return {start,proxy,close,summary};
}
