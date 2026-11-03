import React,{useEffect,useState} from 'react';
import {api,csrfToken,Dialog,Field,type Item} from './ui';
import './execution-generator.css';

export function ExecutionGenerator({topicId,beforeGenerate,onApply,onClose}:{topicId:string;beforeGenerate:()=>Promise<number>;onApply:(result:Item)=>Promise<void>;onClose:()=>void}){
 const [raw,setRaw]=useState(''),[job,setJob]=useState<Item|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[connected,setConnected]=useState<boolean|null>(null);
 const active=!!job&&['排队','处理中','等待重试'].includes(job.status);
 useEffect(()=>{let live=true;api('/topics/'+topicId+'/execution-generation').then(r=>{if(live){setConnected(r.connection.loggedIn);if(r.job){setJob(r.job);setRaw(r.job.input?.text||'');}}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[topicId]);
 useEffect(()=>{if(!active)return;let live=true,pending=false;const timer=setInterval(async()=>{if(pending)return;pending=true;try{const r=await api('/execution-jobs/'+job!.id);if(live)setJob(r);}catch(e:any){if(live)setError(e.message);}finally{pending=false;}},1500);return()=>{live=false;clearInterval(timer);};},[job?.id,active]);
 async function readFile(file?:File){if(!file)return;setBusy(true);setError('');setRaw('');setJob(null);try{if(file.size>12*1024*1024)throw Error('文案文件最大12MiB');const fd=new FormData();fd.append('file',file);const response=await fetch('./api/topics/'+topicId+'/execution-document',{method:'POST',headers:{'x-workbench-csrf':csrfToken()},body:fd});const r=await response.json();if(!response.ok)throw Error(r.error||'文件读取未完成');setRaw(r.text);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function generate(){setBusy(true);setError('');try{const scriptRevision=await beforeGenerate();setJob(await api('/topics/'+topicId+'/execution-generation',{text:raw,scriptRevision}));}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <Dialog title="上传文案，生成分镜脚本" wide onClose={()=>{if(!busy)onClose();}}>
  <p>保留完整口播，逐句补齐画面、花字字幕、转场和音乐音效。生成后可继续编辑。</p>
  <label className="execution-document-pick">上传完整文案<input type="file" disabled={busy||active} accept=".txt,.md,.docx,.pdf" onChange={e=>readFile(e.target.files?.[0])}/><small>Word DOCX、PDF文字版、TXT、Markdown · 最大12MiB</small></label>
  <Field label="完整文案"><textarea rows={11} maxLength={100000} disabled={busy||active} value={raw} placeholder="也可以把整篇文案粘贴到这里。" onChange={e=>{setRaw(e.target.value);setJob(null);setError('');}}/></Field>
  <p className="small muted">{raw.length.toLocaleString()} 字 · 使用本机已登录的 Codex{connected===false?' · 请先在电脑上登录 Codex':''}</p>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {job?.status==='失败'&&<p className="notice error" role="alert">{job.error||'生成未完成，请重试。原文和当前分镜均已保留。'}</p>}
  {job?.status==='已取消'&&<p role="status">已取消生成，当前分镜未改变。</p>}
  {active&&<div className="execution-generation-progress" role="status"><b>{job?.stage||'正在排队'}</b><p>可以关闭窗口，任务会继续；再次打开可查看进度与结果。</p><button onClick={async()=>{try{setJob(await api('/jobs/'+job!.id+'/cancel',{}));}catch(e:any){setError(e.message);}}}>取消本次生成</button></div>}
  {job?.status==='成功'&&job.result?.draft&&<section className="execution-generated-preview"><h3>已生成 {job.result.count} 个镜头</h3><p className="small muted">先看前3镜；采用后，全部镜头进入执行表。</p><div>{job.result.draft.segments.slice(0,3).map((s:Item,i:number)=><article key={s.id}><b>镜头 {i+1} · {s.heading}</b><p>{s.narration}</p><dl><dt>画面</dt><dd>{s.shot}</dd><dt>花字</dt><dd>{s.subtitle}</dd><dt>声音</dt><dd>{s.audioNote}</dd></dl></article>)}</div><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onApply(job.result);onClose();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>采用全部分镜 · 保留当前版本</button> <button disabled={busy} onClick={generate}>重新生成一版</button></section>}
  {!active&&job?.status!=='成功'&&<button className="primary" disabled={busy||!raw.trim()||connected===false} onClick={generate}>{busy?'正在读取与准备…':job?'重新生成分镜':'生成分镜脚本'}</button>}
 </Dialog>;
}
