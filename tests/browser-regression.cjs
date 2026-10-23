const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const QA=process.env.QA_DIR||'.runtime/qa',BASE=process.env.BASE_URL||'http://127.0.0.1:4890';
(async()=>{await fs.mkdir(QA,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});const ctx=await browser.newContext({acceptDownloads:true}),p=await ctx.newPage(),errors=[];
 p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);await p.locator('#rvText').waitFor();
 const click=async selector=>{await p.click(selector);await p.waitForFunction(()=>document.body.dataset.busy!=='1');};
 const results=[];async function check(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message);}}
 const state=()=>p.evaluate(async()=> (await ActorStore.exportBundle()).state);
 await check('draft survives theme, navigation and reload',async()=>{
  await p.locator('#rvText').fill('未提交的决定草稿');await p.locator('#rvWho').selectOption('助理');await click('[data-act=theme][data-v=butter]');assert.equal(await p.inputValue('#rvText'),'未提交的决定草稿');
  await click('[data-act=go][data-i="0"]');await click('[data-act=go][data-i="-1"]');assert.equal(await p.inputValue('#rvText'),'未提交的决定草稿');await p.reload();await p.locator('#rvText').waitFor();assert.equal(await p.inputValue('#rvText'),'未提交的决定草稿');assert.equal(await p.inputValue('#rvWho'),'助理');
 });
 await check('decision persists without duplicating its draft',async()=>{await click('[data-act=rvsave]');await p.waitForTimeout(300);assert.equal((await state()).reviews.home.length,1);await p.reload();await p.locator('#rvText').waitFor();assert.equal(await p.inputValue('#rvText'),'');});
 await check('20 text originals survive storage beyond old localStorage quota',async()=>{
  const files=Array.from({length:20},(_,i)=>({name:`source-${i}.txt`,mimeType:'text/plain',buffer:Buffer.from(('测试'+i).padEnd(290000,'x'))}));await p.setInputFiles('#rvFile',files);await p.waitForFunction(()=>document.querySelectorAll('[data-act=filedownload]').length===20,{},{timeout:30000});await p.reload();await p.locator('[data-act=filedownload]').first().waitFor();assert.equal((await state()).files.home.length,20);
  const original=await p.evaluate(async()=>{const d=await ActorStore.exportBundle();const row=d.state.files.home[0];const blob=await ActorStore.getFile(row.file.id);return {bytes:blob.size,text:(await blob.text()).slice(0,4),files:d.files.length};});assert.equal(original.bytes,290004);assert.equal(original.files,20);
 });
 await check('malformed nested backup does not mutate existing records',async()=>{
  await click('[data-act=settings]');await p.setInputFiles('#bkFile',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'xilixiwai',version:1,state:{folder:null}}))});await p.locator('#saveError').waitFor();assert.match(await p.locator('#saveError').innerText(),/未保存/);assert.equal((await state()).reviews.home.length,1);await p.reload();await p.locator('#rvText').waitFor();assert.equal((await state()).files.home.length,20);
 });
 await check('two tabs reject stale writes and preserve saved decisions',async()=>{
  const q=await ctx.newPage();await q.goto(BASE);await q.locator('#rvText').waitFor();await p.fill('#rvText','A窗口最新决定');await click('[data-act=rvsave]');await p.waitForTimeout(250);await q.click('[data-act=theme][data-v=moss]');await q.locator('#saveError').waitFor();assert.match(await q.locator('#saveError').innerText(),/另一窗口/);assert.equal((await state()).reviews.home.length,2);await q.close();
 });
 await check('editable project team data and custom works import persist',async()=>{
  await click('[data-act=go][data-i="0"]');await p.fill('#project-director','虚构导演甲');await p.fill('#project-team','制片：乙；摄影：丙');await click('[data-act=saveproject]');await p.reload();await p.locator('#rvText').waitFor();await click('[data-act=go][data-i="0"]');assert.equal(await p.inputValue('#project-director'),'虚构导演甲');
  await click('[data-act=go][data-i="-8"]');await p.setInputFiles('#worksFile',{name:'works.csv',mimeType:'text/csv',buffer:Buffer.from('作品名,年份,角色,题材,备注\n"片名,含逗号",2025,主角,现实,自填\n')});await p.waitForTimeout(400);assert.equal((await state()).userWorks[0].title,'片名,含逗号');
 });
 await check('theme-only preference writes do not mutate workspace records',async()=>{
  const before=(await state()).reviews.home.length;await p.goto(BASE+'/launch.html');await p.waitForTimeout(250);await p.goto(BASE);await p.locator('#rvText').waitFor();assert.equal((await state()).reviews.home.length,before);
 });
 await check('320px navigation remains visible and touchable across all 17 sections',async()=>{
  await p.setViewportSize({width:320,height:850});for(const i of [-1,0,1,2,3,4,5,6,7,-8,-6,-5,-7,-4,-9,-2,-3]){await p.locator(`[data-act=go][data-i="${i}"]`).first().evaluate(e=>e.click());await p.waitForTimeout(90);const bad=await p.locator('#side .st[data-act=go]').evaluateAll(es=>es.filter(e=>!e.innerText.trim()||e.getBoundingClientRect().width<44).length);assert.equal(bad,0);}
  await p.screenshot({path:path.join(QA,'mobile-320-after.png'),fullPage:true});
 });
 assert.equal(errors.length,0,JSON.stringify(errors));await fs.writeFile(path.join(QA,'browser-regression.json'),JSON.stringify({results,errors},null,2));await browser.close();if(results.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
