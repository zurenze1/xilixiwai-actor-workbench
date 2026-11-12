export type Template = 'salary'|'hours'|'income';
export type SalaryRow = {label:string;before:string|number;after:string|number};
export type WorkData = {
 template:Template; title:string; beforeLabel:string; afterLabel:string; source:string; period:string; note:string;
 duration:number; appearance:'studio'|'paper';accent:string;focusIndex:string;salaryRows:SalaryRow[]; beforeDays:string|number;afterDays:string|number;
 beforeDailyHours:string|number;afterDailyHours:string|number;beforeIncome:string|number;afterIncome:string|number;
};
export const templateInfo = {
 salary:{name:'工资构成',tag:'SALARY BREAKDOWN',description:'固定工资、奖金、补贴，哪一项变了',title:'工资构成，变化在哪里？'},
 hours:{name:'工时变化',tag:'WORKING HOURS',description:'工作天数 × 每天时长，算清月工时',title:'每个月，多工作了多久？'},
 income:{name:'收入与时薪',tag:'INCOME & HOURLY PAY',description:'月到手收入和实际时薪，放在一起看',title:'收入与时薪，放在一起看'},
} as const;
export const blankData=(template:Template):WorkData=>({template,title:templateInfo[template].title,beforeLabel:'此前',afterLabel:'此后',source:'',period:'',note:'',duration:8,appearance:'studio',accent:'#e6be69',focusIndex:'',salaryRows:[{label:'固定工资',before:'',after:''},{label:'奖金绩效',before:'',after:''},{label:'补贴',before:'',after:''}],beforeDays:'',afterDays:'',beforeDailyHours:'',afterDailyHours:'',beforeIncome:'',afterIncome:''});
export const numeric=(x:string|number):number|null=>x===''||x===null||x===undefined||!Number.isFinite(Number(x))?null:Number(x);
export const fmt=(x:number,decimals=2)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:decimals}).format(Math.abs(x)<.0000001?0:x);
export const signed=(x:number)=>`${x>0?'+':x<0?'−':''}${fmt(Math.abs(x))}`;
export const percent=(before:number,after:number)=>before===0?null:(after-before)/before*100;
export const pct=(x:number|null)=>x===null?'基期为零，未计算比例':`${x>0?'+':x<0?'−':''}${fmt(Math.abs(x),1)}%`;
export function calculation(d:WorkData){
 const fields=d.template==='salary'?d.salaryRows.flatMap(r=>[r.before,r.after]):[d.beforeDays,d.afterDays,d.beforeDailyHours,d.afterDailyHours,...(d.template==='income'?[d.beforeIncome,d.afterIncome]:[])];
 const filled=fields.every(x=>numeric(x)!==null&&(numeric(x)??-1)>=0);
 const a=(x:string|number)=>numeric(x)??0;
 const beforeHours=a(d.beforeDays)*a(d.beforeDailyHours),afterHours=a(d.afterDays)*a(d.afterDailyHours);
 const before=d.template==='salary'?d.salaryRows.reduce((n,r)=>n+a(r.before),0):d.template==='hours'?beforeHours:a(d.beforeIncome);
 const after=d.template==='salary'?d.salaryRows.reduce((n,r)=>n+a(r.after),0):d.template==='hours'?afterHours:a(d.afterIncome);
 const ready=filled&&(d.template!=='income'||(beforeHours>0&&afterHours>0));
 return {ready,before,after,delta:after-before,change:percent(before,after),beforeHours,afterHours,beforeHourly:beforeHours>0?a(d.beforeIncome)/beforeHours:null,afterHourly:afterHours>0?a(d.afterIncome)/afterHours:null};
}
export function validate(d:WorkData):string[]{
 const errors:string[]=[];
 if(!d.title.trim()||d.title.length>20)errors.push('请填写20字以内的画面标题');
 if(!d.beforeLabel.trim()||!d.afterLabel.trim()||d.beforeLabel.length>12||d.afterLabel.length>12)errors.push('请填写12字以内的两期名称');
 if(!d.source.trim()||d.source.length>45)errors.push('请填写45字以内的数据来源');
 if(d.period.length>24||d.note.length>40)errors.push('资料时间限24字，画面备注限40字');
 if(![6,8,10].includes(d.duration))errors.push('时长请选择6、8或10秒');
 if(!/^#[0-9a-f]{6}$/i.test(d.accent))errors.push('重点色需为六位HEX颜色');
 if(!['studio','paper'].includes(d.appearance))errors.push('请选择画面风格');
 const check=(value:string|number,label:string,max:number)=>{const n=numeric(value);if(n===null||n<0||n>max)errors.push(`${label}需填写0至${max}的数值`);};
 if(d.template==='salary'){
  if(d.salaryRows.length<1||d.salaryRows.length>5)errors.push('工资项目需1至5项');
  d.salaryRows.forEach((r,i)=>{if(!r.label.trim()||r.label.length>10)errors.push(`第${i+1}项名称需1至10字`);check(r.before,`第${i+1}项此前金额`,10000000);check(r.after,`第${i+1}项此后金额`,10000000);});
 }else{
  check(d.beforeDays,'此前每月工作天数',31);check(d.afterDays,'此后每月工作天数',31);
  check(d.beforeDailyHours,'此前每天小时',24);check(d.afterDailyHours,'此后每天小时',24);
  if(d.template==='income'){
   check(d.beforeIncome,'此前月到手收入',10000000);check(d.afterIncome,'此后月到手收入',10000000);
   const c=calculation(d);if(c.beforeHours<=0||c.afterHours<=0)errors.push('计算时薪时，两期月工时都必须大于0');
  }
 }
 return [...new Set(errors)];
}
