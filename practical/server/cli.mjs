import {access,mkdir} from 'node:fs/promises';
import {join,delimiter} from 'node:path';
import {spawn} from 'node:child_process';
async function findProgram(name){for(const p of (process.env.PATH||'').split(delimiter)){const file=join(p,name);try{await access(file);return file;}catch{}}if(name==='codex'){const p='/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';try{await access(p);return p;}catch{}}return null;}
export async function runCLI(connection,prompt,{signal,cliRoot,find=findProgram,spawnProcess=spawn}={}){
 const isCodex=connection.provider==='codex',program=await find(isCodex?'codex':'claude');if(!program)throw new Error(`这台电脑尚未找到${isCodex?'Codex':'Claude Code'}，请由使用者安装并登录自己的工具后再测试。`);
 await mkdir(cliRoot,{recursive:true});const args=isCodex?['exec','--ignore-user-config','--disable','shell_tool','--disable','unified_exec','--config','project_doc_max_bytes=0','--config','mcp_servers={}','--config','web_search="disabled"','--sandbox','read-only','--ephemeral','--skip-git-repo-check','--json','-']:['--print','--output-format','json','--tools','','--max-turns','1','--no-session-persistence','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--settings','{"disableAllHooks":true}'];
 if(connection.model?.trim())args.splice(isCodex?1:0,0,'--model',connection.model.trim());
 return new Promise((acceptResult,reject)=>{let output='',errors='',finished=false;const child=spawnProcess(program,args,{cwd:cliRoot,env:process.env,stdio:['pipe','pipe','pipe']});
 const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):acceptResult(result);};
 const abort=()=>{child.kill('SIGTERM');finish(new Error('本次本机工具调用已取消。'));};const timer=setTimeout(()=>{child.kill('SIGTERM');finish(new Error('本机工具在120秒内未完成，请缩短输入或确认登录状态。'));},120000);signal?.addEventListener('abort',abort,{once:true});
 child.stdout.on('data',b=>{output+=b.toString();if(output.length>2000000){child.kill('SIGTERM');finish(new Error('本机工具输出过大，本次已停止。'));}});child.stderr.on('data',b=>{errors=(errors+b.toString()).slice(-5000);});child.on('error',()=>finish(new Error('无法启动本机工具，请检查安装状态。')));
 child.on('close',code=>{if(finished)return;if(code!==0)return finish(new Error('本机工具未完成调用，请在自己的终端确认已登录、模型可用及版本兼容。'));
  try{let text='',usage=null;if(isCodex){for(const line of output.split(/\r?\n/)){let e;try{e=JSON.parse(line);}catch{continue;}if(e.type==='item.completed'&&e.item?.type==='agent_message')text=e.item.text;if(e.type==='turn.completed')usage=e.usage;}}else{const result=JSON.parse(output);if(result.is_error)throw new Error();text=result.result;usage=result.usage;}if(!text?.trim())throw new Error();finish(null,{text,model:connection.model?.trim()||'本机工具当前模型',usage});}catch{finish(new Error('本机工具没有返回可用文本，请检查登录与工具输出格式。'));}
 });child.stdin.end('只根据以下资料输出JSON，不调用任何工具，不读取、创建或修改文件：\n'+prompt);
 });
}
