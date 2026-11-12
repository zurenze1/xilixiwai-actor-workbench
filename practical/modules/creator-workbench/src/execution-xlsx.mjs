// ExcelJS 4.4.0 (MIT), vendored for an offline, dependency-free installed app.
import ExcelJS from '../vendor/exceljs-4.4.0.cjs';

function clock(n){
 if(n==null)return '待定';
 const ms=Math.round(n*1000),m=Math.floor(ms/60000),s=Math.floor(ms/1000)%60;
 return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+(ms%1000?'.'+String(ms%1000).padStart(3,'0').replace(/0+$/,''):'');
}
const str=v=>String(v??'');
function savedTime(value,zone){
 if(!value)return '未提供';
 try{return new Intl.DateTimeFormat('zh-CN',{timeZone:zone||undefined,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value)).replaceAll('/','-');}catch{return str(value);}
}
function materialText(s,p){
 const items=(s.materials||[]).map(ref=>{
  const m=p.materials?.[ref.versionId];if(!m)return '素材信息未补齐';
  const meta=m.metadata||{},src=m.source||{};
  return [meta.title||src.title||m.filename||'未命名素材',ref.role,m.filename,meta.url||src.url].filter(Boolean).join('\n');
 });
 for(const id of s.evidenceIds||[]){const e=p.references?.[id],m=e?.sourceVersion?.metadata;if(e)items.push(['引用：'+(m?.title||'资料'),e.text,m?.url].filter(Boolean).join('\n'));}
 return items.join('\n\n');
}
export async function executionWorkbook(p){
 if(!p?.draft||!Array.isArray(p.draft.segments))throw Error('固定版本缺少分镜内容，未生成空表。');
 const wb=new ExcelJS.Workbook();wb.creator='IP工作台';
 const ws=wb.addWorksheet('分镜执行表',{views:[{state:'frozen',ySplit:4,xSplit:2,showGridLines:false,zoomScale:80}],pageSetup:{paperSize:8,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.4,bottom:.4,header:.15,footer:.15}}});
 ws.columns=[7,18,48,38,26,28,28,36,12].map(width=>({width}));
 ws.mergeCells('A1:I1');ws.getCell('A1').value=p.draft.title||p.topic?.title||'分镜执行表';ws.getCell('A1').font={name:'微软雅黑',size:20,bold:true,color:{argb:'FF193E57'}};ws.getRow(1).height=36;
 ws.mergeCells('A2:I2');ws.getCell('A2').value=`固定版本 v${p.scriptVersionNumber||1} · ${p.draft.segments.length} 个镜头 · 保存时间 ${savedTime(p.createdAt,p.timezone)}${p.timezone?'（'+p.timezone+'）':''}`;ws.getCell('A2').font={name:'微软雅黑',size:10,color:{argb:'FF637887'}};ws.getRow(2).height=25;ws.getRow(3).height=10;
 const headers=['镜号','时间 / 时长','口播文案','画面 / 素材需求','花字 / 字幕','转场 / 音乐 / 音效','剪辑备注','素材与引用出处','执行状态'];
 const header=ws.getRow(4);header.values=headers;header.height=29;
 header.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF244D66'}};cell.font={name:'微软雅黑',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle',wrapText:true};});
 for(const [i,s]of p.draft.segments.entries()){
  const time=clock(s.startSec)+' — '+clock(s.endSec)+(s.startSec!=null&&s.endSec!=null?'\n'+Math.round((s.endSec-s.startSec)*1000)/1000+' 秒':'');
  const values=[i+1,time,[s.heading,s.narration].filter(Boolean).join('\n\n'),s.shot,s.subtitle,[s.transition&&'转场：'+s.transition,s.audioNote&&'声音：'+s.audioNote].filter(Boolean).join('\n'),s.editNote,materialText(s,p),s.executionState||'待填写'];
  const row=ws.addRow(values.map((v,c)=>c===0?v:str(v)));
  row.eachCell({includeEmpty:true},cell=>{cell.font={name:'微软雅黑',size:11,color:{argb:'FF203C50'}};cell.alignment={vertical:'top',wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:i%2?'FFF0F5F8':'FFFFFFFF'}};cell.border={bottom:{style:'hair',color:{argb:'FFD6E0E7'}}};});
  const lines=Math.max(...values.map((v,c)=>str(v).split('\n').reduce((n,t)=>n+Math.max(1,Math.ceil([...t].reduce((a,ch)=>a+(ch.charCodeAt(0)>255?2:1),0)/(ws.columns[c].width-2))),0)));
  row.height=Math.min(409,Math.max(66,lines*17+12));row.getCell(1).font={name:'微软雅黑',size:12,bold:true,color:{argb:'FF244D66'}};
 }
 ws.autoFilter={from:'A4',to:'I'+Math.max(4,ws.rowCount)};ws.pageSetup.printTitlesRow='1:4';ws.pageSetup.printArea='A1:I'+ws.rowCount;ws.headerFooter.oddFooter='&L'+str(p.draft.title).replace(/&/g,'&&').slice(0,100)+'&R第 &P / &N 页';
 return wb;
}
export async function executionXlsx(p){return (await executionWorkbook(p)).xlsx.writeBuffer();}
