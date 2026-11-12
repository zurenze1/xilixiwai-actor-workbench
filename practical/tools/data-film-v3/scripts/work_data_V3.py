"""Local editable work-data cards. No network or model call."""
import math

TEMPLATES = {'salary': '工资构成', 'hours': '工时变化', 'income': '收入与时薪'}
TITLES = {'salary':'工资构成，变化在哪里？','hours':'每个月，多工作了多久？','income':'收入与时薪，放在一起看'}

def blank(template):
    return dict(template=template,title=TITLES[template],beforeLabel='此前',afterLabel='此后',source='',period='',note='',duration=8,appearance='studio',accent='#e6be69',focusIndex='',
        salaryRows=[dict(label=x,before='',after='') for x in ['固定工资','奖金绩效','补贴']],
        beforeDays='',afterDays='',beforeDailyHours='',afterDailyHours='',beforeIncome='',afterIncome='')

def draft(raw):
    if not isinstance(raw,dict) or raw.get('template') not in TEMPLATES:
        raise ValueError('请选择工资构成、工时变化或收入与时薪')
    out=blank(raw['template'])
    limits={'title':20,'beforeLabel':12,'afterLabel':12,'source':45,'period':24,'note':40}
    for key,limit in limits.items():
        value=raw.get(key,out[key])
        if not isinstance(value,str) or len(value)>limit: raise ValueError(f'{key}文字过长或格式不正确')
        out[key]=value.strip()
    for key in ['beforeDays','afterDays','beforeDailyHours','afterDailyHours','beforeIncome','afterIncome']:
        val=raw.get(key,'')
        if isinstance(val,bool) or not isinstance(val,(str,int,float)) or len(str(val))>32:
            raise ValueError('数值字段格式不正确')
        out[key]=val
    rows=raw.get('salaryRows',out['salaryRows'])
    if not isinstance(rows,list) or not 1<=len(rows)<=5: raise ValueError('工资项目需1至5项')
    out['salaryRows']=[]
    for row in rows:
        if not isinstance(row,dict) or not isinstance(row.get('label'),str) or len(row['label'])>10: raise ValueError('工资项目名称限10字')
        r={'label':row['label'].strip()}
        for key in ['before','after']:
            val=row.get(key,'')
            if isinstance(val,bool) or not isinstance(val,(str,int,float)) or len(str(val))>32: raise ValueError('工资金额格式不正确')
            r[key]=val
        out['salaryRows'].append(r)
    if raw.get('duration',8) not in [6,8,10]: raise ValueError('时长请选择6、8或10秒')
    out['duration']=raw.get('duration',8)
    if raw.get('appearance','studio') not in ['studio','paper']:raise ValueError('画面风格无效')
    out['appearance']=raw.get('appearance','studio')
    import re
    color=raw.get('accent','#e6be69')
    if not isinstance(color,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',color):raise ValueError('重点色需为六位HEX颜色')
    out['accent']=color.lower()
    index=str(raw.get('focusIndex',''))
    if index not in ['', '0','1','2','3','4']:raise ValueError('重点工资项目无效')
    out['focusIndex']=index
    return out

def number(value,label,max_value):
    if isinstance(value,bool) or value=='' or value is None: raise ValueError(f'请填写{label}；未知不要填0')
    try: n=float(value)
    except (ValueError,TypeError): raise ValueError(f'{label}不是有效数值')
    if not math.isfinite(n) or not 0<=n<=max_value: raise ValueError(f'{label}需在0至{max_value}之间')
    return n

def normalize(raw):
    d=draft(raw)
    for key,label in [('title','标题'),('beforeLabel','此前名称'),('afterLabel','此后名称'),('source','数据来源')]:
        if not d[key]: raise ValueError(f'请填写{label}')
    if d['template']=='salary':
        for i,r in enumerate(d['salaryRows']):
            if not r['label']: raise ValueError(f'请填写第{i+1}个工资项目名称')
            for key in ['before','after']:r[key]=number(r[key],f'第{i+1}项金额',10000000)
    else:
        for key in ['beforeDays','afterDays']:d[key]=number(d[key],'每月工作天数',31)
        for key in ['beforeDailyHours','afterDailyHours']:d[key]=number(d[key],'每天工作小时',24)
        if d['template']=='income':
            for key in ['beforeIncome','afterIncome']:d[key]=number(d[key],'月到手收入',10000000)
            if d['beforeDays']*d['beforeDailyHours']<=0 or d['afterDays']*d['afterDailyHours']<=0:
                raise ValueError('计算时薪时，两期月工时都必须大于0')
    return d

def calculations(d):
    if d['template']=='salary':
        a=sum(x['before'] for x in d['salaryRows']); b=sum(x['after'] for x in d['salaryRows'])
        return dict(before=a,after=b,delta=b-a,percent=None if a==0 else (b-a)/a*100)
    a=d['beforeDays']*d['beforeDailyHours'];b=d['afterDays']*d['afterDailyHours']
    result=dict(beforeHours=a,afterHours=b,hoursDelta=b-a)
    if d['template']=='income': result.update(beforeIncome=d['beforeIncome'],afterIncome=d['afterIncome'],beforeHourly=d['beforeIncome']/a,afterHourly=d['afterIncome']/b)
    return result
