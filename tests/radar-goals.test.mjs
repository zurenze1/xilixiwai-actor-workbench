import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../web/radar-goals.js';
import {mainSchema,validateMain} from '../src/main-schema.js';
import {validateRecord} from '../practical/server/validation.mjs';
import {parseHTML} from 'linkedom';
const R=globalThis.ActorRadar;
const plan=()=>{const p=R.blank();p.owner='虚构演员与工作室';p.reviewDate='2027-02-28';p.axes[0].current=0;p.axes[0].target=20;return p;};

test('unknown scores stay null while explicit zero remains an assessed value',()=>{
 const p=R.validate(plan(),{complete:true});assert.equal(p.axes[0].current,0);assert.equal(p.axes[1].current,null);
 const svg=R.svg(p);assert.equal((svg.match(/data-radar-point="current"/g)||[]).length,1);assert.doesNotMatch(svg,/data-radar-series="current"/);assert.match(svg,/cx="170" cy="158"/);assert.doesNotMatch(svg,/NaN|Infinity/);
 const md=R.markdown(p);assert.match(md,/现在：0 \/ 100/);assert.match(md,/现在：未评 \/ 100/);assert.match(md,/目标：待定 \/ 100/);
});
test('goals may intentionally be below the current assessment',()=>{
 const p=plan();p.axes[0].current=90;p.axes[0].target=35;assert.equal(R.validate(p,{complete:true}).axes[0].target,35);
});
test('reject scores outside the range, fractions, strings, NaN and Infinity',()=>{
 for(const value of[-1,101,.5,NaN,Infinity,-Infinity,'80',undefined])for(const key of['current','target']){
  const p=plan();p.axes[0][key]=value;assert.throws(()=>R.validate(p),/0–100整数/,'invalid '+key+' '+String(value));
 }
 for(const value of[0,100,null]){const p=plan();p.axes[0].target=value;assert.equal(R.validate(p).axes[0].target,value);}
});
test('calendar validation rejects nonexistent dates and accepts a leap day',()=>{
 for(const date of['2026-02-29','2026-02-30','2027-04-31','0000-01-01','2027-13-01','2027-01-00','2027-2-01','invalid']){const p=plan();p.reviewDate=date;assert.throws(()=>R.validate(p),/真实日期/,date);}
 for(const date of['','2028-02-29','2027-12-31']){const p=plan();p.reviewDate=date;assert.equal(R.validate(p).reviewDate,date);}
});
test('a complete plan requires responsible people and at least one known score',()=>{
 assert.doesNotThrow(()=>R.validate(R.blank()));assert.throws(()=>R.validate(R.blank(),{complete:true}),/周期和共同设定者/);
 const p=R.blank();p.owner='虚构团队';assert.throws(()=>R.validate(p,{complete:true}),/至少填写一个/);p.axes[3].target=0;assert.doesNotThrow(()=>R.validate(p,{complete:true}));
});
test('eight unique axes retain immutable identifiers, safe string bounds and shape',()=>{
 for(const alter of[p=>p.axes.pop(),p=>p.axes.push({...p.axes[0]}),p=>p.axes[0].id='axis-9',p=>p.axes[0].label='',p=>p.axes[1].label=p.axes[0].label,p=>p.axes[2].evidence='x'.repeat(2001),p=>p.axes[3].action=42,p=>p.owner='x'.repeat(201)]){const p=plan();alter(p);assert.throws(()=>R.validate(p));}
});
test('all eight axis labels and source/action strings are escaped in SVG and forms',()=>{
 const p=plan();p.period='<img src=x onerror=1>';p.owner='" onfocus="run()';p.rubric='</textarea><script>evil()</script>';
 p.axes.forEach((r,i)=>{r.label='<b>轴'+i+'</b>';r.evidence='</textarea><img src=x onerror=1>';r.action='<script>evil()</script>';r.current=i*10;r.target=100-i*10;});
 const svg=R.svg(p),form=R.form(p);assert.doesNotMatch(svg,/<img|<b>/);assert.match(svg,/&lt;b&gt;轴0&lt;\/b&gt;/);assert.doesNotMatch(form,/<script>|<img src=x/);assert.match(form,/&lt;\/textarea&gt;&lt;script&gt;/);assert.equal((svg.match(/data-radar-series=/g)||[]).length,2);
 const {document}=parseHTML('<main>'+svg+form+'</main>');assert.equal(document.querySelector('script,img,[onerror],[onfocus]'),null);
 // Download text keeps the actor's actual words rather than HTML entities.
 assert.match(R.markdown(p),/<script>evil\(\)<\/script>/);
});
test('old main states and backups without a radar remain valid and do not invent a score',()=>{
 const fresh=()=>({theme:'tide',home:true,radarPlan:null,tasks:[],folder:[]});
 const old=validateMain({theme:'tide',home:true,tasks:[],folder:[]},fresh);assert.equal(old.radarPlan,null);
 const empty=validateMain({radarPlan:null},fresh);assert.equal(empty.radarPlan,null);
 const p=plan(),roundtrip=JSON.parse(JSON.stringify({radarPlan:p}));assert.equal(mainSchema.parse(roundtrip).radarPlan.axes[1].current,null);assert.equal(mainSchema.parse(roundtrip).radarPlan.axes[0].current,0);
 p.axes[0].current=NaN;assert.equal(mainSchema.safeParse({radarPlan:p}).success,false);
});
test('server-side goal validation enforces the same radar contract on record writes',()=>{
 const good=plan();assert.doesNotThrow(()=>validateRecord('goal',{radar:good}));
 for(const alter of[p=>p.axes[0].current=101,p=>p.axes[0].target=NaN,p=>p.reviewDate='2027-02-30',p=>p.owner='',p=>p.axes[1].label=p.axes[0].label]){const p=plan();alter(p);assert.throws(()=>validateRecord('goal',{radar:p}));}
 assert.doesNotThrow(()=>validateRecord('goal',{goal:'既有普通目标',status:'规划中'}));
});
