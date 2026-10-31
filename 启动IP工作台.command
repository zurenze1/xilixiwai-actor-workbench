#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=24?0:1)'; then
  print '需要 Node.js 24 或更新版本。请安装后重新双击启动器。'
  read 'reply?按回车退出。'
  exit 1
fi
if [[ ! -d node_modules/better-auth || ! -d node_modules/zod ]]; then
  npm ci --ignore-scripts
fi
if curl -fsS http://127.0.0.1:4936/api/health 2>/dev/null | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{const r=JSON.parse(s);process.exit(r.profile==="ip"&&r.ipVersion==="1.1.0"?0:1)}catch{process.exit(1)}})'; then
  open http://127.0.0.1:4936/practical/ip/
  exit 0
fi
if lsof -nP -iTCP:4936 -sTCP:LISTEN >/dev/null 2>&1; then
  print '端口4936已被其他程序占用。请先检查正在运行的工作台，不要关闭不认识的程序。'
  read 'reply?按回车退出。'
  exit 1
fi
print 'IP工作台正在启动。保留这个窗口；关闭窗口会停止本机服务。'
print '资料保存在当前工程的 runtime-ip 文件夹；不会随源码上传。'
node practical/server/ip-start.mjs &
ip_server_pid=$!
trap 'kill "$ip_server_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in {1..30}; do
  if ! kill -0 "$ip_server_pid" 2>/dev/null; then
    print '服务没有成功启动，请查看上方错误。'
    read 'reply?按回车退出。'
    exit 1
  fi
  if curl -fsS http://127.0.0.1:4936/api/health >/dev/null 2>&1; then
    open http://127.0.0.1:4936/practical/ip/
    break
  fi
  sleep 1
done
wait "$ip_server_pid"
