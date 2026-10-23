from pathlib import Path
import subprocess, json, hashlib, os, shutil, time
from concurrent.futures import ThreadPoolExecutor, as_completed

WEB=Path('web'); OWN=WEB/'scripts/actor3-render'; MEDIA=WEB/'assets/loops'
FFMPEG=os.environ.get('ACTOR_FFMPEG') or shutil.which('ffmpeg')
FFPROBE=os.environ.get('ACTOR_FFPROBE') or shutil.which('ffprobe')
if not FFMPEG or not FFPROBE:raise SystemExit('Set ACTOR_FFMPEG/ACTOR_FFPROBE or put FFmpeg on PATH.')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def probe(p):return json.loads(subprocess.check_output([FFPROBE,'-v','error','-show_streams','-show_format','-of','json',str(p)]))
scenes=json.loads((OWN/'qa/probe.json').read_text())[0]['scenes']
ranges={s['key']:(s['start'],s['duration']) for s in scenes if s['key']}
ranges.update(prev=(46.45,4),charity=(96.54,4.6))
jobs=[]
for theme in ['tide','butter','moss']:
    source=MEDIA/f'film-{theme}-repaired.mp4'
    for attempt in range(180):
        try:
            if float(probe(source)['format']['duration'])>126:break
        except (OSError,subprocess.CalledProcessError,KeyError):pass
        time.sleep(1)
    else:raise RuntimeError(f'Film intermediate not ready: {theme}')
    for p in sorted((MEDIA/theme).glob('*.mp4')):jobs.append((theme,p,source))
backup=MEDIA/'originals_20261023';backup.mkdir(exist_ok=True);(backup/'.gitignore').write_text('*\n')
def render(job):
    theme,p,source=job;original=sha(p);dest=backup/theme/p.name;dest.parent.mkdir(exist_ok=True)
    if not dest.exists():shutil.copy2(p,dest)
    start,duration=ranges[p.stem];offset=start+max(0,(duration-3.625)/2)
    out=OWN/'qa'/f'loop-{theme}-{p.stem}.mp4'
    subprocess.run([FFMPEG,'-v','error','-y','-ss',str(offset),'-i',str(source),'-t','3.625','-an','-vf','scale=768:432:flags=lanczos,fps=24','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',str(out)],check=True)
    d=probe(out);v=next(s for s in d['streams'] if s['codec_type']=='video')
    if (v['width'],v['height'])!=(768,432) or abs(float(d['format']['duration'])-3.625)>.06:raise RuntimeError('Invalid loop output '+str(p))
    shutil.move(out,p)
    return {'file':str(p.relative_to(WEB)),'originalSha256':original,'newSha256':sha(p),'sourceRange':{'start':round(offset,4),'duration':3.625},'width':768,'height':432,'fps':24}
rows=[]
with ThreadPoolExecutor(max_workers=3) as pool:
    for f in as_completed([pool.submit(render,j) for j in jobs]):
        rows.append(f.result());print(json.dumps({'loopsCompleted':len(rows),'loopsTotal':len(jobs),'file':rows[-1]['file']}),flush=True)
(MEDIA/'REPAIR-MANIFEST.json').write_text(json.dumps({'source':'Newly rendered 2026-10-23 theme-aligned HyperFrames previews; original audio unchanged.','loops':sorted(rows,key=lambda x:x['file'])},ensure_ascii=False,indent=2))
for theme in ['tide','butter','moss']:
    p=MEDIA/f'film-{theme}-repaired.mp4'
    if p.exists():shutil.move(p,OWN/'qa'/f'intermediate-film-{theme}.mp4')
print('Loop repair complete; long intermediates retained in ignored local QA, not public assets.',flush=True)
