import {betterAuth} from 'better-auth';
import {getMigrations} from 'better-auth/db/migration';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
export async function createAuth({dataDir,baseURL}) {
 await mkdir(dataDir,{recursive:true,mode:0o700});
 const file=join(dataDir,'master.secret');let secret=process.env.PRACTICAL_SECRET;
 if(!secret){try{secret=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;secret=randomBytes(48).toString('base64url');await writeFile(file,secret,{mode:0o600,flag:'wx'});}}
 if(secret.length<32)throw Error('PRACTICAL_SECRET 至少32个字符');
 const authDb=new DatabaseSync(join(dataDir,'identity.sqlite'));authDb.exec('PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;');
 const auth=betterAuth({database:authDb,baseURL,secret,emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128},trustedOrigins:[baseURL],session:{expiresIn:60*60*24*7,updateAge:60*60*12},rateLimit:{enabled:true,window:60,max:40},advanced:{database:{validateSchema:false},useSecureCookies:baseURL.startsWith('https:'),defaultCookieAttributes:{sameSite:'lax',httpOnly:true}},logger:{level:'error'}});
 await (await getMigrations(auth.options)).runMigrations();
 return {auth,masterSecret:secret,close:()=>authDb.close()};
}
