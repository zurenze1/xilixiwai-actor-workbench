#!/usr/bin/env python3
import os,argparse,json,subprocess,sys,threading,webbrowser
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[1];UI=ROOT/'ui/V2';PORT=int(os.environ.get('MACRO_PORT','4967'));URL=f'http://127.0.0.1:{PORT}';job={'app':'macro-data-film-v2','running':False,'ok':True,'message':'就绪'};guard=threading.Lock()
def run():
 log=ROOT/'evidence/V2/界面检查更新日志.txt'
 try:
  before=set((ROOT/'outputs/V2').glob('*'))
  with log.open('w') as f:r=subprocess.run(['/usr/bin/caffeinate','-i',sys.executable,str(ROOT/'scripts/macro_V2.py'),'all'],cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,timeout=900)
  added=set((ROOT/'outputs/V2').glob('*'))-before
  manifests=[p/'manifest_V2.json' for p in added if (p/'manifest_V2.json').exists()]
  if not manifests:raise RuntimeError('本次未能完成数据核验，请稍后重试。')
  m=json.loads(manifests[0].read_text())
  if r.returncode:
   names={'gdp':'GDP','cpi':'CPI','urban':'城镇失业率','youth':'青年失业率','retail':'社零','house':'70城房价'}
   failed=[names[x['indicator']] for x in m.get('items',[]) if x.get('status')=='failed']
   raise RuntimeError('暂时无法核验'+('：'+'、'.join(failed) if failed else '最新数据')+'，请稍后重试。')
  changed=any(x['status']=='rendered' for x in m['items'])
  if changed:subprocess.run([sys.executable,str(ROOT/'scripts/build_gallery_V2.py'),str(manifests[0].parent)],check=True,cwd=ROOT)
  job.update(ok=True,message='暂无新数据，未重复出片。' if not changed else '数据已更新，已生成对应图表。',changed=changed,run=str(manifests[0].parent))
 except Exception as e:job.update(ok=False,message=str(e))
 finally:job['running']=False
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(UI),**kwargs)
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/api/status':
   raw=json.dumps({**job,'root':str(ROOT)},ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
  else:super().do_GET()
 def do_POST(self):
  if self.path!='/api/run':self.send_error(404);return
  if self.headers.get('Origin')!=URL:self.send_error(403);return
  if int(self.headers.get('Content-Length','0'))>1024:self.send_error(413);return
  self.rfile.read(int(self.headers.get('Content-Length','0')))
  with guard:
   if job['running']:self.send_error(409);return
   job.update(running=True,message='正在核对官方数据…',changed=False)
   threading.Thread(target=run,daemon=True).start()
  self.send_response(202);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"running":true}')
def main():
 p=argparse.ArgumentParser();p.add_argument('--no-open',action='store_true');a=p.parse_args()
 try:server=ThreadingHTTPServer(('127.0.0.1',PORT),Handler)
 except OSError:
  try:
   if json.load(urlopen(URL+'/api/status',timeout=2))['app']!='macro-data-film-v2':raise ValueError()
  except Exception:print('4967端口已占用，请先检查占用程序，未停止其他服务。',file=sys.stderr);return 1
  print('本工具已运行：'+URL,flush=True)
  if not a.no_open:webbrowser.open(URL)
  return 0
 print('宏观图表 V2：'+URL,flush=True)
 if not a.no_open:webbrowser.open(URL)
 try:server.serve_forever()
 except KeyboardInterrupt:server.server_close()
if __name__=='__main__':
 from server_V3 import main as work_data_main
 sys.exit(work_data_main() or 0)
