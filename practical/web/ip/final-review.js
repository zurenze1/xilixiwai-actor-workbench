export const FINAL_GROUPS=[
 {name:'画面',items:['水印已检查','无意外黑边','无意外黑场','画面清晰，无明显低质素材']},
 {name:'字幕',items:['错别字已核对','双行字幕已检查','字幕大小保持一致','无字幕叠字幕','字幕投影已检查']},
 {name:'声音',items:['BGM已检查','段落响度统一','需要的音效已补齐','音效与画面相符','音质清楚，无明显杂音']}
];
export const FINAL_COUNT=FINAL_GROUPS.reduce((n,g)=>n+g.items.length,0);
export const emptyChecks=()=> '0'.repeat(FINAL_COUNT);
export function checkProgress(value){const bits=String(value||'');return {done:[...bits].filter(c=>c==='1').length,total:FINAL_COUNT,complete:bits==='1'.repeat(FINAL_COUNT)};}
export function finalChecksHTML(value,{esc,id='',editable=false}={}){
 const bits=/^[01]{14}$/.test(value||'')?value:emptyChecks();let index=0;
 const p=checkProgress(bits);
 return `<div class="final-checks" data-final-list><p class="review-progress"><strong>${p.done} / ${p.total}</strong> 项已核对${p.complete?' · 本版核对完成':''}</p>${FINAL_GROUPS.map(g=>`<fieldset><legend>${g.name}</legend>${g.items.map(text=>{const i=index++;return `<label class="final-check-row"><input type="checkbox" data-final-index="${i}"${id?` data-final-id="${esc(id)}"`:''}${bits[i]==='1'?' checked':''}${editable?'':' disabled'}><span>${esc(text)}</span></label>`;}).join('')}</fieldset>`).join('')}</div>`;
}
