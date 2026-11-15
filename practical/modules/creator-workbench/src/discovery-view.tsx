import React,{useEffect,useState} from 'react';
import {NEWS_CHANNELS} from '../server/news-channels.mjs';
import {api,Badge,Dialog,Field,Link,stamp,type Item} from './ui';

export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function DateRange({from,to,onChange,label='日期范围'}:{from:string;to:string;onChange:(f:string,t:string)=>void;label?:string}){
  return <div className="date-range" aria-label={label}><Field label={label+'开始'}><input type="date" value={from} onInput={e=>onChange(e.currentTarget.value,to)}/></Field><span>至</span><Field label={label+'结束'}><input type="date" value={to} onInput={e=>onChange(from,e.currentTarget.value)}/></Field><div><button onClick={()=>onChange(today(),today())}>今天</button><button onClick={()=>{const t=today(),d=new Date(t+'T12:00:00+08:00');d.setDate(d.getDate()-6);onChange(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d),t);}}>近7天</button></div></div>;
}
export function PreviewMedia({src,kind='图片',alt='来源原图'}:{src?:string;kind?:string;alt?:string}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
  return <div className="original-preview">{src&&!failed?(kind==='视频'?<video muted playsInline preload="metadata" src={src+'#t=0.1'} aria-label={alt} onError={()=>setFailed(true)}/>:<img src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>):<span className="image-unavailable">{failed?'原图预览失败':kind==='文档'?'文档原件':kind==='音频'?'音频原件':'尚未取得原图'}</span>}</div>;
}
export function NewsCard({item,onDetail}:{item:Item;onDetail:(n:Item)=>void}){
  const [failedSrc,setFailedSrc]=useState(''),src=item.media?.hash?'./api/blobs/'+item.media.hash:'',hasImage=!!src&&src!==failedSrc;
  return <article className="visual-news">{hasImage&&<button className="visual-news-cover" onClick={()=>onDetail(item)} aria-label={'查看原图与出处 '+item.title}><div className="original-preview"><img src={src} alt={item.title} loading="lazy" onError={()=>setFailedSrc(src)}/></div><span>{item.person||item.category}</span></button>}<div className="visual-news-copy"><div className="news-meta">{!hasImage&&<Badge>{item.person||item.category}</Badge>}<small>{item.publishedAt||'原文日期未知'}</small></div><button className="news-title" onClick={()=>onDetail(item)}>{item.title}</button><div className="news-source"><Link url={item.sources[0].url} label={item.sources[0].name+' ↗'}/></div></div></article>;
}
export function DailyFeed({compact=false,openTopic,lane='all',assessHot}:{assessHot?:(id:string)=>void;compact?:boolean;openTopic?:(id:string)=>Promise<void>;lane?:'all'|'story'|'people'|'culture'|'apparel'|'ai'|'finance'|'other'}){
  const channel=lane==='story'?'people':lane;
  const [range,setRange]=useState([today(),today()]),[data,setData]=useState<Item|null>(null),[err,setErr]=useState(''),[notice,setNotice]=useState(''),[detail,setDetail]=useState<Item|null>(null);
  const query=()=>new URLSearchParams({from:range[0],to:range[1],...(channel==='all'?{}:{channel})});
  const load=()=>api('/discovery/daily?'+query()).then(setData);
  useEffect(()=>{
    let live=true;
    const run=()=>api('/discovery/daily?'+query()).then(r=>{if(live){setData(r);setErr('');}}).catch(e=>{if(live)setErr(e.message);});
    run();const timer=setInterval(run,10000);return()=>{live=false;clearInterval(timer);};
  },[range[0],range[1],channel]);
  const labels:Record<string,string>=Object.fromEntries(NEWS_CHANNELS),items=data?.items||[],days=[...new Set(items.map((n:Item)=>n.day))] as string[];
  const descriptions:Record<string,string>={all:'人物、时尚界、服装、AI与财经，按日期整理。',people:'每天10位不同人物，保留事实、原图与出处。',culture:'品牌、秀场、设计师、红毯与时尚行业。',apparel:'从款式、面料和工艺，看到具体穿着问题。',ai:'为研究、写作与制作寻找新方法。',finance:'宏观政策、产业企业、消费住房、教育养老与公共服务，连接具体生活问题。',other:'暂未映射到其他栏目的历史资料，原分类与来源完整保留。'};
  const target:Record<string,number>={all:45,people:10,culture:10,apparel:10,ai:5,finance:10};
  return <section className="visual-feed">
    <header className="visual-heading"><div><p className="section-label">热点早报</p><h1>{labels[channel]}</h1><p>{descriptions[channel]}</p></div>{target[channel]&&range[0]===range[1]&&<div className="daily-quota"><b>{channel==='people'?new Set(items.map((n:Item)=>n.person||n.title)).size:items.length}<span> / {target[channel]}</span></b><small>{range[0]} · 已保存</small></div>}</header>
    {!compact&&<><DateRange from={range[0]} to={range[1]} onChange={(f,t)=>setRange([f,t])} label="日报日期"/><div className="feed-tools"><Field label="已保存日期"><select value={range[0]===range[1]?range[0]:''} onChange={e=>{if(e.target.value)setRange([e.target.value,e.target.value]);}}><option value="">选择日期</option>{!data?.history.some((h:Item)=>h.day===today())&&<option value={today()}>今天 · 等待采集</option>}{data?.history.map((h:Item)=><option key={h.day}>{h.day}</option>)}</select></Field><button onClick={async()=>{try{for(const day of days.length?days:[range[0]])await api('/discovery/daily/images',{day});setNotice('已排队读取来源原图，完成后自动显示。受限来源会保留原因。');await load();}catch(e:any){setErr(e.message);}}}>读取本期原图</button><small>日报日期、原文发布时间与实际入库时间分别保留</small></div></>}
    {(err||notice)&&<p className={'notice '+(err?'error':'')} role={err?'alert':'status'}>{err||notice}</p>}
    {!data?<p role="status">正在读取…</p>:days.length?days.map(day=>{const edition=items.filter((n:Item)=>n.day===day);return <section className="dated-section" key={day}><div className="dated-heading"><h2>{day}</h2><span>{edition.length} 条</span></div><div className="visual-news-grid">{(compact?edition.slice(0,4):edition).map((n:Item,i:number)=><NewsCard key={n.eventId+'-'+i} item={n} onDetail={setDetail}/>)}</div></section>;}):<div className="calm-empty"><h2>这个日期范围还没有{labels[channel]}记录</h2><p>历史资料保留在对应日期，可选择其他已保存日期查看。</p></div>}
    {!compact&&<details className="feed-status"><summary>采集与来源状态</summary><p>{data?.automation.state}</p><p>{data?.automation.note}</p><p>人物按独立姓名计数；图片是来源原图，使用权需另行核对。未取得图片时可打开原文查看。</p></details>}
    {detail&&<Dialog wide title={detail.title} onClose={()=>setDetail(null)}>{detail.media?.hash&&<img className="news-detail-image" src={'./api/blobs/'+detail.media.hash} alt={detail.title}/>}<p><Badge>{detail.person||detail.category}</Badge> · 原文 {detail.publishedAt||'日期未知'} · 对应日报 {detail.day}</p><p>{detail.facts}</p><h3>可以怎么讲</h3><p>{detail.analysis||'待判断'}</p>{detail.heatClue&&<p>热度线索：{detail.heatClue}</p>}<details><summary>核对范围与原图</summary>{detail.originalTitle&&detail.originalTitle!==detail.title&&<p>资料原题：{detail.originalTitle}</p>}<p>{detail.readScope}</p><p>{detail.media?.note||'尚未取得原图'} · {detail.media?.observedAt&&stamp(detail.media.observedAt)}</p></details><div className="actions">{detail.media?.pageHash&&<a className="button" href={'./api/blobs/'+detail.media.pageHash+'?download=1&name=source-page.html'}>原网页存档</a>}{detail.sources.map((s:Item)=><Link key={s.url} url={s.url} label={s.name+' ↗'}/>)}{(assessHot||openTopic)&&<button className="primary" onClick={async()=>{if(assessHot){assessHot(detail.eventId);setDetail(null);}else{try{const r=await api('/hot/events/'+detail.eventId+'/topic',{});await openTopic?.(r.topic.id);setDetail(null);}catch(e:any){setErr(e.message);}}}}>判断选题</button>}</div></Dialog>}
  </section>;
}
