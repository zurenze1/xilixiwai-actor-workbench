import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarRecords} from '../web/ip/calendar-model.mjs';

test('archiving a video preserves its dated history without restoring hidden or cancelled records',()=>{
 const rows=[
  {id:'work',kind:'ip-work',body:{archived:true}},
  {id:'history',kind:'ip-event',title:'写稿',body:{workId:'work',status:'完成'}},
  {id:'private-archive',kind:'ip-event',title:'旧草案',body:{archived:true}},
  {id:'cancelled',kind:'ip-event',title:'已取消',body:{status:'取消'}},
 ];
 assert.deepEqual(calendarRecords(rows).map(r=>r.id),['history']);
 assert.equal(rows[0].body.archived,true);
});

test('a rescheduled calendar event is shown once while original shoot metadata remains intact',()=>{
 const body={start:'2026-08-03T10:00',end:'2026-08-03T11:00'};
 const rows=[
  {id:'shoot',kind:'ip-shoot',title:'视频拍摄',body:{...body,contentId:'script-1'}},
  {id:'rescheduled',kind:'ip-event',title:'拍摄｜视频',body:{...body,start:'2026-08-04T10:00',end:'2026-08-04T11:00',notes:'稿件 script-1'}},
  {id:'other',kind:'ip-event',title:'客户沟通',body:{...body}},
 ];
 assert.deepEqual(calendarRecords(rows).map(r=>r.id),['rescheduled','other']);
 assert.equal(rows[0].body.start,'2026-08-03T10:00');
});
