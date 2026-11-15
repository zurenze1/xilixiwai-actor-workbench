import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newsChannel} from '../modules/creator-workbench/server/news-channels.mjs';
import {Store} from '../modules/creator-workbench/server/store.mjs';
import {ingestDaily,latestDigest} from '../modules/creator-workbench/server/discovery.mjs';
import {creatorRoute,CREATOR_DESKS} from '../web/ip/creator-navigation.mjs';

test('历史前缀分开映射时尚、服装，未识别资料进入其他',()=>{
 assert.equal(newsChannel({channel:'people',category:'人物故事'}),'people');
 assert.equal(newsChannel({channel:'culture',title:'时尚界热点｜设计师的新系列'}),'culture');
 assert.equal(newsChannel({channel:'other',title:'服装类热点｜羊毛护理'}),'apparel');
 assert.equal(newsChannel({channel:'culture',title:'历史文化资料',category:'文学'}),'other');
 assert.equal(newsChannel({channel:'other',title:'没有分类的旧记录'}),'other');
 assert.equal(newsChannel({channel:'ai'}),'ai');
 assert.equal(newsChannel({channel:'finance',category:'劳动与收入'}),'finance');
 assert.equal(newsChannel({channel:'other',category:'财经｜住房'}),'finance');
});

test('旧radar链接可用，记住上次类别，未知分类安全回到全部',()=>{
 const routes=['today','radar','topics'];
 assert.deepEqual(creatorRoute('#radar',routes),{route:'radar',page:'finance'});
 assert.deepEqual(creatorRoute('#radar',routes,{radarPage:'finance'}),{route:'radar',page:'finance'});
 assert.deepEqual(creatorRoute('#radar~people',routes,{radarPage:'finance'}),{route:'radar',page:'people'});
 assert.deepEqual(creatorRoute('#radar',routes,{radarPage:'removed'}),{route:'radar',page:'daily'});
 assert.deepEqual(creatorRoute('#radar~comments',routes),{route:'radar',page:'comments'});
 assert.deepEqual(CREATOR_DESKS.radar.map(x=>x[1]),['全部','人物','时尚界','服装','AI','财经','竞品评论洞察','行业早报','其他']);
});

test('正式日报导入保留财经与服装分类、来源和事实，幂等重试不新增',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'news-channels-')),store=new Store(join(dir,'workbench.sqlite'));
 try{
  await mkdir(join(dir,'staging'));await mkdir(join(dir,'blobs'));
  const now=new Date(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const body={day,generatedAt:now.toISOString(),model:'test fixture',news:[
   {channel:'finance',category:'财经｜就业',title:'就业数据测试',facts:'这是测试用事实占位，不进入正式数据。',analysis:'区分就业人数与收入。',publishedAt:day,readScope:'isolated fixture',sources:[{name:'测试来源',url:'https://example.com/employment'}]},
   {channel:'other',category:'服装类热点',title:'服装类热点｜面料测试',facts:'仅隔离环境使用。',analysis:'比较织法。',publishedAt:day,readScope:'isolated fixture',sources:[{name:'测试来源',url:'https://example.com/fabric'}]}
  ]};
  const first=await ingestDaily(store,dir,body),again=await ingestDaily(store,dir,body);
  assert.equal(again.duplicate,true);assert.equal(again.id,first.id);
  const saved=latestDigest(store,day).payload.news;
  assert.deepEqual(saved.map(n=>n.channel),['finance','apparel']);
  assert.equal(saved[0].analysis,body.news[0].analysis);assert.deepEqual(saved[0].sources,body.news[0].sources);
  assert.equal(store.db.prepare('SELECT count(*) n FROM daily_digests').get().n,1);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
