import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../practical/modules/creator-workbench/',import.meta.url));
await mkdir(root+'dist',{recursive:true});
await build({entryPoints:[root+'src/main.tsx'],outfile:root+'dist/app.js',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
await writeFile(root+'dist/index.html','<!doctype html><html lang="zh-CN" data-theme="paper"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IP工作台 · 创作模块</title><link rel="stylesheet" href="./app.css"></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>');
console.log('IP热点雷达与分镜执行台构建完成');
