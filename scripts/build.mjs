import { mkdir,cp,readFile } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await build({entryPoints:['src/app.js'],bundle:true,format:'esm',outfile:'dist/app.js',minify:true,target:'es2022'});
console.log('Built 8 worksheet pages and original Excel template.');
