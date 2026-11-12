import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await build({entryPoints:[path.join(root,'src/editor_V3.tsx')],outfile:path.join(root,'ui/V3/app.js'),bundle:true,minify:true,platform:'browser',target:'es2020',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
console.log('V3 editor bundled');
