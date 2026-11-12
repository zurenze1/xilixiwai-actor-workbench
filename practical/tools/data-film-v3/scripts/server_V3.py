#!/usr/bin/env python3
"""Editable data films; preserves the V2 macro gallery and its API."""
import argparse,copy,csv,hashlib,json,mimetypes,os,re,signal,subprocess,sys,threading,time,uuid,webbrowser,shutil
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote,urlparse
import server_V2 as legacy
from work_data_V3 import blank,draft,normalize,calculations

ROOT=Path(__file__).resolve().parents[1];PORT=int(os.environ.get('MACRO_PORT','4967'));URL=f'http://127.0.0.1:{PORT}'
NODE=os.environ.get('DATA_FILM_NODE') or shutil.which('node') or str(Path.home()/'Documents/Codex/tools/node/bin/node')

class Store:
 def __init__(self,folder=None,outputs=None):
  self.folder=Path(folder or ROOT/'state/V3');self.outputs=Path(outputs or ROOT/'outputs/V3');self.lock=threading.RLock();self.proc=None
  self.folder.mkdir(parents=True,exist_ok=True);self.outputs.mkdir(parents=True,exist_ok=True)
  self.job=dict(running=False,ok=True,message='填入数据，即刻预览',progress=0,result=None)
  p=self.folder/'last-result.json'
  if p.is_file():
   try:self.job['result']=json.loads(p.read_text())
   except (ValueError,OSError):pass
 def save_json(self,path,obj):
  temp=path.with_suffix('.tmp');temp.write_text(json.dumps(obj,ensure_ascii=False,indent=2,allow_nan=False));temp.replace(path)
 def drafts(self):
  with self.lock:
   p=self.folder/'drafts.json';value=json.loads(p.read_text()) if p.exists() else {}
   return {k:draft(value[k]) if k in value else blank(k) for k in ['salary','hours','income']}
 def save_draft(self,raw):
  d=draft(raw)
  with self.lock:
   values=self.drafts();values[d['template']]=d;self.save_json(self.folder/'drafts.json',values)
  return d
 def snapshot(self):
  with self.lock:return copy.deepcopy(self.job)
 def start(self,raw,fmt):
  d=normalize(raw)
  if fmt not in ['horizontal','vertical','both']:raise ValueError('导出比例无效')
  with self.lock:
   if self.job['running'] or legacy.job['running']:raise BlockingIOError('正在生成视频，请等本次完成')
   self.job=dict(running=True,ok=True,message='正在准备画面',progress=0,result=None,startedAt=time.time(),template=d['template'])
   threading.Thread(target=self.render,args=(d,fmt),daemon=True).start()
  return self.snapshot()
 def render(self,d,fmt):
  run=self.outputs/f'{datetime.now():%Y%m%d_%H%M%S}_{d["template"]}_{uuid.uuid4().hex[:8]}';run.mkdir()
  self.save_json(run/'data.json',d);self.save_json(run/'calculations.json',calculations(d))
  fields=['item','before','after','unit']
  with (run/'data.csv').open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
   if d['template']=='salary':
    for r in d['salaryRows']:w.writerow(dict(item=r['label'],before=r['before'],after=r['after'],unit='元/月'))
   else:
    w.writerow(dict(item='工作天数',before=d['beforeDays'],after=d['afterDays'],unit='天/月'))
    w.writerow(dict(item='每天时长',before=d['beforeDailyHours'],after=d['afterDailyHours'],unit='小时/天'))
    if d['template']=='income':w.writerow(dict(item='月到手收入',before=d['beforeIncome'],after=d['afterIncome'],unit='元/月'))
  timer=None;proc=None
  try:
   self.proc=subprocess.Popen(['/usr/bin/caffeinate','-i',NODE,str(ROOT/'scripts/render_V3.mjs'),str(run/'data.json'),fmt],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
   proc=self.proc
   def timeout():
    if proc.poll() is None:os.killpg(proc.pid,signal.SIGTERM)
   timer=threading.Timer(600,timeout);timer.start()
   with (run/'render.log').open('w') as log:
    for line in proc.stdout:
     log.write(line);log.flush()
     try:msg=json.loads(line)
     except ValueError:continue
     if msg.get('type') in ['progress','stage']:
      with self.lock:self.job.update(message=msg['message'],progress=min(.99,float(msg.get('progress',0))))
   if proc.wait()!=0:raise RuntimeError('生成未完成；数据草稿已保存，请重试。')
   receipt=json.loads((run/'render-receipt.json').read_text());files=[]
   for item in receipt['files']:
    p=Path(item['file'])
    if not p.is_file() or p.stat().st_size==0:raise RuntimeError('没有找到导出视频')
    files.append(dict(ratio=item['ratio'],url='/outputs/'+str(p.relative_to(self.outputs)),name=d['title']+('_横屏.mp4' if item['ratio']=='horizontal' else '_竖屏.mp4'),bytes=p.stat().st_size,width=item['width'],height=item['height']))
   result=dict(title=d['title'],template=d['template'],createdAt=datetime.now().astimezone().isoformat(),data=d,files=files)
   self.save_json(self.folder/'last-result.json',result);self.save_json(run/'manifest.json',dict(status='rendered',result=result))
   with self.lock:self.job.update(running=False,ok=True,message='视频已生成，可直接导入剪映',progress=1,result=result)
  except Exception as e:
   self.save_json(run/'manifest.json',dict(status='failed',error=str(e)))
   with self.lock:self.job.update(running=False,ok=False,message=str(e))
  finally:
   if timer:timer.cancel()
   if self.proc is proc:self.proc=None
 def stop(self):
  proc=self.proc
  if proc and proc.poll() is None:
   try:os.killpg(proc.pid,signal.SIGTERM)
   except ProcessLookupError:pass

class Handler(legacy.Handler):
 store=None
 def __init__(self,*args,**kwargs):SimpleHTTPRequestHandler.__init__(self,*args,directory=str(ROOT/'ui/V3'),**kwargs)
 def json(self,obj,code=200):
  data=json.dumps(obj,ensure_ascii=False,allow_nan=False).encode();self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
 def host_ok(self):return self.headers.get('Host') in [f'127.0.0.1:{PORT}',f'localhost:{PORT}']
 def do_GET(self):
  if not self.host_ok():return self.json({'error':'只接受本机访问'},403)
  path=urlparse(self.path).path
  if path=='/api/status':return self.json({**legacy.job,'app':'macro-data-film-v2','version':'V3','root':str(ROOT),'running':legacy.job['running'] or self.store.snapshot()['running']})
  if path=='/api/v3/drafts':return self.json(self.store.drafts())
  if path=='/api/v3/status':return self.json(self.store.snapshot())
  if path.startswith('/outputs/'):
   p=(self.store.outputs/unquote(path[len('/outputs/'):])).resolve()
   if not p.is_relative_to(self.store.outputs.resolve()) or not p.is_file() or p.suffix not in ['.mp4','.png','.csv']:return self.json({'error':'文件不存在'},404)
   return self.media(p)
  if path=='/macro':self.send_response(302);self.send_header('Location','/macro/');self.end_headers();return
  if path.startswith('/macro/'):
   p=(ROOT/'ui/V2'/unquote(path[len('/macro/'):])).resolve()
   if not p.is_relative_to((ROOT/'ui/V2').resolve()):return self.json({'error':'文件不存在'},404)
   if p.is_dir():p=p/'index.html'
   if not p.is_file():return self.json({'error':'文件不存在'},404)
   return self.media(p)
  if path not in ['/','/index.html','/app.js','/style.css']:return self.json({'error':'文件不存在'},404)
  return SimpleHTTPRequestHandler.do_GET(self)
 def media(self,p):
  size=p.stat().st_size;start=0;end=size-1;code=200;r=self.headers.get('Range')
  if r:
   m=re.fullmatch(r'bytes=(\d+)-(\d*)',r)
   if not m or int(m[1])>=size:return self.json({'error':'无效视频范围'},416)
   start=int(m[1]);end=min(int(m[2]) if m[2] else end,end)
   if end<start:return self.json({'error':'无效视频范围'},416)
   code=206
  self.send_response(code);self.send_header('Content-Type',mimetypes.guess_type(p)[0] or 'application/octet-stream');self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes');self.send_header('Cache-Control','no-cache')
  if code==206:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
  self.end_headers()
  try:
   with p.open('rb') as f:
    f.seek(start);remaining=end-start+1
    while remaining>0:
     chunk=f.read(min(1024*1024,remaining))
     if not chunk:break
     self.wfile.write(chunk);remaining-=len(chunk)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_POST(self):
  if not self.host_ok() or self.headers.get('Origin')!=URL:return self.json({'error':'请从本机工具页面操作'},403)
  if self.path=='/api/run':
   if self.store.snapshot()['running']:return self.json({'error':'数据卡正在生成，请稍后检查宏观更新'},409)
   return legacy.Handler.do_POST(self)
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=32000:raise ValueError('提交内容过大或为空')
   body=json.loads(self.rfile.read(length))
   if self.path=='/api/v3/draft':return self.json(self.store.save_draft(body))
   if self.path=='/api/v3/render':return self.json(self.store.start(body['data'],body['format']),202)
   return self.json({'error':'接口不存在'},404)
  except BlockingIOError as e:return self.json({'error':str(e)},409)
  except (ValueError,KeyError,TypeError) as e:return self.json({'error':str(e)},400)

def main():
 p=argparse.ArgumentParser();p.add_argument('--no-open',action='store_true');a=p.parse_args();store=Store();Handler.store=store
 try:server=ThreadingHTTPServer(('127.0.0.1',PORT),Handler)
 except OSError:
  from urllib.request import urlopen
  try:
   info=json.load(urlopen(URL+'/api/status',timeout=2))
   if info.get('app')!='macro-data-film-v2':raise ValueError()
  except Exception:print('端口已占用，未停止其他程序。',file=sys.stderr);return 1
  print('数据出片已运行：'+URL,flush=True)
  if not a.no_open:webbrowser.open(URL)
  return 0
 def stop(*_):store.stop();threading.Thread(target=server.shutdown,daemon=True).start()
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
 print('数据出片 V3：'+URL,flush=True)
 if not a.no_open:webbrowser.open(URL)
 try:server.serve_forever()
 finally:store.stop();server.server_close()
 return 0

if __name__=='__main__':sys.exit(main())
