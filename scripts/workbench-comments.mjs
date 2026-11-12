import {syncCloudDirectory} from '../practical/modules/creator-workbench/server/comment-cloud.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../practical/modules/creator-workbench/server/store.mjs';
import {creators} from '../practical/modules/creator-workbench/server/discovery.mjs';
import {COMMENT_RULE,replyTarget,replyRows,ingestCommentScan,claimReply,finishReply,setReplyTarget} from '../practical/modules/creator-workbench/server/comment-workflow.mjs';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1],cmd=args[0];
if(!args.includes('--root'))throw Error('必须明确 --root IP工作台数据目录');
const root=path.resolve(arg('--root')),parent=path.join(root,'creator-modules');
const ids=(await fs.readdir(parent)).filter(id=>/^[a-f0-9-]{36}$/.test(id));
const open=id=>{if(!ids.includes(id))throw Error('该IP不在指定工作台');return new Store(path.join(parent,id,'workbench.sqlite'));};
const file=async()=>{if(!args.includes('--file'))throw Error('请指定 --file JSON文件');const f=arg('--file');if((await fs.stat(f)).size>2*1024*1024)throw Error('输入超过2MiB');return JSON.parse(await fs.readFile(f,'utf8'));};
if(cmd==='context'){
 const cloud=syncCloudDirectory(root);const projects=[];
 for(const id of ids){const s=open(id);try{const peers=creators(s).filter(a=>a.role==='对标'&&a.follow),target=replyTarget(s),approved=replyRows(s,{state:'已批准'});projects.push({projectId:id,peers,target,approved,collector:s.get('discovery.collector'),rule:COMMENT_RULE});}finally{s.close();}}
 console.log(JSON.stringify({root,projects,cloud,notes:'每次读取动态名单；只采实际可见评论。发送必须先claim，核对账号与审核原文，完成后complete；未验证的发送用需核对，禁止自动重发。'},null,2));
}else{
 const id=arg('--project');if(!args.includes('--project'))throw Error('请明确 --project IP标识');const s=open(id);
 try{let r;if(cmd==='ingest')r=await ingestCommentScan(s,path.join(parent,id),await file());else if(cmd==='target')r=setReplyTarget(s,await file());else if(cmd==='claim')r=claimReply(s,arg('--id'),{manualSession:args.includes('--manual-session')?arg('--manual-session'):undefined});else if(cmd==='complete')r=finishReply(s,arg('--id'),await file());else if(cmd==='automation'){r=await file();s.set('comments.automation',r);}else throw Error('使用context、ingest、target、claim或complete');console.log(JSON.stringify(r,null,2));}finally{s.close();}
}
