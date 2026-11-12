import React from 'react';
import {AbsoluteFill,Easing,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {WorkData,calculation,fmt,numeric,pct,percent,signed,templateInfo} from './work-data-v3';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const fit=(s:string,w:number,max:number)=>Math.min(max,w/Math.max(1,s.length*.61));
export const WorkDataScene:React.FC<{data:WorkData}>=({data:d})=>{
 const frame=useCurrentFrame(),{width,height,fps,durationInFrames}=useVideoConfig(),v=height>width;
 const c=calculation(d),pad=v?90:100,inner=width-pad*2,info=templateInfo[d.template],paper=d.appearance==='paper';
 const accent=/^#[0-9a-f]{6}$/i.test(d.accent||'')?d.accent:'#e6be69';
 const C={bg:paper?'#eeede5':'#101613',ink:paper?'#1a3029':'#f5f2e5',muted:paper?'#738071':'#9ca89b',panel:paper?'#17231c':'#17211b',panelText:'#f7f4e8',panelMuted:'#aab4a5',line:paper?'#d1d7ca':'#334032',track:'#2c362c'};
 const phase=(a:number,b:number)=>interpolate(frame,[a*fps,Math.min(b*fps,durationInFrames-2*fps)],[0,1],{...clamp,easing:Easing.bezier(.16,1,.3,1)});
 const first=phase(.25,1.0),second=phase(.9,1.85),conclusion=phase(1.6,2.25);
 const panelTop=v?470:350,panelH=v?1080:550,leftWidth=v?inner:550,chartLeft=v?40:630,chartW=v?inner-80:inner-690;
 const denseSalary=!v&&d.template==='salary'&&d.salaryRows.length>3;
 const autoFocus=d.salaryRows.reduce((best,r,i)=>Math.abs(Number(r.after)-Number(r.before))>Math.abs(Number(d.salaryRows[best].after)-Number(d.salaryRows[best].before))?i:best,0);
 const focus=d.focusIndex!==''&&Number(d.focusIndex)<d.salaryRows.length?Number(d.focusIndex):autoFocus;
 const rowColor=(i:number)=>i===focus?accent:['#718276','#a6b3a1','#c4c7ad','#738d90','#a79e98'][i];
 const hourly=d.template==='income',a=hourly?(c.beforeHourly??0):c.before,b=hourly?(c.afterHourly??0):c.after,delta=b-a,change=percent(a,b);
 const percentHero=hourly&&change!==null;
 const hero=percentHero?pct(change):signed(delta*conclusion),unit=hourly?'元 / 时':d.template==='hours'?'小时 / 月':'元 / 月';
 const basis=d.template==='salary'?'项目合计按填写项计算，未计入未填写项目':d.template==='hours'?'月工时 = 工作天数 × 每天工作小时':'到手时薪 = 月到手收入 ÷ 月工时';
 const pairBars=(before:number,after:number,unitLabel:string)=>{
  const max=Math.max(before,after,1);
  return <div style={{display:'flex',flexDirection:'column',gap:v?(hourly?32:54):hourly?28:37}}>{[[d.beforeLabel,before,first],[d.afterLabel,after,second]].map(([label,value,draw],i)=><div key={i}><div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:20,marginBottom:v?(hourly?14:19):hourly?13:15}}><span style={{fontSize:v?40:32,color:C.panelMuted}}>{label as string}</span><span style={{fontSize:fit(fmt(value as number),v?510:600,v?(hourly?64:70):hourly?58:64),fontWeight:600,letterSpacing:-1,fontVariantNumeric:'tabular-nums',color:C.panelText}}>{fmt(value as number)}<small style={{fontSize:v?33:28,marginLeft:12,fontWeight:400,color:C.panelMuted}}>{unitLabel}</small></span></div><div style={{height:v?(hourly?64:70):hourly?52:64,background:C.track,overflow:'hidden',borderRadius:3}}><div style={{height:'100%',width:`${(value as number)/max*(draw as number)*100}%`,background:i===0?'#91a18d':accent,borderRadius:3}}/></div></div>)}</div>;
 };
 return <AbsoluteFill data-testid="work-scene" style={{background:C.bg,color:C.ink,fontFamily:'"PingFang SC","Microsoft YaHei",sans-serif',fontVariantNumeric:'tabular-nums'}}>
  <div style={{position:'absolute',width:v?1000:1400,height:v?1000:1400,right:-480,top:-650,background:`radial-gradient(circle,${accent}12,transparent 68%)`}}/>
  <div style={{position:'absolute',left:pad,right:pad,top:v?100:76,display:'flex',alignItems:'center',gap:14,color:paper?'#5f735c':accent,fontSize:v?30:25,letterSpacing:2}}><span style={{height:12,width:12,background:accent}}/>{info.name}<span style={{marginLeft:'auto',fontSize:v?20:19,color:C.muted,letterSpacing:1.5}}>{info.tag}</span></div>
  <div style={{position:'absolute',left:pad,right:pad,top:v?180:149}}><div style={{fontSize:v?(d.title.length>11?66:79):78,lineHeight:1.23,letterSpacing:-2,fontWeight:650,overflowWrap:'anywhere'}}>{v&&(d.title||info.title).length>11?<>{(d.title||info.title).slice(0,10)}<br/>{(d.title||info.title).slice(10)}</>:d.title||info.title}</div><div style={{display:'flex',alignItems:'center',gap:24,marginTop:v?25:20,fontSize:v?36:29,color:C.muted}}><span>{d.beforeLabel||'此前'}</span><span style={{color:paper?'#657b57':accent}}>→</span><span>{d.afterLabel||'此后'}</span></div></div>
  <div data-testid="data-panel" style={{position:'absolute',left:pad,right:pad,top:panelTop,height:panelH,background:C.panel,border:`1px solid ${paper?'#253226':'#34402f'}`,boxShadow:paper?'0 25px 60px #182b1f20':'0 25px 55px #00000022',overflow:'hidden'}}>
   {!c.ready?<div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:v?42:24,color:C.panelMuted}}><svg width="190" height="120" viewBox="0 0 190 120"><rect x="0" y="65" width="140" height="18" rx="2" fill="#718276"/><rect x="0" y="98" width="190" height="18" rx="2" fill={accent}/><text x="0" y="36" fill={accent} fontSize="36" fontFamily="sans-serif">—</text></svg><div style={{fontSize:v?42:39}}>填入数据，画面即刻更新</div><div style={{fontSize:v?30:25}}>先有依据，再让重点被看见。</div></div>:<>
    <div style={{position:'absolute',left:0,top:0,width:leftWidth,height:v?360:panelH,background:`linear-gradient(135deg,${accent}1f,${accent}08)`}}/>
    {!v&&<div style={{position:'absolute',top:45,bottom:45,left:550,width:1,background:'#ffffff13'}}/>}
    <div style={{position:'absolute',left:v?42:46,top:v?50:50,width:v?inner-84:455,lineHeight:1.1}}>
     <div style={{fontSize:v?38:32,color:C.panelMuted}}>{hourly?'到手时薪变化':d.template==='hours'?'月工时变化':'工资项目合计变化'}</div>
     <div style={{fontSize:fit(percentHero?pct(change):signed(delta),v?inner-90:465,hourly?(v?154:128):(v?159:140)),fontWeight:650,lineHeight:1.08,letterSpacing:-4,color:accent,marginTop:v?24:35,opacity:conclusion,translate:`0 ${18*(1-conclusion)}px`}}>{hero}</div>
     {!percentHero&&<div style={{fontSize:v?40:32,color:C.panelMuted,marginTop:12}}>{unit}</div>}
     <div style={{marginTop:v?22:27,fontSize:v?34:27,color:C.panelText,opacity:conclusion}}>{hourly?`${fmt(a)} → ${fmt(b)} 元 / 时`:`变化幅度  ${pct(change)}`}</div>
     {!v&&<div style={{height:2,width:55,background:accent,marginTop:30}}/>}
     {!v&&<div style={{fontSize:25,color:C.panelMuted,lineHeight:1.7,marginTop:24,maxWidth:445}}>{hourly?'把月到手收入与月工时放在一起，计算实际到手时薪。':d.template==='hours'?'用实际工作天数和每日时长，把工时差异算清楚。':'固定工资、奖金与补贴，分别对照，变化更清楚。'}</div>}
    </div>
    <div style={{position:'absolute',left:chartLeft,right:v?40:50,top:v?435:55,lineHeight:1.1}}>
     {d.template==='salary'?<><div style={{display:'flex',flexDirection:'column',gap:v?46:denseSalary?26:38}}>{['before','after'].map((key,i)=>{const total=i?c.after:c.before,max=Math.max(c.before,c.after,1),draw=i?second:first;return <div key={key}><div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:20,marginBottom:denseSalary?12:20}}><span style={{fontSize:v?42:33,color:C.panelMuted}}>{i?d.afterLabel:d.beforeLabel}</span><span style={{fontSize:fit(fmt(total),v?510:640,v?64:denseSalary?56:64),fontWeight:600,color:C.panelText}}>{fmt(total)}<small style={{fontSize:v?33:27,fontWeight:400,color:C.panelMuted,marginLeft:12}}>元</small></span></div><div style={{width:`${total/max*draw*100}%`,height:v?68:denseSalary?56:70,display:'flex',overflow:'hidden',borderRadius:3}}>{d.salaryRows.map((r,j)=><div key={j} style={{height:'100%',width:`${total===0?0:Number(r[key as 'before'|'after'])/total*100}%`,background:rowColor(j),borderRight:j<d.salaryRows.length-1?`3px solid ${C.panel}`:undefined}}/>)}</div></div>;})}</div><div style={{display:'flex',flexWrap:'wrap',gap:v?'17px 30px':'15px 28px',marginTop:v?35:denseSalary?20:29}}>{d.salaryRows.map((r,i)=><span key={i} style={{fontSize:v?28:denseSalary?20:24,color:i===focus?accent:C.panelMuted,display:'flex',gap:10,alignItems:'center'}}><i style={{width:14,height:14,display:'inline-block',background:rowColor(i)}}/>{r.label}</span>)}</div><div style={{marginTop:v?37:denseSalary?18:26,fontSize:v?32:27,color:accent,opacity:conclusion,lineHeight:1.45}}>{d.salaryRows[focus].label}：{fmt(Number(d.salaryRows[focus].before))} → {fmt(Number(d.salaryRows[focus].after))} 元</div></>:
      <>{pairBars(a,b,hourly?'元 / 时':'小时')}<div style={{marginTop:v?(hourly?42:62):35,borderTop:'1px solid #ffffff17',paddingTop:v?(hourly?22:28):23,color:C.panelText}}>{hourly?<><div style={{fontSize:v?31:25,color:C.panelMuted,marginBottom:10}}>月到手收入</div><div style={{fontSize:v?49:38,fontWeight:550}}>{fmt(c.before)} → {fmt(c.after)}<small style={{fontSize:v?30:25,color:C.panelMuted,marginLeft:14}}>元 / 月</small></div><div style={{marginTop:v?25:12,fontSize:v?28:23,color:C.panelMuted}}>对应月工时：{fmt(c.beforeHours)} → {fmt(c.afterHours)} 小时</div></>:<div style={{display:'flex',justifyContent:'space-between',gap:20}}><div style={{fontSize:v?35:28,lineHeight:1.65}}><small style={{fontSize:v?28:23,color:C.panelMuted}}>{d.beforeLabel}</small><br/>{fmt(numeric(d.beforeDays)??0)}天 × {fmt(numeric(d.beforeDailyHours)??0)}小时</div><div style={{fontSize:v?35:28,lineHeight:1.65}}><small style={{fontSize:v?28:23,color:C.panelMuted}}>{d.afterLabel}</small><br/>{fmt(numeric(d.afterDays)??0)}天 × {fmt(numeric(d.afterDailyHours)??0)}小时</div></div>}</div></>}
    </div>
   </>}
  </div>
  <div data-testid="explanation" style={{position:'absolute',left:pad,right:pad,top:v?1595:927,fontSize:v?31:26,color:C.muted,lineHeight:1.55}}>{d.note||basis}</div>
  <div data-testid="source" style={{position:'absolute',left:pad,right:pad,bottom:v?107:60,borderTop:`1px solid ${C.line}`,paddingTop:v?23:17,fontSize:v?27:23,color:C.muted,lineHeight:1.65,display:'flex',flexDirection:v?'column':'row',justifyContent:'space-between',gap:v?7:28}}><span style={{maxWidth:v?'100%':'68%',overflowWrap:'anywhere'}}>来源：{d.source||'请填写数据来源'}</span>{d.period&&<span style={{maxWidth:v?'100%':'32%'}}>资料时间：{d.period}</span>}</div>
 </AbsoluteFill>;
};
