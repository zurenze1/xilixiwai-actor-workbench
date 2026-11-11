// Creation/import time is audit metadata, not the work's historical date.
// Keep the date argument for existing callers; business dates stay in their fields.
export function archiveName(title,_createdAt,version=1){
 const name=String(title||'未命名').trim();
 return [name,`V${Math.max(1,Number(version)||1)}`].join(' ');
}
export function archiveFilename(title,createdAt,version=1,extension='md'){
 return archiveName(title,createdAt,version).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,180)+'.'+extension;
}
