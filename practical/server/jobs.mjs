import {buildPrompt,splitDocuments,parseAnalysis} from './analysis.mjs';
export function planAnalysis(task,{documents=[],fields={}}={}){
 try{const prompt=buildPrompt(task,{documents,fields});return {task,fields,documents,batches:[{documents,prompt}],sourceChars:prompt.stats.sourceChars};}
 catch(e){if(e.code!=='PROMPT_TOO_LARGE')throw e;const chunks=splitDocuments(documents,{maxChars:48000,overlapLines:0});const batches=chunks.map(chunk=>{const part={id:chunk.sourceId,name:chunk.name+'（分段）',text:chunk.text};return {documents:[part],chunk,prompt:buildPrompt(task,{documents:[part],fields:{...fields,segment:{lineStart:chunk.lineStart,lineEnd:chunk.lineEnd,notice:'当前仅为原文片段，不能假设未看到的上下文。输出行号按本片段从1开始，系统会映射回原文。'}}})};});return {task,fields,documents,batches,sourceChars:documents.reduce((n,d)=>n+d.text.length,0)};}
}
export async function runAnalysisPlan(plan,runner,progress=()=>{}){
 const results=[];let usage=[],models=[];
 for(let i=0;i<plan.batches.length;i++){const batch=plan.batches[i];await progress(i,plan.batches.length);const output=await runner(batch.prompt.system+'\n'+batch.prompt.user);const part=parseAnalysis(output.text,batch.documents);if(batch.chunk){for(const entry of [...part.sections.flatMap(s=>s.items),...part.revisions])if(entry.citationVerified){entry.lineStart+=batch.chunk.lineStart-1;entry.lineEnd+=batch.chunk.lineStart-1;}}results.push(part);usage.push(output.usage);models.push(output.model);await progress(i+1,plan.batches.length);}
 if(results.length===1)return {...results[0],model:models[0],usage:usage[0]};
 // Preserve separate segment observations; do not pretend concatenation proves a global character arc.
 const merged={title:'分段分析：'+results[0].title,summary:`已处理 ${results.length} 个原文分段。以下按片段保留分析，跨段关系与整体成长线需人工或后续选取相关片段复核。`,sections:results.flatMap((r,i)=>r.sections.map(s=>({...s,heading:`片段${i+1} · ${s.heading}`}))),revisions:results.flatMap(r=>r.revisions),shots:results.flatMap(r=>r.shots).map((s,i)=>({...s,number:i+1})),actions:results.flatMap(r=>r.actions),questions:[...new Set(results.flatMap(r=>r.questions))],model:[...new Set(models)].join(', '),usage,segments:results.map((r,i)=>({index:i+1,title:r.title,summary:r.summary,sourceId:plan.batches[i].chunk.sourceId,lineStart:plan.batches[i].chunk.lineStart,lineEnd:plan.batches[i].chunk.lineEnd}))};
 return merged;
}
