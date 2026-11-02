// The existing daily workflow, pointed explicitly at this IP's creative library.
import fsp from 'node:fs/promises';
import {config} from '../practical/modules/creator-workbench/server/config.mjs';
import {Store} from '../practical/modules/creator-workbench/server/store.mjs';
import {creators,ingestDaily,dailyStatus} from '../practical/modules/creator-workbench/server/discovery.mjs';
import {events} from '../practical/modules/creator-workbench/server/public-events.mjs';
const args=process.argv.slice(2);
if(!args.includes('--data')||!args[args.indexOf('--data')+1])throw Error('必须用 --data 指定当前IP的创作目录，未写入默认旧库');
const cfg=config(args),store=new Store(cfg.db);
try{
 if(args[0]==='context')console.log(JSON.stringify({creators:creators(store).filter(a=>a.follow),collector:store.get('discovery.collector')||null,automation:dailyStatus(store),dailyRequirements:{peopleTarget:10,channels:['people','culture','ai','other'],peopleUniqueBy:'person',image:'imageUrl must be the actual source image; unavailable stays empty'},existingEvents:events(store).slice(-200)},null,2));
 else if(args[0]==='import'){
  const p=args.indexOf('--file');if(p<0||!args[p+1])throw Error('请指定 --file 日报.json');
  if((await fsp.stat(args[p+1])).size>2*1024*1024)throw Error('日报文件超过2MB');
  console.log(JSON.stringify(await ingestDaily(store,cfg.dir,JSON.parse(await fsp.readFile(args[p+1],'utf8'))),null,2));
 }else throw Error('使用 context 或 import --file 日报.json，并指定 --data IP创作目录');
}catch(e){console.error(e.message);process.exitCode=1;}finally{store.close();}
