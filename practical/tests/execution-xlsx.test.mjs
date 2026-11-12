import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {executionWorkbook,executionXlsx} from '../modules/creator-workbench/src/execution-xlsx.mjs';
const sample={scriptVersionNumber:2,createdAt:'2026-11-12T12:00:00+08:00',timezone:'Asia/Shanghai',draft:{title:'分镜导出验证',segments:[{heading:'开场',narration:'=原话不应成为公式\n第二行中文、引号“与”逗号，全部保留。',startSec:0,endSec:3.125,shot:'近景',subtitle:'花字',audioNote:'音乐渐弱',transition:'叠化',editNote:'保留呼吸',executionState:'待剪辑',materials:[{versionId:'m1',role:'主选'}],evidenceIds:['e1']},{narration:'末镜头',shot:'全景'}]},materials:{m1:{filename:'原片.mp4',metadata:{title:'参考画面',url:'https://example.com/video'}}},references:{e1:{text:'引用原话',sourceVersion:{metadata:{title:'来源',url:'https://example.com/source'}}}}};
test('XLSX retains every shot, multiline text, exact time and fixed material references',async()=>{
 const w=await executionWorkbook(sample),s=w.getWorksheet('分镜执行表');assert.equal(s.rowCount,6);assert.equal(s.getCell('A5').value,1);assert.equal(s.getCell('B5').value,'00:00 — 00:03.125\n3.125 秒');assert.equal(s.getCell('C5').value,'开场\n\n'+sample.draft.segments[0].narration);assert.equal(s.getCell('C6').value,'末镜头');assert.match(s.getCell('H5').value,/原片.mp4/);assert.match(s.getCell('H5').value,/引用原话/);assert.match(s.getCell('B6').value,/待定/);
 const files=unzipSync(new Uint8Array(await executionXlsx(sample))),xml=strFromU8(files['xl/worksheets/sheet1.xml']),strings=strFromU8(files['xl/sharedStrings.xml']);assert.match(xml,/state="frozen"/);assert.match(xml,/autoFilter ref="A4:I6"/);assert.match(xml,/orientation="landscape"/);assert.match(strings,/=原话不应成为公式/);assert.doesNotMatch(xml,/<f[ >]/);assert.match(strFromU8(files['xl/styles.xml']),/wrapText="1"/);
});
test('Empty or invalid payload does not silently invent a worksheet',async()=>{await assert.rejects(()=>executionXlsx({}),/缺少分镜/);});
