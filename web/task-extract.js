/* Deterministic local line extraction. No model call or invented deadline. */
((root)=>{
 function extract(text){
  if(typeof text!=='string'||!text.trim())throw Error('先粘贴一段稿件或会议纪要');
  if(text.length>100000)throw Error('稿件过长，请按50条以内分批整理');
  const rows=[],seen=new Set();
  text.split(/\r?\n/).forEach((source,index)=>{
   const original=source.trim(),line=original.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/, '').trim();if(!line)return;
   if(!/[-*•]|[｜|]/.test(original)&&line.length<60&&/(?:会议纪要|会议记录|碰头会|通告单)[（(]?.*$/.test(line))return;
   if(seen.has(line))return;seen.add(line);if(line.length>2000)throw Error('第'+(index+1)+'行过长，请先拆成较短的事项');
   let t=line,who='待分配',due='待确认';
   const parts=line.split(/[｜|]/).map(x=>x.trim());
   if(parts.length===3){[t,who,due]=parts;who=who||'待分配';due=due||'待确认';}
   else{
    const task=/(?:事项|任务)[：:]\s*([^；;]+)/.exec(line),owner=/(?:负责人|负责)[：:]\s*([^；;]+)/.exec(line),deadline=/(?:截止|期限)[：:]\s*([^；;]+)/.exec(line);
    if(task)t=task[1].trim();if(owner)who=owner[1].trim();if(deadline)due=deadline[1].trim();
   }
   if(!t)throw Error('第'+(index+1)+'行缺少事项');
   const timeHint=(line.match(/(?:\d{4}-\d{2}-\d{2}|\d{1,2}月\d{1,2}日|下周|周[一二三四五六日天])/g)||[]).join('、');
   rows.push({t,who,due,col:0,sourceText:original,sourceLine:index+1,timeHint});
  });
  if(!rows.length)throw Error('没有找到事项，请每行填写一件事');if(rows.length>50)throw Error('一次最多拆50件事，请分批处理');return rows;
 }
 root.ActorTaskExtract=Object.freeze({extract});
})(globalThis);
