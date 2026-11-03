import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {narrationParts,checkGenerated,generateExecution} from '../modules/creator-workbench/server/execution-generation.mjs';
import {normalizeDateTime} from '../web/ip/date-time.mjs';

const suggestions=line=>({id:line.id,heading:'细节',shot:'近景拍摄实际衣料，移动镜头展示表面纹理。',subtitle:'看清细节',transition:'动作匹配切换',audioNote:'轻音乐，保留环境声。',editNote:'画面跟随这句口播。'});
test('完整文案分批生成，口播不改写，缺镜/重复镜头/中途取消不返回可采用结果',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ip-generated-'));await mkdir(join(dir,'staging'));
 try{
  const text=Array.from({length:43},(_,i)=>`第${i+1}句，观察衣服的细节。`).join('\n');const progress=[];let calls=0;
  const result=await generateExecution({title:'隔离测试',text,scriptRevision:4},{dir,stage:x=>progress.push(x),run:async({prompt})=>{calls++;const lines=JSON.parse(prompt.split('文案数据：')[1]);return {text:JSON.stringify({items:lines.map(suggestions).reverse()})};}});
  assert.ok(calls>1);assert.equal(result.count,43);assert.equal(result.draft.segments.map(x=>x.narration).join(''),text);assert.equal(result.scriptRevision,4);assert.equal(progress.length,calls);assert.match(result.draft.segments[0].shot,/近景/);
  const lines=[{id:'one',narration:'第一句。'},{id:'two',narration:'第二句。'}];
  assert.throws(()=>checkGenerated([suggestions(lines[0])],lines),/缺少镜头/);
  assert.throws(()=>checkGenerated([suggestions(lines[0]),suggestions(lines[0])],lines),/编号/);
  assert.throws(()=>narrationParts('a'.repeat(100001)),/10万字/);
  const abort=new AbortController();let completed=0;await assert.rejects(generateExecution({title:'取消',text},{dir,signal:abort.signal,run:async({prompt})=>{completed++;const lines=JSON.parse(prompt.split('文案数据：')[1]);abort.abort();return {text:JSON.stringify({items:lines.map(suggestions)})};}}));assert.equal(completed,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('拍摄日期时间保留24小时原值，拒绝无效日期与进位时间',()=>{
 assert.equal(normalizeDateTime('2026-11-04 09:30'),'2026-11-04T09:30');
 assert.equal(normalizeDateTime('2026-11-04 23:59'),'2026-11-04T23:59');
 assert.equal(normalizeDateTime('2028-02-29 00:00'),'2028-02-29T00:00');
 for(const value of ['2026-02-29 09:30','2026-11-04 24:00','2026-11-04 09:60'])assert.throws(()=>normalizeDateTime(value));
});
