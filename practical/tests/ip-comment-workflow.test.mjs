import {syncCloudCompetitors} from '../modules/creator-workbench/server/comment-cloud.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {Store} from '../modules/creator-workbench/server/store.mjs';
import {saveCreator} from '../modules/creator-workbench/server/discovery.mjs';
import {setReplyTarget,ingestCommentScan,researchPool,generateCommentReplies,replyRows,changeReply,claimReply,finishReply} from '../modules/creator-workbench/server/comment-workflow.mjs';
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

test('生成未完成先显示评论，人工改稿后迟到模型结果不覆盖',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});await ingestCommentScan(s,dir,scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[comment('真实问题',0)]}));let r=replyRows(s)[0];assert.equal(r.state,'待生成');r=changeReply(s,r.id,{revision:r.revision,body:'本人已经修改的回复'});await generateCommentReplies(s,dir,{accountId:a.id,ids:[r.comment_id]},{run:async()=>({text:JSON.stringify({replies:[{id:r.comment_id,body:'迟到的模型草稿'}]})})});assert.equal(replyRows(s)[0].body,'本人已经修改的回复');
}));

test('采集任务拟回复直接进入待审核，重采不覆盖已批准版本',()=>fixture(async(s,dir)=>{
 const a=s.account({name:'本人',role:'自有'});setReplyTarget(s,{accountId:a.id,name:'本人',douyinId:'12345678',url:'https://www.douyin.com/user/selfA'});const b=scan(a.id,{purpose:'inbox',identity:{douyinId:'12345678'},comments:[{...comment('想了解细节',0),replyDraft:'下期可以讲讲这个细节。'}]});await ingestCommentScan(s,dir,b);let r=replyRows(s)[0];assert.equal(r.state,'待审核');r=changeReply(s,r.id,{revision:r.revision,action:'approve'});await ingestCommentScan(s,dir,{...b,comments:[{...b.comments[0],replyDraft:'后来的另一版'}]});assert.equal(replyRows(s)[0].body,'下期可以讲讲这个细节。');assert.equal(replyRows(s)[0].state,'已批准');
}));
