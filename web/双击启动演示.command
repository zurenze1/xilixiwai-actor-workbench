#!/bin/bash
# 双击启动：在本机 4890 端口打开演示（不联网也能用）。演示期间不要关闭这个窗口。
cd "$(dirname "$0")"
PORT=4890
if ! lsof -i :$PORT >/dev/null 2>&1; then
  python3 serve.py "$PORT" >/dev/null 2>&1 &
  sleep 1
fi
open "http://127.0.0.1:$PORT/launch.html"
echo "演示已启动：http://127.0.0.1:$PORT/launch.html"
echo "工作台：http://127.0.0.1:$PORT/index.html"
echo "演示期间请不要关闭这个窗口。结束后按 Ctrl+C 或直接关闭。"
wait
