// Historical calendar entries remain visible when their video is archived.
export function calendarRecords(records){
 const listed=records.filter(r=>['ip-event','ip-shoot'].includes(r.kind)&&!r.body.archived&&r.body.status!=='取消');
 const events=listed.filter(r=>r.kind==='ip-event');
 // A dated calendar plan can be rescheduled without rewriting an old shoot record.
 return listed.filter(r=>r.kind!=='ip-shoot'||!events.some(e=>e.title.startsWith('拍摄｜')&&((r.body.workId&&e.body.workId===r.body.workId)||(r.body.contentId&&(e.body.notes||'').includes(r.body.contentId)))));
}
