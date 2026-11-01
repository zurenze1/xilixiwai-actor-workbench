import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matrixModel,count} from '../web/ip/matrix.js';
import '../web/ip/schema.js';
const record=(id,kind,body)=>({id,kind,title:id,body});
const account=record('a','ip-account',{platform:'抖音',handle:'fixture',profileUrl:'https://example.test/account'});
const snap=(id,date,followers,source='同来源')=>record(id,'ip-account-snapshot',{accountId:'a',measuredOn:date,followers,dataSource:source,sourceUrl:'https://example.test/account',scope:'平台主页累计',sourceMode:'人工记录'});
const work=(id,date,likes,publishedOn='',url='https://example.test/work')=>record(id,'ip-work-snapshot',{accountId:'a',url,measuredOn:date,publishedOn,likes,scope:'作品当前累计',dataSource:'虚构测试来源',sourceMode:'人工记录'});
test('Matrix uses latest observations without summing snapshots or converting missing metrics to zero',()=>{
 const data=[account,snap('s1','2026-10-30','100'),snap('s2','2026-10-31','120'),snap('other-source','2026-10-29','999','不同来源'),work('w1','2026-10-30','90'),work('w2','2026-10-31','0'),work('unknown','2026-10-31','5','','https://example.test/unknown')];
 const m=matrixModel(data);assert.equal(m.allWorks.length,2);assert.equal(m.byAccount[0].snapshot.id,'s2');assert.equal(m.byAccount[0].delta,20);assert.equal(m.allWorks.find(w=>w.body.url.endsWith('/work')).body.likes,'0');assert.equal(count(''),null);assert.equal(count(undefined),null);assert.equal(count('0'),0);
 assert.equal(matrixModel(data,{from:'2026-10-01'}).works.length,0);
 assert.equal(matrixModel(data.map(x=>x.id==='a'?{...x,body:{...x.body,archived:true}}:x)).allWorks.length,0);
 assert.equal(matrixModel([account,snap('s1','2026-10-30','100'),snap('s2','2026-10-31','120','不同来源')]).byAccount[0].delta,null);
});
test('Matrix validation rejects invalid sources, impossible chronology and falsely empty follower counts',()=>{
 const {validate}=globalThis.IPSchema;
 assert.throws(()=>validate('ip-account',{...account.body,profileUrl:'javascript:alert(1)'}),/HTTP/);
 assert.throws(()=>validate('ip-account-snapshot',{...snap('s','2026-10-31','').body}),/粉丝/);
 assert.throws(()=>validate('ip-work-snapshot',{...work('w','2026-10-31','5','2026-11-01').body}),/发布日期/);
 assert.throws(()=>validate('ip-work-snapshot',{...work('w','2026-10-31','-1').body}),/非负整数/);
 assert.doesNotThrow(()=>validate('ip-work-snapshot',work('w','2026-10-31','0').body));
});
