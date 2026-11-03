let pickers=[];
const FORMAT='Y-m-d\\TH:i';
export function normalizeDateTime(value){
 const m=String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
 if(!m)throw Error('请输入日期和24小时时间，例如 2026-11-03 09:30');
 const [y,mo,d,h,mi]=m.slice(1).map(Number),date=new Date(0);
 date.setUTCFullYear(y,mo-1,d);date.setUTCHours(h,mi,0,0);
 if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d||date.getUTCHours()!==h||date.getUTCMinutes()!==mi)throw Error('日期或时间无效，请重新选择');
 return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
}
export function clearDateTimes(){for(const p of pickers)p.destroy();pickers=[];}
function sync(p){
 const input=p.altInput||p.input,raw=input.value.trim();
 if(!raw){p.clear();input.setCustomValidity('');return;}
 try{const value=normalizeDateTime(raw);p.setDate(value,true,FORMAT);input.setCustomValidity('');}
 catch(e){input.setCustomValidity(e.message);throw e;}
}
export function syncDateTimes(){for(const p of pickers)sync(p);}
export function mountDateTimes(root){
 clearDateTimes();
 for(const input of root.querySelectorAll('[data-date-time]')){
  if(!window.flatpickr)continue;
  const label=input.closest('label').querySelector('span').textContent.replace('*','').trim();
  const p=window.flatpickr(input,{enableTime:true,time_24hr:true,minuteIncrement:1,disableMobile:true,allowInput:true,static:true,altInput:true,dateFormat:FORMAT,altFormat:'Y-m-d H:i',locale:window.flatpickr.l10ns.zh,ariaDateFormat:'Y年m月d日',
   onReady:(_,__,instance)=>{
    instance.altInput.placeholder='选择日期与时间，或输入 2026-11-03 09:30';
    instance.altInput.setAttribute('aria-label',label);
    instance.hourElement.setAttribute('aria-label',label+'小时');
    instance.minuteElement.setAttribute('aria-label',label+'分钟');
   }
  });
  p.altInput.addEventListener('input',()=>p.altInput.setCustomValidity(''));
  p.altInput.addEventListener('blur',e=>{try{sync(p);}catch{e.stopImmediatePropagation();}},{capture:true});
  pickers.push(p);
 }
}
