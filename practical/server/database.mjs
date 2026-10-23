import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
export const id=()=>randomUUID(),now=()=>new Date().toISOString(),hash=value=>createHash('sha256').update(value).digest('hex');
export const fail=(message,status=400)=>{const error=Error(message);error.status=status;throw error;};
export function createDatabase(dataDir,secret){
 mkdirSync(dataDir,{recursive:true,mode:0o700});
 const db=new DatabaseSync(join(dataDir,'workbench.sqlite'));db.exec(`PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS studios(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS members(studio_id TEXT NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),name TEXT NOT NULL,email TEXT NOT NULL,PRIMARY KEY(studio_id,user_id));
 CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,studio_id TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL,expires_at TEXT NOT NULL,used_by TEXT);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,studio_id TEXT NOT NULL,title TEXT NOT NULL,actor TEXT NOT NULL,phase INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,studio_id TEXT NOT NULL,project_id TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,visibility TEXT NOT NULL CHECK(visibility IN ('team','private')),owner_id TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS records_project ON records(project_id,kind);
 CREATE TABLE IF NOT EXISTS record_versions(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,studio_id TEXT NOT NULL,project_id TEXT NOT NULL,owner_id TEXT NOT NULL,visibility TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,path TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,studio_id TEXT NOT NULL,project_id TEXT NOT NULL,file_id TEXT,name TEXT NOT NULL,text TEXT NOT NULL,source_url TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL DEFAULT 1,metadata TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,studio_id TEXT NOT NULL,owner_id TEXT NOT NULL,visibility TEXT NOT NULL,name TEXT NOT NULL,provider TEXT NOT NULL,model TEXT NOT NULL,base_url TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'text',sealed_key TEXT NOT NULL,tested_at TEXT,status TEXT NOT NULL DEFAULT 'untested');
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,studio_id TEXT NOT NULL,project_id TEXT NOT NULL,owner_id TEXT NOT NULL,connection_id TEXT NOT NULL,task TEXT NOT NULL,status TEXT NOT NULL,input TEXT NOT NULL,result TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,studio_id TEXT NOT NULL,project_id TEXT,user_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 `);
 const documentCols=new Set(db.prepare('PRAGMA table_info(documents)').all().map(c=>c.name));if(!documentCols.has('owner_id'))db.exec("ALTER TABLE documents ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';");if(!documentCols.has('visibility'))db.exec("ALTER TABLE documents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'team';");
 const versionCols=new Set(db.prepare('PRAGMA table_info(record_versions)').all().map(c=>c.name));if(!versionCols.has('visibility'))db.exec("ALTER TABLE record_versions ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';");if(!versionCols.has('owner_id'))db.exec("ALTER TABLE record_versions ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';");
 if(!versionCols.has('title'))db.exec('ALTER TABLE record_versions ADD COLUMN title TEXT;');
 const encryptionKey=createHash('sha256').update(secret).digest();
 const seal=text=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey,iv),bytes=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),bytes].map(b=>b.toString('base64url')).join('.');};
 const unseal=text=>{const[iv,tag,bytes]=text.split('.').map(b=>Buffer.from(b,'base64url')),d=createDecipheriv('aes-256-gcm',encryptionKey,iv);d.setAuthTag(tag);return Buffer.concat([d.update(bytes),d.final()]).toString('utf8');};
 const get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 let transactionDepth=0;
 const transaction=fn=>{const level=transactionDepth++,savepoint='nested_'+level;try{db.exec(level?'SAVEPOINT '+savepoint:'BEGIN IMMEDIATE');try{const result=fn();db.exec(level?'RELEASE SAVEPOINT '+savepoint:'COMMIT');return result;}catch(e){db.exec(level?'ROLLBACK TO SAVEPOINT '+savepoint:'ROLLBACK');if(level)db.exec('RELEASE SAVEPOINT '+savepoint);throw e;}}finally{transactionDepth--;}};
 const member=(studio,user,write=false)=>{const m=get('SELECT * FROM members WHERE studio_id=? AND user_id=?',studio,user);if(!m)fail('没有这个工作室的访问权限',403);if(write&&m.role==='viewer')fail('当前为只读成员，不能修改',403);return m;};
 const project=(pid,studio,user,write=false)=>{const m=member(studio,user);const p=get('SELECT * FROM projects WHERE id=? AND studio_id=?',pid,studio);if(!p)fail('项目不存在或不属于当前工作室',404);const data=JSON.parse(p.data);if(data.internal==='business'&&m.role!=='owner')fail('经营资料仅管理员可访问',403);if(data.internal===true&&p.created_by!==user)fail('私人资料不可访问',404);if(write&&m.role==='viewer'&&data.internal!==true)fail('当前为只读成员',403);return {...p,data};};
 const audit=(studio,user,action,target,detail={},pid=null)=>run('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)',id(),studio,pid,user,action,target,JSON.stringify(detail),now());
 const listRecords=(pid,studio,user,kind)=>all("SELECT * FROM records WHERE project_id=? AND studio_id=? AND (visibility='team' OR owner_id=?)"+(kind?' AND kind=?':'')+' ORDER BY updated_at DESC',...([pid,studio,user,...(kind?[kind]:[])])).map(r=>({...r,body:JSON.parse(r.body)}));
 const record=(rid,pid,studio,user,write=false)=>{project(pid,studio,user,write);const r=get("SELECT * FROM records WHERE id=? AND project_id=? AND studio_id=? AND (visibility='team' OR owner_id=?)",rid,pid,studio,user);if(!r)fail('记录不存在或无权查看',404);return {...r,body:JSON.parse(r.body)};};
 function saveRecord({rid,pid,studio,user,kind,title,body,visibility='team',revision}){
  const p=project(pid,studio,user,true);if(p.data.internal===true||p.data.internal==='business')visibility='private';if(!['team','private'].includes(visibility))fail('可见范围无效');const encoded=JSON.stringify(body);if(encoded.length>2_000_000)fail('单条记录过长，请分开保存',413);
  return transaction(()=>{
   const stamp=now();if(rid){const old=record(rid,pid,studio,user,true);if(visibility!==old.visibility&&old.owner_id!==user)fail('只有创建者能修改记录可见范围',403);if(revision!==old.revision)fail('记录已被其他成员更新，请先保存草稿再重新读取',409);if(old.owner_id!==user&&old.visibility==='private')fail('只能修改自己的私密记录',403);run('INSERT INTO record_versions(id,record_id,revision,body,actor_id,created_at,visibility,owner_id,title) VALUES(?,?,?,?,?,?,?,?,?)',id(),rid,old.revision,JSON.stringify(old.body),user,stamp,old.visibility,old.owner_id,old.title);run('UPDATE records SET title=?,body=?,visibility=?,revision=revision+1,updated_at=? WHERE id=?',title,encoded,visibility,stamp,rid);}
   else {rid=id();run('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?,?)',rid,studio,pid,kind,title,encoded,visibility,user,1,stamp,stamp);}
   audit(studio,user,'record.save',rid,{kind},pid);return record(rid,pid,studio,user);
  });
 }
 function personalProject(studio,user){member(studio,user.id);let p=get("SELECT * FROM projects WHERE studio_id=? AND created_by=? AND json_extract(data,'$.internal')=1",studio,user.id);if(!p){const pid=id(),stamp=now();run('INSERT INTO projects VALUES(?,?,?,?,?,?,?,?,?,?,?)',pid,studio,'私人资料',user.name,0,1,JSON.stringify({internal:true}),0,user.id,stamp,stamp);p=get('SELECT * FROM projects WHERE id=?',pid);}return p.id;}
 function businessProject(studio,user){const m=member(studio,user.id);if(m.role!=='owner')return null;let p=get("SELECT * FROM projects WHERE studio_id=? AND json_extract(data,'$.internal')='business'",studio);if(!p){const pid=id(),stamp=now();run('INSERT INTO projects VALUES(?,?,?,?,?,?,?,?,?,?,?)',pid,studio,'经营管理','',0,1,JSON.stringify({internal:'business'}),0,user.id,stamp,stamp);p=get('SELECT * FROM projects WHERE id=?',pid);}return p.id;}
 function socialProject(studio,user){member(studio,user.id);let p=get("SELECT * FROM projects WHERE studio_id=? AND json_extract(data,'$.internal')='social'",studio);if(!p){const pid=id(),stamp=now();run('INSERT INTO projects VALUES(?,?,?,?,?,?,?,?,?,?,?)',pid,studio,'内容与账号运营','',0,1,JSON.stringify({internal:'social'}),0,user.id,stamp,stamp);p=get('SELECT * FROM projects WHERE id=?',pid);}return p.id;}
 function ensureStudio(user){const existing=all('SELECT s.*,m.role FROM studios s JOIN members m ON m.studio_id=s.id WHERE m.user_id=?',user.id);if(existing.length)return existing;
  return transaction(()=>{const studio=id();run('INSERT INTO studios VALUES(?,?,?)',studio,user.name+'的工作室',now());run('INSERT INTO members VALUES(?,?,?,?,?)',studio,user.id,'owner',user.name,user.email);if(!get("SELECT value FROM settings WHERE key='local_owner'"))run('INSERT INTO settings VALUES(?,?)','local_owner',user.id);return all('SELECT s.*,m.role FROM studios s JOIN members m ON m.studio_id=s.id WHERE m.user_id=?',user.id);});
 }
 return {db,get,all,run,transaction,member,project,record,saveRecord,listRecords,audit,ensureStudio,personalProject,businessProject,socialProject,seal,unseal,close:()=>db.close()};
}
