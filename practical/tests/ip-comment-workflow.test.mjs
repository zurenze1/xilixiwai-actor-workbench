import {syncCloudCompetitors} from '../modules/creator-workbench/server/comment-cloud.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {Store} from '../modules/creator-workbench/server/store.mjs';
import {saveCreator} from '../modules/creator-workbench/server/discovery.mjs';
import {setReplyTarget,ingestCommentScan,researchPool,generateCommentReplies,replyRows,changeReply,claimReply,finishReply,manualReplySession} from '../modules/creator-workbench/server/comment-workflow.mjs';
async function fixture(fn){const dir=await mkdtemp(path.join(tmpdir(),'ip-comments-'));await mkdir(path.join(dir,'staging'));await mkdir(path.join(dir,'blobs'));const s=new Store(path.join(dir,'workbench.sqlite'));try{await fn(s,dir);}finally{s.close();await rm(dir,{recursive:true,force:true});}}
const url=i=>'https://www.douyin.com/video/'+i;
const scan=(accountId,extra={})=>({accountId,purpose:'research',observedAt:new Date().toISOString(),videos:[{url:url(1),title:'实际衣服细节'}],origin:'隔离测试',scope:'测试夹具，未访问外网',status:'成功',comments:[],...extra});
const comment=(text,likes)=>({videoUrl:url(1),text,author:'观众',likes,likesLabel:String(likes)});
test('竞品动态启用、50赞边界、点赞降序、最高5条与展开筛选，不混本人评论',()=>fixture(async(s,dir)=>{
 const p=saveCreator(s,{name:'竞品甲',url:'https://www.douyin.com/user/peer',follow:true});const own=s.account({name:'本人',role:'自有'});
 await ingestCommentScan(s,dir,scan(p.id,{comments:[comment('49赞不入库',49),comment('未知不入库',null),...Array.from({length:8},(_,i)=>comment('评论'+i,50+i*200))]}));
 let pool=researchPool(s,{});assert.equal(pool.total,8);assert.equal(pool.items.length,5);assert.equal(pool.items[0].likes,1450);assert.equal(researchPool(s,{minLikes:1000}).total,3);assert.equal(researchPool(s,{limit:25}).items.length,8);assert.throws(()=>researchPool(s,{minLikes:49}),/最低/);
 saveCreator(s,{follow:false},p.id);assert.equal(researchPool(s,{}).total,0);await assert.rejects(ingestCommentScan(s,dir,scan(p.id)),/尚未/);assert.equal(own.role,'自有');
}));
test('最近作品窗口更新后旧作品不显示，旧原件仍在',()=>fixture(async(s,dir)=>{
 const p=saveCreator(s,{name:'竞品',url:'https://www.douyin.com/user/peer'});await ingestCommentScan(s,dir,scan(p.id,{observedAt:new Date(Date.now()-2000).toISOString(),comments:[comment('旧作品高赞',9999)]}));
 await ingestCommentScan(s,dir,scan(p.id,{videos:[{url:url(2),title:'新作品'}],comments:[{...comment('新作品评论',50),videoUrl:url(2)}]}));assert.equal(researchPool(s).items[0].text,'新作品评论');assert.equal(researchPool(s).total,1);assert.equal(s.db.prepare('SELECT count(*) n FROM comment_observations').get().n,2);
}));
test('本人评论不受50赞限制；生成不发送，审核修订和目标账号保护，单次领取防重复',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});
 const b=scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[comment('想看面料',0)]});await assert.rejects(ingestCommentScan(s,dir,{...b,identity:{douyinId:'87654321'}}),/身份/);await ingestCommentScan(s,dir,b);
 const ids=s.db.prepare('SELECT id FROM comment_observations').all().map(r=>r.id);await generateCommentReplies(s,dir,{accountId:a.id,ids},{run:async()=>({text:JSON.stringify({replies:[{id:ids[0],body:'收到，下次可以专门聊聊面料细节。'}]})})});let r=replyRows(s)[0];assert.equal(r.state,'待审核');assert.throws(()=>claimReply(s,r.id),/批准/);
 r=changeReply(s,r.id,{revision:r.revision,action:'approve'});assert.throws(()=>changeReply(s,r.id,{revision:1,action:'approve'}),/已经变化/);r=changeReply(s,r.id,{revision:r.revision,body:'我把这个方向记下来。'});assert.equal(r.state,'待审核');assert.equal(r.approved_body,'');assert.throws(()=>claimReply(s,r.id),/批准/);
 r=changeReply(s,r.id,{revision:r.revision,action:'approve'});setReplyTarget(s,{accountId:a.id,name:'另一个账号',douyinId:'87654321',url:'https://www.douyin.com/user/other'});assert.throws(()=>claimReply(s,r.id),/批准/);setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});
 const claimed=claimReply(s,r.id);assert.throws(()=>claimReply(s,r.id),/批准/);assert.throws(()=>finishReply(s,r.id,{dispatchToken:claimed.dispatchToken,body:'擅自改文案'}),/不一致/);
 const done={dispatchToken:claimed.dispatchToken,body:claimed.body,state:'已发送',videoUrl:url(1),identity:{douyinId:'12345678'},proof:'隔离测试回执，未发送任何外部消息'};assert.throws(()=>finishReply(s,r.id,{...done,videoUrl:url(2)}),/作品/);assert.equal(finishReply(s,r.id,done).state,'已发送');assert.throws(()=>claimReply(s,r.id),/批准/);assert.throws(()=>changeReply(s,r.id,{revision:r.revision,body:'覆盖'}),/不能改写/);
}));

