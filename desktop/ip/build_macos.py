#!/usr/bin/env python3
"""Build a self-contained, native Mac IP workbench. Never copies user data."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import platform
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

def run(args, **kwargs):
    subprocess.run([str(x) for x in args], check=True, **kwargs)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'qa-ip/macos-build')
    parser.add_argument('--node-root', type=Path, required=True, help='Unpacked official Node.js 24.21+ distribution')
    parser.add_argument('--sdk', type=Path, help='Compatible macOS SDK, if the default does not match swiftc')
    args = parser.parse_args()
    node_root = args.node_root.resolve()
    node = node_root / 'bin/node'
    npm = node_root / 'bin/npm'
    version = subprocess.check_output([str(node), '-p', 'process.versions.node'], text=True).strip()
    if tuple(int(x) for x in version.split('.')) < (24, 21, 0):
        raise SystemExit('Node.js 24.21 or newer is required')
    if not (node_root / 'LICENSE').is_file():
        raise SystemExit('Use an official Node.js archive with its LICENSE')
    output = args.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    app = output / 'IP工作台.app'
    if app.exists():
        raise SystemExit('Output application already exists; use a new output directory')
    macos = app / 'Contents/MacOS'; resources = app / 'Contents/Resources'
    macos.mkdir(parents=True); resources.mkdir()
    service = resources / 'service'; service.mkdir()
    for name in ['server', 'practical/server', 'practical/web']:
        shutil.copytree(ROOT / name, service / name)
    (service / 'web').mkdir()
    shutil.copy2(ROOT / 'web/radar-goals.js', service / 'web/radar-goals.js')
    module = ROOT / 'practical/modules/creator-workbench'
    if module.exists():
        if not (module / 'dist/index.html').is_file():
            raise SystemExit('Build the creator modules first: npm run build:creator-modules')
        for name in ['server', 'dist']:
            shutil.copytree(module / name, service / 'practical/modules/creator-workbench' / name)
    for name in ['package.json', 'package-lock.json']:
        shutil.copy2(ROOT / name, service / name)
    env = dict(os.environ, PATH=str(node_root / 'bin') + os.pathsep + os.environ.get('PATH', ''))
    run([npm, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', output / '.npm-cache'], cwd=service, env=env)
    run([node, '--input-type=module', '-e', "await import('./practical/server/index.mjs')"], cwd=service, env=env)
    (resources / 'node/bin').mkdir(parents=True)
    shutil.copy2(node, resources / 'node/bin/node')
    shutil.copy2(node_root / 'LICENSE', resources / 'node/LICENSE')
    if (ROOT / 'docs/licenses').exists(): shutil.copytree(ROOT / 'docs/licenses', resources / 'licenses')
    iconset = output / 'IPWorkbench.iconset'; iconset.mkdir()
    master = HERE / 'assets/icon-master.png'
    for size in [16,32,128,256,512]:
        run(['sips','-z',size,size,master,'--out',iconset / f'icon_{size}x{size}.png'], stdout=subprocess.DEVNULL)
        run(['sips','-z',size*2,size*2,master,'--out',iconset / f'icon_{size}x{size}@2x.png'], stdout=subprocess.DEVNULL)
    run(['iconutil','-c','icns',iconset,'-o',resources / 'IPWorkbench.icns'])
    info = {
        'CFBundleName':'IP工作台','CFBundleDisplayName':'IP工作台','CFBundleExecutable':'IPWorkbench',
        'CFBundleIdentifier':'com.zurenze.ip-workbench','CFBundlePackageType':'APPL',
        'CFBundleShortVersionString':'1.0.1','CFBundleVersion':'2',
        'CFBundleIconFile':'IPWorkbench','LSMinimumSystemVersion':'13.5',
        'LSMultipleInstancesProhibited':True,'NSHighResolutionCapable':True,
        'NSAppTransportSecurity':{'NSAllowsLocalNetworking':True},
    }
    (app / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
    compiler = ['swiftc','-swift-version','5','-O','-target',platform.machine()+'-apple-macos13.5']
    if args.sdk: compiler += ['-sdk', args.sdk.resolve()]
    run(compiler + [HERE / 'IPWorkbench.swift','-framework','Cocoa','-framework','WebKit','-o',macos / 'IPWorkbench'])
    run(['codesign','--force','--deep','--sign','-',app])
    run(['codesign','--verify','--deep','--strict',app])
    # The bundle whitelist above deliberately excludes runtime-ip, SQLite files,
    # environment files, QA records and the original desktop launcher's paths.
    forbidden = [p for p in app.rglob('*') if p.name in ['master.secret','.env','workbench.sqlite','identity.sqlite']]
    if forbidden: raise SystemExit('Private runtime file found in application bundle')
    (output / 'build-receipt.json').write_text(json.dumps({'application':str(app),'node':version,'private_runtime_copied':False}, ensure_ascii=False,indent=2)+'\n')
    print(str(app))

if __name__ == '__main__': main()
