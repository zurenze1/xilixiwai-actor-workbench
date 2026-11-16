import {readFileSync} from 'node:fs';
import path from 'node:path';
import {Store} from '../practical/modules/creator-workbench/server/store.mjs';
import {saveDailyEditorial} from '../practical/modules/creator-workbench/server/daily-editorial.mjs';
import {appendDailyNews} from '../practical/modules/creator-workbench/server/discovery.mjs';
const args=process.argv.slice(2),option=k=>args[args.indexOf(k)+1];
if(!args.includes('--data')||!args.includes('--file'))throw Error('请明确 --data 创作库目录与 --file 编辑思考JSON');
const dir=path.resolve(option('--data')),store=new Store(path.join(dir,'workbench.sqlite'));
try{const batch=JSON.parse(readFileSync(option('--file'),'utf8'));const result=[];for(const body of Array.isArray(batch)?batch:[batch])result.push(await (args.includes('--append')?appendDailyNews:saveDailyEditorial)(store,dir,body));console.log(JSON.stringify(result));}finally{store.close();}