test('飞书竞品新增即进入名单，手动停用保留，原表移除不删历史',()=>fixture(async(s)=>{
 const src=records=>[{type:'competitors',tableId:'tableA',records}];const row={record_id:'one',竞品名称:'原表竞品',核查入口:['https://www.xingtu.cn/ad/creator/author-homepage/douyin-video/123']};
 assert.equal(syncCloudCompetitors(s,src([row])).added,1);assert.equal(syncCloudCompetitors(s,src([row])).added,0);const account=s.db.prepare("SELECT id FROM accounts WHERE name='原表竞品'").get();saveCreator(s,{follow:false},account.id);syncCloudCompetitors(s,src([row]));assert.equal(researchPool(s).creators.length,0);syncCloudCompetitors(s,src([]));assert.ok(s.row('accounts',account.id));
}));

test('飞书对标理由保留明确目标IP和原表链接，账号仍使用已核对的抖音主页',()=>fixture(async(s)=>{
 const rows=[{record_id:'one',竞品名称:'服装观察者',对标对象:'目标IP',入选理由:'与目标IP同讲服装与人物',差异与限制:'不照搬人设',重点拆解项:'把审美判断写成可见细节',关系类型:['内容接近'],抖音主页:'https://www.douyin.com/user/verified'}];
 syncCloudCompetitors(s,[{type:'competitors',tableId:'tableA',url:'https://example.test/base',records:rows}]);
 const peer=researchPool(s).creators[0];assert.equal(peer.research.target,'目标IP');assert.equal(peer.research.reason,rows[0].入选理由);assert.equal(peer.research.sourceUrl,'https://example.test/base');assert.equal(peer.url,rows[0].抖音主页);
}));

test('多竞品样本超过2000条后仍完整筛出低赞竞品，概览不随单个竞品或门槛隐藏',()=>fixture(async(s,dir)=>{
 const peers=[];
 for(let i=0;i<3;i++){const p=saveCreator(s,{name:'竞品'+i,url:'https://www.douyin.com/user/p'+i});peers.push(p);const u=url(100+i);await ingestCommentScan(s,dir,scan(p.id,{videos:[{url:u,title:'隔离作品'+i}],comments:Array.from({length:800},(_,n)=>({...comment(i+'-'+n,i===2?50:10000-i),videoUrl:u}))}));}
 const pool=researchPool(s,{accountId:peers[2].id});assert.equal(pool.total,800);assert.deepEqual(pool.coverage.map(c=>c.hotCount),[800,800,800]);assert.equal(pool.items.length,5);
 const high=researchPool(s,{accountId:peers[2].id,minLikes:1000});assert.equal(high.total,0);assert.equal(high.coverage.length,3);assert.equal(high.coverage[2].works,1);assert.equal(high.coverage[2].hotCount,800);
}));

test('生成未完成先显示评论，人工改稿后迟到模型结果不覆盖',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});await ingestCommentScan(s,dir,scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[comment('真实问题',0)]}));let r=replyRows(s)[0];assert.equal(r.state,'待生成');r=changeReply(s,r.id,{revision:r.revision,body:'本人已经修改的回复'});await generateCommentReplies(s,dir,{accountId:a.id,ids:[r.comment_id]},{run:async()=>({text:JSON.stringify({replies:[{id:r.comment_id,body:'迟到的模型草稿'}]})})});assert.equal(replyRows(s)[0].body,'本人已经修改的回复');
}));

test('采集任务拟回复直接进入待审核，重采不覆盖已批准版本',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});const b=scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[{...comment('想了解细节',0),replyDraft:'下期可以讲讲这个细节。'}]});await ingestCommentScan(s,dir,b);let r=replyRows(s)[0];assert.equal(r.state,'待审核');r=changeReply(s,r.id,{revision:r.revision,action:'approve'});await ingestCommentScan(s,dir,{...b,comments:[{...b.comments[0],replyDraft:'后来的另一版'}]});assert.equal(replyRows(s)[0].body,'下期可以讲讲这个细节。');assert.equal(replyRows(s)[0].state,'已批准');
}));

