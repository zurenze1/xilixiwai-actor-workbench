import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validateMain} from '../src/main-schema.js';
const ctx={window:{}};vm.runInNewContext(await readFile(new URL('../web/data.js',import.meta.url),'utf8'),ctx);vm.runInNewContext(await readFile(new URL('../web/demo-experience.js',import.meta.url),'utf8'),ctx);
const E=ctx.DemoExperience,D=ctx.window.DEMO;
const fresh=()=>({ran:{},folder:[],reviews:{},replyEdits:{},replySubmissions:{},experience:{active:false,step:0,checks:{}},selfAns:{},tasks:D.tasks.map(x=>({...x})),handling:'probe',scope:'ad',scopeTried:false});
test('showing canned outputs does not complete actions the visitor has not performed',()=>{
 const s=fresh();s.folder=['take','role','prev','shoot','deal','review'];s.ran={compare:true,take:true,subtext:true,beats:true,shots:true,tasks:true,classify:true,rights:true,selfrev:true};
 assert.equal(E.statuses(s)[0].done,false);assert.equal(E.statuses(s)[1].done,false);assert.equal(E.statuses(s)[2].done,false);assert.equal(E.statuses(s)[4].done,false);assert.equal(E.statuses(s)[5].done,false);assert.equal(E.statuses(s)[7].done,false);
});
test('reply audit exports retain submitted text separately from later edits',()=>{
 const s=fresh();s.replySubmissions[1]={text:'第一版审核快照',tone:'warm',at:'10/24 02:00',risk:false,edited:true};s.replyEdits['comment-1-warm']='尚未再次提交的第二版';
 const md=E.report(s,D);assert.match(md,/第一版审核快照/);assert.match(md,/尚未再次提交的第二版/);assert.match(md,/未自动发送或发布/);
});
test('export uses actual handling, task progress and original personal review',()=>{
 const s=fresh();s.handling='restrain';s.folder=['role'];s.ran.tasks=true;s.tasks=[{t:'我新增的任务',who:'虚构经纪人',due:'明天下午',col:2}];s.selfAns={0:'我的复盘回答'};
 const md=E.report(s,D);assert.match(md,/我选的演法：克制/);assert.ok(md.includes(D.handlings[0].rhythm));assert.match(md,/已完成｜我新增的任务｜虚构经纪人/);assert.match(md,/我的复盘回答/);assert.match(md,/尚未完成/);
});
test('new guided state and immutable reply snapshot survive main backup validation',()=>{
 const s=fresh();s.experience={active:true,step:5,checks:{replyEdited:true}};s.replySubmissions[1]={text:'保存的审核版本',tone:'formal',at:'10/24 02:00',risk:false,edited:true};
 const out=validateMain(JSON.parse(JSON.stringify(s)),fresh);assert.deepEqual(out.experience,s.experience);assert.deepEqual(out.replySubmissions,s.replySubmissions);
 const old=validateMain({folder:[]},fresh);assert.equal(old.experience.step,0);assert.deepEqual(old.replySubmissions,{});
});
test('corrupt guided step and audit snapshot are rejected before replacing a backup',()=>{
 for(const patch of [{experience:{active:true,step:8,checks:{}}},{experience:{active:'yes',step:0,checks:{}}},{replySubmissions:{1:{text:'x',tone:'unknown',at:'now',risk:false,edited:true}}}])assert.throws(()=>validateMain({...fresh(),...patch},fresh));
});
