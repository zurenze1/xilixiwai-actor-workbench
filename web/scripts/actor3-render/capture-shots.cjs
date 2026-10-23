const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const mapping={home:'home',take:'st=0',read:'st=1',role:'st=2',dance:'st=2',prev:'st=3',call:'st=4',promo:'st=5',deal:'st=6',folder:'st=7',trip:'trip',body:'body',portfolio:'portfolio',fans:'fans',deals:'deals',crisis:'crisis',brief:'brief',charity:'charity'};
const ROOT=path.resolve('web/assets/shots'),QA=path.resolve('web/scripts/actor3-render/qa');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.ACTOR_QA_CHROME?{executablePath:process.env.ACTOR_QA_CHROME}:{})});
 const rows=[];
 for(const theme of ['tide','butter','moss']){
  const ctx=await browser.newContext({viewport:{width:1600,height:900},locale:'zh-CN'}),p=await ctx.newPage();
  for(const [key,hash]of Object.entries(mapping)){
   await p.goto('http://127.0.0.1:4906/index.html#'+hash);await p.locator('[data-act="theme"][data-v="'+theme+'"]').first().click();
   if(key==='dance'){const b=p.locator('[data-act="tab"][data-v="dance"]');if(await b.count())await b.first().click();}
   if(key==='call'){const b=p.locator('[data-act="tab"][data-v="call"]');if(await b.count())await b.first().click();}
   await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(100);
   for(const suffix of ['a','b']){
    if(suffix==='b'){const run=p.locator('[data-act="run"]:visible');if(await run.count()){await run.first().click();await p.locator('[id^="think-"]').waitFor({state:'detached',timeout:12000}).catch(()=>{});}}
    const dest=path.join(ROOT,theme,key+'_'+suffix+'.png'),backup=path.join(ROOT,'originals_20261023',theme,key+'_'+suffix+'.png');
    if(fs.existsSync(dest)&&!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(dest,backup)}
    fs.mkdirSync(path.dirname(dest),{recursive:true});await p.screenshot({path:dest});
   }
   rows.push({theme,key,actualTheme:await p.locator('html').getAttribute('data-theme')});console.log(JSON.stringify(rows.at(-1)));
  }await ctx.close();
 }await browser.close();fs.writeFileSync(path.join(QA,'shots-recaptured.json'),JSON.stringify(rows,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
