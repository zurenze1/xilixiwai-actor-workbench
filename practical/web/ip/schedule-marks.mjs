export const MARK_COLORS=[['蓝色','#789bd7'],['紫色','#a18bd3'],['青绿','#67ac98'],['橙色','#d8a364'],['玫红','#d083a4'],['天蓝','#74b8ce'],['灰色','#9ba5ae']];
export const markedKind=kind=>['ip-event','ip-task','ip-shoot'].includes(kind);
export const validMarkColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function scheduleColor(record){
 if(validMarkColor(record.body?.color))return record.body.color.toLowerCase();
 const title=String(record.title||'').split(/[｜|]/)[0];
 if(/复盘/.test(title))return '#9ba5ae';
 if(/发布/.test(title))return '#d083a4';
 if(/剪辑|审片|粗剪|后期/.test(title))return '#d8a364';
 if(/拍摄|开机|走位|妆发/.test(title)||record.kind==='ip-shoot')return '#67ac98';
 if(/撰稿|写稿|脚本|分镜/.test(title))return '#a18bd3';
 if(/沟通|客户|确认/.test(title))return '#74b8ce';
 return '#789bd7';
}
export const emphasis=record=>record.body?.highlight==='1';
export const markStyle=record=>`--schedule-color:${scheduleColor(record)}`;
export function colorField(value,esc){
 const selected=validMarkColor(value)?value.toLowerCase():'';
 return `<fieldset class="schedule-color-field wide"><legend>标记颜色</legend><input type="hidden" name="color" value="${esc(selected)}"><div class="schedule-color-options"><button type="button" data-mark-color="" aria-pressed="${!selected}">自动按环节</button>${MARK_COLORS.map(([name,color])=>`<button type="button" class="color-swatch" style="--swatch:${color}" data-mark-color="${color}" aria-label="选择${name}" title="${name}" aria-pressed="${selected===color}"><span></span></button>`).join('')}<label class="custom-mark-color"><span>自选颜色</span><input type="color" data-native-mark-color value="${selected||'#789bd7'}" aria-label="日程自选颜色"></label><input class="mark-hex" data-mark-hex value="${esc(selected)}" maxlength="7" placeholder="#789bd7" aria-label="日程颜色代码"></div><small>颜色用于区分安排，不会改变进度、日期或完成状态。</small></fieldset>`;
}
export function mountMarkColors(form){
 const field=form.querySelector('.schedule-color-field');if(!field)return;
 const hidden=field.querySelector('[name=color]'),hex=field.querySelector('[data-mark-hex]'),picker=field.querySelector('[data-native-mark-color]');
 const update=value=>{hidden.value=value;hex.value=value;if(validMarkColor(value))picker.value=value;field.querySelectorAll('[data-mark-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.markColor===value)));hidden.dispatchEvent(new Event('input',{bubbles:true}));};
 field.addEventListener('click',e=>{const button=e.target.closest('[data-mark-color]');if(button){e.preventDefault();update(button.dataset.markColor);}});
 field.addEventListener('input',e=>{if(e.target===picker)update(picker.value);else if(e.target===hex)update(hex.value);});
}
