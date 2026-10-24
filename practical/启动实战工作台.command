#!/bin/zsh
set -e
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=24?0:1)' ; then
  print '请先安装Node.js24或更新版本，然后重新打开。'
  read 'reply?按回车退出。'
  exit 1
fi
if [[ ! -d node_modules/better-auth || ! -d node_modules/esbuild || ! -d node_modules/pdfjs-dist ]]; then
  npm ci --ignore-scripts
fi
node scripts/build-demo-lab.mjs
node scripts/build-demo-operations.mjs
node scripts/build-demo-previs.mjs
node scripts/build-demo-tools.mjs
node scripts/build-usage-guide.mjs
if curl -fsS http://127.0.0.1:4930/api/health 2>/dev/null | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{process.exit(JSON.parse(s).version==="3.1-practical"?0:1)}catch{process.exit(1)}})' ; then
  open http://127.0.0.1:4930/practical/
  exit 0
fi
if curl -fsS http://127.0.0.1:4930/api/health >/dev/null 2>&1; then
  print '端口4930正在运行另一个版本。请先关闭原来的工作台启动窗口，再启动此版本。'
  read 'reply?按回车退出。'
  exit 1
fi
node practical/server/index.mjs &
workbench_pid=$!
trap 'kill "$workbench_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in {1..30}; do
  if ! kill -0 "$workbench_pid" 2>/dev/null; then
    print '服务未能启动，请查看上方错误。'
    exit 1
  fi
  if curl -fsS http://127.0.0.1:4930/api/health >/dev/null 2>&1; then
    open http://127.0.0.1:4930/practical/
    break
  fi
  sleep 1
done
wait "$workbench_pid"
