const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.ACTOR_QA_CHROME?{executablePath:process.env.ACTOR_QA_CHROME}:{})});
 const context=await browser.newContext({viewport:{width:1600,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
 const result=[];
 for(const kind of ['film','outro'])for(const theme of ['tide','butter','moss']){
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:4906/${kind}.html?theme=${theme}&render=1`);await p.waitForFunction(()=>window.__ready);
  result.push({kind,theme,...await p.evaluate(()=>({duration:window.__total/1000,scenes:window.__sceneMeta,palette:getComputedStyle(document.documentElement).getPropertyValue('--bg'),font:getComputedStyle(document.documentElement).getPropertyValue('--serif'),timeline:!!window.__timelines?.[document.getElementById('stage').dataset.compositionId]})),errors});
  await p.evaluate(()=>window.__seek(6000));await p.screenshot({path:`web/scripts/actor3-render/qa/${kind}-${theme}-6s.png`});await p.close();
 }
 fs.writeFileSync('web/scripts/actor3-render/qa/probe.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
