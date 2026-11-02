// Display and export labels only: preserve original titles and creation dates.
export function archiveName(title,createdAt,version=1){
 const d=new Date(createdAt),day=Number.isFinite(d.getTime())?`${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`:'';
 const name=String(title||'未命名').trim();
 return [day,name,`V${Math.max(1,Number(version)||1)}`].filter(Boolean).join(' ');
}
export function archiveFilename(title,createdAt,version=1,extension='md'){
 return archiveName(title,createdAt,version).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,180)+'.'+extension;
}
