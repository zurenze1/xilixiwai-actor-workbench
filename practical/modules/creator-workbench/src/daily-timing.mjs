function clock(iso,zone){
  if(!iso)return null;const d=new Date(iso);if(!Number.isFinite(d.getTime()))return null;
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,label:`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`,epoch:d.getTime()};
}
export function briefTiming(item){
  const zone=item.uiTimezone||'Asia/Shanghai',scheduled=/^\d{2}:\d{2}$/.test(item.scheduleTime||'')?item.scheduleTime:'09:00';
  const edited=clock(item.editorial?.reviewedAt,zone),prepared=clock(item.generatedAt,zone),delivered=clock(item.delivery?.deliveredAt,zone);
  const afterDelivery=!!(edited&&delivered&&edited.epoch>delivered.epoch);
  const afterPlan=!!(edited&&(edited.day>item.day||edited.day===item.day&&edited.time>scheduled));
  const label=item.editorial?.retrospective?'本次回看分析':afterDelivery?'交付后分析更新':afterPlan?'后续补充分析':'分析最近编辑';
  const explanation=item.editorial?.retrospective?'这是本次回看时补充的分析，不能当作当日已完成。':afterDelivery?'这条分析的最近一次补充或编辑在初版聊天交付之后，原早报版本保留。':afterPlan?'这是计划交付时点之后的补充；实际聊天交付时间需单独核实。':'这里记录分析的实际编辑时间，不替代早报交付时间。';
  return {scheduled,zone,edited,prepared,delivered,label,explanation};
}