test('本人回复窗口只接审核稿；重复打开不重复领取，关闭后不自动重发',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});
 await ingestCommentScan(s,dir,scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[{...comment('想了解细节',0),replyDraft:'这个细节可以再展开聊。'}]}));
 let r=replyRows(s)[0];assert.throws(()=>manualReplySession(s,r.id,{action:'start'}),/审核|确认/);
 r=changeReply(s,r.id,{revision:r.revision,action:'approve'});const again=changeReply(s,r.id,{revision:r.revision,action:'approve'});assert.equal(again.revision,r.revision);assert.equal(again.approved_at,r.approved_at);
 const pane=manualReplySession(s,r.id,{action:'start'});assert.equal(pane.reply.state,'本人回复中');assert.equal(pane.reply.dispatch_token,'');assert.equal(pane.reply.approved_body,r.approved_body);
 assert.equal(manualReplySession(s,r.id,{action:'start'}).session,pane.session);assert.throws(()=>claimReply(s,r.id),/批准/);
 assert.throws(()=>changeReply(s,r.id,{revision:r.revision,body:'覆盖'}),/不能改写/);
 assert.throws(()=>manualReplySession(s,r.id,{action:'reported',session:'wrong'}),/窗口已变化/);
 const closed=manualReplySession(s,r.id,{action:'closed',session:pane.session});assert.equal(closed.state,'需核对');assert.equal(closed.reply.sent_at,'');assert.throws(()=>claimReply(s,r.id),/批准/);
 const resumed=manualReplySession(s,r.id,{action:'start'});assert.equal(resumed.resumed,true);assert.equal(resumed.reply.state,'需核对');
 const reported=manualReplySession(s,r.id,{action:'reported',session:pane.session});assert.equal(reported.state,'需核对');assert.equal(reported.reply.sent_at,'');
 const back=manualReplySession(s,r.id,{action:'cancel',session:pane.session});assert.equal(back.state,'待审核');assert.equal(back.reply.body,r.body);assert.equal(back.reply.approved_at,'');assert.equal(back.reply.approved_body,'');assert.throws(()=>manualReplySession(s,r.id,{action:'start'}),/审核/);
}));

test('本人回复窗口不重开已发送记录，不借用改变后的目标账号',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});
 await ingestCommentScan(s,dir,scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[{...comment('问题',0),replyDraft:'收到这个问题。'}]}));
 let r=replyRows(s)[0];r=changeReply(s,r.id,{revision:r.revision,action:'approve'});
 setReplyTarget(s,{accountId:a.id,name:'其他',douyinId:'87654321',url:'https://www.douyin.com/user/selfB'});assert.throws(()=>manualReplySession(s,r.id,{action:'start'}),/目标/);
 setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});
 const claimed=claimReply(s,r.id);assert.throws(()=>manualReplySession(s,r.id,{action:'start'}),/重新打开/);
 finishReply(s,r.id,{dispatchToken:claimed.dispatchToken,body:r.body,state:'已发送',videoUrl:url(1),identity:{douyinId:'12345678'},proof:'隔离测试回执，没有平台发送'});assert.throws(()=>manualReplySession(s,r.id,{action:'start'}),/重新打开/);
}));

test('实测本人窗口时须显式匹配会话才可领取，日常任务不领取人工窗口',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});
 await ingestCommentScan(s,dir,scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[{...comment('本人窗口测试',0),replyDraft:'只发送本人审核的原文。'}]}));
 let r=replyRows(s)[0];r=changeReply(s,r.id,{revision:r.revision,action:'approve'});const pane=manualReplySession(s,r.id,{action:'start'});
 assert.throws(()=>claimReply(s,r.id),/批准/);assert.throws(()=>claimReply(s,r.id,{manualSession:'其他窗口'}),/批准/);
 const c=claimReply(s,r.id,{manualSession:pane.session});assert.equal(c.state,'发送中');assert.equal(c.body,r.approved_body);assert.throws(()=>claimReply(s,r.id,{manualSession:pane.session}),/批准/);
 const done=finishReply(s,r.id,{dispatchToken:c.dispatchToken,body:c.approved_body,state:'已发送',videoUrl:url(1),identity:{douyinId:'12345678'},proof:'隔离测试，仅验证状态，不操作平台'});assert.equal(done.state,'已发送');
}));

test('身份验证后的原发送可补记真实回执，保留窗口信息且不重新发送',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});
 await ingestCommentScan(s,dir,scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[{...comment('短信验证测试',0),replyDraft:'原审核稿保持不变。'}]}));
 let r=replyRows(s)[0];r=changeReply(s,r.id,{revision:r.revision,action:'approve'});const pane=manualReplySession(s,r.id,{action:'start'}),c=claimReply(s,r.id,{manualSession:pane.session});
 const receipt={dispatchToken:c.dispatchToken,body:c.approved_body,videoUrl:url(1),identity:{douyinId:'12345678'},proof:'隔离测试，没有平台发送'};
 const held=finishReply(s,r.id,{...receipt,state:'需核对'});assert.equal(JSON.parse(held.receipt).manualSession,pane.session);assert.throws(()=>claimReply(s,r.id,{manualSession:pane.session}),/批准/);
 assert.throws(()=>finishReply(s,r.id,{...receipt,state:'发送失败'}),/重试/);assert.throws(()=>finishReply(s,r.id,{...receipt,state:'已发送',dispatchToken:'wrong'}),/凭据/);
 assert.equal(finishReply(s,r.id,{...receipt,state:'已发送',proof:'隔离测试中新补记的回读证据'}).state,'已发送');assert.throws(()=>finishReply(s,r.id,{...receipt,state:'已发送'}),/凭据/);
}));
