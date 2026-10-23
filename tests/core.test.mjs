import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDays,timeRange} from '../src/schedule.js';
import {validateMain} from '../src/main-schema.js';
import {runModel,providerBase} from '../server/models.mjs';
const event=(id,time,t='biz',a=2,b=a)=>({id,time,t,a,b});
test('overlap covers two business events; adjacent slots do not clash',()=>{
 assert.equal(scheduleDays([event('a','14:00–16:00'),event('b','15:00–17:00')],31)[1].clash,true);
 assert.equal(scheduleDays([event('a','14:00–16:00'),event('b','16:00–17:00')],31)[1].clash,false);
});
test('rest marker cannot erase work; overnight and unknown time are considered',()=>{
 const days=scheduleDays([event('a','23:00–02:00'),event('b','01:00–03:00','shoot',3),event('c','','rest',2)],31);
 assert.equal(days[1].work,true);assert.equal(days[2].clash,true);
 assert.equal(scheduleDays([event('a',''),event('b','14:00–15:00')],31)[1].potential,true);
 assert.throws(()=>timeRange(event('a','25:00–15:00')));
});
test('nested invalid backup values are rejected instead of replacing saved data',()=>{
 const fresh=()=>({folder:[],reviews:{},files:{},pack:{},home:true,st:0});
 for(const invalid of [{folder:null},{reviews:{home:[{text:'x'}]}},{pack:null},{st:50},{home:'yes'}])assert.throws(()=>validateMain(invalid,fresh));
 assert.deepEqual(validateMain({folder:['take']},fresh).folder,['take']);
});
test('API adapters produce actual provider-specific requests using recipient credentials',async()=>{
 for(const provider of ['openai','deepseek','anthropic']){
  let captured;const fixture=provider==='openai'?{output:[{content:[{type:'output_text',text:'actual result'}]}]}:provider==='anthropic'?{content:[{type:'text',text:'actual result'}]}:{choices:[{message:{content:'actual result'}}]};
  const result=await runModel({provider,model:'recipient-model',apiKey:'test-fixture-not-a-secret'},'source text',{fetcher:async(url,opts)=>{captured={url,opts};return new Response(JSON.stringify(fixture),{status:200});}});
  assert.equal(result.text,'actual result');assert.equal(JSON.parse(captured.opts.body).model,'recipient-model');assert.equal(captured.opts.redirect,'error');
  if(provider==='openai')assert.equal(JSON.parse(captured.opts.body).store,false);
 }
});
test('API authentication failure returns safe errors and local URLs are rejected',async()=>{
 assert.throws(()=>providerBase({provider:'compatible',baseUrl:'http://127.0.0.1/v1'}));
 await assert.rejects(runModel({provider:'openai',model:'model',apiKey:'test-fixture-not-a-secret'},'x',{fetcher:async()=>new Response('secret response',{status:401})}),/认证失败/);
});

import {publicAddress} from '../server/public-fetch.mjs';
test('model transport rejects private, reserved and mapped network destinations',()=>{
 for(const address of ['127.0.0.1','10.0.0.1','192.168.1.3','172.16.0.1','169.254.169.254','100.64.1.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(publicAddress(address),false,address);
 for(const address of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(publicAddress(address),true,address);
});
