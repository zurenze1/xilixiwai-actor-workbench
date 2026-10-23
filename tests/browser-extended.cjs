const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const QA=process.env.QA_DIR||'.runtime/qa';
(async()=>{await fs.mkdir(QA,{recursive:true});
 const b=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})}),c=await b.newContext({acceptDownloads:true}),p=await c.newPage();p.setDefaultTimeout(7000);const errors=[],results=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(process.env.BASE_URL||'http://127.0.0.1:4890');await p.locator('#rvText').waitFor();
 const state=()=>p.evaluate(async()=>(await ActorStore.exportBundle()).state),click=async selector=>{await p.locator(selector).first().evaluate(el=>el.click());await p.waitForFunction(()=>!document.body.dataset.busy);};
 async function check(name,fn){try{await fn();console.log('PASS',name);results.push({name,pass:true});}catch(e){console.log('FAIL',name,e.message);results.push({name,pass:false,error:e.stack});}}
 await check('actual backup restore and corrupt attachment rollback',async()=>{
  await p.setInputFiles('#rvFile',{name:'source.txt',mimeType:'text/plain',buffer:Buffer.from('演员的原始资料')});await p.locator('[data-act=filedownload]').waitFor();await p.fill('#rvText','应恢复的决定');await click('[data-act=rvsave]');
  const doc=await p.evaluate(()=>ActorStore.exportBundle());await p.fill('#rvText','之后新增');await click('[data-act=rvsave]');await click('[data-act=settings]');await p.setInputFiles('#bkFile',{name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await p.waitForTimeout(450);assert.equal((await state()).reviews.home.length,1);
  const bad=structuredClone(doc);bad.files[0].data='AA==';await p.setInputFiles('#bkFile',{name:'corrupt.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await p.locator('#saveError').waitFor();assert.match(await p.locator('#saveError').innerText(),/附件校验失败/);assert.equal((await state()).reviews.home.length,1);await p.reload();await p.locator('#rvText').waitFor();
 });
 await check('failed storage reports failure and does not claim success',async()=>{
  await p.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(key==='workspaces')throw new DOMException('测试：空间不足','QuotaExceededError');return put.apply(this,arguments);};});
  await p.fill('#rvText','存储失败时保留草稿');await click('[data-act=rvsave]');await p.locator('#saveError').waitFor();assert.match(await p.locator('#saveError').innerText(),/未保存/);assert.equal((await state()).reviews.home.length,1);await p.reload();await p.locator('#rvText').waitFor();
 });
 await check('ranking follows weights and zero weights give no false recommendation',async()=>{
  await p.evaluate(async()=>{const d=await ActorStore.exportBundle();d.state.ran.compare=true;d.state.wts={role:0,dir:0,team:0,sched:0,fee:50};d.state.home=false;d.state.st=0;await ActorStore.restoreBundle(d);});await p.reload();await p.locator('.pick').first().waitFor();
  assert.match(await p.locator('.pick').filter({hasText:'当前权重首选'}).innerText(),/云端之上/);
  await p.locator('[data-wt=fee]').fill('0');await p.waitForTimeout(150);assert.equal(await p.locator('.pick .tag').count(),0);assert.match(await p.locator('#main').innerText(),/所有权重为0/);
 });
 await check('biography and fan replies can be edited and exported',async()=>{
  await p.evaluate(async()=>{const d=await ActorStore.exportBundle();d.state.ran.bio=true;await ActorStore.restoreBundle(d);});await p.reload();await p.locator('#rvText').waitFor();await click('[data-act=go][data-i="1"]');await click('[data-act=tab][data-v=bio]');await click('[data-act=editbio]');await p.fill('#editText','我自己重写的小传 <保留为文字>');await click('[data-act=saveedit]');assert.match(await p.locator('#main').innerText(),/我自己重写的小传 <保留为文字>/);
  await click('[data-act=go][data-i="-5"]');await click('[data-act=editreply]');await p.fill('#editText','谢谢关注，我们会在确认后分享。');await click('[data-act=saveedit]');assert.match(await p.locator('#main').innerText(),/谢谢关注，我们会在确认后分享/);
 });
 await check('archive includes changed project data and attachment originals',async()=>{
  await click('[data-act=settings]');await click('[data-act=archive]');const d=await p.evaluate(()=>ActorStore.exportBundle());assert.equal(d.state.archives.length,1);assert.ok(JSON.parse(d.state.archives[0].snap).bioEdits.main);assert.equal(d.files.length,1);
  await click('[data-act=archiveexport]');await click('[data-act=close]');
 });
 await check('all themes/pages render with no broken images or horizontal page overflow',async()=>{
  await p.evaluate(async()=>{const d=await ActorStore.exportBundle();for(const k of ['compare','take','vet','rel','growth','subtext','keysc','bio','rcard','lineopt','beats','dance','looks','shots','call','tasks','classify','report','itv','brand','rights','plan','airdata','selfrev','port','crisis','clause','offer0','fanplan','orgcheck','fanpost','bodyplan','legs','wear','sched','brief'])d.state.ran[k]=true;await ActorStore.restoreBundle(d);});await p.reload();await p.locator('#rvText').waitFor();const rows=[];
  for(const theme of ['tide','butter','moss']){await click(`[data-act=theme][data-v=${theme}]`);for(const width of [1440,390,320]){await p.setViewportSize({width,height:900});for(const i of [-1,0,1,2,3,4,5,6,7,-8,-6,-5,-7,-4,-9,-2,-3]){await click(`[data-act=go][data-i="${i}"]`);await p.waitForTimeout(35);rows.push(await p.evaluate(({theme,i})=>({theme,i,width:innerWidth,doc:document.documentElement.scrollWidth,broken:[...document.images].filter(e=>e.complete&&!e.naturalWidth).map(e=>e.getAttribute('src'))}),{theme,i}));} }console.log('layout theme',theme);}
  await fs.writeFile(path.join(QA,'layout-after.json'),JSON.stringify(rows,null,2));const overflow=rows.filter(r=>r.doc>r.width+2);assert.deepEqual(overflow,[]);assert.deepEqual(rows.filter(r=>r.broken.length),[]);
 });
 await fs.writeFile(path.join(QA,'browser-extended.json'),JSON.stringify({results,errors},null,2));await b.close();if(results.some(r=>!r.pass)||errors.length){console.log('PAGE ERRORS',errors);process.exitCode=1;}
})().catch(e=>{console.error(e);process.exit(1)});
